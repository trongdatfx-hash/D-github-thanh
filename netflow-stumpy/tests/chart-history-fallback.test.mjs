import test from 'node:test';
import assert from 'node:assert/strict';
import {chartHistoryFallback} from '../chart-history-fallback.mjs';
import {chartFresh} from '../chart-live.mjs';

test('offline history clips future candles, expands a cached window, and never qualifies as LIVE',async()=>{
 const saved=globalThis.fetch,now=Date.parse('2026-10-26T14:00:00Z'),step=900000;
 const compact=iso=>{const t=Date.parse(iso);return [t,100,101,99,100,10,t+step-1,1000,500];};
 const bars=['2026-10-01T13:00:00Z','2026-10-20T13:00:00Z','2026-10-26T14:00:00Z'].map(compact);
 globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('manifest.json')?{interval:'15m',months:['2026-10'],lastTime:now}:{SPYUSDT:bars,QQQUSDT:bars}});
 try{
  const week=await chartHistoryFallback({interval:'15m',days:7,now});
  assert.equal(week.historical,true);assert.equal(week.SPYUSDT.length,1);
  assert.equal(chartFresh(week,now,null,now),false);
  const month=await chartHistoryFallback({interval:'15m',days:30,now});
  assert.equal(month.SPYUSDT.length,2);assert(month.SPYUSDT.every(r=>r.end<now));
 }finally{globalThis.fetch=saved;}
});

test('fallback does not invent unsupported timeframes',async()=>{
 await assert.rejects(chartHistoryFallback({interval:'5m',days:7}),/chỉ có M15/);
});
