import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderBookMomentum} from '../orderbook-momentum.mjs';
function controlled(){
 let now=100000,state='buy',fast='sell',large=false;
 const m=new OrderBookMomentum({now:()=>now});m.reset('SPYUSDT');m.transport='WS';m.latest={};m.tapeConnected=true;
 m.window=seconds=>({seconds,ready:true,state:seconds===5?fast:state,count:30,total:(large?100:20)/.7,flow:state==='sell'?-.7:.7,delta:(state==='sell'?-1:1)*(large?100:20),bidDepth:100,askDepth:100,obi:.5,ofi:.3});
 const read=()=>{m.lastBookAt=m.lastTradeAt=now;return m.read();};
 const advance=seconds=>{let r;for(let i=0;i<seconds;i++){now+=1000;r=read();}return r;};
 return {m,read,advance,setState:s=>{state=s;},setLarge:()=>{large=true;},setFast:s=>{fast=s;}};
}
test('60s wins over opposite 5s; brief neutral readings do not flash the headline',()=>{
 const c=controlled();c.read();assert.equal(c.advance(8).state,'buy');
 c.setState('mixed');assert.equal(c.advance(3).state,'buy');c.setState('buy');assert.equal(c.advance(3).state,'buy');
});
test('a sustained reversal needs confirmation and minimum hold; stale data still clears immediately',()=>{
 const c=controlled();c.read();c.advance(8);c.setState('sell');assert.equal(c.advance(15).state,'buy');
 assert.equal(c.advance(5).state,'sell');c.m.lastBookAt=0;assert.equal(c.m.read().quality,'offline');assert.equal(c.m.stable,'mixed');
});
test('large imbalance can confirm after 5s but cannot manufacture direction from mixed price evidence',()=>{
 const c=controlled();c.setLarge();c.read();const r=c.advance(5);assert.equal(r.state,'buy');assert.equal(r.summary.large,true);
 const d=controlled();d.setState('mixed');d.setLarge();d.read();assert.equal(d.advance(10).state,'mixed');
});
test('display totals update once in 5s and ratios smooth gradually without changing on repeated reads',()=>{
 const c=controlled();const before=c.read().summary;c.setState('sell');const early=c.advance(4).summary;
 assert.deepEqual(early,before);const after=c.advance(1).summary;assert.ok(after.flow<before.flow&&after.flow>-.7);
 assert.deepEqual(c.read().summary,after);
});
