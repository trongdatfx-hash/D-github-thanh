import {writeFile} from 'node:fs/promises';

const key=process.env.BINANCE_MARKET_DATA_API_KEY;
if(!key)throw new Error('Missing BINANCE_MARKET_DATA_API_KEY');
const url='https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=SPYUSDT&period=15m&limit=24';
const res=await fetch(url,{headers:{'X-MBX-APIKEY':key},signal:AbortSignal.timeout(12000)});
if(!res.ok)throw new Error('Binance Top Trader HTTP '+res.status);
const rows=await res.json();
if(!Array.isArray(rows))throw new Error('Invalid Binance Top Trader response');
const step=900000,now=Date.now(),byTime=new Map();
for(const row of rows){
  if(row?.symbol!=='SPYUSDT'||row.longAccount===null||row.longAccount==='')continue;
  const time=Number(row.timestamp),share=Number(row.longAccount);
  if(Number.isSafeInteger(time)&&time%step===0&&time<=now&&Number.isFinite(share)&&share>=0&&share<=1)byTime.set(time,share);
}
const points=[...byTime].sort((a,b)=>a[0]-b[0]);
if(points.length<3||now-points.at(-1)[0]>3*step)throw new Error('Insufficient recent SPYUSDT M15 Top Trader data');
await writeFile(new URL('../data/spy-top-trader-m15.json',import.meta.url),JSON.stringify({symbol:'SPYUSDT',period:'15m',points})+'\n');
console.log('Published '+points.length+' SPYUSDT M15 positioning samples.');
