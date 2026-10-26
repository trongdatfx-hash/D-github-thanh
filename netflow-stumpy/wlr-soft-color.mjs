// Display only: closed-bar WLR slope / price-change sigma, with Composite soft gating.
export const WLR_SOFT_COLORS=Object.freeze({positive:'#1ae0a3',negative:'#ff4d70',positiveWeak:'#83b8aa',negativeWeak:'#c28e9b',conflict:'#f6b94f',neutral:'#8794a5'});
function schmitt(x,previous,enter=.15,exit=.07){return previous===1&&x>exit?1:previous===-1&&x< -exit?-1:x>=enter?1:x<=-enter?-1:0;}
export function wlrSoftColors(bars,bands,composite,volume,{step,closedBefore=Infinity}={}){
 if(!Array.isArray(bars)||!Array.isArray(bands)||bars.length!==bands.length||!(composite instanceof Map)||!(volume instanceof Map)||!Number.isInteger(step)||step<=0)throw Error('Invalid WLR soft color inputs');
 let history=[],previous=null,smoothed=0,slopeDirection=0,compositeDirection=0,last=null,pendingTone=null,pendingCount=0,width=2,shadeLast=null;
 const reset=()=>{history=[];smoothed=0;slopeDirection=0;compositeDirection=0;last=null;pendingTone=null;pendingCount=0;width=2;shadeLast=null;};
 return bars.map((bar,i)=>{
  if(!Number.isFinite(bar.t)||bands[i].t!==bar.t)throw Error('Invalid WLR soft color timestamp');
  if(previous!==null&&bar.t-previous!==step)reset();previous=bar.t;
  const closed=(bar.end??bar.t+step-1)<closedBefore;
  if(!closed)return {...(last??{direction:0,trendDirection:0,tone:'neutral',width:2,targetWidth:2,color:WLR_SOFT_COLORS.neutral,referenceTime:null}),t:bar.t,closed:false,reason:'live_hold'};
  const band=bands[i],cv=composite.get(bar.t)?.adjusted,v=volume.get(bar.t)?.adjusted;
  if(!Number.isFinite(bar.c)){reset();return {t:bar.t,closed:true,direction:0,trendDirection:0,tone:'neutral',width:2,targetWidth:2,color:WLR_SOFT_COLORS.neutral,reason:'missing_price'};}
  const sample=[...history,{o:bar.o,c:bar.c,mid:band.mid}],ready=sample.length>=14&&sample.slice(-3).every(x=>Number.isFinite(x.mid));
  let sigma=null,score=null;
  if(ready){const changes=sample.slice(-13).map((x,j)=>x.c-sample[sample.length-14+j].c),mean=changes.reduce((a,b)=>a+b,0)/13;sigma=Math.sqrt(changes.reduce((s,x)=>s+(x-mean)**2,0)/13);score=(band.mid-sample.at(-3).mid)/2/Math.max(sigma,1e-9);smoothed=.5*score+.5*smoothed;slopeDirection=schmitt(smoothed,slopeDirection);}else{smoothed=0;slopeDirection=0;}
  compositeDirection=Number.isFinite(cv)?schmitt(cv,compositeDirection):0;
  const baseTrendDirection=ready&&Number.isFinite(v)&&Math.abs(v)>=.07&&Math.sign(v)===slopeDirection?slopeDirection:0;
  const short=sample.slice(-4),priceSlope=ready?short.reduce((sum,x,j)=>sum+(j-1.5)*x.c,0)/5:0,priceScore=priceSlope/Math.max(sigma??0,1e-9),fastSign=Math.abs(priceScore)>=.15?Math.sign(priceScore):0;
  const group=sample.slice(-3),sameSide=fastSign&&group.filter(x=>Number.isFinite(x.o)&&Number.isFinite(x.mid)&&((x.o+x.c)/2-x.mid)*fastSign>.1*(sigma??0)).length>=2&&(bar.c-band.mid)*fastSign>.1*(sigma??0);
  const fastDirection=ready&&sameSide&&Number.isFinite(v)&&Math.abs(v)>=.07&&Math.sign(v)===fastSign?fastSign:0;
  const early=Boolean(fastDirection&&fastDirection!==baseTrendDirection),trendDirection=early?fastDirection:baseTrendDirection;
  const rawTone=!baseTrendDirection?'neutral':compositeDirection===baseTrendDirection?'confirmed':compositeDirection===-baseTrendDirection?'conflict':'weak';
  // Debounce only the Composite shade within an unchanged price/volume direction.
  // A lost direction, a new direction or absent Composite resets immediately.
  let tone=rawTone;
  if(shadeLast&&baseTrendDirection&&shadeLast.trendDirection===baseTrendDirection&&Number.isFinite(cv)&&rawTone!==shadeLast.tone){
   pendingCount=pendingTone===rawTone?pendingCount+1:1;pendingTone=rawTone;
   if(pendingCount<2)tone=shadeLast.tone;else{pendingTone=null;pendingCount=0;}
  }else{pendingTone=null;pendingCount=0;}
  shadeLast={trendDirection:baseTrendDirection,tone};
  const baseTone=tone;if(early)tone='early';
  const magnitude=Math.tanh(Math.abs(smoothed)/.75),targetWidth=early?2.5:tone==='confirmed'?3+5*magnitude:tone==='weak'?2+3*magnitude:tone==='conflict'?2+Math.min(1,magnitude):2;
  const cap=early?2.5:tone==='confirmed'?8:tone==='weak'?5:tone==='conflict'?3:2;
  width=Math.max(2,Math.min(cap,width+.35*(targetWidth-width)));
  const color=tone==='neutral'?WLR_SOFT_COLORS.neutral:tone==='conflict'?WLR_SOFT_COLORS.conflict:trendDirection>0?(tone==='confirmed'?WLR_SOFT_COLORS.positive:WLR_SOFT_COLORS.positiveWeak):(tone==='confirmed'?WLR_SOFT_COLORS.negative:WLR_SOFT_COLORS.negativeWeak);
  last={t:bar.t,closed:true,direction:early||tone==='conflict'?0:baseTrendDirection,trendDirection,baseTrendDirection,baseTone,early,fastDirection,priceScore,compositeDirection,tone,rawTone,pendingCount,width,targetWidth,ready,color,sigma,score,smoothed,referenceTime:bar.t,referenceComposite:Number.isFinite(cv)?cv:null,referenceVolume:Number.isFinite(v)?v:null,reason:ready?tone:'warmup'};
  history.push({o:bar.o,c:bar.c,mid:band.mid});if(history.length>13)history.shift();return last;
 });
}
