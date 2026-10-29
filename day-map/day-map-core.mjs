const DAY_START=4*60,PRE_END=9*60+30,DAY_END=16*60,SLOTS=48;
const PATH_SLOTS=[0,8,16,21,25,31,39,47];
const PATH_WEIGHTS=PATH_SLOTS.map(()=>0.55);
const EXTRA_WEIGHTS=[1,1,1,1,1.1,1,1,1,1,1.1,1,1,1];

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const fmtDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

export function nyClock(t){
  const p=Object.fromEntries(fmtDay.formatToParts(t).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute),weekday:p.weekday};
}

export function weightedQuantile(values,weights,p){
  const pairs=values.map((value,i)=>({value,weight:Math.max(0,weights[i]??0)})).filter(x=>Number.isFinite(x.value)&&x.weight>0).sort((a,b)=>a.value-b.value);
  const total=pairs.reduce((s,x)=>s+x.weight,0);if(!pairs.length||total<=0)return null;
  const target=clamp(p,0,1)*total;let cumulative=0;
  for(const pair of pairs){cumulative+=pair.weight;if(cumulative>=target)return pair.value;}
  return pairs.at(-1).value;
}

function latestByDay(map,day,endMinute,{activeOnly=false}={}){
  let latest=null;
  for(const value of map?.values?.()??[]){
    const t=value.t??value.asOf??value.right;if(!Number.isFinite(t))continue;
    const clock=nyClock(t);if(clock.day!==day||clock.minute<DAY_START||clock.minute>=endMinute)continue;
    if(activeOnly&&value.active!==true)continue;
    if(!latest||t>(latest.t??latest.asOf??latest.right))latest=value;
  }
  return latest;
}

function alignmentValue(value){return value==='aligned'?1:value==='opposed'?-1:0;}
function finite(value,fallback=0){return Number.isFinite(value)?value:fallback;}

function buildH1Blocks(rows,boxSnapshots,trendMap){
  const blocks=[];let previousImpulse=0;
  for(let offset=0;offset+3<rows.length;offset+=4){
    const sample=rows.slice(offset,offset+4),first=sample[0],last=sample.at(-1),o=first.o,c=last.c,h=Math.max(...sample.map(x=>x.h)),l=Math.min(...sample.map(x=>x.l)),range=Math.max(1e-12,h-l);
    const box=[...sample].reverse().map(x=>boxSnapshots?.get?.(x.t)).find(Boolean)??null,trend=[...sample].reverse().map(x=>trendMap.get(x.t)).find(x=>x?.active===true)??null;
    const boxDirection=[-1,1].includes(box?.direction)?box.direction:0,trendDirection=[-1,1].includes(trend?.direction)?trend.direction:0,priceDirection=Math.abs(c-o)>=.08*range?Math.sign(c-o):0;
    const vote=.55*priceDirection+.25*boxDirection+.20*trendDirection,direction=Math.abs(vote)>=.30?Math.sign(vote):0;
    const meanRange=sample.reduce((s,x)=>s+x.h-x.l,0)/sample.length,priceScore=clamp(Math.abs(c-o)/Math.max(1e-12,meanRange),0,1);
    const quote=sample.reduce((s,x)=>s+Math.max(0,finite(x.q)),0),net=sample.reduce((s,x)=>s+(Number.isFinite(x.net)?x.net:Number.isFinite(x.q)&&Number.isFinite(x.buy)?2*x.buy-x.q:0),0);
    const bodyDelta=sample.reduce((s,x)=>{const delta=Number.isFinite(x.net)?x.net:Number.isFinite(x.q)&&Number.isFinite(x.buy)?2*x.buy-x.q:0;return s+Math.sign(x.c-x.o)*Math.abs(delta);},0);
    const deltaScore=direction&&quote?clamp(direction*bodyDelta/quote*4,0,1):0,nfScore=direction&&quote?clamp(direction*net/quote*4,0,1):0;
    const structural=[boxDirection,trendDirection].filter(Boolean),alignment=direction&&structural.length?structural.reduce((s,x)=>s+(x===direction?1:0),0)/structural.length:0;
    const impulse=.30*priceScore+.20*deltaScore+.20*nfScore+.20*alignment,strengthening=impulse>previousImpulse?1:0,score=100*(impulse+.10*strengthening);previousImpulse=impulse;
    blocks.push({t:first.t,end:last.end??last.t+899999,day:nyClock(first.t).day,minute:nyClock(first.t).minute,o,h,l,c,range,direction,quality:clamp(score/100,0,1),score,priceScore,deltaScore,nfScore,alignment,strengthening,box,trend,quote,net,bodyDelta,
      feature:[direction,score/100,priceScore,deltaScore,nfScore,alignment,strengthening,100*(c/o-1),100*range/o,finite(box?.percentile,.5)-.5,finite(trend?.continuation,.5)-.5]});
  }
  return blocks;
}

