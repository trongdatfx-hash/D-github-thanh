import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPersistentHistory} from '../history-store.mjs';

test('current shard refreshes when manifest changes without advancing lastTime',async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;
 const start=Date.parse('2026-10-28T05:00:00Z'),t=Date.parse('2026-10-26T23:45:00Z');
 const urls=[];
 let clock=start,updatedAt=1,close=100;
 const bar=()=>[t,close,close,close,close,1,t+900000-1,100,50];
 globalThis.fetch=async url=>{
  urls.push(String(url));
  return {ok:true,json:async()=>String(url).includes('manifest.json')
   ?{interval:'15m',months:['2026-10'],lastTime:t,updatedAt}
   :{SPYUSDT:[bar()],QQQUSDT:[bar()]}};
 };
 Date.now=()=>clock;
 try{
  const first=await loadPersistentHistory({days:7});
  assert.equal(first.SPYUSDT.at(-1).c,100);
  updatedAt=2;close=101;clock+=6*60000;
  const second=await loadPersistentHistory({days:7});
  assert.equal(second.SPYUSDT.at(-1).c,101);
  assert.equal(second.QQQUSDT.at(-1).c,101);
  assert(urls.some(url=>url.includes('2026-10.json?v=1')));
  assert(urls.some(url=>url.includes('2026-10.json?v=2')));
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
