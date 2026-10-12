import test from 'node:test';
import assert from 'node:assert/strict';
import {ReversalStabilizer} from '../stability.mjs';

const ready=(level,direction=1)=>({ready:true,direction,low:level-1,level,high:level+1,rate:.4,lower:.25,baselineRate:.2,uplift:.2,similarity:.8,n:40,start:1,end:2});

test('REV6 smooths a live zone and confirms disappearance across three new snapshots',()=>{
  const smoother=new ReversalStabilizer({alpha:.25,confirmations:3}),key='SPY|COMPOSITE|15m|1';
  assert.equal(smoother.update(ready(100),key,1).level,100);
  const moved=smoother.update(ready(104),key,2);assert.equal(moved.level,101);assert.equal(moved.smoothed,true);
  const off={ready:false,reason:'confidence',n:40};
  const first=smoother.update(off,key,3);assert.equal(first.ready,true);assert.equal(first.stabilizing,true);
  const repeated=smoother.update(off,key,3);assert.equal(repeated.ready,true);assert.equal(repeated.level,first.level); // repeated render is not a new observation
  assert.equal(smoother.update(off,key,4).ready,true);
  assert.equal(smoother.update(off,key,5).ready,false);
});

test('REV6 resets smoothing immediately for a new candle/configuration key',()=>{
  const smoother=new ReversalStabilizer();smoother.update(ready(100),'a',1);
  assert.equal(smoother.update(ready(110),'b',2).level,110);
});
