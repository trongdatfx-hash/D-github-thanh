import {STEPS,sessionAt} from './engine.mjs';
export const SPY_SCHEMA='spy-etf-5m-v1';
export function spyBars(doc,interval,now=Date.now(),days=30){
  const step=STEPS[interval];
  if(doc?.schema!==SPY_SCHEMA||doc.symbol!=='SPY'||!Array.isArray(doc.bars)||!step)throw Error('SPY: snapshot kh�ng h?p l?');
  const buckets=new Map(),seen=new Set(),start=now-days*86400000;
  for(const b of [...doc.bars].sort((a,b)=>a.t-b.t)){
    if(![b.t,b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||b.t%300000||b.t>now||seen.has(b.t)||b.l<=0||b.v<0||b.l>Math.min(b.o,b.c)||b.h<Math.max(b.o,b.c)||b.l>b.h)continue;
    seen.add(b.t);const t=Math.floor(b.t/step)*step;if(t<start)continue;
    let x=buckets.get(t);if(!x){x={t,end:t+step-1,o:b.o,h:b.h,l:b.l,c:b.c,v:0,count:0,...sessionAt(t)};buckets.set(t,x);}
    x.h=Math.max(x.h,b.h);x.l=Math.min(x.l,b.l);x.c=b.c;x.v+=b.v;x.count++;
  }
  // A closed aggregate must contain every underlying 5-minute bar. Never
  // silently turn missing provider data into a complete M15/M30/H1 candle.
  return [...buckets.values()].filter(b=>b.count===step/300000||b.end>=now).map(({count,...b})=>b);
}
export function hybridSpy(price,binance){
  const flow=new Map(binance.map(b=>[b.t,b]));
  return price.map(b=>{const f=flow.get(b.t);return {...b,etfVolume:b.v,q:f?.q??null,buy:f?.buy??null,sell:f?.sell??null,net:f?.net??null,nf:f?.nf??null,priceSource:'SPY ETF / Yahoo Finance',flowSource:'Binance SPYUSDT'};});
}
let snapshot=null,loadedAt=0;
export async function loadSpy(interval,days,{signal,now=Date.now(),get=fetch}={}){
  if(!snapshot||Date.now()-loadedAt>60000){
    const response=await get(new URL('data/spy/5m.json',import.meta.url),{signal,cache:'no-store'});
    if(!response.ok)throw Error(`SPY: ch�a c� d? li?u ETF (HTTP ${response.status})`);
    const next=await response.json();spyBars(next,interval,now,days);snapshot=next;loadedAt=Date.now();
  }
  const bars=spyBars(snapshot,interval,now,days);
  if(!bars.length)throw Error('SPY: kh�ng c� n?n ETF trong kho?ng �? ch?n');
  return {bars,m15:spyBars(snapshot,'15m',now,60),meta:{provider:'Yahoo Finance',fetchedAt:snapshot.fetchedAt,lastTime:bars.at(-1).t,delayed:true}};
}
