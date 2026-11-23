import test from 'node:test';
import assert from 'node:assert/strict';
import {tpoSession,tpoWindows,buildTpo,parseTpoMinutes,tpoValueArea} from '../tpo-profile.mjs';
import {TpoMinuteLoader} from '../tpo-minutes.mjs';
const start=Date.parse('2026-11-23T14:30:00Z'),m=60000;
const bar=(t,l=100,h=101,step=15*m)=>({t,l,h,o:l,c:h,v:1,end:t+step-1});
const window=(count=4)=>tpoWindows(Array.from({length:count},(_,i)=>bar(start+i*15*m)))[0];
test('New York session anchors adjust for DST and exclude holiday/weekend',()=>{
  assert.equal(tpoSession(start).start,start);
  assert.equal(tpoSession(Date.parse('2026-07-01T13:30Z')).session,'RTH');
  assert.equal(tpoSession(Date.parse('2026-11-23T14:29Z')).session,'PRE');
  assert.equal(tpoSession(Date.parse('2026-11-21T15:00Z')),null);
  assert.equal(tpoSession(Date.parse('2026-11-26T15:00Z')),null);
});
test('same row is counted once per 30m block and IB uses exactly first hour',()=>{
  const w=window(8);w.bars[4]=bar(start+60*m,90,110);
  const p=buildTpo(w,{source:'M15',now:start+120*m,rowSize:.5});
  assert.equal(p.rows.find(r=>r.low===100).blocks.length,4);
  assert.deepEqual(p.ib,{low:100,high:101,complete:true});
  assert.equal(p.missing,0);
  assert.equal(buildTpo(w,{source:'M15',now:w.end,rowSize:.5}).missing,18);
});
test('IB stays provisional before first hour and flags missing opening candles',()=>{
  const w=window(2);const p=buildTpo(w,{now:start+30*m,source:'M15'});
  assert.equal(p.ib.complete,false);assert.equal(p.forming,true);assert.equal(p.missing,0);
  const later=window(8);later.bars.shift();assert.equal(buildTpo(later,{now:start+120*m}).ib.complete,false);
});
test('M1 preserves intra-M15 price gaps; missing minute falls back without double counting',()=>{
  const w=window(1);w.bars=[bar(start,100,110)];
  const minutes=Array.from({length:15},(_,i)=>bar(start+i*m,i<8?100:109,i<8?101:110,m));
  const p=buildTpo(w,{minutes,now:start+15*m,rowSize:1});
  assert.equal(p.source,'M1');assert.equal(p.rows.find(r=>r.low===105).blocks.length,0);
  const fallback=buildTpo(w,{minutes:minutes.slice(1),now:start+15*m,rowSize:1});
  assert.equal(fallback.source,'M15');assert.equal(fallback.rows.find(r=>r.low===105).blocks.length,1);
});
test('M1/M15 coverage is explicit and current minute is included provisionally',()=>{
  const w=window(2),minutes=Array.from({length:16},(_,i)=>bar(start+i*m,100,102,m));
  const mixed=buildTpo(w,{minutes:minutes.slice(0,15),now:start+30*m});assert.equal(mixed.source,'M1/M15');
  const current=buildTpo(w,{minutes,now:start+15*m+1000});assert.equal(current.source,'M1');assert.equal(current.forming,true);
});
test('value area contains contiguous neighbours including zero-count gaps',()=>{
  const rows=[3,0,10,4].map((count,i)=>({index:i,low:i,high:i+1,blocks:Array(count).fill(0)}));
  const v=tpoValueArea(rows);assert.equal(v.pocIndex,2);assert.equal(v.val,2);assert.equal(v.vah,4);assert.ok(v.covered>=v.total*.7);
});
test('minute parsing deduplicates, validates and rejects future rows',()=>{
  const raw=t=>[t,100,101,100,101,1,t+m-1];
  assert.equal(parseTpoMinutes([raw(start),raw(start),raw(start+m)],start+m).length,1);
  assert.throws(()=>parseTpoMinutes([[start,1,0,2,1,1,start+m-1]],start+m));
});
test('loader throttles, caches completed sessions and cancels late results',async()=>{
  const w=window(1);w.end=start+15*m;let calls=0;
  const raw=Array.from({length:15},(_,i)=>{const t=start+i*m;return [t,100,101,100,101,1,t+m-1];});
  const loader=new TpoMinuteLoader(async()=>{calls++;return raw;});
  await loader.refresh('SPYUSDT',[w],w.end);await loader.refresh('SPYUSDT',[w],w.end+120000);
  assert.equal(calls,1);assert.equal(loader.read('SPYUSDT',[w]).length,15);
  let resolve;const delayed=new TpoMinuteLoader(()=>new Promise(r=>{resolve=r;}));
  const pending=delayed.refresh('SPYUSDT',[w],w.end);delayed.cancel();resolve(raw);await pending;
  assert.equal(delayed.read('SPYUSDT',[w]).length,0);
});
test('failed M1 request does not poison coarse history and retries only after cooldown',async()=>{
  let calls=0;const loader=new TpoMinuteLoader(async()=>{calls++;throw Error('offline');}),w=window(1);
  await loader.refresh('SPYUSDT',[w],start+15*m);await loader.refresh('SPYUSDT',[w],start+15*m+1000);
  assert.equal(calls,1);assert.equal(loader.read('SPYUSDT',[w]).length,0);
  await loader.refresh('SPYUSDT',[w],start+16*m);assert.equal(calls,2);
});