function makeFeatures(day){
  const box=day.box??{},encoding=box.encoding??{},trend=day.trend??{};
  const ruleScore=finite(encoding.ruleScore)/100,boxPercentile=finite(box.percentile,.5)-.5;
  return [
    ...PATH_SLOTS.map(i=>finite(day.path[i])),
    day.preMove,day.rthMove,day.range,day.closeLocation,
    finite(box.direction),boxPercentile,clamp(finite(box.efficiency),-4,4),clamp(finite(box.channelBars)/16,0,3),
    ruleScore,alignmentValue(box.compositeAlignment),
    finite(trend.direction),clamp(finite(trend.currentBars)/16,0,3),finite(trend.continuation,.5)-.5
  ];
}

export function buildDailyMaps({priceRows=[],boxSnapshots=new Map(),trendStates=[]}={}){
  const groups=new Map(),trendMap=new Map(trendStates.filter(x=>Number.isFinite(x?.t)).map(x=>[x.t,x]));
  for(const row of priceRows){
    const clock=nyClock(row.t);
    if(['Sat','Sun'].includes(clock.weekday)||clock.minute<DAY_START||clock.minute>=DAY_END)continue;
    if(!groups.has(clock.day))groups.set(clock.day,[]);
    groups.get(clock.day).push({...row,minute:clock.minute});
  }
  const days=[];
  for(const [day,unsorted] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    const rows=unsorted.sort((a,b)=>a.t-b.t);
    if(rows.length!==SLOTS||rows[0].minute!==DAY_START||rows.at(-1).minute!==DAY_END-15)continue;
    const preOpen=rows[0].o,rthOpen=rows.find(x=>x.minute===PRE_END)?.o;
    if(!(preOpen>0&&rthOpen>0))continue;
    const pct=value=>100*(value/preOpen-1),path=rows.map(x=>pct(x.c));
    const rth=rows.filter(x=>x.minute>=PRE_END),high=Math.max(...rth.map(x=>x.h)),low=Math.min(...rth.map(x=>x.l));
    const lastActiveTrend=[...rows].reverse().map(x=>trendMap.get(x.t)).find(x=>x?.active===true)??null;
    const directBox=[...rows].reverse().map(x=>boxSnapshots.get(x.t)).find(Boolean)??latestByDay(boxSnapshots,day,DAY_END);
    const close=rows.at(-1).c,range=100*(high-low)/preOpen,closeLocation=high>low?(close-low)/(high-low)-.5:0;
    const item={day,rows,preOpen,rthOpen,path,preMove:path[21],rthMove:100*(close/rthOpen-1),dayMove:path.at(-1),range,closeLocation,
      rthHigh:100*(high/preOpen-1),rthLow:100*(low/preOpen-1),box:directBox??null,trend:lastActiveTrend,feature:null,next:null};
    item.h1Blocks=buildH1Blocks(rows,boxSnapshots,trendMap);
    item.feature=makeFeatures(item);days.push(item);
  }
  for(let i=0;i<days.length-1;i++)days[i].next=days[i+1];
  return days;
}

function standardizer(rows){
  const n=rows[0]?.feature.length??0,mu=Array(n).fill(0),sd=Array(n).fill(0);
  for(const row of rows)for(let j=0;j<n;j++)mu[j]+=row.feature[j]/rows.length;
  for(const row of rows)for(let j=0;j<n;j++)sd[j]+=(row.feature[j]-mu[j])**2;
  for(let j=0;j<n;j++)sd[j]=Math.sqrt(sd[j]/Math.max(1,rows.length-1))||1;
  return {mu,sd};
}

function normalizedFeature(row,{mu,sd}){return row.feature.map((x,i)=>(x-mu[i])/sd[i]);}
function distance(a,b){
  const weights=[...PATH_WEIGHTS,...EXTRA_WEIGHTS];let total=0,den=0;
  for(let i=0;i<a.length;i++){const w=weights[i]??1;total+=w*(a[i]-b[i])**2;den+=w;}
  return Math.sqrt(total/Math.max(1,den));
}

