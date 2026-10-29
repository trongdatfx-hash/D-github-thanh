// Browser-side top-up of the day-map M15 history.
// Only closed, contiguous and timestamp-paired SPYUSDT/QQQUSDT candles may
// extend the stored archive. Any validation failure leaves the archive intact.
export const STEP=15*60*1000;
const KLINES='https://fapi.binance.com/fapi/v1/klines';
const STREAM='wss://fstream.binance.com/stream?streams=spyusdt@kline_15m/qqqusdt@kline_15m';

function compactKline(k,step=STEP){
  if(!Array.isArray(k)||k.length<11)throw Error('Kline thi?u tr�?ng');
  const t=Number(k[0]),o=+k[1],h=+k[2],l=+k[3],c=+k[4],v=+k[5],end=Number(k[6]),q=+k[7],buy=+k[10],row=[t,o,h,l,c,v,end,q,buy];
  if(!row.every(Number.isFinite)||t%step!==0||end!==t+step-1||o<=0||c<=0||l<=0||h<Math.max(o,c)||l>Math.min(o,c)||q<0||buy<0||buy>q)throw Error('Kline kh�ng h?p l?');
  return row;
}

export function closedContiguousKlines(raw,{afterT,now,step=STEP}){
  if(!Array.isArray(raw))throw Error('Ph?n h?i klines kh�ng ph?i m?ng');
  const byT=new Map();
  for(const k of raw){
    const row=compactKline(k,step),t=row[0],end=row[6];
    if(end>=now||t<=afterT)continue;
    const old=byT.get(t);if(old&&old.some((x,i)=>x!==row[i]))throw Error('Kline tr�ng timestamp kh�c d? li?u');
    byT.set(t,row);
  }
  const out=[];let expect=afterT+step;
  for(const t of [...byT.keys()].sort((a,b)=>a-b)){if(t!==expect)break;out.push(byT.get(t));expect+=step;}
  return out;
}

export function trimToCommonEnd(a,b){
  const lastA=a.at(-1)?.[0],lastB=b.at(-1)?.[0];
  if(lastA===undefined||lastB===undefined)return [[],[]];
  const end=Math.min(lastA,lastB);
  return [a.filter(r=>r[0]<=end),b.filter(r=>r[0]<=end)];
}

// Same rule as netflow-stumpy/collect-history.py collection_metadata().
export function collectionFor({lastBySymbol,checkedAt,source,step=STEP}){
  const lag=Math.max(0,checkedAt-Math.min(...Object.values(lastBySymbol))-step);
  return {source,status:source==='daily-archive'||lag>step+15000?'delayed':'live',checkedAt,lastTimeBySymbol:lastBySymbol,lagHours:Math.round(lag/3600000*100)/100};
}

export async function fetchKlinePages(symbol,startTime,{now=Date.now(),fetchImpl=fetch,maxPages=4}={}){
  const rows=[];let cursor=startTime;
  for(let page=0;page<maxPages&&cursor<now;page++){
    const url=`${KLINES}?symbol=${symbol}&interval=15m&limit=1000&startTime=${cursor}&endTime=${now}`;
    const response=await fetchImpl(url,{cache:'no-store'});
    if(!response.ok)throw Error(`Binance klines HTTP ${response.status}`);
    const part=await response.json();if(!Array.isArray(part))throw Error('Binance klines tr? v? kh�ng ph?i m?ng');
    if(!part.length)break;rows.push(...part);
    const next=Number(part.at(-1)[0])+STEP;if(!(next>cursor))break;cursor=next;
    if(part.length<1000)break;
  }
  return rows;
}

