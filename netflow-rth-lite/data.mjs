import {SYMBOLS,STEPS,validateSymbol,parseKlines} from './engine.mjs';
export const BASE='https://fapi.binance.com';
const PAGE_LIMIT=1000,PARALLEL_PAGES=3,INFO_TTL=15*60000;
let infoCache=null,infoCachedAt=0;
export async function getJSON(path,signal){
  const response=await fetch(BASE+path,{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean)),cache:'no-store'});
  if(!response.ok)throw Error(`Binance HTTP ${response.status}`);
  const json=await response.json();if(json?.code<0)throw Error(`Binance ${json.code}: ${json.msg}`);return json;
}
async function mapLimited(items,limit,worker){
  const output=new Array(items.length),next={value:0};
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next.value<items.length){const i=next.value++;output[i]=await worker(items[i]);}}));
  return output;
}
async function fetchRange(symbol,interval,start,end,step,get,signal){
  if(start>=end)return [];
  const span=PAGE_LIMIT*step,chunks=[];for(let cursor=start;cursor<end;cursor+=span)chunks.push([cursor,Math.min(end,cursor+span-1)]);
  const pages=await mapLimited(chunks,PARALLEL_PAGES,async([from,to])=>{
    const limit=Math.max(1,Math.min(PAGE_LIMIT,Math.ceil((to-from+1)/step)));
    const page=await get(`/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&startTime=${from}&endTime=${to}`,signal);
    if(!Array.isArray(page))throw Error('Kline response không hợp lệ');return page;
  });
  return pages.flat();
}
export async function load(interval,days,{signal,get=getJSON,previous=null}={}){
  const step=STEPS[interval];if(!step||![7,14,30].includes(days))throw Error('Khung thời gian/lịch sử không hợp lệ');
  const canCacheInfo=get===getJSON&&infoCache&&Date.now()-infoCachedAt<INFO_TTL;
  const [info,{serverTime}]=await Promise.all([canCacheInfo?infoCache:get('/fapi/v1/exchangeInfo',signal),get('/fapi/v1/time',signal)]);
  if(get===getJSON&&!canCacheInfo){infoCache=info;infoCachedAt=Date.now();}
  const contracts=SYMBOLS.map(s=>validateSymbol(info,s));if(!Number.isFinite(serverTime))throw Error('Thời gian server không hợp lệ');
  const start=Math.floor((serverTime-days*86400000)/step)*step,reusable=previous?.interval===interval&&previous?.days===days;
  const pairs=await Promise.all(SYMBOLS.map(async symbol=>{
    const kept=reusable?(previous[symbol]??[]).filter(x=>x.t>=start&&x.end<serverTime):[];
    const cursor=kept.length?kept.at(-1).t+step:start;
    const fresh=parseKlines(await fetchRange(symbol,interval,cursor,serverTime,step,get,signal),serverTime,step,{includeOpen:true});
    const merged=new Map(kept.map(x=>[x.t,x]));for(const row of fresh)merged.set(row.t,row);
    const bars=[...merged.values()].sort((a,b)=>a.t-b.t);if(!bars.length)throw Error(`${symbol}: không có dữ liệu nến`);return [symbol,bars];
  }));
  return {contracts,serverTime,interval,days,incremental:reusable,...Object.fromEntries(pairs)};
}
