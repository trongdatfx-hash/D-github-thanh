import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderBookMomentum,sustainedTradePressure} from '../orderbook-momentum.mjs';
const minute=(flow,count=20)=>({ready:true,count,total:100,delta:flow*100,flow});
test('recent pressure and 2/3 same-side minutes are required symmetrically',()=>{
 for(const side of [1,-1]){
  const p={seconds:300,state:side>0?'buy':'sell'};
  assert.equal(sustainedTradePressure(p,[minute(.2*side),minute(.5*side),minute(-.3*side)]).passed,true);
  assert.equal(sustainedTradePressure(p,[minute(-.2*side),minute(.5*side),minute(.5*side)]).passed,false);
  assert.equal(sustainedTradePressure(p,[minute(.09*side),minute(.5*side),minute(.5*side)]).passed,false);
  assert.equal(sustainedTradePressure(p,[minute(.5*side,9),minute(.5*side),minute(.5*side)]).reason,'recent-quiet');
  assert.equal(sustainedTradePressure(p,[minute(.5*side),minute(-.5*side),minute(-.5*side)]).reason,'not-sustained');
  assert.equal(sustainedTradePressure(p,[minute(.5*side),minute(.5*side,4),minute(-.5*side)]).passed,false);
 }
});
test('missing history blocks long push labels, while provisional and absorption classifications keep separate rules',()=>{
 const ms=[minute(.5),minute(.5),{...minute(.5),ready:false}];
 assert.equal(sustainedTradePressure({seconds:180,state:'buy'},ms).reason,'history');
 assert.equal(sustainedTradePressure({seconds:60,state:'buy'},ms).applied,false);
 assert.equal(sustainedTradePressure({seconds:300,state:'buyAbsorbed'},ms).applied,false);
});
test('actual minute buckets do not overlap and an old large buy cannot bypass latest selling',()=>{
 const now=300000,m=new OrderBookMomentum({now:()=>now,horizon:180});m.reset('SPYUSDT');m.bookSince=m.tapeSince=0;m.lastBookAt=m.lastTradeAt=now;m.tapeConnected=true;m.transport='WS';m.latest={};
 for(let i=0;i<180;i++){
  const b=m.bucket(120000+i*1000);Object.assign(b,{buy:i<120?100:0,sell:i>=120?10:0,count:2,samples:1,obi:.5,micro:.1,ofi:1,ofiScale:2,first:100+i*.01,last:100+i*.01,high:100+i*.01,low:100+i*.01,spread:.1,bidDepth:100,askDepth:100});
 }
 const minutes=[0,1,2].map(i=>m.window(60,now-i*60000));assert.deepEqual(minutes.map(w=>w.delta),[-600,6000,6000]);
 assert.equal(m.window(180,now).state,'buy');let r=m.read();assert.equal(r.raw,'mixed');assert.equal(r.persistence.reason,'recent-opposed');assert.equal(r.summary.large,false);
 const before=minutes.map(w=>w.delta);Object.assign(m.bucket(now+5000),{buy:999999,sell:0,count:100});assert.deepEqual([0,1,2].map(i=>m.window(60,now-i*60000).delta),before);
});
