// Display only: closed-bar WLR slope / price-change sigma, with Composite soft gating.
export const WLR_SOFT_COLORS=Object.freeze({positive:'#1ae0a3',negative:'#ff4d70',positiveWeak:'#83b8aa',negativeWeak:'#c28e9b',conflict:'#f6b94f',neutral:'#8794a5'});
function schmitt(x,previous,enter=.15,exit=.07){return previous===1&&x>exit?1:previous===-1&&x< -exit?-1:x>=enter?1:x<=-enter?-1:0;}
export function wlrSoftColors(bars,bands,composite,volume,{step,closedBefore=Infinity}={}){
 if(!Array.isArray(bars)||!Array.isArray(bands)||bars.length!==bands.length||!(composite instanceof Map)||!(volume instanceof Map)||!Number.isInteger(step)||step<=0)throw Error('Invalid WLR soft color inputs');
 let history=[],previous=null,smoothed=0,slopeDirection=0,compositeDirection=0,last=null;
 const reset=()=>{history=[];smoothed=0;slopeDirection=0;compositeDirection=0;last=null;};
 return bars.map((bar,i)=>{
  if(!Number.isFinite(bar.t)||bands[i].t!==bar.t)throw Error('Invalid WLR soft color timestamp');
  if(previous!==null&&bar.t-previous!==step)reset();previous=bar.t;
  const closed=(bar.end??bar.t+step-1)<closedBefore;
  if(!closed)return {...(last??{direction:0,trendDirection:0,tone:'neutral',color:WLR_SOFT_COLORS.neutral,referenceTime:null}),t:bar.t,closed:false,reason:'live_hold'};
  const band=bands[i],cv=composite.get(bar.t)?.adjusted,v=volume.get(bar.t)?.adjusted;
  if(!Number.isFinite(bar.c)){reset();return {t:bar.t,closed:true,direction:0,trendDirection:0,tone:'neutral',color:WLR_SOFT_COLORS.neutral,reason:'missing_price'};}
  const sample=[...history,{c:bar.c,mid:band.mid}],ready=sample.length>=14&&sample.slice(-3).every(x=>Number.isFinite(x.mid));
  let sigma=null,score=null;
  if(ready){const changes=sample.slice(-13).map((x,j)=>x.c-sample[sample.length-14+j].c),mean=changes.reduce((a,b)=>a+b,0)/13;sigma=Math.sqrt(changes.reduce((s,x)=>s+(x-mean)**2,0)/13);score=(band.mid-sample.at(-3).mid)/2/Math.max(sigma,1e-9);smoothed=.5*score+.5*smoothed;slopeDirection=schmitt(smoothed,slopeDirection);}else{smoothed=0;slopeDirection=0;}
  compositeDirection=Number.isFinite(cv)?schmitt(cv,compositeDirection):0;
  const trendDirection=ready&&Number.isFinite(v)&&Math.abs(v)>=.07&&Math.sign(v)===slopeDirection?slopeDirection:0;
  const tone=!trendDirection?'neutral':compositeDirection===trendDirection?'confirmed':compositeDirection===-trendDirection?'conflict':'weak';
  const color=tone==='neutral'?WLR_SOFT_COLORS.neutral:tone==='conflict'?WLR_SOFT_COLORS.conflict:trendDirection>0?(tone==='confirmed'?WLR_SOFT_COLORS.positive:WLR_SOFT_COLORS.positiveWeak):(tone==='confirmed'?WLR_SOFT_COLORS.negative:WLR_SOFT_COLORS.negativeWeak);
  last={t:bar.t,closed:true,direction:tone==='conflict'?0:trendDirection,trendDirection,compositeDirection,tone,color,sigma,score,smoothed,referenceTime:bar.t,referenceComposite:Number.isFinite(cv)?cv:null,referenceVolume:Number.isFinite(v)?v:null,reason:ready?tone:'warmup'};
  history.push({c:bar.c,mid:band.mid});if(history.length>13)history.shift();return last;
 });
}
