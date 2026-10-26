import {BOX_DEFAULTS,strengthBoxes,strengthBoxLabel,summarizeStrengthBox} from './strength-box-core.mjs?v=20261026-channel-box1';

// Display annotations of the channels currently drawn, not forecast snapshots.
// Closed-channel display qualification can be retrospective, just like its rails.
export function channelStrengthBoxes(rows,{channels=[],now=Infinity,step=900000,compositeRows=new Map(),compositeMode='annotate',compositeThreshold=.15}={}){
 const closed=rows.filter(r=>r.end<now),raw=strengthBoxes(closed,{now,step}),byTime=new Map(),trs=[];let previous=null,rma=null;
 for(let i=0;i<closed.length;i++){
  const r=closed[i],tr=Math.max(r.h-r.l,previous?Math.abs(r.h-previous.c):0,previous?Math.abs(r.l-previous.c):0);
  if(previous&&r.t-previous.t!==step){trs.length=0;rma=null;}
  trs.push(tr);if(trs.length>14)trs.shift();rma=rma===null?(trs.length===14?trs.reduce((a,b)=>a+b,0)/14:null):(13*rma+tr)/14;
  byTime.set(r.t,{...r,tr,index:i,atr:rma});previous=r;
 }
 const boxes=[];
 for(const c of [...channels].sort((a,b)=>a.confirmationTime-b.confirmationTime)){
  if(c.confirmed!==true||c.volumeQualified===false||c.displayQualified===false||![-1,1].includes(c.direction)||![c.startTime,c.confirmationTime,c.insideEndTime].every(Number.isFinite)||c.startTime>c.confirmationTime||c.confirmationTime>c.insideEndTime||c.confirmationTime+step>now)continue;
  const first=byTime.get(c.startTime),last=byTime.get(c.insideEndTime),confirmation=byTime.get(c.confirmationTime);if(!first||!last||!confirmation)continue;
  const entryComposite=compositeRows.get(c.confirmationTime)?.adjusted;
  if(compositeMode==='filter'&&!(Number.isFinite(entryComposite)&&entryComposite*c.direction>=compositeThreshold))continue;
  const seed=closed.slice(first.index,last.index+1).map(r=>byTime.get(r.t));if(seed.some((r,i)=>i&&r.t-seed[i-1].t!==step))continue;
  const b={id:c.confirmationTime,start:c.startTime,startIndex:first.index,right:last.t,rightIndex:last.index,entryTime:c.confirmationTime,issuedAt:c.confirmationTime+step,asOf:last.t,top:Math.max(...seed.map(r=>r.h)),bottom:Math.min(...seed.map(r=>r.l)),y0:first.c,direction:c.direction,phase:first.session??'—',maxStrength:null,live:c.provisional===true,open:c.provisional===true,freeze:null,n:0,tr2:0,sx:0,sy:0,sxy:0,sxx:0,syy:0,compositeMode,source:'causal-channel'};
  for(const r of seed){const x=r.index-first.index,y=r.c-first.c;b.n++;b.tr2+=r.tr*r.tr;b.sx+=x;b.sy+=y;b.sxy+=x*y;b.sxx+=x*x;b.syy+=y*y;const s=raw.strength.get(r.t);if(Number.isFinite(s))b.maxStrength=Math.max(b.maxStrength??0,Math.abs(s));}
  const v=compositeRows.get(last.t)?.adjusted;b.compositeStrength=Number.isFinite(v)?v:null;b.compositeAlignment=!Number.isFinite(v)?'missing':v*c.direction>=compositeThreshold?'aligned':v*c.direction<=-compositeThreshold?'opposed':'neutral';
  const box=summarizeStrengthBox(b,last.atr,null,BOX_DEFAULTS);box.label=strengthBoxLabel(box);boxes.push(box);
 }
 return {version:'causal-channel-strength-box-v1',boxes,latest:boxes.at(-1)??null,snapshots:new Map(),settings:{...BOX_DEFAULTS,trigger:'causal-channel',compositeMode,compositeThreshold}};
}
