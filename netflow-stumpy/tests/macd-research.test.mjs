import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ema,macdFeatures,macdDistance,pairedMacd,readyMacdWindow} from '../macd-research.mjs';
const rows=Array.from({length:200},(_,i)=>({t:i*900000,c:100+i,high:102+i,low:98+i,pv:[Math.log(100+i),.4,.2,.7,1,.5,0,0,.6,.2],x:[0,.2,.6,0]}));
test('12/26/9 SMA-seeded EMA, signal and histogram match constant/linear analytic values',()=>{
 assert.deepEqual(ema([1,2,3,4,5],3),[null,null,2,3,4]);
 const r=macdFeatures(rows);assert.equal(r[24].macd.line,null);assert.equal(r[32].macd.signal,null);assert.equal(r[33].macd.line,7);assert.equal(r[33].macd.signal,7);assert.equal(r[33].macd.histogram,0);
 assert.equal(readyMacdWindow(r,{i:47}),false);assert.equal(readyMacdWindow(r,{i:48}),true);
 const flat=macdFeatures(rows.map(r=>({...r,c:100})));assert.equal(flat[100].macd.line,0);assert.equal(flat[100].macd.histogram,0);
});
test('MACD is causal and ATR-normalized channels are invariant to a price scale change',()=>{
 const full=macdFeatures(rows);for(const at of [35,70,120])assert.deepEqual(macdFeatures(rows.slice(0,at+1)),full.slice(0,at+1));
 const changed=rows.map((r,i)=>i<90?r:{...r,c:r.c*10,high:r.high*11,low:r.low*9});assert.deepEqual(macdFeatures(changed).slice(0,90),full.slice(0,90));
 const scaled=macdFeatures(rows.map(r=>({...r,c:r.c*3,high:r.high*3,low:r.low*3})));assert.ok(Math.abs(scaled[150].mf[6]-full[150].mf[6])<1e-10);assert.ok(Math.abs(scaled[150].mf[7]-full[150].mf[7])<1e-10);
});
test('pure MACD distance excludes both user Strength channels and all candle-cluster channels',()=>{
 const a=macdFeatures(rows).slice(-16),b=macdFeatures(rows.map(r=>({...r,x:[0,-2,2,0],pv:[...r.pv.slice(0,4),-1,-1,1,1,-9,9]}))).slice(-16);
 assert.ok(macdDistance(a,b,'MACD')<1e-10);assert.ok(macdDistance(a,b,'PRICE')<1e-10);assert.ok(macdDistance(a,b,'PAIR')>.01);assert.ok(macdDistance(a,b,'COMBINED')>.01);
});
test('paired comparison refuses unequal timestamps and uses conservative primary interval',()=>{
 const a=Array.from({length:34},(_,i)=>({day:String(i),issuedAt:i,loss:.2,brier:.6})),b=a.map(r=>({...r,loss:.1,brier:.5})),p=pairedMacd(a,b,{alpha:.025});assert.equal(p.confidence,.975);assert.ok(Math.abs(p.pathGainPct-.1)<1e-10);assert.equal(p.status,'PROMISING_REQUIRES_FORWARD_TEST');assert.throws(()=>pairedMacd(a,b.map((r,i)=>i? r:{...r,issuedAt:-1})),/identical/);
});
test('shared-channel distances match actual Python STUMPY MASS for every ablation',{skip:!process.env.MACD_TASKS},()=>{
 const data=JSON.parse(fs.readFileSync(process.env.MACD_TASKS)),profiles=JSON.parse(fs.readFileSync(process.env.MACD_PROFILES)),keys=Object.keys(profiles.ranked),sample=[...keys.slice(0,4),...keys.slice(-4)];let n=0;
 for(const key of sample){const m=+key.split(':')[1],end=data.queries[key],q=data.rows.slice(end-m+1,end+1);for(const [variant,ranked]of Object.entries(profiles.ranked[key]))for(const r of [...ranked.slice(0,4),...ranked.slice(-4)]){const distance=macdDistance(q,data.rows.slice(r.index,r.index+m),variant);assert.ok(Math.abs(distance-r.distance)<2e-5,`${variant}: ${distance} != ${r.distance}`);n++;}}
 assert.ok(n>0);console.log(`Compared ${n} actual STUMPY ablation distances`);
});