function envelope(paths,weights){
  return Array.from({length:SLOTS},(_,slot)=>({
    p10:weightedQuantile(paths.map(x=>x[slot]),weights,.10),
    p25:weightedQuantile(paths.map(x=>x[slot]),weights,.25),
    p50:weightedQuantile(paths.map(x=>x[slot]),weights,.50),
    p75:weightedQuantile(paths.map(x=>x[slot]),weights,.75),
    p90:weightedQuantile(paths.map(x=>x[slot]),weights,.90)
  }));
}

export function similarDayForecast(days,index,{k=20,minSamples=12,deadband=.15}={}){
  const current=days[index];if(!current)return {ready:false,reason:'Không có ngày được chọn'};
  const candidates=days.slice(0,index).filter(x=>x.next);
  if(candidates.length<minSamples)return {ready:false,reason:`Chỉ có ${candidates.length}/${minSamples} ngày quá khứ có kết quả ngày kế tiếp`,current,candidates:[]};
  const scale=standardizer(candidates),target=normalizedFeature(current,scale);
  const ranked=candidates.map(day=>({day,distance:distance(normalizedFeature(day,scale),target)})).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(k,candidates.length));
  const bandwidth=ranked[Math.floor(ranked.length/2)]?.distance||1,rawWeights=ranked.map(x=>Math.exp(-.5*(x.distance/Math.max(.05,bandwidth))**2)),sum=rawWeights.reduce((a,b)=>a+b,0)||1,weights=rawWeights.map(x=>x/sum);
  const nextPaths=ranked.map(x=>x.day.next.path),todayPaths=ranked.map(x=>x.day.path),closes=ranked.map(x=>x.day.next.dayMove),highs=ranked.map(x=>x.day.next.rthHigh),lows=ranked.map(x=>x.day.next.rthLow);
  const neff=1/weights.reduce((s,w)=>s+w*w,0),weightedUp=weights.reduce((s,w,i)=>s+w*(closes[i]>deadband?1:0),0),weightedDown=weights.reduce((s,w,i)=>s+w*(closes[i]<-deadband?1:0),0);
  const prior=20,up=(weightedUp*neff+prior*.5)/(neff+prior),down=(weightedDown*neff+prior*.5)/(neff+prior);
  const close={p10:weightedQuantile(closes,weights,.1),p50:weightedQuantile(closes,weights,.5),p90:weightedQuantile(closes,weights,.9)};
  const weightedMean=weights.reduce((s,w,i)=>s+w*closes[i],0),variance=weights.reduce((s,w,i)=>s+w*(closes[i]-weightedMean)**2,0),se=Math.sqrt(variance/Math.max(1,neff));
  const edge=Math.max(up,down)-.5,direction=up>down?1:-1,effect=direction*close.p50,rangeExcludesZero=close.p10>0||close.p90<0;
  const evidence=Math.min(1,neff/50)*Math.min(1,Math.max(0,edge)/.10)*(rangeExcludesZero?1:.55),confidence=Math.round(100*evidence);
  const label=neff>=minSamples&&Math.max(up,down)>=.56&&effect>0&&Math.abs(close.p50)>=2*se&&rangeExcludesZero?(direction>0?'UP':'DOWN'):'WAIT';
  return {ready:true,current,ranked:ranked.map((x,i)=>({...x,weight:weights[i]})),n:ranked.length,neff,up,down,label,confidence,wait:100-confidence,referenceOnly:neff<50,
    todayEnvelope:envelope(todayPaths,weights),nextEnvelope:envelope(nextPaths,weights),close,
    high:{p10:weightedQuantile(highs,weights,.1),p50:weightedQuantile(highs,weights,.5),p90:weightedQuantile(highs,weights,.9)},
    low:{p10:weightedQuantile(lows,weights,.1),p50:weightedQuantile(lows,weights,.5),p90:weightedQuantile(lows,weights,.9)},
    diagnostics:{weightedMean,se,rangeExcludesZero,candidates:candidates.length,deadband}};
}

function directionOf(value){return value>0?1:value<0?-1:0;}
function overlapRatio(a0,a1,b0,b1){
  if(![a0,a1,b0,b1].every(Number.isFinite)||a1<=a0||b1<=b0)return 0;
  return clamp((Math.min(a1,b1)-Math.max(a0,b0))/Math.min(a1-a0,b1-b0),0,1);
}

