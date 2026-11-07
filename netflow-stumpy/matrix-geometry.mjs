import {analyzeGeometry,causalAtr,classifyBreakoutRetest} from './geometry.mjs?v=20261107-matrix-lines1';
import {weightedPriceBands,directionalVolumeDelta} from './engine.mjs?v=20261105-spyv-h1-1';
import {lockedH1Blocks,scoreH1Box,h1ScoreBars} from './h1-box-score.mjs?v=20261107-outside-fast1';
import {buildH1Matrix,matrixOptions} from './h1-matrix-state.mjs?v=20261107-matrix-short-label1';
import {oiCandleBars} from './oi-candle-bars.mjs?v=20261104-oi-p62-1';

export const MATRIX_GEOMETRY_VERSION='matrix-lines-v1';
const M15=900000,H1=3600000,finite=Number.isFinite;
const clamp=x=>Math.max(0,Math.min(1,x));
const at=(line,index)=>line.startValue+line.slope*(index-line.startIndex);
const average=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);

// Same component definitions as the visible score matrix. Never use its capped
// total as a second vote, and never use the three-M15 preview for geometry.
export function geometryScoreRecords({price=[],flow=[],h1CandleColors=[],oiByTime=new Map(),now=Date.now()}){
  const bars=price.filter(b=>b.end<now),deltas=directionalVolumeDelta(bars,M15);
  const oi=oiByTime instanceof Map?oiByTime:new Map();
  const points=oiCandleBars(bars,deltas,flow,oi,M15,now,{filterPin:true,history:true,minOiMultiplier:1,oiPercentile:.62}).points;
  const inputs={bands:new Map(weightedPriceBands(bars,M15).map(r=>[r.t,r])),deltas:new Map(deltas.map(r=>[r.t,r])),flows:new Map(flow.map(r=>[r.t,r])),oi,oiPoints:points,now};
  return lockedH1Blocks(new Map(h1CandleColors.map(s=>[s.t,s])),now,Infinity,220).map(block=>scoreH1Box(block,{...inputs,bars:h1ScoreBars(bars,block.blockStart)})).filter(Boolean);
}

export function geometryMatrixAt(records,asOf,options={}){
  const eligible=records.filter(r=>r.status!=='PREVIEW'&&r.closedBars===4&&r.blockEnd<asOf&&(r.asOf??r.blockEnd+1)<=asOf);
  const matrix=buildH1Matrix(eligible,options),group=matrix.groups.at(-1);
  const expectedEnd=Math.floor(asOf/H1)*H1-1,last=eligible.at(-1);
  const fresh=last?.blockEnd===expectedEnd;
  return {...matrix,group,fresh,asOf,latestEnd:last?.blockEnd??null};
}

export function matrixLineEvidence(matrix,direction){
  const columns=matrix.columns.slice(-matrix.options.size);
  const weights={position:.25,slope:.2,deltaNF:.25,oi:.2,randomWalk:.1};
  let signed=0,known=0;
  for(const c of columns)for(const [key,w] of Object.entries(weights))if(finite(c.values[key])){signed+=w*direction*c.values[key];known+=w;}
  const confirmed=matrix.fresh&&matrix.group?.state===(direction>0?'UP':'DOWN');
  const weak=matrix.group?.state===(direction>0?'UP_WEAK':'DOWN_WEAK');
  const missingOI=!columns.length||columns.some(c=>!finite(c.values.oi));
  return {direction,signed:matrix.fresh&&known?signed/known:0,coverage:known/Math.max(1,columns.length),confirmed,weak,missingOI,fresh:matrix.fresh,state:matrix.group?.state??'WAIT',text:matrix.group?.text??'Chưa đủ hộp'};
}

