import {analyze,composite,calculateVolumeStrength,parseKlines,STEPS,wlrTrendThickness,candleRegimeClusters} from './engine.mjs';
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
  const output={};
  for(const [symbol,source] of Object.entries({SPYUSDT:spy,QQQUSDT:qqq})){
    const closed=analyze(source.filter(r=>r.end<now),step),trend=wlrTrendThickness(closed,step),clusters=candleRegimeClusters(closed,volume,step);
    const derived=new Map(closed.map((row,i)=>{
      const w=trend[i],c=clusters[i],pv=[Math.log(row.c),Number.isFinite(w.width)?(w.width-1)/5:null,Number.isFinite(w.normalizedSlope)?Math.sign(w.slope)*Math.tanh(w.normalizedSlope):null,w.r2,c.group,c.smooth,Number(c.counter),Number(c.transition)];
      return [row.t,pv.map(v=>Number.isFinite(v)?v:null)];
    }));
    output[symbol]=featureRows(closed,combined,volume,{now}).map(row=>({...row,pv:derived.get(row.t)}));
  }
  return output;
}
export function fromKlines(doc,now){return Object.fromEntries(['SPYUSDT','QQQUSDT'].map(symbol=>[symbol,parseKlines(doc[symbol],now,STEPS['15m'])]));}
