import {STEPS,analyze,normCDF} from './engine.mjs';

export function normalizedTakerVolumeDelta(bars,step,{normLen=20}={}){
  if(!Array.isArray(bars)||!Object.values(STEPS).includes(step)||!Number.isInteger(normLen)||normLen<1)throw Error('Tham số Taker Volume Delta không hợp lệ');
  let quoteVolumes=[],previous=null;
  return bars.map(bar=>{
    if(previous!==null&&bar.t-previous!==step)quoteVolumes=[];previous=bar.t;
    const net=Number.isFinite(bar.net)?bar.net:Number.isFinite(bar.q)&&Number.isFinite(bar.buy)?2*bar.buy-bar.q:NaN;
    if(!Number.isFinite(bar.q)||bar.q<0||!Number.isFinite(net)||Math.abs(net)>bar.q+1e-8)throw Error('Thiếu taker quote volume Binance');
    quoteVolumes.push(bar.q);if(quoteVolumes.length>normLen)quoteVolumes.shift();
    const mean=quoteVolumes.reduce((sum,value)=>sum+value,0)/quoteVolumes.length;
    return {t:bar.t,value:mean>0?net/mean:0,net,quoteVolume:bar.q,mean};
  });
}

export function commonTakerDeltaValue(spyValue,qqqValue,{spyWeight=.7}={}){
  if(!Number.isFinite(spyValue)||!Number.isFinite(qqqValue)||!Number.isFinite(spyWeight)||spyWeight<0||spyWeight>1)return null;
  return spyWeight*Math.tanh(spyValue)+(1-spyWeight)*Math.tanh(qqqValue);
}

export function calculateDeltaVolumeStrength(deltas,step,{strLen=8,halfLife=2,lookback=500}={}){
  if(!Array.isArray(deltas)||!Object.values(STEPS).includes(step)||![strLen,lookback].every(value=>Number.isInteger(value)&&value>0)||!Number.isFinite(halfLife)||halfLife<0)throw Error('Tham số Delta Volume Strength không hợp lệ');
  let impulses=[],magnitudes=[],ew=null,previous=null;const alpha=halfLife>0?1-2**(-1/Math.max(1,halfLife)):1;
  return deltas.map(delta=>{
    if(!Number.isFinite(delta?.t)||!Number.isFinite(delta?.value))throw Error('Delta Volume Strength thiếu dữ liệu');
    if(previous!==null&&delta.t-previous!==step){impulses=[];magnitudes=[];ew=null;}previous=delta.t;
    impulses.push(delta.value);if(impulses.length>strLen)impulses.shift();if(impulses.length<strLen)return null;
    const impulse=impulses.reduce((sum,value)=>sum+value,0);ew=ew===null?impulse:ew+alpha*(impulse-ew);const smoothed=halfLife>0?ew:impulse;
    magnitudes.push(Math.abs(smoothed));if(magnitudes.length>lookback)magnitudes.shift();if(magnitudes.length<lookback)return null;
    const sigma=magnitudes.reduce((sum,value)=>sum+value,0)/magnitudes.length*Math.sqrt(Math.PI/2);
    return sigma>0?2*normCDF(smoothed/sigma)-1:0;
  });
}

export function calculateCommonTakerVolumeStrength(spyBars,qqqBars,step,{spyWeight=.7,...strengthOptions}={}){
  const spyDelta=normalizedTakerVolumeDelta(spyBars,step),qqqDelta=normalizedTakerVolumeDelta(qqqBars,step),qqqMap=new Map(qqqDelta.map(row=>[row.t,row])),deltas=spyDelta.flatMap(row=>{const value=commonTakerDeltaValue(row.value,qqqMap.get(row.t)?.value,{spyWeight});return Number.isFinite(value)?[{t:row.t,value}]:[];}),times=new Set(deltas.map(row=>row.t)),bars=spyBars.filter(row=>times.has(row.t));
  return {rows:analyze(bars,step,{strength:calculateDeltaVolumeStrength(deltas,step,strengthOptions)}),deltas,spyDelta,qqqDelta};
}
