// A candle compares only with preceding closed periods; today's spike never
// enters its own baseline. Missing periods reset the ten-delta warmup.
export function oiDeltaGates(oiByTime,step,now,{window=10,multiplier=1}={}){
  const output=new Map(),history=[];let previous=null,sum=0;
  if(!(step>0)||!Number.isFinite(now)||!Number.isInteger(window)||window<1||!(multiplier>0))return output;
  for(const [t,point] of [...oiByTime].sort((a,b)=>a[0]-b[0])){
    if(!Number.isFinite(t)||t+step>now||!Number.isFinite(point?.oi)||point.oi<=0)continue;
    if(!previous||t-previous.t!==step){history.length=0;sum=0;previous={t,oi:point.oi};continue;}
    const delta=Math.abs(point.oi-previous.oi),ready=history.length===window,baseline=ready?sum/window:null,threshold=ready?baseline*multiplier:null;
    output.set(t,{ready,baseline,threshold,passed:ready&&delta>threshold});
    history.push(delta);sum+=delta;if(history.length>window)sum-=history.shift();
    previous={t,oi:point.oi};
  }
  return output;
}
