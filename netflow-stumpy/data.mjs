import {SYMBOLS,STEPS,validateSymbol,parseKlines} from './engine.mjs?v=20261029-price-delta1';
export const BASE='https://fapi.binance.com';
const PAGE_LIMIT=1000,PARALLEL_PAGES=3,INFO_TTL=15*60000;
let infoCache=null,infoCachedAt=0;
const HISTORY_KEY='netflow:binance-history:v1',HISTORY_TTL=24*60*60000;
let historySavedAt=0,historySavedKey='';
function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}
function readHistory(storage,interval,days,serverTime){
  try{
    const saved=JSON.parse(storage?.getItem(HISTORY_KEY)||'null');
    if(saved?.version!==1||saved.interval!==interval||saved.days!==days||
      !Number.isFinite(saved.serverTime)||saved.serverTime>serverTime||
      serverTime-saved.serverTime>HISTORY_TTL)return null;
    const data={interval,days,serverTime:saved.serverTime};
    for(const symbol of SYMBOLS){
      const raw=saved[symbol];
      if(!Array.isArray(raw)||!raw.length||raw.length>20000)return null;
      data[symbol]=parseKlines(raw,saved.serverTime,STEPS[interval],{includeOpen:true});
      if(data[symbol].length!==raw.length)return null;
    }
    return data;
  }catch{return null;}
}
function saveHistory(storage,data){
  if(!storage)return;
  const key=data.interval+':'+data.days;
  if(key===historySavedKey&&Date.now()-historySavedAt<60000)return;
  try{
    const saved={version:1,interval:data.interval,days:data.days,serverTime:data.serverTime};
    for(const symbol of SYMBOLS)saved[symbol]=data[symbol].map(r=>[r.t,r.o,r.h,r.l,r.c,r.v,r.end,r.q,0,0,r.buy]);
    storage.setItem(HISTORY_KEY,JSON.stringify(saved));
    historySavedAt=Date.now();historySavedKey=key;
  }catch{/* Storage disabled/full: live loading remains available. */}
}
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
async function fetchRange(symbol,interval,start,end,step,get,signal,onLatest){
  if(start>=end)return [];
  const span=PAGE_LIMIT*step,chunks=[];for(let cursor=start;cursor<end;cursor+=span)chunks.push([cursor,Math.min(end,cursor+span-1)]);
  // Fetch the newest page first, keeping the same concurrency/request budget.
  const latestStart=chunks.at(-1)[0];
  const pages=await mapLimited(chunks.reverse(),PARALLEL_PAGES,async([from,to])=>{
    const limit=Math.max(1,Math.min(PAGE_LIMIT,Math.ceil((to-from+1)/step)));
    const page=await get(`/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&startTime=${from}&endTime=${to}`,signal);
    if(!Array.isArray(page))throw Error('Kline response không hợp lệ');
    if(from===latestStart&&onLatest)await onLatest(page);
    return page;
  });
  return pages.flat();
}
export async function load(interval,days,{signal,get=getJSON,previous=null,storage=browserStorage(),onPreview=null}={}){
  let active=true;
  const step=STEPS[interval];if(!step||![7,14,30].includes(days))throw Error('Khung thời gian/lịch sử không hợp lệ');
  const canCacheInfo=get===getJSON&&infoCache&&Date.now()-infoCachedAt<INFO_TTL;
  // Contract validation and candle loading are independent. Never publish data
  // until BOTH succeed, but do not hold back klines on a slow exchangeInfo.
  const contractsTask=(async()=>{
    const info=canCacheInfo?infoCache:await get('/fapi/v1/exchangeInfo',signal);
    const contracts=SYMBOLS.map(s=>validateSymbol(info,s));
    if(get===getJSON&&!canCacheInfo){infoCache=info;infoCachedAt=Date.now();}
    return contracts;
  })();
  const candlesTask=(async()=>{
    const {serverTime}=await get('/fapi/v1/time',signal);
    if(!Number.isFinite(serverTime))throw Error('Thời gian server không hợp lệ');
    const start=Math.floor((serverTime-days*86400000)/step)*step;
    const compatible=previous&&!previous.historical&&!previous.partial&&previous.interval===interval&&previous.days===days&&previous.serverTime<=serverTime;
    const source=compatible?previous:readHistory(storage,interval,days,serverTime);
    const reusable=!!source;
    const previewRows=new Map();
    const previewLatest=!reusable&&typeof onPreview==='function'?async(symbol,raw)=>{
      const bars=parseKlines(raw,serverTime,step,{includeOpen:true});
      if(!bars.length)return;
      previewRows.set(symbol,bars);
      if(previewRows.size!==SYMBOLS.length)return;
      const contracts=await contractsTask;
      signal?.throwIfAborted();
      if(!active)return;
      // Price-only preview. It must never seed history, indicators or LIVE state.
      onPreview({contracts,serverTime,interval,days,partial:true,...Object.fromEntries(previewRows)});
    }:null;
    const pairs=await Promise.all(SYMBOLS.map(async symbol=>{
      // Refresh the last closed candle as well as every previously open candle.
      // Historical fallback snapshots are never accepted as complete live history.
      const closed=reusable?(source[symbol]??[]).filter(x=>x.t>=start&&x.end<source.serverTime&&x.end<serverTime):[];
      const kept=closed.slice(0,-1);
      const cursor=kept.length?kept.at(-1).t+step:start;
      const fresh=parseKlines(await fetchRange(symbol,interval,cursor,serverTime,step,get,signal,previewLatest?raw=>previewLatest(symbol,raw):null),serverTime,step,{includeOpen:true});
      const merged=new Map(kept.map(x=>[x.t,x]));for(const row of fresh)merged.set(row.t,row);
      const bars=[...merged.values()].sort((a,b)=>a.t-b.t);if(!bars.length)throw Error(`${symbol}: không có dữ liệu nến`);return [symbol,bars];
    }));
    return {serverTime,interval,days,incremental:reusable,restored:reusable&&!compatible,...Object.fromEntries(pairs)};
  })();
  try{
    const [contracts,data]=await Promise.all([contractsTask,candlesTask]);
    signal?.throwIfAborted();
    const result={contracts,...data};
    saveHistory(storage,result);
    return result;
  }finally{active=false;}
}
