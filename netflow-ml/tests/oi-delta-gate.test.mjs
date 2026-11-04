import test from 'node:test';
import assert from 'node:assert/strict';
import {oiDeltaGates} from '../oi-delta-gate.mjs';
import {oiCandleBars} from '../oi-candle-bars.mjs';
const step=900000,start=Date.parse('2026-11-03T05:00:00Z');
function fixture(delta){return new Map(Array.from({length:12},(_,i)=>[start+i*step,{oi:1000+Math.min(i,10)*10+(i===11?delta:0)}]));}
test('strict P62 threshold uses ten preceding absolute deltas, excluding current spike',()=>{
  const t=start+11*step,now=t+step;
  for(const [delta,passed] of [[9,false],[10,false],[11,true],[1000,true]]){
    const result=oiDeltaGates(fixture(delta),step,now).get(t);assert.equal(result.baseline,10);assert.equal(result.threshold,10);assert.equal(result.passed,passed);
  }
  assert.equal(oiDeltaGates(fixture(15),step,now,{multiplier:1.5}).get(t).passed,false);
  assert.equal(oiDeltaGates(fixture(16),step,now,{multiplier:1.5}).get(t).passed,true);
});
test('P62 uses linear interpolation and resists a single extreme baseline delta',()=>{
  const t=start+11*step,now=t+step;
  const make=last=>{let oi=1000;return new Map([0,...[2,3,4,5,6,7,8,9,10,last,8]].map((delta,i)=>{oi+=delta;return [start+i*step,{oi}];}));};
  const a=oiDeltaGates(make(11),step,now).get(t),b=oiDeltaGates(make(100),step,now).get(t);
  assert.ok(Math.abs(b.threshold-7.58)<1e-9);assert.equal(a.threshold,b.threshold);assert.equal(b.passed,true);
  assert.equal(oiDeltaGates(make(100),step,now,{percentile:.8}).get(t).passed,false);
});
test('insufficient history, a gap and an unclosed sample never grant the gate',()=>{
  const oi=fixture(20),t=start+11*step;
  assert.equal(oiDeltaGates(oi,step,t+step).get(start+10*step).ready,false);
  assert.equal(oiDeltaGates(oi,step,t+step-1).has(t),false);
  oi.delete(start+5*step);assert.equal(oiDeltaGates(oi,step,t+step).get(t).ready,false);
});
test('OI threshold filters both old consensus and the new falling-price OI expansion',()=>{
  const t=start+11*step,now=t+step,row={t,end:now-1,o:101,c:100,h:102,l:99};
  const run=delta=>oiCandleBars([row],[{t,value:-1}],[{t,net:-20}],fixture(delta),step,now,{history:true,minOiMultiplier:1});
  assert.equal(run(10).matched,0);assert.equal(run(11).matched,1);assert.equal(run(11).points.get(t).kind,'down-oi-increase');
  assert.equal(run(-10).matched,0);assert.equal(run(-11).matched,1);assert.equal(run(-11).points.get(t).kind,'down-oi-decrease');
});