export function breakoutPressure(line,bars,atr){
  const i=bars.length-1,scale=atr[i],d=line.kind==='resistance'?1:-1;
  if(i<7||!(scale>0)||line.knownAt>bars[i].t)return {ready:false,near:false,compressing:false};
  const sample=bars.slice(-8),start=i-7;
  const distances=sample.map((b,j)=>d*(at(line,start+j)-b.c)/scale);
  const inside=distances.at(-1)>=-.08,near=inside&&distances.at(-1)<=.8;
  const old=average(distances.slice(0,4)),recent=average(distances.slice(4));
  const oldRange=Math.max(...sample.slice(0,4).map(b=>b.h))-Math.min(...sample.slice(0,4).map(b=>b.l));
  const newRange=Math.max(...sample.slice(4).map(b=>b.h))-Math.min(...sample.slice(4).map(b=>b.l));
  const approaching=old>.1&&recent<=old*.8,compressing=oldRange>0&&newRange<=oldRange*.8;
  return {ready:near&&(approaching||compressing),near,compressing,approaching,distanceATR:distances.at(-1),rangeRatio:oldRange?newRange/oldRange:null};
}

function familyId(lines){return lines.map(l=>l.kind+':'+l.anchors.map(a=>a.t).join(',')).join('|');}
function offsetLine(line,offset){return {...line,startIndex:line.startIndex+offset,endIndex:line.endIndex+offset,anchors:line.anchors.map(a=>({...a,index:a.index+offset}))};}
function families(geometry,offset){
  const lines=geometry.referenceLines??geometry.lines;
  const classic=lines.filter(l=>l.source!=='pattern').map(l=>({type:'classic',rails:[offsetLine(l,offset)]}));
  const wedges=(geometry.patterns??[]).map(p=>({...p,type:'wedge',rails:p.rails.map(l=>offsetLine(l,offset))}));
  return [...classic,...wedges].map(f=>({...f,id:familyId(f.rails),rank:Math.max(...f.rails.map(l=>l.score))}));
}
function project(f,bars,index){return {...f,rails:f.rails.map(l=>({...l,endIndex:index,endTime:bars[index].t,endValue:at(l,index)}))};}
function duplicate(a,b,index,scale){return a.type===b.type&&a.rails.length===b.rails.length&&a.rails.every((l,j)=>l.kind===b.rails[j].kind&&Math.abs(at(l,index)-at(b.rails[j],index))<.3*scale&&Math.abs(l.slope-b.rails[j].slope)<.04*scale);}
function labelFor(line,evidence,pressure,armed){
  const base=line.kind==='resistance'?'KC':'HT',arrow=line.kind==='resistance'?'↑':'↓';
  if(!evidence.fresh)return `${base} · ${armed?'chờ phá · ':''}thiếu H1`;
  if(evidence.missingOI)return `${base} · ${armed?'chờ phá · ':''}thiếu OI`;
  if(evidence.weak)return `${base} · lực suy yếu`;
  return evidence.confirmed&&pressure.ready?`${base} · nén ${arrow}`:`${base} · ${armed?'chờ phá':'theo dõi'}`;
}
function annotate(f,bars,index,atr,matrix,armed=false){
  const projected=project(f,bars,index);
  const rails=projected.rails.map(l=>{
    const evidence=matrixLineEvidence(matrix,l.kind==='resistance'?1:-1),pressure=breakoutPressure(l,bars.slice(0,index+1),atr.slice(0,index+1));
    const geometryScore=l.geometryScore??l.score,rankScore=Math.max(0,Math.min(100,Math.round(.8*geometryScore+20*(.5+.5*evidence.signed))));
    return {...l,geometryScore,rankScore,score:geometryScore,matrixEvidence:evidence,pressure,setupLabel:f.type==='wedge'?`Nêm · ${armed?'chờ phá':'theo dõi'}${evidence.missingOI?' · thiếu OI':''}`:labelFor(l,evidence,pressure,armed),setupState:armed?'ARMED':'WATCH',armedAt:f.armedAt??null};
  });
  return {...projected,rails,rank:Math.max(...rails.map(l=>l.rankScore)),ready:rails.some(l=>l.pressure.ready)};
}
function confirmDirections(input,time){
  const flow=input.flow.findLast(r=>r.t===time),v=input.volume.findLast(r=>r.t===time);
  return {strengthDirection:Math.sign(flow?.adjusted??0),flowDirection:Math.sign(flow?.nf??0),volumeDirection:Math.sign(v?.adjusted??0)};
}

/** Deterministic bounded prefix replay. An armed family's slope and anchors are
 * copied once. New candidates cannot refit it, even after a breakout candle. */
