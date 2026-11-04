import test from 'node:test';
import assert from 'node:assert/strict';
import {oiDeltaGates} from '../oi-delta-gate.mjs';
import {oiCandleBars} from '../oi-candle-bars.mjs';
const step=900000,start=Date.parse('2026-11-03T05:00:00Z');
function fixture(delta){return new Map(Array.from({length:22},(_,i)=>[start+i*step,{oi:1000+Math.min(i,20)*10+(i===21?delta:0)}]));}
test('strict threshold uses twenty preceding absolute deltas, excluding current spike',()=>{
  const t=start+21*step,now=t+step;
  for(const [delta,passed] of [[9,false],[10,false],[11,true],[1000,true]]){
    const result=oiDeltaGates(fixture(delta),step,now).get(t);assert.equal(result.baseline,10);assert.equal(result.threshold,10);assert.equal(result.passed,passed);
  }
  assert.equal(oiDeltaGates(fixture(15),step,now,{multiplier:1.5}).get(t).passed,false);
  assert.equal(oiDeltaGates(fixture(16),step,now,{multiplier:1.5}).get(t).passed,true);
});
test('insufficient history, a gap and an unclosed sample never grant the gate',()=>{
  const oi=fixture(20),t=start+21*step;
  assert.equal(oiDeltaGates(oi,step,t+step).get(start+20*step).ready,false);
  assert.equal(oiDeltaGates(oi,step,t+step-1).has(t),false);
  oi.delete(start+10*step);assert.equal(oiDeltaGates(oi,step,t+step).get(t).ready,false);
});
test('OI threshold filters both old consensus and the new falling-price OI expansion',()=>{
  const t=start+21*step,now=t+step,row={t,end:now-1,o:101,c:100,h:102,l:99};
  const run=delta=>oiCandleBars([row],[{t,value:-1}],[{t,net:-20}],fixture(delta),step,now,{history:true,minOiMultiplier:1});
  assert.equal(run(10).matched,0);assert.equal(run(11).matched,1);assert.equal(run(11).points.get(t).kind,'down-oi-increase');
  assert.equal(run(-10).matched,0);assert.equal(run(-11).matched,1);assert.equal(run(-11).points.get(t).kind,'same-sign');
});
