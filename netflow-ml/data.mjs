import {STEP,parseKlines,validateSymbol} from './engine.mjs';
const BASE='https://fapi.binance.com';
export async function getJSON(path,signal){
  const response=await fetch(BASE+path,{signal,cache:'no-store'});
  if(!response.ok)throw Error(`Binance HTTP ${response.status}`);
  const json=await response.json();
  if(json?.code<0)throw Error(`Binance: ${json.msg}`);
  return json;
}
export async function load(symbol,days,{signal,get=getJSON}={}){
  const info=await get('/fapi/v1/exchangeInfo',signal);
  const contract=validateSymbol(info,symbol);
  const {serverTime}=await get('/fapi/v1/time',signal);
  if(!Number.isFinite(serverTime))throw Error('Không xác nhận được thời gian Binance');
  const start=Math.floor((serverTime-days*86400000)/STEP)*STEP;
  let cursor=start,rows=[];
  while(cursor<serverTime){
    const page=await get(`/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=1000&startTime=${cursor}&endTime=${serverTime}`,signal);
    if(!Array.isArray(page))throw Error('Kline response không hợp lệ');
    if(!page.length)break;
    rows.push(...page);
    const next=Number(page.at(-1)[0])+STEP;
    if(next<=cursor)throw Error('Phân trang không tiến');
    cursor=next;
    if(page.length<1000)break;
  }
  const bars=parseKlines(rows,serverTime);
  if(!bars.length)throw Error('Không có nến M15 đã đóng');
  return {bars,contract,serverTime};
}