export function replayMatrixGeometry(input,records,options={},candidateBuilder=null){
  const full=input.price,offset=Math.max(0,full.length-800),bars=full.slice(offset),atr=causalAtr(bars);
  const limit=Math.max(4,Number(options.maxLines)||4),classicBudget=Math.ceil(limit/2),wedgeBudget=Math.floor(Math.floor(limit/2)/2);
  const quotas={classic:classicBudget,wedge:wedgeBudget},armed=[],seen=new Set(),events=[];
  let pool=[],lastRefresh=-1,lastMatrixKey='',matrix=null;
  const first=Math.max(24,bars.length-600);
  const saved=options.replayState,positions=new Map(bars.map((b,i)=>[b.t,i]));let start=first;
  // Worker memory carries armed anchors across live updates, including when
  // the bounded history window slides. OI backfill never refits those anchors.
  if(saved?.version===MATRIX_GEOMETRY_VERSION&&positions.has(saved.lastTime)&&bars[positions.get(saved.lastTime)].c===saved.lastClose&&saved.lastTime<=bars.at(-1).t){
    const rebase=f=>{
      if(!positions.has(f.armedAt-M15)&&f.armedAt!==undefined)return null;
      if(f.rails.some(l=>!positions.has(l.startTime)))return null;
      return {...f,armedIndex:f.armedAt===undefined?undefined:positions.get(f.armedAt-M15),pendingIndex:f.pendingTime===undefined?undefined:positions.get(f.pendingTime),terminalIndex:f.terminalTime===undefined?undefined:positions.get(f.terminalTime),rails:f.rails.map(l=>({...l,startIndex:positions.get(l.startTime),endIndex:positions.get(l.endTime)??bars.length-1,anchors:l.anchors.map(a=>({...a,index:positions.get(a.t)??a.index}))}))};
    };
    armed.push(...saved.armed.map(rebase).filter(Boolean));pool=saved.pool.map(rebase).filter(Boolean);
    for(const id of saved.seen)seen.add(id);
    events.push(...saved.points.filter(e=>positions.has(e.at)).map(e=>({...e,index:positions.get(e.at)+offset})));
    start=Math.max(first,positions.get(saved.lastTime)+1);
    matrix=geometryMatrixAt(records,(bars.at(-1).end??bars.at(-1).t+M15-1)+1,options.matrixOptions);
  }
  for(let i=start;i<bars.length;i++){
    const asOf=(bars[i].end??bars[i].t+M15-1)+1,key=Math.floor(asOf/H1);
    if(key!==lastMatrixKey){matrix=geometryMatrixAt(records,asOf,options.matrixOptions);lastMatrixKey=key;}
    const scale=atr[i];if(!(scale>0))continue;
    const prefix=bars.slice(0,i+1),time=bars[i].t;
    // Read state before creating new lines: a breakout can only concern a line
    // that was armed on an earlier closed bar.
    for(let j=armed.length-1;j>=0;j--){
      const f=armed[j],crossed=f.type==='wedge'&&at(f.rails[1],i)<=at(f.rails[0],i);
      if(crossed||i-f.armedIndex>96||(f.terminalIndex!==undefined&&i-f.terminalIndex>8)||(f.pendingBreak&&i-f.pendingIndex>8)){armed.splice(j,1);continue;}
      const breached=f.rails.find(l=>(l.kind==='resistance'?1:-1)*(bars[i].c-at(l,i))>.35*scale);
      if(breached&&!f.event){f.pendingBreak=true;f.pendingDirection=breached.kind==='resistance'?1:-1;f.pendingTime??=time;f.pendingIndex??=i;}
      const result=classifyBreakoutRetest(prefix,f.rails,confirmDirections(input,time));
      if(result&&['true_break','strong_break','false_break'].includes(result.key)&&f.lastEvent!==result.key){
        const evidence=matrixLineEvidence(matrix,result.breakDirection);
        if(result.key!=='false_break'&&!evidence.confirmed){f.pendingBreak=true;f.pendingDirection=result.breakDirection;continue;}
        f.lastEvent=result.key;f.terminalIndex=i;f.terminalTime=time;f.pendingBreak=false;
        const event={...result,label:result.key==='false_break'?'Phá giả':`Phá ${result.direction>0?'↑':'↓'} · xn`,at:time,index:i+offset,lineValue:result.lineValue,matrixState:evidence.state,matrixAsOf:matrix.asOf,armedAt:f.armedAt,confidence:undefined};
        events.push(event);f.event=event;
      }
    }
    if(lastRefresh<0||key!==Math.floor(((bars[lastRefresh].end??bars[lastRefresh].t+M15-1)+1)/H1)){
      const from=Math.max(0,i-199),part={...input,price:bars.slice(from,i+1),h1CandleColors:(input.h1CandleColors??[]).filter(s=>s.t<=time)};
      const candidates=candidateBuilder?candidateBuilder(part,options,i):analyzeGeometry(part,{...options,maxLines:Math.max(12,limit*3)});
      pool=families(candidates,from);lastRefresh=i;
    }
    const ranked=pool.filter(f=>!seen.has(f.id)).map(f=>annotate(f,bars,i,atr,matrix)).sort((a,b)=>b.rank-a.rank);
    for(const f of ranked){
      if(!f.ready||armed.filter(a=>a.type===f.type).length>=quotas[f.type]||armed.some(a=>duplicate(a,f,i,scale)))continue;
      // Both wedge rails must still enclose price. No post-breakout arming.
      if(f.rails.some(l=>l.kind==='resistance'?bars[i].c>at(l,i)+.08*scale:bars[i].c<at(l,i)-.08*scale))continue;
      const locked={...f,armedAt:asOf,armedIndex:i,rails:f.rails.map(l=>({...l,knownAt:time,anchors:l.anchors.map(a=>({...a}))}))};
      seen.add(f.id);armed.push(locked);
    }
  }
  const index=bars.length-1;if(index<first||!matrix)return {lines:[],patterns:[],points:[],breakout:null,selectionBudget:{classic:classicBudget,pattern:wedgeBudget*2},matrix:null};
  const active=armed.map(f=>annotate(f,bars,index,atr,matrix,true));
  // Distant structures remain WATCH candidates. They can move until armed;
  // watches never generate confirmed break notifications.
  const watches=pool.filter(f=>!seen.has(f.id)).map(f=>annotate(f,bars,index,atr,matrix)).sort((a,b)=>b.rank-a.rank);
  for(const f of watches){if(active.filter(a=>a.type===f.type).length>=quotas[f.type]||active.some(a=>duplicate(a,f,index,atr[index])))continue;if(f.type==='wedge'&&at(f.rails[1],index)<=at(f.rails[0],index))continue;active.push(f);}
  for(const f of active)for(const l of f.rails){
    if(f.event){l.setupLabel=f.event.label;l.setupState=f.event.key;}
    else if(f.pendingBreak){l.setupLabel=`Phá ${f.pendingDirection>0?'↑':'↓'} · chờ xn`;l.setupState='BREAK_WAIT';}
    // Restore full-array indices for consumers; prices/timestamps unchanged.
    l.startIndex+=offset;l.endIndex+=offset;l.anchors=l.anchors.map(a=>({...a,index:a.index+offset}));
  }
  const points=events.slice(-4).map(({line,...e})=>e);
  const replayState={version:MATRIX_GEOMETRY_VERSION,lastTime:bars.at(-1).t,lastClose:bars.at(-1).c,armed,pool,seen:[...seen].slice(-512),points};
  return {lines:active.flatMap(f=>f.rails),patterns:active.filter(f=>f.type==='wedge'),points,breakout:events.at(-1)?.at===bars.at(-1).t?events.at(-1):null,selectionBudget:{classic:classicBudget,pattern:wedgeBudget*2},matrix:{asOf:matrix.asOf,state:matrix.group?.state,fresh:matrix.fresh,options:matrix.options},replayBars:Math.max(0,bars.length-start),replayState};
}

export function analyzeMatrixGeometry(input,options={}){
  const base=analyzeGeometry(input,options),now=(input.price.at(-1)?.end??0)+1;
  const records=geometryScoreRecords({...input,now:now+1});
  const replay=replayMatrixGeometry(input,records,options);
  return {...base,...replay,referenceLines:replay.lines,provisionalLines:[],matrixVersion:MATRIX_GEOMETRY_VERSION,scoreRecords:records.length,summary:{...base.summary,support:replay.lines.filter(l=>l.kind==='support').length,resistance:replay.lines.filter(l=>l.kind==='resistance').length}};
}
