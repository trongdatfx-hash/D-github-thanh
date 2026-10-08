import {SYMBOLS,STEPS,validateSymbol,parseKlines} from './engine.mjs';
export const BASE='https://fapi.binance.com';
export async function getJSON(path,signal){
  const response=await fetch(BASE+path,{signal:AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean)),cache:'no-store'});
  if(!response.ok)throw Error(`Binance HTTP ${response.status}`);
  const json=await response.json();if(json?.code<0)throw Error(`Binance ${json.code}: ${json.msg}`);return json;
}
export async function load(interval,days,{signal,get=getJSON}={}){
  const step=STEPS[interval];if(!step||![7,14,30].includes(days))throw Error('Khung thời gian/lịch sử không hợp lệ');
  const info=await get('/fapi/v1/exchangeInfo',signal),contracts=SYMBOLS.map(s=>validateSymbol(info,s));
  const {serverTime}=await get('/fapi/v1/time',signal);if(!Number.isFinite(serverTime))throw Error('Thời gian server không hợp lệ');
  const result={contracts,serverTime};
  for(const symbol of SYMBOLS){
    let cursor=Math.floor((serverTime-days*86400000)/step)*step,rows=[];
    while(cursor<serverTime){
      const page=await get(`/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=1000&startTime=${cursor}&endTime=${serverTime}`,signal);
      if(!Array.isArray(page))throw Error('Kline response không hợp lệ');if(!page.length)break;
      rows.push(...page);const next=+page.at(-1)[0]+step;if(next<=cursor)throw Error('Phân trang không tiến');cursor=next;
      if(page.length<1000)break;
    }
    result[symbol]=parseKlines(rows,serverTime,step);if(!result[symbol].length)throw Error(`${symbol}: không có nến đã đóng`);
  }
  return result;
}
