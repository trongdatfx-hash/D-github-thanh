// Pure causal M15 features, shared by the chart and the API. No model estimates here.
export const STEP=900000, VERSION='hhll-m15-v1';
export const dayNY=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const round=x=>Number.isFinite(x)?Math.round(x*10000)/10000:null;
export function closedBars(input,now){
  if(!Array.isArray(input)||input.length>2500||!Number.isFinite(now))throw Error('Dữ liệu M15 không hợp lệ.');
  let prev=-Infinity;
  return input.map(b=>{
    const {t,o,h,l,c}=b;
    if(![t,o,h,l,c].every(Number.isFinite)||t%STEP||t<=prev||l<=0||l>Math.min(o,c)||h<Math.max(o,c)||l>h)throw Error('OHLC hoặc thứ tự nến không hợp lệ.');
    prev=t;
    const v=Number.isFinite(b.v)&&b.v>=0?b.v:null,q=Number.isFinite(b.q)&&b.q>=0?b.q:null,buy=Number.isFinite(b.buy)&&b.buy>=0&&b.buy<=q?b.buy:null;
    return {t,o,h,l,c,v,q,buy};
  }).filter(b=>b.t+STEP<=now);
}
export function pattern(input,{now=Date.now(),symbol='SPYUSDT'}={}){
  const all=closedBars(input,now),last=all.at(-1);
  if(all.length<24)return null;
  // Never draw geometry or forward results through a missing candle.
  let start=all.length-1;while(start>0&&all[start].t-all[start-1].t===STEP)start--;
  const bars=all.slice(Math.max(start,all.length-128));if(bars.length<24)return null;
  const atr=mean(bars.slice(-14).map((b,j)=>{const i=bars.length-14+j;return Math.max(b.h-b.l,Math.abs(b.h-bars[Math.max(0,i-1)].c),Math.abs(b.l-bars[Math.max(0,i-1)].c));}));
  if(atr<=0)return null;
  const pivots=[],previous={H:null,L:null};
  for(let i=2;i<bars.length-2;i++){
    const b=bars[i],near=bars.slice(i-2,i+3),high=near.every((x,j)=>j===2||b.h>x.h),low=near.every((x,j)=>j===2||b.l<x.l);
    // Outside bars that are both a high and a low have ambiguous intrabar order.
    if(high===low)continue;
    const type=high?'H':'L',value=high?b.h:b.l,old=previous[type];
    const label=old===null?type:type==='H'?(value>old?'HH':value<old?'LH':'EH'):(value<old?'LL':value>old?'HL':'EL');
    previous[type]=value;pivots.push({t:b.t,confirmedAt:bars[i+2].t+STEP,type,label,value,index:i});
  }
  if(pivots.length<4)return null;
  const tail=pivots.slice(-6),first=tail[0],segment=bars.slice(first.index),n=segment.length;
  const xs=segment.map((_,i)=>i),ys=segment.map(b=>(b.c-segment[0].c)/atr),mx=mean(xs),my=mean(ys);
  const denom=xs.reduce((s,x)=>s+(x-mx)**2,0),slope=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/denom;
  const residual=ys.reduce((s,y,i)=>s+(y-my-slope*(i-mx))**2,0),variance=ys.reduce((s,y)=>s+(y-my)**2,0);
  const volumeMean=mean(bars.slice(-20).map(b=>b.v).filter(Number.isFinite));
  const quote=segment.reduce((s,b)=>s+(b.q??0),0),flowKnown=segment.every(b=>b.q!==null&&b.buy!==null);
  const morphology=segment.slice(-16).map(b=>{const r=b.h-b.l;return {t:b.t,direction:Math.sign(b.c-b.o),body:round(r?Math.abs(b.c-b.o)/r:0),upperWick:round(r?(b.h-Math.max(b.o,b.c))/r:0),lowerWick:round(r?(Math.min(b.o,b.c)-b.l)/r:0),rangeATR:round(r/atr),relativeVolume:b.v===null||!volumeMean?null:round(b.v/volumeMean)};});
  const highs=tail.filter(p=>p.type==='H'),lows=tail.filter(p=>p.type==='L');
  const upper=highs.length>1?(highs.at(-1).value-highs[0].value)/(highs.at(-1).index-highs[0].index)/atr:0;
  const lower=lows.length>1?(lows.at(-1).value-lows[0].value)/(lows.at(-1).index-lows[0].index)/atr:0;
  const features={slopeATR:round(slope),r2:round(variance?1-residual/variance:0),spanATR:round((Math.max(...segment.map(b=>b.h))-Math.min(...segment.map(b=>b.l)))/atr),bodyRatio:round(mean(morphology.map(b=>b.body))),upperWick:round(mean(morphology.map(b=>b.upperWick))),lowerWick:round(mean(morphology.map(b=>b.lowerWick))),upperSlopeATR:round(upper),lowerSlopeATR:round(lower),netFlowRatio:flowKnown&&quote?round(segment.reduce((s,b)=>s+2*b.buy-b.q,0)/quote):null,bars:n};
  return {version:VERSION,id:[VERSION,symbol,tail.at(-1).t,tail.at(-1).type].join(':'),symbol,interval:'15m',asOf:last.t+STEP,lastTime:last.t,firstTime:first.t,close:last.c,atr:round(atr),sequence:tail.map(p=>p.label).join(' → '),pivots:tail.map(({index,...p})=>p),features,morphology,vector:[slope,features.r2,features.spanATR/10,features.bodyRatio,features.upperWick,features.lowerWick,upper,lower].map(round)};
}
export function settle(sample,bars,now){
  if(sample.outcome)return sample;
  const map=new Map(closedBars(bars,now).map(b=>[b.t,b]));
  const forward=Array.from({length:8},(_,i)=>map.get(sample.lastTime+(i+1)*STEP));
  if(forward.some(b=>!b))return sample;
  return {...sample,outcome:{horizon:8,closedAt:forward.at(-1).t+STEP,returnATR:round((forward.at(-1).c-sample.close)/sample.atr),mfeATR:round((Math.max(...forward.map(b=>b.h))-sample.close)/sample.atr),maeATR:round((Math.min(...forward.map(b=>b.l))-sample.close)/sample.atr),direction:Math.sign(forward.at(-1).c-sample.close)}};
}
export function similar(current,samples){
  const ranked=samples.filter(s=>s.version===VERSION&&s.symbol===current.symbol&&s.outcome&&s.outcome.closedAt<=current.asOf&&s.lastTime+8*STEP<current.firstTime&&s.vector?.length===current.vector.length).map(s=>({...s,distance:Math.sqrt(mean(s.vector.map((x,i)=>(x-current.vector[i])**2)))})).filter(s=>s.distance<=.65).sort((a,b)=>a.distance-b.distance).slice(0,30);
  const n=ranked.length,up=ranked.filter(s=>s.outcome.direction>0).length,down=ranked.filter(s=>s.outcome.direction<0).length;
  const p=n?up/n:null,z=1.96,denom=1+z*z/(n||1),center=n?(p+z*z/(2*n))/denom:null,half=n?z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom:null;
  return {status:n>=20?'DESCRIPTIVE_ONLY':'WAIT',n,up,down,flat:n-up-down,upRate:n>=20?round(p):null,wilson95:n>=20?[round(center-half),round(center+half)]:null,meanReturnATR:n?round(mean(ranked.map(s=>s.outcome.returnATR))):null,examples:ranked.slice(0,5).map(({sequence,features,outcome,distance,lastTime})=>({sequence,features,outcome,distance:round(distance),lastTime}))};
}