// Never throws. A failed top-up returns the untouched stored rows and preserves
// their stale WAIT gate in the manifest.
export async function topUpLive(base,toRow,{now=Date.now(),fetchImpl=fetch}={}){
  const fail=reason=>({...base,manifest:{...base.manifest,topUp:{status:'failed',reason:String(reason?.message??reason)}}});
  try{
    const lastS=base.SPYUSDT.at(-1)?.t,lastQ=base.QQQUSDT.at(-1)?.t;
    if(!Number.isFinite(lastS)||!Number.isFinite(lastQ))return fail('Thi?u n?n g?c �? n?i');
    const [rawS,rawQ]=await Promise.all([fetchKlinePages('SPYUSDT',lastS+STEP,{now,fetchImpl}),fetchKlinePages('QQQUSDT',lastQ+STEP,{now,fetchImpl})]);
    const closedS=closedContiguousKlines(rawS,{afterT:lastS,now}),closedQ=closedContiguousKlines(rawQ,{afterT:lastQ,now});
    const [s,q]=trimToCommonEnd(closedS,closedQ);
    if(!s.length){
      if(closedS.length||closedQ.length)return fail('Hai m? ch�a c� c�ng n?n ��ng li?n k?');
      const lastBySymbol={SPYUSDT:lastS,QQQUSDT:lastQ},collection=collectionFor({lastBySymbol,checkedAt:now,source:'browser-rest'});
      return {...base,manifest:{...base.manifest,collection,topUp:{status:'current',added:0,storedCollection:base.manifest.collection??null}}};
    }
    const SPYUSDT=[...base.SPYUSDT,...s.map(toRow)],QQQUSDT=[...base.QQQUSDT,...q.map(toRow)];
    const lastBySymbol={SPYUSDT:SPYUSDT.at(-1).t,QQQUSDT:QQQUSDT.at(-1).t};
    const manifest={...base.manifest,lastTime:Math.min(...Object.values(lastBySymbol)),collection:collectionFor({lastBySymbol,checkedAt:now,source:'browser-rest'}),topUp:{status:'ok',added:s.length,storedCollection:base.manifest.collection??null}};
    return {manifest,SPYUSDT,QQQUSDT};
  }catch(error){return fail(error);}
}

export function closedWsKline(message,{step=STEP}={}){
  const event=message?.data??message,k=event?.k;
  if(!k||k.i!=='15m'||k.x!==true||!['SPYUSDT','QQQUSDT'].includes(k.s))return null;
  const raw=[k.t,k.o,k.h,k.l,k.c,k.v,k.T,k.q,0,0,k.V];
  return {symbol:k.s,row:compactKline(raw,step)};
}

// Emits only a matched pair at exactly afterT + STEP. Open candles are ignored.
// A gap is reported to the caller so it can repair with REST, never by guessing.
export function openClosedPairStream({afterT,onPair,onGap,onStatus,WebSocketImpl=globalThis.WebSocket}={}){
  if(typeof WebSocketImpl!=='function')return {close(){}};
  let expected=afterT+STEP,closed=false,retry=0,socket=null,timer=null;const pending=new Map();
  const connect=()=>{
    if(closed)return;socket=new WebSocketImpl(STREAM);
    socket.onopen=()=>{retry=0;onStatus?.('open');};
    socket.onmessage=event=>{
      try{
        const parsed=closedWsKline(JSON.parse(event.data));if(!parsed)return;
        const [t]=parsed.row;if(t<expected)return;if(t>expected){onGap?.({expected,received:t});return;}
        if(!pending.has(t))pending.set(t,new Map());pending.get(t).set(parsed.symbol,parsed.row);
        const pair=pending.get(t);if(pair.size!==2)return;
        onPair?.({t,SPYUSDT:pair.get('SPYUSDT'),QQQUSDT:pair.get('QQQUSDT'),checkedAt:Math.max(Date.now(),pair.get('SPYUSDT')[6]+1)});
        pending.delete(t);expected+=STEP;
      }catch(error){onStatus?.('error',error);}
    };
    socket.onerror=error=>onStatus?.('error',error);
    socket.onclose=()=>{onStatus?.('closed');if(!closed)timer=setTimeout(connect,Math.min(30000,1000*2**retry++));};
  };
  connect();return {close(){closed=true;clearTimeout(timer);socket?.close();},expected(){return expected;}};
}

