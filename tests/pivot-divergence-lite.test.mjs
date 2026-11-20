import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeGeometry} from '../netflow-stumpy/geometry.mjs';
import {analyzePivotDivergences} from '../netflow-stumpy/pivot-divergence.mjs';
function fixture(step=900000){
 const t=Date.UTC(2026,10,10);
 const price=Array.from({length:280},(_,i)=>{const c=200+Math.sin(i/5)*4+Math.sin(i/13)*2+i*.02;return {t:t+i*step,end:t+(i+1)*step-1,o:c-.2,h:c+.6,l:c-.7,c};});
 const values=price.map((b,i)=>({t:b.t,adjusted:Math.sin(i/9)}));
 return {price,spy:values,qqq:values.map(v=>({...v,adjusted:-v.adjusted})),flow:price.map((b,i)=>({t:b.t,net:Math.sin(i/4)*100000})),volume:values};
}
for(const step of [900000,3600000]){
 test('light pivot/divergence matches full geometry at step '+step,()=>{
  const input=fixture(step),old=analyzeGeometry(input,{minScore:55}),next=analyzePivotDivergences(input,{minScore:55});
  assert.deepEqual(next.pivots,old.pivots);assert.deepEqual(next.events,old.events);assert.deepEqual(next.atr,old.atr);
  assert.equal(next.pivotSource,old.pivotSource);assert.equal(next.lines.length,0);assert.equal(next.patterns.length,0);
 });
}
test('H1 color pivots stay independent after trendline removal',()=>{
 const input=fixture();
 input.h1CandleColors=input.price.map((b,i)=>({t:b.t,blockStart:b.t,blockEnd:b.t+900000,direction:Math.sin(i/8)>0?1:-1,preview:false}));
 const old=analyzeGeometry(input),next=analyzePivotDivergences(input);
 assert.deepEqual(next.h1Pivots,old.h1Pivots);assert.deepEqual(next.pivots,old.pivots);assert.deepEqual(next.events,old.events);
});
test('empty history is safe',()=>{
 const r=analyzePivotDivergences({price:[]});assert.deepEqual(r.pivots,[]);assert.deepEqual(r.events,[]);
});
