import test from 'node:test';
import assert from 'node:assert/strict';
import {tpoSession,tpoWindows,buildTpo,tpoBlockLetter,TPO_CONTROL_IDS} from '../tpo-profile.mjs';
import {TpoMinuteLoader} from '../tpo-minutes.mjs';
test('daily TPO starts at New York midnight and includes actual weekend data',()=>{
  const w=tpoSession(Date.parse('2026-11-23T15:30Z'),'DAY');
  assert.equal(w.start,Date.parse('2026-11-23T05:00Z'));assert.equal(w.end,Date.parse('2026-11-24T05:00Z'));
  assert.equal(tpoSession(Date.parse('2026-11-22T15:30Z'),'DAY').session,'DAY');
});
test('midnight boundaries handle 23-hour and 25-hour DST days',()=>{
  const spring=tpoSession(Date.parse('2026-03-08T16:00Z'),'DAY'),fall=tpoSession(Date.parse('2026-11-01T16:00Z'),'DAY');
  assert.equal(spring.end-spring.start,23*3600000);assert.equal(fall.end-fall.start,25*3600000);
  assert.equal(spring.start,Date.parse('2026-03-08T05:00Z'));assert.equal(fall.start,Date.parse('2026-11-01T04:00Z'));
});
test('daily profile groups night, PRE, RTH and POST and anchors IB at midnight',()=>{
  const start=Date.parse('2026-11-23T05:00Z');
  const bars=Array.from({length:96},(_,i)=>({t:start+i*900000,l:i<4?99:90,h:i<4?101:110}));
  const windows=tpoWindows(bars,{session:'DAY'});assert.equal(windows.length,1);assert.equal(windows[0].bars.length,96);
  const p=buildTpo(windows[0],{source:'M15',now:start+86400000});assert.deepEqual(p.ib,{low:99,high:101,complete:true});assert.equal(p.missing,0);
  assert.equal(tpoBlockLetter(0),'A');assert.equal(tpoBlockLetter(25),'Z');assert.equal(tpoBlockLetter(26),'a');assert.equal(tpoBlockLetter(49),'x');
  assert.ok(TPO_CONTROL_IDS.includes('tpo-anchor'));assert.ok(TPO_CONTROL_IDS.includes('price-chart-style'));
});
test('M1 loader paginates a complete 25-hour day without discarding coverage',async()=>{
  const w=tpoSession(Date.parse('2026-11-01T16:00Z'),'DAY');let calls=0;
  const raw=Array.from({length:1500},(_,i)=>{const t=w.start+i*60000;return [t,100,101,99,100,1,t+59999];});
  const loader=new TpoMinuteLoader(async path=>{calls++;const q=new URL(path,'https://example.com').searchParams;return raw.filter(r=>r[0]>=+q.get('startTime')&&r[0]<=+q.get('endTime')).slice(0,1000);});
  await loader.refresh('SPYUSDT',[w],w.end);assert.equal(calls,2);assert.equal(loader.read('SPYUSDT',[w]).length,1500);
  await loader.refresh('SPYUSDT',[w],w.end+60000);assert.equal(calls,2);
});
