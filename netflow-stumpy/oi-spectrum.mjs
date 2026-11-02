// ΔOI assigned to candle close is an estimate by price, not positions' entry prices.
export function oiSpectrum(priceRows, oiByTime, step, now, {binStep=.5,range=12}={}){
  const empty={ready:false,bins:[],max:0,times:[],count:0};
  if(!(step>0)||!(binStep>0)||!(range>0)||!Number.isFinite(now))return empty;
  const closed=priceRows.filter(r=>r.end<now),last=closed.at(-1);
  if(!last)return empty;
  const times=[],bins=new Map(),center=priceRows.at(-1)?.c;
  for(const row of closed){
    const current=oiByTime.get(row.t),previous=oiByTime.get(row.t-step);
    if(!current||!previous||![current.oi,previous.oi,row.c].every(Number.isFinite)||current.oi<=0||previous.oi<=0)continue;
    const delta=current.oi-previous.oi;times.push(row.t);
    const key=Math.round(row.c/binStep),bin=bins.get(key)??{price:key*binStep,opened:0,closed:0};
    bin.opened+=Math.max(0,delta);bin.closed+=Math.max(0,-delta);bins.set(key,bin);
  }
  // No forward fill across missing periods; stale history must not look current.
  if(times.at(-1)!==last.t||times.length<2)return empty;
  const visible=[...bins.values()].filter(b=>Math.abs(b.price-center)<=range).sort((a,b)=>a.price-b.price);
  return {ready:true,bins:visible,max:visible.reduce((m,b)=>Math.max(m,b.opened,b.closed),0),times,count:times.length,first:times[0],last:times.at(-1)};
}