function macroObservation(block,index){
  return {index,t:block.t,day:block.day,minute:block.minute,direction:block.direction,quality:block.quality,lower:block.l,upper:block.h,ageBars:4,sourceBlock:block};
}

function h1Units(days){
  const units=[],dayLastStateIndex=[];
  days.forEach((day,dayIndex)=>{
    for(const block of day.h1Blocks??[]){units.push({...block,sourceDay:day,dayIndex});dayLastStateIndex[dayIndex]=units.length-1;}
  });
  return {units,dayLastStateIndex};
}

function macroFeature(state){
  const block=state.sourceBlock?.feature??[];
  return [
    state.ageH1,Math.log1p(state.ageBars),state.evidence/state.ageH1,state.overlapAverage,state.widthPct,state.ageDays,
    state.observation.quality,...block
  ];
}

// Builds a causal higher-timeframe ledger from locked, non-overlapping H1
// packets. M15 remains the fast input; only four closed M15 candles can add age.
export function buildAdditiveMacroMap(days,{minQuality=.25,neutralBridge=1}={}){
  const {units,dayLastStateIndex}=h1Units(days),states=[],episodes=[];let active=null,serial=0;
  const finish=(endIndex,censored=false)=>{
    if(!active)return;
    const episode={id:active.id,direction:active.direction,startIndex:active.startIndex,endIndex,started:active.started,ended:units[endIndex]?.day??active.started,finalAgeH1:active.ageH1,finalAgeDays:active.days.size,finalAgeBars:active.ageBars,finalEvidence:active.evidence,lower:active.lower,upper:active.upper,startAnchor:active.startAnchor,censored};
    episode.finalWidthPct=episode.startAnchor>0?100*(episode.upper-episode.lower)/episode.startAnchor:null;episodes.push(episode);active=null;
  };
  for(let index=0;index<units.length;index++){
    const unit=units[index],observation=macroObservation(unit,index),qualified=observation.direction!==0&&observation.quality>=minQuality&&observation.upper>observation.lower;
    if(qualified&&(!active||observation.direction!==active.direction)){
      if(active)finish(active.lastContributionIndex,false);
      active={id:++serial,direction:observation.direction,startIndex:index,started:unit.day,startAnchor:unit.o,ageH1:0,spanH1:0,ageBars:0,days:new Set(),evidence:0,lower:null,upper:null,overlapSum:0,overlapN:0,neutralH1:0,lastContributionIndex:index};
    }
    if(qualified&&active&&observation.direction===active.direction){
      const overlap=active.lower===null?1:overlapRatio(active.lower,active.upper,observation.lower,observation.upper),increment=observation.quality*(.65+.35*overlap);
      active.ageH1++;active.spanH1++;active.ageBars+=4;active.days.add(unit.day);active.evidence+=increment;active.overlapSum+=overlap;active.overlapN++;active.lower=active.lower===null?observation.lower:Math.min(active.lower,observation.lower);active.upper=active.upper===null?observation.upper:Math.max(active.upper,observation.upper);active.neutralH1=0;active.lastContributionIndex=index;
      const widthPct=active.startAnchor>0?100*(active.upper-active.lower)/active.startAnchor:null;
      states.push({index,t:unit.t,day:unit.day,minute:unit.minute,active:true,carried:false,episodeId:active.id,direction:active.direction,ageH1:active.ageH1,spanH1:active.spanH1,ageDays:active.days.size,ageBars:active.ageBars,evidence:active.evidence,increment,overlap,overlapAverage:active.overlapSum/active.overlapN,lower:active.lower,upper:active.upper,widthPct,startAnchor:active.startAnchor,sourceDay:unit.sourceDay,sourceBlock:unit,observation,feature:null});
      states.at(-1).feature=macroFeature(states.at(-1));continue;
    }
    if(active&&active.neutralH1<neutralBridge){
      active.neutralH1++;active.spanH1++;
      const widthPct=active.startAnchor>0?100*(active.upper-active.lower)/active.startAnchor:null;
      states.push({index,t:unit.t,day:unit.day,minute:unit.minute,active:true,carried:true,episodeId:active.id,direction:active.direction,ageH1:active.ageH1,spanH1:active.spanH1,ageDays:active.days.size,ageBars:active.ageBars,evidence:active.evidence,increment:0,overlap:0,overlapAverage:active.overlapN?active.overlapSum/active.overlapN:0,lower:active.lower,upper:active.upper,widthPct,startAnchor:active.startAnchor,sourceDay:unit.sourceDay,sourceBlock:unit,observation,feature:null});
      states.at(-1).feature=macroFeature(states.at(-1));continue;
    }
    if(active)finish(active.lastContributionIndex,false);
    states.push({index,t:unit.t,day:unit.day,minute:unit.minute,active:false,carried:false,episodeId:null,direction:0,ageH1:0,spanH1:0,ageDays:0,ageBars:0,evidence:0,increment:0,overlap:0,overlapAverage:0,lower:null,upper:null,widthPct:null,startAnchor:unit.o,sourceDay:unit.sourceDay,sourceBlock:unit,observation,feature:[]});
  }
  if(active)finish(active.lastContributionIndex,true);
  const byId=new Map(episodes.map(episode=>[episode.id,episode]));
  for(const state of states)state.outcome=state.episodeId?byId.get(state.episodeId)??null:null;
  return {states,episodes,units,dayLastStateIndex};
}

