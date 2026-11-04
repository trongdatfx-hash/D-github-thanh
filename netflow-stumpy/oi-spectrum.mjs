const nyDayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export const oiSpectrumDay=t=>nyDayFormat.format(t);
// ΔOI assigned to candle close is an estimate by price, not positions' entry prices.
export function oiSpectrum(priceRows, oiByTime, step, now, {binStep=.5,range=12}={}){
  const empty={ready:false,bins:[],max:0,times:[],count:0};
  if(!(step>0)||!(binStep>0)||!(range>0)||!Number.isFinite(now))return empty;
  const currentDay=oiSpectrumDay(now),allClosed=priceRows.filter(r=>r.end<now),last=allClosed.at(-1);
  if(!last)return empty;
  const groups=new Map(),center=priceRows.at(-1)?.c;
  for(const row of allClosed){
    const current=oiByTime.get(row.t),previous=oiByTime.get(row.t-step);
    if(!current||!previous||![current.oi,previous.oi,row.c].every(Number.isFinite)||current.oi<=0||previous.oi<=0)continue;
    const day=oiSpectrumDay(row.t);if(!groups.has(day))groups.set(day,[]);groups.get(day).push(row);
  }
  const day=[...groups.keys()].sort().reverse().find(day=>groups.get(day).length>=2);
  if(!day)return empty;
  const closed=groups.get(day),times=[],bins=new Map();
  for(const row of closed){
    const current=oiByTime.get(row.t),previous=oiByTime.get(row.t-step);
    if(!current||!previous||![current.oi,previous.oi,row.c].every(Number.isFinite)||current.oi<=0||previous.oi<=0)continue;
    const delta=current.oi-previous.oi;times.push(row.t);
    const key=Math.round(row.c/binStep),bin=bins.get(key)??{price:key*binStep,opened:0,closed:0};
    bin.opened+=Math.max(0,delta);bin.closed+=Math.max(0,-delta);bins.set(key,bin);
  }
  // Show the latest real paired observations while the tail loads; never forward fill.
  const stale=day!==currentDay||times.at(-1)!==last.t;
  const visible=[...bins.values()].filter(b=>Math.abs(b.price-center)<=range).sort((a,b)=>a.price-b.price);
  return {ready:true,stale,bins:visible,max:visible.reduce((m,b)=>Math.max(m,b.opened,b.closed),0),times,day,timeZone:'America/New_York',count:times.length,first:times[0],last:times.at(-1)};
}
