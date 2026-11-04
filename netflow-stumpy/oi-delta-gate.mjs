// R7 linear interpolation, matching the research example.
function quantile(values,p){const sorted=[...values].sort((a,b)=>a-b),h=(sorted.length-1)*p,lo=Math.floor(h),hi=Math.ceil(h);return sorted[lo]+(sorted[hi]-sorted[lo])*(h-lo);}
// A candle compares only with preceding closed periods; today's spike never
// enters its own baseline. Missing periods reset the ten-delta warmup.
export function oiDeltaGates(oiByTime,step,now,{window=10,multiplier=1,percentile=.62}={}){
  const output=new Map(),history=[];let previous=null;
  if(!(step>0)||!Number.isFinite(now)||!Number.isInteger(window)||window<1||!(multiplier>0)||!Number.isFinite(percentile)||percentile<0||percentile>1)return output;
  for(const [t,point] of [...oiByTime].sort((a,b)=>a[0]-b[0])){
    if(!Number.isFinite(t)||t+step>now||!Number.isFinite(point?.oi)||point.oi<=0)continue;
    if(!previous||t-previous.t!==step){history.length=0;previous={t,oi:point.oi};continue;}
    const delta=Math.abs(point.oi-previous.oi),ready=history.length===window,baseline=ready?quantile(history,percentile):null,threshold=ready?baseline*multiplier:null;
    output.set(t,{ready,baseline,threshold,passed:ready&&delta>threshold});
    history.push(delta);if(history.length>window)history.shift();
    previous={t,oi:point.oi};
  }
  return output;
}
