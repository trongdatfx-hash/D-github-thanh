import test from 'node:test';import assert from 'node:assert/strict';
import {strengthBoxes,strengthBoxLabel,normalCDF} from '../strength-box-core.mjs';
const step=900000,start=Date.parse('2026-10-20T07:00:00Z');
const make=(n=100)=>Array.from({length:n},(_,i)=>({t:start+i*step,end:start+(i+1)*step-1,o:100,h:101,l:99,c:100,q:1000,buy:500,session:'RTH'}));
const signal=(rows,entries)=>new Map(rows.map((r,i)=>[r.t,entries.includes(i)?.97:0]));
test('DVP defaults create a back-eight envelope only at the threshold close',()=>{
 const rows=make(),strengthRows=signal(rows,[16,17,18]),r=strengthBoxes(rows,{strengthRows,now:rows[18].end+1}),b=r.latest;
 assert.equal(b.start,rows[8].t);assert.equal(b.entryTime,rows[16].t);assert.equal(b.issuedAt,rows[16].end+1);assert.equal(b.n,11);assert.equal(b.top,101);assert.equal(b.bottom,99);
 assert.equal(r.snapshots.has(rows[15].t),false);assert.equal(r.snapshots.get(rows[16].t).n,9);assert.equal(b.type,'COMPRESSED');assert.match(b.label,/NÉN/);
});
test('extension does not change width/TR mass and breakout freezes before exit bar',()=>{
 const rows=make(24);rows[21]={...rows[21],c:105,h:106};const r=strengthBoxes(rows,{strengthRows:signal(rows,[16,17,18])}),a=r.snapshots.get(rows[18].t),b=r.latest;
 assert.equal(b.freeze,'breakout');assert.equal(b.right,rows[20].t);assert.equal(b.top,a.top);assert.equal(b.tr2,a.tr2);assert.match(b.label,/⤬/);assert.equal(r.snapshots.has(rows[21].t),false);
});
test('timeout uses a dotted-state marker distinct from actual breakout',()=>{
 const rows=make(25),r=strengthBoxes(rows,{strengthRows:signal(rows,[16]),extend:2});assert.equal(r.latest.freeze,'timeout');assert.match(r.latest.label,/⌛/);assert.equal(r.latest.right,rows[17].t);
});
test('classification uses RW efficiency ratio, not probability or flow direction',()=>{
 const rows=make(20);for(let i=8;i<19;i++){rows[i]={...rows[i],c:100+(i-8)*2,h:101+(i-8)*2,l:99+(i-8)*2};}
 const r=strengthBoxes(rows,{strengthRows:signal(rows,[16,17,18]),now:rows[18].end+1});assert.equal(r.latest.type,'PAID');assert.match(r.latest.label,/ĐÃ TRẢ/);
 assert.equal(strengthBoxLabel({...r.latest,ratio:1,type:'NEUTRAL',percentile:.83,phase:'PRE',freeze:null,compositeMode:'off'}),'p83 · PRE');
 assert(Math.abs(normalCDF(0)-.5)<1e-6);
});
test('future candles cannot alter earlier snapshots and open candles do not create a box',()=>{
 const rows=make(),strengthRows=signal(rows,[16,17,18]),full=strengthBoxes(rows,{strengthRows}),cut=strengthBoxes(rows,{strengthRows,now:rows[18].end+1});
 for(const [t,s] of cut.snapshots)assert.deepEqual(s,full.snapshots.get(t));assert.equal(strengthBoxes(rows,{strengthRows,now:rows[16].end}).boxes.length,0);
});
test('Composite annotation preserves original geometry; filtering is entry-only and prospective',()=>{
 const rows=make(24),strengthRows=signal(rows,[16,17,18]),compositeRows=new Map(rows.map(r=>[r.t,{adjusted:-.5}]));
 const original=strengthBoxes(rows,{strengthRows}),annotated=strengthBoxes(rows,{strengthRows,compositeRows,compositeMode:'annotate'}),filtered=strengthBoxes(rows,{strengthRows,compositeRows,compositeMode:'filter'});
 assert.equal(annotated.latest.top,original.latest.top);assert.equal(annotated.latest.bottom,original.latest.bottom);assert.equal(annotated.latest.start,original.latest.start);assert.match(annotated.latest.label,/C nghịch/);assert.equal(filtered.boxes.length,0);
 compositeRows.set(rows[17].t,{adjusted:.5});const later=strengthBoxes(rows,{strengthRows,compositeRows,compositeMode:'filter'});assert.equal(later.latest.entryTime,rows[17].t);
});
test('raw Strength requires its full 500-value normalization history',()=>{
 const rows=make(650).map((r,i)=>({...r,buy:500+200*Math.sin(i/29)})),r=strengthBoxes(rows);assert.equal(r.strength.get(rows[505].t),null);assert(Number.isFinite(r.strength.get(rows[506].t)));
});
