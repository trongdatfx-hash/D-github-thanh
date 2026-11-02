// Only locked display states are persisted. This cache never grants LIVE or
// feeds raw history, indicators, training cohorts, or running-candle previews.
export const H1_COLOR_CACHE_VERSION='20261103-h1-consistent1';
const ROOT='netflow:h1-h4-colors:v1:',TTL=24*60*60*1000,MAX_CHARS=2000000;
const FIELDS=['t','o','h','l','c','v','end','q','buy'];
const supported=raw=>raw&&!raw.partial&&['15m','1h'].includes(raw.interval)&&[7,14,30].includes(raw.days);
export function archiveColorRevision(manifest){return manifest?JSON.stringify(manifest):null;}
export function closedColorSourceKey(raw){
  if(!supported(raw)||!Number.isFinite(raw.serverTime))return null;
  let a=2166136261,b=5381;
  const add=value=>{const text=String(value)+'|';for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}};
  add(raw.interval);add(raw.days);
  for(const symbol of ['SPYUSDT','QQQUSDT']){
    const rows=raw[symbol];if(!Array.isArray(rows)||!rows.length||rows.length>20000)return null;
    add(symbol);let count=0,last=-Infinity;
    for(const row of rows){
      if(!Number.isFinite(row.end)||!Number.isFinite(row.t)||row.t<=last)return null;last=row.t;
      if(row.end>=raw.serverTime)continue;
      if(!FIELDS.every(key=>Number.isFinite(row[key])))return null;
      for(const key of FIELDS)add(row[key]);count++;
    }
    if(!count)return null;add(count);
  }
  return `${H1_COLOR_CACHE_VERSION}|${raw.interval}|${raw.days}|${(a>>>0).toString(16)}:${(b>>>0).toString(16)}`;
}
function validStates(states,raw){
  if(!Array.isArray(states)||states.length>20000)return false;
  const first=raw.SPYUSDT[0]?.t,last=raw.SPYUSDT.at(-1)?.t;let previous=-Infinity;
  return states.every(state=>{
    if(!state||!Number.isFinite(state.t)||state.t<=previous||state.t<first||state.t>last||state.preview!==false||![-1,0,1].includes(state.direction)||!Number.isFinite(state.blockStart)||!Number.isFinite(state.blockEnd)||state.blockStart>state.t||state.blockEnd<state.t||state.blockEnd>=raw.serverTime||typeof state.dayKey!=='string'||!Number.isFinite(state.quality)||state.quality<0||state.quality>1)return false;
    previous=state.t;
    return ['score','spyV','priceVector'].every(key=>state[key]===null||Number.isFinite(state[key]));
  });
}
export function readH1ColorCache(storage,raw,{sourceKey=closedColorSourceKey(raw),archiveRevision=null,now=Date.now()}={}){
  try{
    if(!sourceKey)return null;
    const text=storage?.getItem(ROOT+raw.interval+':'+raw.days);if(!text||text.length>MAX_CHARS)return null;
    const saved=JSON.parse(text);
    if(saved?.version!==H1_COLOR_CACHE_VERSION||saved.sourceKey!==sourceKey||!Number.isFinite(saved.savedAt)||saved.savedAt>now||now-saved.savedAt>TTL||typeof saved.archiveRevision!=='string'||(archiveRevision!==null&&saved.archiveRevision!==archiveRevision)||!validStates(saved.h1,raw)||!validStates(saved.strip,raw))return null;
    return saved;
  }catch{return null;}
}
export function saveH1ColorCache(storage,raw,{sourceKey=closedColorSourceKey(raw),archiveRevision,h1=[],strip=[],now=Date.now()}={}){
  try{
    if(!sourceKey||typeof archiveRevision!=='string'||!storage)return false;
    const first=raw.SPYUSDT[0]?.t,last=raw.SPYUSDT.at(-1)?.t;
    const locked=states=>states.filter(state=>state.preview===false&&state.blockEnd<raw.serverTime&&state.t>=first&&state.t<=last);
    const saved={version:H1_COLOR_CACHE_VERSION,sourceKey,archiveRevision,savedAt:now,h1:locked(h1),strip:locked(strip)};
    if(!validStates(saved.h1,raw)||!validStates(saved.strip,raw)||(!saved.h1.length&&!saved.strip.length))return false;
    const text=JSON.stringify(saved);if(text.length>MAX_CHARS)return false;
    storage.setItem(ROOT+raw.interval+':'+raw.days,text);return true;
  }catch{return false;}
}
