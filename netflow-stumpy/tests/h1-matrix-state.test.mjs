import test from 'node:test';
import assert from 'node:assert/strict';
import {buildH1Matrix,matrixOptions,hasTrendPrediction,cvdConfirmationText} from '../h1-matrix-state.mjs';
const H=3600000;
const record=(i,d=1)=>({blockStart:i*H,closedBars:4,status:'LOCKED',parts:{position:d,slope:d,randomWalk:d,deltaNF:d,oi:d},bonus:{randomWalkAlignment:d},missing:[]});
test('matrix preserves six rows, chronological groups, and two recent supported states',()=>{
 const r=Array.from({length:9},(_,i)=>record(i));const m=buildH1Matrix(r);
 assert.equal(m.rows.length,6);assert.equal(m.columns.length,9);assert.deepEqual(m.groups.map(g=>g.state),['UP','UP']);assert.equal(m.groups[0].from,3*H);assert.equal(m.groups[1].from,6*H);
});
test('weakening requires actual earlier support, not a low total or missing OI',()=>{
 const r=Array.from({length:6},(_,i)=>record(i));for(const x of r.slice(3)){x.parts.deltaNF=0;x.parts.oi=0;}
 assert.equal(buildH1Matrix(r).groups[1].state,'UP_WEAK');
 r[4].parts.oi=null;r[4].status='PARTIAL';assert.equal(buildH1Matrix(r).groups[1].state,'MISSING');
});
test('price-flow conflict and bearish support remain distinct',()=>{
 const r=Array.from({length:6},(_,i)=>record(i,-1));assert.equal(buildH1Matrix(r).groups[1].state,'DOWN');
 for(const x of r.slice(3))x.parts.deltaNF=1;assert.equal(buildH1Matrix(r).groups[1].state,'CONFLICT');
});
test('forming and future preview scores never enter matrix; gaps do not create a group',()=>{
 const r=Array.from({length:6},(_,i)=>record(i));const a=buildH1Matrix(r);r.push({...record(6),status:'PREVIEW',closedBars:3});assert.deepEqual(buildH1Matrix(r),a);
 r[4].blockStart=100*H;assert.ok(buildH1Matrix(r).groups.some(g=>g.state==='WAIT'));
});
test('window, group size and count change actual inference grouping',()=>{
 const r=Array.from({length:80},(_,i)=>record(i));
 const a=buildH1Matrix(r,{window:10,size:2,groups:3});assert.equal(a.columns.length,10);assert.equal(a.groups.length,3);assert.ok(a.groups.every(g=>g.count===2));assert.equal(a.groups[2].from,78*H);
 const b=buildH1Matrix(r,{window:6,size:2,groups:1});assert.equal(b.columns.length,6);assert.equal(b.groups[0].from,78*H);
 assert.deepEqual(matrixOptions({size:100}),{window:9,size:3,groups:2});assert.equal(matrixOptions({window:6,size:4,groups:3}).groups,1);
});
test('unknown trend forecasts are hidden; zero probability remains a valid prediction',()=>{
 assert.equal(hasTrendPrediction(null),false);assert.equal(hasTrendPrediction({active:true,reliable:false,continuation:null}),false);
 assert.equal(hasTrendPrediction({active:true,reliable:true,continuation:0}),true);assert.equal(hasTrendPrediction({active:false,reliable:true,continuation:.9}),false);
});
test('CVD conflict is omitted and valid confirmation retains its count',()=>{
 assert.equal(cvdConfirmationText({state:'conflict',count:3,support:0,share:0}),'');assert.equal(cvdConfirmationText({state:'confirmed',count:3,support:2,share:.8}),'XN 2/3 · 80%');
});
