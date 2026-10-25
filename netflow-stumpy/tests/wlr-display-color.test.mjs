import test from 'node:test';import assert from 'node:assert/strict';
import {wlrDisplayColors,WLR_COLOR_DEFAULTS} from '../wlr-display-color.mjs';
const step=900000;
function source(pairs){return {rows:pairs.map((_,i)=>({t:i*step,mid:100+i})),c:new Map(pairs.map(([c],i)=>[i*step,{adjusted:c}])),v:new Map(pairs.map(([,v],i)=>[i*step,{adjusted:v}]))};}
function run(pairs,options={}){const f=source(pairs);return wlrDisplayColors(f.rows,f.c,f.v,{step,...options});}
test('both strengths must cross the entry threshold; near-zero noise stays neutral',()=>{
 const result=run([[.01,.02],[-.01,-.02],[.149,.4],[.3,.149],[.15,.15]]);
 assert.deepEqual(result.map(x=>x.direction),[0,0,0,0,1]);
 assert.equal(result[0].color,WLR_COLOR_DEFAULTS.neutral);
});
test('positive and negative states have separate entry and exit thresholds',()=>{
 const result=run([[.2,.2],[.1,.11],[.071,.3],[.07,.3],[.1,.3],[-.15,-.15],[-.1,-.12],[-.07,-.4],[-.1,-.4]]);
 assert.deepEqual(result.map(x=>x.direction),[1,1,1,0,0,-1,-1,0,0]);
 assert.equal(result[0].color,WLR_COLOR_DEFAULTS.positive);assert.equal(result[5].color,WLR_COLOR_DEFAULTS.negative);
});
test('opposition and missing data reset color instead of retaining a stale trend',()=>{
 assert.deepEqual(run([[.4,.3],[-.1,.3],[-.4,-.4],[null,-.4],[.1,.4]]).map(x=>x.direction),[1,0,-1,0,0]);
});
test('strong opposite consensus can switch direction without an artificial delay',()=>{
 assert.deepEqual(run([[.4,.4],[-.3,-.3]]).map(x=>x.direction),[1,-1]);
});
test('an open candle keeps the last confirmed color; its close may confirm a new color',()=>{
 const pairs=[[.3,.3],[-.4,-.4]],open=run(pairs,{closedBefore:step+100});
 assert.deepEqual(open.map(x=>x.direction),[1,1]);assert.equal(open[1].closed,false);
 assert.deepEqual(run(pairs).map(x=>x.direction),[1,-1]);
});
test('gap, absent WLR and fresh series start never inherit prior state',()=>{
 const f=source([[.3,.3],[.1,.1],[.1,.1]]);
 f.rows[1].mid=null;assert.deepEqual(wlrDisplayColors(f.rows,f.c,f.v,{step}).map(x=>x.direction),[1,0,0]);
 const t=3*step;f.rows[1]={t,mid:100};f.rows=f.rows.slice(0,2);f.c.set(t,{adjusted:.1});f.v.set(t,{adjusted:.1});
 assert.deepEqual(wlrDisplayColors(f.rows,f.c,f.v,{step}).map(x=>x.direction),[1,0]);
});
test('prefix colors are unchanged by future data and input price/width fields remain intact',()=>{
 const pairs=Array.from({length:90},(_,i)=>[.3*Math.sin(i/4),.25*Math.sin(i/4)]),f=source(pairs);
 f.rows.forEach((r,i)=>r.width=1+i/20);const before=structuredClone(f.rows),full=wlrDisplayColors(f.rows,f.c,f.v,{step});
 for(const n of [10,30,70])assert.deepEqual(wlrDisplayColors(f.rows.slice(0,n),f.c,f.v,{step}),full.slice(0,n));
 assert.deepEqual(f.rows,before);
});
test('hysteresis removes repeated entry flicker around the weaker threshold',()=>{
 const pairs=[[.2,.2],...Array.from({length:12},(_,i)=>i%2?[.16,.16]:[.14,.14]),[.06,.06],...Array.from({length:12},(_,i)=>i%2?[.08,.08]:[.06,.06])],result=run(pairs);
 assert.deepEqual(result.map(x=>x.direction),[...Array(13).fill(1),...Array(13).fill(0)]);
});
test('invalid and reversed thresholds are rejected',()=>{
 assert.throws(()=>run([[.2,.2]],{enter:.05,exit:.07}),/settings/);
 assert.throws(()=>run([[.2,.2]],{exit:-.01}),/settings/);
});
