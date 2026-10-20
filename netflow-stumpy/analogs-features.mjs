import {analyze,composite,calculateVolumeStrength,parseKlines,STEPS,wlrTrendThickness,candleRegimeClusters} from './engine.mjs';
import {eligibleMarketBar} from './market-calendar.mjs';
export function featureRows(priceRows,compositeRows,volumeRows,{now=Date.now()}={}){
  const cMap=new Map(compositeRows.map(r=>[r.t,r])),vMap=new Map(volumeRows.map(r=>[r.t,r]));
  return priceRows.filter(r=>r.end<now).map(r=>{
    const c=cMap.get(r.t),v=vMap.get(r.t),x=[Math.log(r.c),c?.adjusted,v?.adjusted,Number.isFinite(c?.nf)?c.nf/100:null];
    return {t:r.t,c:r.c,high:r.h,low:r.l,day:r.day,session:r.session,eligible:eligibleMarketBar(r),x:x.map(v=>Number.isFinite(v)?v:null)};
  });
}
export function chartFeatureRows(priceRows,compositeRows,volumeRows,{now=Date.now()}={}){
  const step=STEPS['15m'],closed=priceRows.filter(r=>r.end<now),trend=wlrTrendThickness(closed,step),clusters=candleRegimeClusters(closed,volumeRows,step);
  return featureRows(closed,compositeRows,volumeRows,{now}).map((row,i)=>{
    const w=trend[i],c=clusters[i],pv=[Math.log(row.c),Number.isFinite(w.width)?(w.width-1)/5:null,Number.isFinite(w.normalizedSlope)?Math.sign(w.slope)*Math.tanh(w.normalizedSlope):null,w.r2,c.group,c.smooth,Number(c.counter),Number(c.transition),row.x[2],row.x[1]];
    return {...row,pv:pv.map(v=>Number.isFinite(v)?v:null)};
  });
}
export function prepareRaw(raw,{now=Date.now()}={}){
  const step=STEPS['15m'],spy=raw.SPYUSDT,qqq=raw.QQQUSDT;
  const combined=analyze(composite(spy,qqq),step),volume=analyze(spy,step,{strength:calculateVolumeStrength(spy,step)});
  return {SPYUSDT:chartFeatureRows(analyze(spy,step),combined,volume,{now}),QQQUSDT:chartFeatureRows(analyze(qqq,step),combined,volume,{now})};
}
export function fromKlines(doc,now){return Object.fromEntries(['SPYUSDT','QQQUSDT'].map(symbol=>[symbol,parseKlines(doc[symbol],now,STEPS['15m'])]));}
