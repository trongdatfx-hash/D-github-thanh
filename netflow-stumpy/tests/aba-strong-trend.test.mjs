import test from 'node:test';import assert from 'node:assert/strict';
import {strongTrendAba} from '../aba-strong-trend.mjs';
const start=Date.parse('2026-10-20T12:00:00Z'),step=900000;
const make=values=>values.map((c,i)=>({t:start+i*step,end:start+(i+1)*step-1,o:c-.1,c,h:c+.3,l:c-.3}));
const rows=make(Array.from({length:25},(_,i)=>100+i*.4)),volume=new Map(rows.map(r=>[r.t,{adjusted:.6}])),composite=new Map(rows.map(r=>[r.t,{adjusted:.4}]));
const run=(extra={})=>strongTrendAba({rows,volume,composite,now:rows.at(-1).t+step,...extra});
test('strong A1 starts on a qualifying close without backfill and leads later trend age',()=>{
 const age=new Map(rows.slice(8).map(r=>[r.t,{label:'UP'}])),r=run({age});
 assert.equal(r.events[0].t,rows[4].t);assert.equal(r.events[0].issuedAt,rows[4].t+step);assert.equal(r.phases.has(rows[3].t),false);assert.equal(r.leading,1);
});
test('simultaneous and late matches are reported honestly',()=>{
 assert.equal(run({age:new Map(rows.slice(4).map(r=>[r.t,{label:'UP'}]))}).same,1);
 assert.equal(run({age:new Map(rows.map(r=>[r.t,{label:'UP'}]))}).late,1);
});
test('future bars do not change earlier phases and an open bar cannot trigger',()=>{
 const full=run(),p=run({rows:rows.slice(0,10),now:rows[10].t});
 assert.deepEqual([...p.phases],[...full.phases].filter(([t])=>t<rows[10].t));assert.deepEqual(p.events,full.events.filter(x=>x.t<rows[10].t));
 assert.equal(run({now:rows[4].end}).events.length,0);
});
test('flat price, missing/opposed flow, gaps and weekend are rejected',()=>{
 assert.equal(run({rows:make(rows.map(()=>100))}).events.length,0);assert.equal(run({volume:new Map()}).events.length,0);
 assert.equal(run({composite:new Map(rows.map(r=>[r.t,{adjusted:-.6}]))}).events.length,0);
 assert.equal(run({rows:rows.filter((_,i)=>i%4!==3)}).events.length,0);
 const p=rows.map(r=>({...r,t:r.t+4*86400000,end:r.end+4*86400000}));assert.equal(run({rows:p,now:p.at(-1).end+1}).events.length,0);
});
test('two adverse closes establish B and a fresh strong return establishes A2',()=>{
 const p=make([100,100.4,100.8,101.2,101.6,102,101.6,101.2,101.6,102,102.4,102.8,103.2]);
 const v=new Map(p.map((r,i)=>[r.t,{adjusted:i===6||i===7?-.6:.6}])),c=new Map(p.map(r=>[r.t,{adjusted:.2}]));
 const r=run({rows:p,volume:v,composite:c,now:p.at(-1).end+1});assert.deepEqual(r.events.map(x=>x.phase),['A1','B','A2']);assert.equal(r.events[1].t,p[7].t);
});
