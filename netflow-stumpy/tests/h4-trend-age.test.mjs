import test from 'node:test';
import assert from 'node:assert/strict';
import {continuousH4Age,h4AgeReadout} from '../h4-trend-age.mjs';
const H=3600000,Q=4*H,T=Date.parse('2026-11-01T21:00:00Z'); // Sunday 16:00 NY, then Monday midnight
const box=(i,d=1,preview=false)=>Array.from({length:preview?2:4},(_,j)=>({t:T+i*Q+j*H,blockStart:T+i*Q,blockEnd:T+(i+1)*Q-1,direction:d,preview}));
test('one H4 counts once and the run crosses midnight, weekends and Monday',()=>{
 const states=[...box(0),...box(1),...box(2),...box(3)],a=continuousH4Age([...states,...states],T+4*Q);
 assert.equal(a.ageH4,4);assert.equal(a.closedH4,4);assert.equal(a.direction,1);assert.equal(a.from,T);
});
test('direction changes restart at one and WAIT resets age to zero',()=>{
 assert.equal(continuousH4Age([...box(0),...box(1),...box(2,-1)],T+3*Q).ageH4,1);
 const wait=continuousH4Age([...box(0),...box(1,0)],T+2*Q);assert.equal(wait.ageH4,0);assert.equal(wait.direction,0);
});
test('forming H4 has a separate preview and never counts as a locked box',()=>{
 const now=T+2*Q+2*H,a=continuousH4Age([...box(0),...box(1),...box(2,1,true)],now);
 assert.equal(a.ageH4,3);assert.equal(a.closedH4,2);assert(a.preview);assert.match(h4AgeReadout(a).text,/PREVIEW/);
 const reversed=continuousH4Age([...box(0),...box(1),...box(2,-1,true)],now);assert.equal(reversed.ageH4,1);assert.equal(reversed.closedH4,0);
});
test('missing H4 cannot bridge the run; invalid incomplete locked groups are ignored',()=>{
 const a=continuousH4Age([...box(0),...box(2)],T+3*Q);assert.equal(a.ageH4,1);assert(a.lowerBound);
 const missing=continuousH4Age(box(0).slice(1),T+Q);assert.equal(missing.boxes,0);
});
test('old data is labelled delayed and future locked groups do not enter age',()=>{
 const a=continuousH4Age([...box(0),...box(5)],T+3*Q);assert.equal(a.ageH4,1);assert(a.delayed);assert.match(h4AgeReadout(a).text,/DELAYED/);
});
