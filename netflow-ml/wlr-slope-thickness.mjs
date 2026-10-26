// Display-only trend thickness. Uses strictly prior closed candles.
export const WLR_SLOPE_DEFAULTS=Object.freeze({window:13,atrWindow:14,trendWeight:.61,flowWeight:.39,minWidth:2,maxWidth:10,alpha:.35,deadband:.07});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function wlrSlopeThickness(bars,composite,volume,{step,closedBefore=Infinity,...options}={}){
 const c={...WLR_SLOPE_DEFAULTS,...options};
 if(!Array.isArray(bars)||!(composite instanceof Map)||!(volume instanceof Map)||!Number.isInteger(step)||step<=0||![c.window,c.atrWindow].every(x=>Number.isInteger(x)&&x>=2)||![c.trendWeight,c.flowWeight,c.minWidth,c.maxWidth,c.alpha,c.deadband].every(Number.isFinite)||c.trendWeight<0||c.flowWeight<0||Math.abs(c.trendWeight+c.flowWeight-1)>1e-9||c.minWidth<=0||c.maxWidth<c.minWidth||c.alpha<=0||c.alpha>1||c.deadband<0||!(Number.isFinite(closedBefore)||closedBefore===Infinity))throw Error('Invalid WLR slope thickness settings');
 let history=[],previous=null,smoothed=c.minWidth;
 return bars.map(bar=>{
  if(!Number.isFinite(bar?.t))throw Error('Invalid WLR timestamp');
  if(previous!==null&&bar.t-previous!==step){history=[];smoothed=c.minWidth;}previous=bar.t;
  let slope=null,r2=null,sigma=null,atr=null,normalizedSlope=0,trendQuality=0,flowQuality=0,noisePenalty=1,quality=0,flowReady=false;
  const ready=history.length>=Math.max(c.window,c.atrWindow);
  if(ready){
   const sample=history.slice(-c.window),sw=c.window*(c.window+1)/2;
   let sx=0,sy=0,sxx=0,sxy=0;
   sample.forEach((b,i)=>{const w=i+1;sx+=w*i;sy+=w*b.c;sxx+=w*i*i;sxy+=w*i*b.c;});
   slope=(sw*sxy-sx*sy)/(sw*sxx-sx*sx);const intercept=(sy-slope*sx)/sw,mean=sy/sw;
   let sse=0,sst=0;sample.forEach((b,i)=>{const w=i+1;sse+=w*(b.c-intercept-slope*i)**2;sst+=w*(b.c-mean)**2;});
   sigma=Math.sqrt(sse/sw);r2=sst>1e-20?clamp(1-sse/sst):0;
   atr=history.slice(-c.atrWindow).reduce((s,b)=>s+b.tr,0)/c.atrWindow;
   normalizedSlope=atr>1e-12?Math.abs(slope)*c.window/atr:0;
   trendQuality=Math.tanh(normalizedSlope)*r2;
   const last=history.at(-1),v=volume.get(last.t)?.adjusted,k=composite.get(last.t)?.adjusted;
   flowReady=Number.isFinite(v)&&Number.isFinite(k);
   if(flowReady&&Math.abs(v)>c.deadband&&Math.abs(k)>c.deadband&&Math.sign(v)===Math.sign(k)&&Math.sign(v)===Math.sign(slope))flowQuality=Math.sqrt(Math.tanh(Math.abs(v))*Math.tanh(Math.abs(k)));
   noisePenalty=atr>1e-12?1/(1+(sigma/atr)**2):1;
   quality=clamp((c.trendWeight*trendQuality+c.flowWeight*flowQuality)*noisePenalty);
  }
  const targetWidth=c.minWidth+(c.maxWidth-c.minWidth)*quality;
  smoothed=ready?smoothed+c.alpha*(targetWidth-smoothed):c.minWidth;
  const result={t:bar.t,width:clamp(smoothed,c.minWidth,c.maxWidth),targetWidth,ready,pairs:history.length,slope,r2,sigma,atr,normalizedSlope,trendQuality,flowQuality,flowReady,noisePenalty,quality};
  if((bar.end??bar.t+step-1)<closedBefore){
   if([bar.c,bar.h,bar.l].every(Number.isFinite)&&bar.h>=bar.l){
    const prev=history.at(-1)?.c,tr=Math.max(bar.h-bar.l,Number.isFinite(prev)?Math.abs(bar.h-prev):0,Number.isFinite(prev)?Math.abs(bar.l-prev):0);
    history.push({t:bar.t,c:bar.c,tr});if(history.length>Math.max(c.window,c.atrWindow))history.shift();
   }else{history=[];smoothed=c.minWidth;}
  }
  return result;
 });
}
