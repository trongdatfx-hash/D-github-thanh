import test from 'node:test';
import assert from 'node:assert/strict';
import {CvdBadgeBorder} from '../cvd-badge-border.mjs';
const at=(time,cvd=100,quote=1000)=>({cvd,quote,time,now:time,fresh:true,key:'SPYUSDT:15m'});
function warm(){const filter=new CvdBadgeBorder();for(const time of [1000,4000,7000,10000])filter.update(at(time));assert.equal(filter.state,'buy');return filter;}
test('first directional border needs real updates over nine seconds',()=>{
 const filter=new CvdBadgeBorder();
 for(const time of [1000,4000,7000])assert.equal(filter.update(at(time)),'neutral');
 assert.equal(filter.update(at(10000)),'buy');
});
test('mouse/OI calls at the same chart timestamp do not confirm a color',()=>{
 const filter=new CvdBadgeBorder();
 for(let i=0;i<20;i++)assert.equal(filter.update({...at(1000),now:1000+i*100}),'neutral');
 assert.equal(filter.pending.count,1);
});
test('alternating opposite ticks retain the supported border',()=>{
 const filter=warm();
 for(let i=1;i<=20;i++)assert.equal(filter.update(at(10000+i*3000,i%2?-100:100)),'buy');
});
test('sustained opposite direction respects confirmation and minimum hold',()=>{
 const filter=warm();
 for(const time of [13000,16000,19000,22000])assert.equal(filter.update(at(time,-100)),'buy');
 assert.equal(filter.update(at(25000,-100)),'sell');
});
test('deadband preserves small same-side CVD and rejects weak opposite ticks',()=>{
 const filter=warm();
 assert.equal(filter.update(at(13000,25)),'buy');
 for(const time of [16000,19000,22000])assert.equal(filter.update(at(time,-30)),'buy');
});
test('persistent neutral flow eventually returns a gray border',()=>{
 const filter=warm();
 for(const time of [13000,16000,19000,22000,25000,28000,31000])assert.equal(filter.update(at(time,0)),'buy');
 assert.equal(filter.update(at(34000,0)),'neutral');
});
test('brief missing data holds the border but stale data expires it',()=>{
 const filter=warm();
 assert.equal(filter.update({...at(10000),now:25000,fresh:false}),'buy');
 assert.equal(filter.update({...at(10000),now:30000,fresh:false}),'neutral');
});
test('fresh response after a long outage cannot revive the old color',()=>{
 const filter=warm();assert.equal(filter.update(at(40000,-100)),'neutral');
 assert.equal(filter.pending.count,1);
});
test('symbol/timeframe changes reset old color and pending evidence',()=>{
 const filter=warm();assert.equal(filter.update({...at(13000),key:'SPYUSDT:1h'}),'neutral');
});
test('invalid numeric data and backwards source time cannot change color',()=>{
 const filter=warm();
 assert.equal(filter.update(at(9000,-100)),'buy');
 assert.equal(filter.update(at(13000,2000,1000)),'buy');
 assert.equal(filter.update({...at(34000),cvd:NaN}),'neutral');
});
