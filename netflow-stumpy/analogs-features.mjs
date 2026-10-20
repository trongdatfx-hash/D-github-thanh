import {analyze,composite,calculateVolumeStrength,parseKlines,STEPS} from './engine.mjs';
import {eligibleMarketBar} from './market-calendar.mjs';
export function featureRows(priceRows,compositeRows,volumeRows,{now=Date.now()}={}){
  const cMap=new Map(compositeRows.map(r=>[r.t,r])),vMap=new Map(volumeRows.map(r=>[r.t,r]));
  return priceRows.filter(r=>r.end<now).map(r=>{
    const c=cMap.get(r.t),v=vMap.get(r.t),x=[Math.log(r.c),c?.adjusted,v?.adjusted,Number.isFinite(c?.nf)?c.nf/100:null];
    return {t:r.t,c:r.c,high:r.h,low:r.l,day:r.day,session:r.session,eligible:eligibleMarketBar(r),x:x.map(v=>Number.isFinite(v)?v:null)};
  });
}
export function prepareRaw(raw,{now=Date.now()}={}){
  const step=STEPS['15m'],spy=raw.SPYUSDT,qqq=raw.QQQUSDT;
  const combined=analyze(composite(spy,qqq),step),volume=analyze(spy,step,{strength:calculateVolumeStrength(spy,step)});
  return {SPYUSDT:featureRows(analyze(spy,step),combined,volume,{now}),QQQUSDT:featureRows(analyze(qqq,step),combined,volume,{now})};
}
export function fromKlines(doc,now){return Object.fromEntries(['SPYUSDT','QQQUSDT'].map(symbol=>[symbol,parseKlines(doc[symbol],now,STEPS['15m'])]));}