function qset(values,weights){return {p10:weightedQuantile(values,weights,.10),p25:weightedQuantile(values,weights,.25),p50:weightedQuantile(values,weights,.50),p75:weightedQuantile(values,weights,.75),p90:weightedQuantile(values,weights,.90)};}

export function additiveMacroForecast(days,index,{k=20,minSamples=12}={}){
  const map=buildAdditiveMacroMap(days),stateIndex=map.dayLastStateIndex[index],current=map.states[stateIndex];
  if(!current?.active)return {ready:false,reason:'H1 cuối ngày được chọn chưa có chuỗi Hộp/Trend cùng chiều để cộng',current,map};
  const resolved=map.episodes.filter(episode=>!episode.censored&&episode.endIndex<stateIndex&&episode.direction===current.direction&&episode.finalAgeH1>=current.ageH1);
  const candidates=resolved.map(episode=>map.states.filter(state=>state.episodeId===episode.id&&!state.carried&&state.ageH1===current.ageH1).at(-1)).filter(Boolean);
  if(candidates.length<3)return {ready:false,reason:`Chỉ có ${candidates.length} chuỗi lịch sử cùng chiều sống đến tuổi H1=${current.ageH1}`,current,map,candidates};
  const scale=standardizer(candidates),target=normalizedFeature(current,scale),ranked=candidates.map(state=>({state,episode:state.outcome,distance:distance(normalizedFeature(state,scale),target)})).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(k,candidates.length));
  const bandwidth=ranked[Math.floor(ranked.length/2)]?.distance||1,raw=ranked.map(x=>Math.exp(-.5*(x.distance/Math.max(.05,bandwidth))**2)),total=raw.reduce((s,x)=>s+x,0)||1,weights=raw.map(x=>x/total),neff=1/weights.reduce((s,w)=>s+w*w,0);
  const outcomes=ranked.map(({state,episode})=>{const anchor=state.sourceBlock.o,finalWidthPct=100*(episode.upper-episode.lower)/anchor,currentWidthPct=100*(state.upper-state.lower)/anchor;return {remainingH1:episode.finalAgeH1-state.ageH1,finalAgeH1:episode.finalAgeH1,remainingDays:Math.max(0,episode.finalAgeDays-state.ageDays),finalAgeDays:episode.finalAgeDays,remainingBars:Math.max(0,episode.finalAgeBars-state.ageBars),finalAgeBars:episode.finalAgeBars,lowerPct:100*(episode.lower/anchor-1),upperPct:100*(episode.upper/anchor-1),growthPct:finalWidthPct-currentWidthPct,finalEvidence:episode.finalEvidence};});
  const growth=outcomes.map(x=>x.growthPct),expandThreshold=Math.max(.15,current.widthPct*.10),rawExpand=weights.reduce((s,w,i)=>s+w*(growth[i]>=expandThreshold?1:0),0),prior=20,expandProbability=(rawExpand*neff+prior*.5)/(neff+prior);
  const growthBand=qset(growth,weights),evidenceFactor=Math.min(1,neff/50),edge=Math.max(0,(expandProbability-.5)/.15),bandFactor=growthBand.p10>0?1:.55,confidence=Math.round(100*evidenceFactor*Math.min(1,edge)*bandFactor),referenceOnly=neff<50;
  const label=!referenceOnly&&ranked.length>=minSamples&&expandProbability>=.60&&growthBand.p10>0?(current.direction>0?'UP':'DOWN'):'WAIT';
  const currentTrack=map.states.filter(state=>state.episodeId===current.episodeId&&state.index<=stateIndex),anchor=current.startAnchor;
  return {ready:true,current,map,currentTrack,ranked:ranked.map((x,i)=>({...x,weight:weights[i],outcome:outcomes[i]})),n:ranked.length,neff,label,confidence,wait:100-confidence,referenceOnly,expandProbability,expandThreshold,
    box:{lower:qset(outcomes.map(x=>x.lowerPct),weights),upper:qset(outcomes.map(x=>x.upperPct),weights),growth:growthBand},
    age:{h1:{current:current.ageH1,final:qset(outcomes.map(x=>x.finalAgeH1),weights),remaining:qset(outcomes.map(x=>x.remainingH1),weights)},days:{current:current.ageDays,final:qset(outcomes.map(x=>x.finalAgeDays),weights),remaining:qset(outcomes.map(x=>x.remainingDays),weights)},bars:{current:current.ageBars,final:qset(outcomes.map(x=>x.finalAgeBars),weights),remaining:qset(outcomes.map(x=>x.remainingBars),weights)}},
    evidence:{current:current.evidence,final:qset(outcomes.map(x=>x.finalEvidence),weights)},anchor,diagnostics:{candidates:candidates.length,resolved:resolved.length}};
}

