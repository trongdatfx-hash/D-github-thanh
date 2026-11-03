import test from 'node:test';
import assert from 'node:assert/strict';
import {oiSpectrum} from '../oi-spectrum.mjs';
const step=900000,rows=Array.from({length:4},(_,i)=>({t:i*step,end:(i+1)*step-1,c:100}));
const points=values=>new Map(values.map((oi,i)=>[i*step,{t:i*step,oi}]));
test('keeps OI increases and decreases separate at the same price',()=>{
 const p=oiSpectrum(rows,points([100,110,105,105]),step,4*step);
 assert(p.ready);assert.deepEqual(p.times,[step,2*step,3*step]);assert.deepEqual(p.bins,[{price:100,opened:10,closed:5}]);assert.equal(p.max,10);
});
test('unchanged open interest contributes zero rather than repeatedly counting the stock',()=>{
 const p=oiSpectrum(rows,points([100,100,100,100]),step,4*step);assert(p.ready);assert.equal(p.max,0);
});
test('open candles, stale samples and gaps cannot fabricate current OI',()=>{
 const oi=points([100,110,105,108]);
 const p=oiSpectrum(rows,oi,step,3*step);assert.deepEqual(p.times,[step,2*step]);
 oi.delete(2*step);assert.equal(oiSpectrum(rows,oi,step,4*step).ready,false);
});
test('invalid OI and unsupported inputs return WAIT',()=>{
 assert.equal(oiSpectrum(rows,points([100,NaN,-1,0]),step,4*step).ready,false);
 assert.equal(oiSpectrum([],new Map(),step,4*step).ready,false);
});

test('only current New York day contributes, with midnight OI allowed as a delta baseline',()=>{
 const midnight=Date.parse('2026-11-03T05:00:00Z'),p=Array.from({length:5},(_,i)=>({t:midnight+(i-2)*step,end:midnight+(i-1)*step-1,c:100})),oi=new Map(p.map((r,i)=>[r.t,{oi:[100,1000,1010,1030,1025][i]}]));
 const profile=oiSpectrum(p,oi,step,midnight+3*step);
 assert(profile.ready);assert.deepEqual(profile.times,p.slice(2).map(r=>r.t));assert.deepEqual(profile.bins,[{price:100,opened:30,closed:5}]);assert.equal(profile.day,'2026-11-03');
 assert.equal(oiSpectrum(p.slice(0,2),oi,step,midnight+3*step).ready,false);
});
test('NY midnight resets OI during both DST seasons, including historical-only data',()=>{
 for(const midnight of [Date.parse('2026-07-06T04:00:00Z'),Date.parse('2026-11-03T05:00:00Z')]){
  const p=Array.from({length:4},(_,i)=>({t:midnight+(i-1)*step,end:midnight+i*step-1,c:100})),oi=new Map(p.map((r,i)=>[r.t,{oi:100+i*10}]));
  assert.equal(oiSpectrum(p,oi,step,midnight).ready,false);
  const profile=oiSpectrum(p,oi,step,midnight+3*step);assert(profile.ready);assert.equal(profile.count,3);assert.equal(profile.first,midnight);
 }
});
