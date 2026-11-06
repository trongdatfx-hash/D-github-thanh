// Copy actual chart values at the SAME closed M15 timestamps; never infer missing OI/Strength.
const STEP=900000;
const number=x=>Number.isFinite(x)?Math.round(x*1e6)/1e6:null;
const map=rows=>new Map((rows||[]).map(r=>[r.t,r]));
export function chatFlowContext(context,{symbol,bars,firstTime,lastTime,asOf}){
  const c=context||{},spy=map(c.spyBars),strength=map(c.spyVolumeRows),delta=map(c.volumeDeltaRows),composite=map(c.compositeRows);
  const oi=c.oiByTime instanceof Map?c.oiByTime:new Map(),points=c.oiPoints instanceof Map?c.oiPoints:new Map();
  const selected=bars.filter(b=>b.t>=firstTime&&b.t<=lastTime&&b.t+STEP<=asOf).slice(-32);
  const rows=selected.map(b=>{
    const s=spy.get(b.t),v=strength.get(b.t),d=delta.get(b.t),flow=composite.get(b.t),o=oi.get(b.t),previous=oi.get(b.t-STEP),point=points.get(b.t);
    const oiReady=Number.isFinite(o?.oi)&&o.oi>0&&Number.isFinite(previous?.oi)&&previous.oi>0;
    const ownNet=Number.isFinite(b.q)&&Number.isFinite(b.buy)?2*b.buy-b.q:null;
    const spyNet=Number.isFinite(s?.q)&&Number.isFinite(s?.buy)?2*s.buy-s.q:null;
    return {t:b.t,close:b.c,spyClose:number(s?.c),spyV:number(v?.adjusted),spyVRaw:number(v?.raw),volume:number(b.v),takerNF:number(ownNet),takerNFPercent:ownNet!==null&&b.q>0?number(100*ownNet/b.q):null,spyTakerNF:number(spyNet),compositeTakerNF:number(flow?.net),volumeDelta:number(d?.value),oi:oiReady?{value:number(o.oi),delta:number(o.oi-previous.oi),deltaPercent:number(100*(o.oi/previous.oi-1)),candleConsensus:point?{matched:point.matched===true,kind:point.kind??null,direction:point.direction,gateReady:point.gateReady===true,gatePassed:point.gatePassed===true,threshold:number(point.threshold),percentile:number(point.percentile)}:null}:null};
  });
  const latest=rows.at(-1)||null,recent=rows.slice(-3),sum=key=>recent.length===3&&recent.every(r=>Number.isFinite(r[key]))?number(recent.reduce((s,r)=>s+r[key],0)):null;
  const known=rows.filter(r=>r.oi?.candleConsensus?.matched),groups={};for(const r of known){const kind=r.oi.candleConsensus.kind;groups[kind]=(groups[kind]||0)+1;}
  const missing=[];if(latest?.spyV==null)missing.push('SPY_V');if(latest?.volumeDelta==null)missing.push('VOLUME_DELTA');if(latest?.takerNF==null)missing.push('TAKER_NF');if(!latest?.oi)missing.push('OI');else if(!latest.oi.candleConsensus)missing.push('OI_CANDLE_CONSENSUS');
  const comparison=c.comparison,times=comparison?.times||[];
  // A live daily price spectrum must not leak into a historical chart selection.
  const spectrumAllowed=symbol==='SPYUSDT'&&comparison?.pairedReady===true&&times.length>0&&times.every(t=>t+STEP<=asOf)&&(!Number.isFinite(comparison.last)||comparison.last<=asOf);
  const group=spectrumAllowed&&typeof c.spectrumGroup==='function'?c.spectrumGroup(latest?.close):null;
  const spectrum=spectrumAllowed?{status:comparison.stale?'STALE':'READY',day:comparison.day,pairedBars:comparison.count,last:comparison.last,bins:(comparison.rows||[]).map(r=>({price:r.price,cvd:number(r.cvd),oiIncrease:number(r.opened),oiDecrease:number(r.closed),netOi:number(r.netOi),rank:r.rank})),priceGroup:group}: {status:'MISSING_OR_NOT_AS_OF',bins:[]};
  return {version:'chat-flow-v1',asOf,scope:{priceSymbol:symbol,spyVSymbol:'SPYUSDT',volumeDeltaSymbol:'SPYUSDT',oiSymbol:'SPYUSDT',spyVSource:c.spyVolumeSource||'UNKNOWN',volumeDeltaDefinition:'sign(SPY close-open) × SPY volume / SMA20(volume); không phải delta taker',takerNFDefinition:'2 × takerBuyQuote − quoteVolume',compositeNFDefinition:'SPY + QQQ, cùng timestamp; không phải riêng SPY',oiCandleSource:'Đúng bộ lọc nến đồng thuận OI trên chart SPY; histogram và nến cùng nguồn, không đếm hai lần'},summary:{latest,last3TakerNF:sum('takerNF'),last3SpyTakerNF:sum('spyTakerNF'),last3CompositeNF:sum('compositeTakerNF'),oiConsensusGroups:groups,missing},rows,spectrum};
}
