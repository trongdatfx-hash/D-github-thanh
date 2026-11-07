// Display-only: one sample per H1 score, known only at its closing timestamp.
const H=3600000,M=900000,finite=Number.isFinite;
const validScore=r=>Number.isInteger(r?.score)&&Math.abs(r.score)<=5&&Array.isArray(r.missing)&&r.missing.length===0;
function smooth(score,previous){
  const alpha=previous===null?1:score*previous<0&&Math.abs(score)>=2?.9:.75;
  return {value:previous===null?score:alpha*score+(1-alpha)*previous,alpha};
}
export function buildH1ScoreLine(records,{now=Date.now()}={}){
  const points=[],timeline=[],closed=new Map();let previous=null,previousTime=null;
  for(const r of records){
    if(!finite(r?.blockStart)||r.blockEnd!==r.blockStart+H-1||r.status==='PREVIEW'||r.closedBars===3||r.blockEnd+1>now)continue;
    const old=closed.get(r.blockStart);if(!old||r.status==='LOCKED')closed.set(r.blockStart,r);
  }
  const gap=time=>{points.push({time:time/1000});timeline.push({t:time,score:null,smoothed:null,preview:false});previous=null;};
  for(const r of [...closed.values()].sort((a,b)=>a.blockStart-b.blockStart)){
    const time=r.blockEnd+1;
    if(previousTime!==null&&time-previousTime!==H)gap(previousTime+H);
    previousTime=time;
    if(r.status!=='LOCKED'||r.closedBars!==4||r.lockedAt!==time||!validScore(r)||(r.asOf??time)>time){gap(time);continue;}
    const s=smooth(r.score,previous);previous=s.value;
    points.push({time:time/1000,value:s.value/5});
    timeline.push({t:time,score:r.score,smoothed:s.value,alpha:s.alpha,preview:false,blockStart:r.blockStart});
  }
  const previewRecord=records.filter(r=>r?.status==='PREVIEW'&&r.closedBars===3&&validScore(r)&&r.blockEnd===r.blockStart+H-1&&r.asOf===r.blockStart+3*M&&r.asOf<=now&&now<r.blockStart+H).sort((a,b)=>a.blockStart-b.blockStart).at(-1);
  const preview=[];let previewMeta=null;
  if(previewRecord){
    const anchor=timeline.at(-1),continuous=anchor?.t===previewRecord.blockStart&&finite(anchor.smoothed);
    const s=smooth(previewRecord.score,continuous?anchor.smoothed:null);
    if(continuous)preview.push({time:anchor.t/1000,value:anchor.smoothed/5});
    preview.push({time:previewRecord.asOf/1000,value:s.value/5});
    previewMeta={t:previewRecord.asOf,score:previewRecord.score,smoothed:s.value,alpha:s.alpha,preview:true,blockStart:previewRecord.blockStart};
  }
  return {points,preview,timeline,previewMeta};
}
export function h1ScoreLineReading(state,asOf){
  if(!finite(asOf))return null;
  const closed=state.timeline.findLast(r=>r.t<=asOf);
  return state.previewMeta?.t<=asOf&&(!closed||state.previewMeta.t>closed.t)?state.previewMeta:closed??null;
}
