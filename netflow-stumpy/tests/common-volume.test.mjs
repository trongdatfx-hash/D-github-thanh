import test from 'node:test';
import assert from 'node:assert/strict';
import {STEPS} from '../engine.mjs';
import {normalizedTakerVolumeDelta,commonTakerDeltaValue,calculateCommonTakerVolumeStrength} from '../common-volume.mjs';

test('D common uses true taker quote delta, independent of candle-body direction',()=>{
  const step=STEPS['15m'],bars=[
    {t:0,o:100,c:101,q:100,buy:40,net:-20},
    {t:step,o:101,c:100,q:200,buy:130,net:60},
    {t:3*step,o:100,c:101,q:80,buy:20,net:-40}
  ],delta=normalizedTakerVolumeDelta(bars,step,{normLen:2});
  assert.deepEqual(delta.map(row=>row.value),[-.2,.4,-.5]);
  assert.equal(delta[0].value<0,true);assert.equal(bars[0].c>bars[0].o,true);
});

test('D common applies the fixed 70/30 tanh blend',()=>{
  const expected=.7*Math.tanh(.5)+.3*Math.tanh(-.25);
  assert(Math.abs(commonTakerDeltaValue(.5,-.25)-expected)<1e-12);
  assert.equal(commonTakerDeltaValue(null,.2),null);
});

test('D common remains causal and bounded after the SPY V smoothing chain',()=>{
  const step=STEPS['15m'],make=(qqq=false)=>Array.from({length:520},(_,i)=>{const q=100,net=(i%11<(qqq?6:7)?1:-1)*(qqq?24:40);return {t:i*step,end:(i+1)*step-1,o:100,c:100+(i%2?.2:-.2),v:100,q,buy:(q+net)/2,net,session:'RTH',day:'2026-10-24'};}),spy=make(false),qqq=make(true),full=calculateCommonTakerVolumeStrength(spy,qqq,step).rows,short=calculateCommonTakerVolumeStrength(spy.slice(0,510),qqq.slice(0,510),step).rows;
  assert.equal(full.findIndex(row=>Number.isFinite(row.adjusted)),506);
  assert(full.filter(row=>Number.isFinite(row.adjusted)).every(row=>row.adjusted>=-1&&row.adjusted<=1));
  assert.deepEqual(short.map(row=>row.adjusted),full.slice(0,510).map(row=>row.adjusted));
});
