import test from 'node:test';
import assert from 'node:assert/strict';
import {spyUsdtSessionChange} from '../spy-session-change.mjs';

const row=(time,c,session)=>({t:Date.parse(time),c,session});
const friday=row('2026-11-07T00:45:00Z',100,'POST');
const weekend=row('2026-11-08T16:00:00Z',100.95,'WEEKEND');
const monday=row('2026-11-10T00:45:00Z',102,'POST');
const calc=(rows,now,options)=>spyUsdtSessionChange(rows,{now:Date.parse(now),...options});

test('uses Friday Post close over the weekend and keeps the strict warning threshold',()=>{
 const state=calc([friday,weekend],'2026-11-08T16:10:00Z');
 assert.equal(state.reference,100);
 assert.equal(state.postDay,'2026-11-06');
 assert.equal(state.volatile,false);
 assert.equal(calc([friday,{...weekend,c:99.04}],'2026-11-08T16:10:00Z').volatile,true);
});

test('changes reference only when the closing candle closes',()=>{
 assert.equal(calc([friday,monday],'2026-11-10T00:59:59Z').reference,100);
 assert.equal(calc([friday,monday],'2026-11-10T01:00:00Z').reference,102);
});

test('handles early closes and H1',()=>{
 const early=row('2026-11-27T21:00:00Z',103,'POST');
 const after=row('2026-11-27T22:00:00Z',104,'NIGHT');
 const state=calc([early,after],'2026-11-27T22:05:00Z',{step:3600000});
 assert.equal(state.reference,103);
 assert.equal(state.postClock,'17:00');
});

test('requires a valid Post close and skips holidays and incomplete sessions',()=>{
 const holiday=row('2026-11-27T00:45:00Z',110,'POST');
 const incomplete=row('2026-11-28T00:30:00Z',111,'POST');
 assert.equal(calc([holiday,incomplete],'2026-11-28T02:00:00Z'),null);
});