export function macroPcaProjection(days,index){
  const map=buildAdditiveMacroMap(days),stateIndex=map.dayLastStateIndex[index],rows=map.states.slice(0,stateIndex+1).filter(state=>state.active&&!state.carried);
  if(rows.length<3)return [];
  const scale=standardizer(rows),matrix=rows.map(row=>normalizedFeature(row,scale)),cov=covariance(matrix),first=eigenvector(cov,0),deflated=cov.map((row,i)=>row.map((x,j)=>x-first.value*first.v[i]*first.v[j])),second=eigenvector(deflated,1);
  return rows.map((state,i)=>({day:state.day,minute:state.minute,x:matrix[i].reduce((s,v,j)=>s+v*first.v[j],0),y:matrix[i].reduce((s,v,j)=>s+v*second.v[j],0),target:state.outcome&&!state.outcome.censored&&state.outcome.endIndex<stateIndex?state.outcome.finalWidthPct-state.widthPct:null,current:state.index===stateIndex,direction:state.direction}));
}

function covariance(matrix){
  const n=matrix.length,d=matrix[0]?.length??0,c=Array.from({length:d},()=>Array(d).fill(0));
  for(const row of matrix)for(let i=0;i<d;i++)for(let j=0;j<d;j++)c[i][j]+=row[i]*row[j]/Math.max(1,n-1);
  return c;
}
function multiply(matrix,vector){return matrix.map(row=>row.reduce((s,x,i)=>s+x*vector[i],0));}
function normalize(vector){const norm=Math.sqrt(vector.reduce((s,x)=>s+x*x,0))||1;return vector.map(x=>x/norm);}
function eigenvector(matrix,seed=0){
  let v=normalize(matrix.map((_,i)=>i===seed%matrix.length?1:.01));
  for(let k=0;k<80;k++)v=normalize(multiply(matrix,v));
  const mv=multiply(matrix,v),value=v.reduce((s,x,i)=>s+x*mv[i],0);return {v,value};
}
export function pcaProjection(days,index){
  const rows=days.slice(0,index+1);if(rows.length<3)return [];
  const scale=standardizer(rows),matrix=rows.map(x=>normalizedFeature(x,scale)),cov=covariance(matrix),first=eigenvector(cov,0);
  const deflated=cov.map((row,i)=>row.map((x,j)=>x-first.value*first.v[i]*first.v[j])),second=eigenvector(deflated,1);
  return rows.map((day,i)=>({day:day.day,x:matrix[i].reduce((s,v,j)=>s+v*first.v[j],0),y:matrix[i].reduce((s,v,j)=>s+v*second.v[j],0),target:day.next?.dayMove??null,current:i===rows.length-1}));
}

export const DAY_MAP_META={slots:SLOTS,startMinute:DAY_START,preEndMinute:PRE_END,endMinute:DAY_END,pathSlots:PATH_SLOTS};
