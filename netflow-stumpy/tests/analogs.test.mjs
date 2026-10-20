import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchAnalogs,shapeDistance,candidateIndices} from '../analogs-core.mjs';
const rows=Array.from({length:400},(_,i)=>({t:i*900000,c:100+i/100,high:101+i/100,low:99+i/100,day:String(Math.floor(i/40)),session:'RTH',eligible:true,x:[Math.sin(i/7)+i/200,Math.cos(i/3),Math.sin(i/5),Math.cos(i/9)]}));
test('causal complete outcomes before query; days and full intervals are distinct',()=>{
 const m=16,h=3,r=searchAnalogs(rows,{m,h});assert.ok(r.n>0);assert.equal(new Set(r.matches.map(x=>x.day)).size,r.n);
 for(const a of r.matches){assert.ok(a.index+m+h-1<rows.length-m);for(const b of r.matches)if(a!==b)assert.ok(a.index>b.index+m+h-1||b.index>a.index+m+h-1);}
});
test('mutating candidate forward returns cannot change candidate distance',()=>{
 const a=rows.slice(20,36),b=rows.slice(-16),d=shapeDistance(a,b);const changed=structuredClone(rows);changed[38].c=10000;assert.equal(shapeDistance(changed.slice(20,36),b),d);
});
test('gaps, missing channels, session-crossing labels rejected',()=>{
 const bad=structuredClone(rows);bad[25].t+=1;for(const i of candidateIndices(bad,16,3))assert.ok(!(i<=25&&i+18>=25));
 const missing=structuredClone(rows);missing.at(-1).x[1]=null;assert.equal(searchAnalogs(missing).n,0);
 const wrong=structuredClone(rows);wrong.at(-1).eligible=false;assert.equal(searchAnalogs(wrong).n,0);
});
test('constant distance convention matches STUMPY',()=>{
 const a=Array.from({length:8},()=>({x:[1,1,1,1]}));assert.equal(shapeDistance(a,a),0);
 const b=Array.from({length:8},(_,i)=>({x:[i,i,i,i]}));assert.equal(shapeDistance(a,b),1);
});
test('real STUMPY MASS vs browser distance across all admitted historical candidates',(t)=>{
 if(!process.env.ANALOG_FEATURES||!process.env.ANALOG_PROFILES){t.skip('Run with actual STUMPY profiles');return;}
 const data=JSON.parse(fs.readFileSync(process.env.ANALOG_FEATURES)),profiles=JSON.parse(fs.readFileSync(process.env.ANALOG_PROFILES));let n=0;
 for(const [key,ranked]of Object.entries(profiles.ranked)){const [symbol,window]=key.split(':'),m=+window,a=data.rows[symbol],q=a.slice(-m);for(const r of ranked){assert.ok(Math.abs(shapeDistance(q,a.slice(r.index,r.index+m))-r.distance)<1e-5,`${key}:${r.index}`);n++;}}
 if(!n)t.skip('No admissible query in this session');else console.log(`Compared ${n} real STUMPY distances`);
});
