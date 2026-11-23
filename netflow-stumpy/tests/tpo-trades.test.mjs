import test from 'node:test';
import assert from 'node:assert/strict';
import {TpoTradeLoader,parseTpoTrades} from '../tpo-trades.mjs';
import {buildTpo} from '../tpo-profile.mjs';
import {tpoRenderMode,compactTpoRows} from '../tpo-layout.mjs';
const B=1800000,start=Date.parse('2026-11-23T05:00Z');
const bar=t=>({t,l:100,h:110,o:100,c:110}),window={start,end:start+B,key:'test',day:'2026-11-23',session:'DAY',bars:[bar(start),bar(start+900000)]};
const raw=(a,t,p=100)=>({a,T:t,p:String(p)});
test('trades count a price once per block, preserve untraded gaps, and fallback only for uncovered blocks',()=>{
  const w={...window,end:start+2*B,bars:[...window.bars,bar(start+B),bar(start+B+900000)]};
  const p=buildTpo(w,{source:'TRADES',now:w.end,rowSize:1,trades:[{start,until:start+B,prices:[100,100,110]}]});
  assert.deepEqual(p.rows.find(r=>r.low===100).blocks,[0,1]);
  assert.deepEqual(p.rows.find(r=>r.low===105).blocks,[1]);
  assert.equal(p.source,'TRADES/M15');assert.equal(p.tradeBlocks,1);assert.equal(p.fallbackBlocks,1);
  const exact=buildTpo(window,{source:'TRADES',now:window.end,rowSize:1,trades:[{start,until:window.end,prices:[100,110]}]});
  assert.equal(exact.rows.find(r=>r.low===105).blocks.length,0);assert.equal(exact.approximate,false);
});
test('partial closed block is never accepted as trade coverage',()=>{
  const p=buildTpo(window,{source:'TRADES',now:window.end+60000,rowSize:1,trades:[{start,until:start+900000,prices:[100]}]});
  assert.equal(p.tradeBlocks,0);assert.equal(p.source,'M15');
});
test('pagination resumes with fromId without exposing incomplete block',async()=>{
  let calls=0,wall=window.end+5000;const urls=[];
  const loader=new TpoTradeLoader(async url=>{urls.push(url);return calls++===0?Array.from({length:1000},(_,i)=>raw(i,start+i,100)): [raw(1000,start+1000,110)];},{budget:1,wallNow:()=>wall});
  assert.equal(await loader.refresh('SPYUSDT',[window],window.end),false);assert.equal(loader.read('SPYUSDT',window,window.end).length,0);
  wall+=30000;assert.equal(await loader.refresh('SPYUSDT',[window],window.end),true);
  const rows=loader.read('SPYUSDT',window,window.end);assert.equal(rows.length,1);assert.deepEqual(rows[0].prices,[100,110]);
  assert.match(urls[1],/fromId=1000/);assert.doesNotMatch(urls[1],/startTime/);
});
test('id gaps fail closed and network errors throttle; older than 48h never requests',async()=>{
  assert.throws(()=>parseTpoTrades([raw(0,start),raw(2,start+1)]));
  let calls=0,wall=window.end+5000;
  const loader=new TpoTradeLoader(async()=>{calls++;throw Error('offline');},{wallNow:()=>wall});
  await loader.refresh('SPYUSDT',[window],window.end);await loader.refresh('SPYUSDT',[window],window.end);assert.equal(calls,1);
  assert.equal(loader.read('SPYUSDT',window,window.end).length,0);assert.match(loader.note,/offline/);
  wall+=49*3600000;await loader.refresh('SPYUSDT',[window],window.end);assert.equal(calls,1);assert.match(loader.note,/48h/);
});
test('cancellation cannot publish late trades',async()=>{
  let resolve;const loader=new TpoTradeLoader(()=>new Promise(r=>resolve=r),{wallNow:()=>window.end});
  const pending=loader.refresh('SPYUSDT',[window],window.end);loader.cancel();resolve([raw(1,start)]);await pending;
  assert.equal(loader.entries.size,0);
});
test('live incremental ranges keep previous prices and reject ID gaps across refreshes',async()=>{
  let wall=start+B/2,calls=0;
  const loader=new TpoTradeLoader(async()=>calls++===0?[raw(1,start,100)]:[raw(3,start+B/2,110)],{wallNow:()=>wall});
  await loader.refresh('SPYUSDT',[window],wall);assert.equal(loader.read('SPYUSDT',window,wall).length,1);
  wall+=30000;await loader.refresh('SPYUSDT',[window],wall);assert.match(loader.note,/Thiếu/);
  assert.deepEqual([...loader.entries.values()][0].prices,new Set([100]));
});
test('zoom aggregation changes drawing only, leaves profile counts untouched',()=>{
  assert.equal(tpoRenderMode(8,14),'cells');assert.equal(tpoRenderMode(5,6),'cells');assert.equal(tpoRenderMode(1,1),'compact');
  const rows=[{index:1,low:1,high:2,blocks:[0,1]},{index:2,low:2,high:3,blocks:[2]}],copy=JSON.stringify(rows);
  assert.equal(compactTpoRows(rows,()=>10.2).length,1);assert.equal(JSON.stringify(rows),copy);
});
