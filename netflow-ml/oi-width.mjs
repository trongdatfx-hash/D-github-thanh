// OI is a display-only modifier; it never changes Composite Strength values.
export function oiWidthByBar(samples, step, now, {window=96,minSamples=20}={}){
 if(!Array.isArray(samples)||!Number.isFinite(step)||step<=0||!Number.isFinite(now))throw Error('Invalid OI input');
 const result=new Map(),history=[];let previous=null;
 for(const item of [...samples].sort((a,b)=>Number(a.timestamp)-Number(b.timestamp))){
  const end=Number(item.timestamp),oi=Number(item.sumOpenInterest);
  if(!Number.isFinite(end)||!Number.isFinite(oi)||oi<=0||end>now||result.has(Math.floor((end-1)/step)*step))continue;
  const t=Math.floor((end-1)/step)*step;
  // The reported period end must correspond to this candle close.
  if(end<t+step-1000||end>t+step)continue;
  if(previous&&t-previous.t!==step)history.length=0;
  const delta=previous&&t-previous.t===step?Math.log(oi/previous.oi):null;
  let state='WAIT',width=2,percentile=null;
  if(delta!==null&&history.length>=minSamples){
   percentile=history.filter(x=>x<=delta).length/history.length;
   state=delta>0&&percentile>=.8?'increase':delta<0&&percentile<=.2?'decrease':'normal';
   width=state==='increase'?4:state==='decrease'?1:2;
  }
  result.set(t,{t,oi,delta,state,width,percentile});
  if(delta!==null){history.push(delta);if(history.length>window)history.shift();}
  previous={t,oi};
 }
 return result;
}
