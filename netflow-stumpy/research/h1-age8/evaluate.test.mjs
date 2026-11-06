import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,distance,prepare,candidates} from './evaluate.mjs';
import {trendAgeStatistics} from '../../pre-rth-wlr-trend.mjs';
const H=3600000;
const window=scores=>scores.map((score,i)=>({t:i*H,score,basis:'NO_OI_4_COMPONENTS'}));
test('eight-box order matters even with equal average scores',()=>{
  const a=encode(window([-3,-2,-1,0,0,1,2,3]),1),b=encode(window([3,2,1,0,0,-1,-2,-3]),1);
  assert.ok(distance(a,b)>0);assert.equal(distance(a,a),0);
});
test('missing hour and mixed data basis cannot become a complete code',()=>{
  const a=window([1,1,1,1,1,1,1,1]);a[4].t+=H;assert.equal(encode(a,1),null);
  const b=window([1,1,1,1,1,1,1,1]);b[4].basis='FULL_OI';assert.equal(encode(b,1),null);
});
test('history rejects future outcomes, overlapping windows and repeated episode samples',()=>{
  const vector=Array(8).fill(0),q={day:'2026-06-04',direction:1,age:1,windowStart:100,episode:{id:99},vector};
  const make=(id,resolvedAt)=>({id,day:'2026-06-03',direction:1,duration:4,resolvedAt,members:[{vector}]});
  const old=make(1,90),future=make(2,101);const eligible=candidates(q,[old,future]);
  assert.deepEqual(eligible.map(x=>x.episode.id),[1]);
  assert.deepEqual(candidates(q,[old,future,make(3,1000)]).map(x=>x.episode.id),[1]);
});
test('day boundary censors a trend; an observed color change ends it',()=>{
  const records=Array.from({length:15},(_,i)=>({t:i*H,end:(i+1)*H,day:i<2?'2026-01-01':i<10?'2026-01-02':'2026-01-03',score:1,basis:'NO_OI_4_COMPONENTS',direction:i===8?0:1}));
  const {episodes}=prepare(records);
  assert.equal(episodes[0].duration,6);assert.equal(episodes[0].censored,false);
  assert.equal(episodes[1].duration,1);assert.equal(episodes[1].censored,true);
  assert.equal(episodes.at(-1).resolvedAt,Infinity);
});
test('small analog cohorts return WAIT with no probability',()=>{
  const stats=trendAgeStatistics(Array.from({length:19},()=>({duration:4,censored:false})),1,1,20,8);
  assert.equal(stats.ready,false);assert.equal(stats.continuation,null);
});
