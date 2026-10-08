import {STEP} from './engine.mjs';
export const dvpStatus={verified:true,source:'DVP_v2924_clean.pine',sha256:'a7ecae8c74ceb65bbd4aa9eff8d95fd4b4fa1d39bf7006df2a432c6e40e6d9ff',message:'Strength theo công thức DVP · delta đầu vào = Taker NetFlow Binance. Không đồng nhất delta TradingView.'};
export function normCDF(z){
  z=Math.max(-8,Math.min(8,z));
  const a=Math.abs(z),t=1/(1+0.2316419*a),d=0.3989422804014327*Math.exp(-a*a/2);
  const p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return z>=0?1-p:p;
}
// Port of Pine lines 155–168 and 1367–1380, including raw-delta fallback
// before SMA(volume,20) is available. Missing M15 bars reset the segment.
export function calculateStrength(bars,{normLen=20,strLen=8,halfLife=2,lookback=500}={}){
  if(![normLen,strLen,lookback].every(x=>Number.isInteger(x)&&x>0)||!Number.isFinite(halfLife)||halfLife<0)throw Error('Tham số DVP không hợp lệ');
  let volumes=[],deltas=[],magnitudes=[],ew=null,previous=null;
  const alpha=halfLife>0?1-Math.pow(2,-1/Math.max(1,halfLife)):1;
  return bars.map(b=>{
    if(previous!==null && b.t-previous!==STEP){volumes=[];deltas=[];magnitudes=[];ew=null;}
    previous=b.t;
    volumes.push(b.v);if(volumes.length>normLen)volumes.shift();
    const mean=volumes.reduce((a,x)=>a+x,0)/normLen;
    const delta=volumes.length===normLen&&mean>0?b.net/mean:b.net;
    deltas.push(delta);if(deltas.length>strLen)deltas.shift();
    if(deltas.length<strLen)return null;
    const r=deltas.reduce((a,x)=>a+x,0);
    ew=ew===null?r:ew+alpha*(r-ew);
    const rs=halfLife>0?ew:r;
    magnitudes.push(Math.abs(rs));if(magnitudes.length>lookback)magnitudes.shift();
    if(magnitudes.length<lookback)return null;
    const sigma=magnitudes.reduce((a,x)=>a+x,0)/lookback*1.2533141373155003;
    return sigma>0?2*normCDF(rs/sigma)-1:null;
  });
}
