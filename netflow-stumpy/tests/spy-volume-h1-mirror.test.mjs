import test from 'node:test';
import assert from 'node:assert/strict';
import {h1ScoreMirror} from '../spy-volume-h1-mirror.mjs';
const H=3600000,S=900000;
const score=(start,value,extra={})=>({blockStart:start,blockEnd:start+H-1,lockedAt:start+H,status:'LOCKED',closedBars:4,missing:[],score:value,...extra});
const rows=values=>values.map((adjusted,i)=>({t:i*S,end:(i+1)*S-1,adjusted}));
test('mirror has opposite sign to smoothed original and preserves zero',()=>{
  const result=h1ScoreMirror(rows([.8,.8,.8,.8]),[],{now:4*S});assert(result.every(r=>Math.abs(r.adjusted+.8)<1e-12));assert.equal(h1ScoreMirror(rows([0]),[],{now:S})[0].adjusted,0);
});
test('H1 weights start next hour, never on the four candles that generated the score',()=>{
  const result=h1ScoreMirror(rows([.1,.2,.3,.4,.5,.6,.7,.8,.9]),[score(0,5)],{now:9*S});assert.deepEqual(result.slice(0,4).map(r=>r.weight),[1,1,1,1]);assert.deepEqual(result.slice(4,8).map(r=>r.weight),[6,6,6,6]);assert.equal(result[8].weight,1);assert.equal(result[8].h1Score,null);
});
test('negative scores produce positive weights and never an extra sign inversion',()=>{
  const input=rows([.1,.2,.3,.4,.9]);assert.deepEqual(h1ScoreMirror(input,[score(0,-5)],{now:5*S}),h1ScoreMirror(input,[score(0,5)],{now:5*S}).map(r=>({...r,h1Score:r.h1Score===null?null:-r.h1Score})));
});
test('weighted smoothing gives a strong closed H1 more influence',()=>{
  const input=rows([0,0,0,0,1]),a=h1ScoreMirror(input,[score(0,5)],{now:5*S}).at(-1),b=h1ScoreMirror(input,[],{now:5*S}).at(-1);assert(a.smoothed>b.smoothed);assert(a.smoothed<=1);assert(a.weight===6);
});
test('preview and missing score data use baseline weight without inventing score zero',()=>{
  const result=h1ScoreMirror(rows([0,0,0,0,1]),[score(0,5,{status:'PREVIEW',closedBars:3}),score(0,5,{missing:['OI_P62']})],{now:5*S});assert(result.every(r=>r.weight===1&&r.h1Score===null));
});
test('future H1 scores and changing the live raw point cannot change closed history',()=>{
  const input=rows([.2,.3,.1,-.2,.4,.9]),now=5*S+100,a=h1ScoreMirror(input,[score(0,3)],{now});
  const changed=input.map((r,i)=>i===5?{...r,adjusted:-.9}:r),b=h1ScoreMirror(changed,[score(0,3),score(H,-5)],{now});assert.deepEqual(a.slice(0,5),b.slice(0,5));assert.notEqual(a.at(-1).adjusted,b.at(-1).adjusted);assert(a.at(-1).provisional);
});
test('missing samples and time gaps restart smoothing rather than bridge unknown data',()=>{
  const a=h1ScoreMirror([{t:0,adjusted:1},{t:2*S,adjusted:-1}],[],{now:3*S});assert.equal(a[1].adjusted,1);
  const b=h1ScoreMirror(rows([1,null,-1]),[],{now:3*S});assert.equal(b[1].adjusted,null);assert.equal(b[2].adjusted,1);
});
test('material reversals cross on the first sample in both directions, faster than the old half-life 2 filter',()=>{
  for(const sign of [1,-1]){
    const values=[...Array(12).fill(.8*sign),...Array(6).fill(-.8*sign)];
    const result=h1ScoreMirror(rows(values),[],{now:values.length*S});
    assert.equal(Math.sign(result[12].smoothed),-sign);assert(result[12].alpha>=.90);
    let n=0,m=0;const old=values.map(v=>{n=2**(-1/2)*n+v;m=2**(-1/2)*m+1;return n/m;});
    assert(result.findIndex((r,i)=>i>=12&&Math.sign(r.smoothed)===-sign)<old.findIndex((v,i)=>i>=12&&Math.sign(v)===-sign));
  }
});
test('expiry of a strong H1 cannot leave old weight mass resisting reversal',()=>{
  const result=h1ScoreMirror(rows([...Array(8).fill(.8),-.1]),[score(0,5)],{now:9*S});
  assert.equal(result[7].weight,6);assert.equal(result[8].weight,1);assert(result[8].smoothed<0);assert(result[8].alpha>.9);
});
test('small fluctuations remain smoother and updates never overshoot input extrema',()=>{
  const values=Array.from({length:40},(_,i)=>.3+(i%2?.01:-.01)),result=h1ScoreMirror(rows(values),[],{now:40*S});
  const variance=a=>{const mean=a.reduce((s,x)=>s+x,0)/a.length;return a.reduce((s,x)=>s+(x-mean)**2,0)/a.length;};
  assert(variance(result.slice(10).map(r=>r.smoothed))<variance(values.slice(10)));
  assert(result.every(r=>r.smoothed>=.29-1e-12&&r.smoothed<=.31+1e-12));
});

