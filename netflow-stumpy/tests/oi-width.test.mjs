import test from 'node:test';import assert from 'node:assert/strict';
import {oiWidthByBar} from '../oi-width.mjs';
const step=900000,make=(i,oi)=>({timestamp:(i+1)*step,sumOpenInterest:String(oi)});
test('OI changes only segment width, with causal warmup',()=>{
 const rows=[...Array.from({length:25},(_,i)=>make(i,100+i*.1)),make(25,130)];
 const map=oiWidthByBar(rows,step,26*step);
 assert.equal(map.get(0).state,'WAIT');assert.equal(map.get(25*step).width,4);
 assert.equal(map.get(25*step).state,'increase');
});
test('OI gap, future and malformed periods do not fabricate widths',()=>{
 const rows=[...Array.from({length:25},(_,i)=>make(i,100+i*.1)),make(27,140),{timestamp:30*step-5000,sumOpenInterest:'200'}];
 const map=oiWidthByBar(rows,step,28*step);
 assert.equal(map.get(27*step).state,'WAIT');assert.equal(map.has(29*step),false);
 assert.equal(oiWidthByBar(rows,step,25*step).has(27*step),false);
});
test('future suffix cannot change already known OI widths',()=>{
 const rows=Array.from({length:30},(_,i)=>make(i,100+i*.1));
 assert.deepEqual([...oiWidthByBar(rows.slice(0,25),step,25*step)], [...oiWidthByBar(rows,step,30*step)].slice(0,25));
});
