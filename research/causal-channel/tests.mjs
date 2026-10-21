import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {channelSnapshots,linePrediction,channelDistance,comparePaths} from './core.mjs';
import {stamp,STEP} from '../../netflow-stumpy/rth-structure.mjs';
import {openingQuery,openingFrame,isOpeningCase} from './opening.mjs';
import {projectPath} from '../../netflow-stumpy/rth-forecast-core.mjs';
const openingRows=day=>Array.from({length:64},(_,i)=>({t:stamp(day,240+i*15),open:600+i*.05,c:600+i*.05,high:600.2+i*.05,low:599.8+i*.05,pv:Array(10).fill(.2)}));
test('first closed RTH bar forecasts the next eight, using PRE inputs in summer and winter',()=>{
 for(const day of ['2026-10-19','2026-12-01','2026-11-27']){
  const all=openingRows(day),end=stamp(day,585),prefix=all.filter(r=>r.t+STEP<=end),q=openingQuery(prefix,{now:end+1000});
  assert.ok(q);assert.equal(q.inputEnd,end);assert.equal(q.inputStart,stamp(day,345));assert.equal(q.queryTime,stamp(day,570));assert.equal(q.targetEnd,stamp(day,705));assert.equal(prefix.slice(-8)[0].t,stamp(day,465));
  const projected=projectPath({median:Array(8).fill(0),low:Array(8).fill(-1),high:Array(8).fill(1)},q);
  assert.equal(projected.points.length,8);assert.equal(projected.points[0].time,end/1000);assert.equal(projected.points[7].time,stamp(day,690)/1000);
  assert.equal(openingQuery(all.filter(r=>r.t+STEP<=stamp(day,570)),{now:stamp(day,570)+1000}),null);
  assert.equal(openingQuery(all.filter(r=>r.t+STEP<=stamp(day,600)),{now:stamp(day,600)+1000}),null);
  assert.equal(openingQuery(all.slice(0,24),{now:end+1000}),null,'do not include running second RTH bar');
  assert.equal(openingQuery(prefix.slice(1).filter((r,i)=>i!==12),{now:end+1000}),null,'missing PRE input stays WAIT');
 }
 const holiday=openingRows('2026-11-26').slice(0,23);assert.equal(openingQuery(holiday,{now:stamp('2026-11-26',585)+1000}),null);
});
test('opening cohort keeps one query per day and only its two profile windows',()=>{
 const rows=openingRows('2026-10-19'),q=openingQuery(rows.slice(0,23),{now:stamp('2026-10-19',585)+1000}),e={query:q,keys:{8:'8',16:'16'},candidateStarts:[7]},data={rows:{SPYUSDT:rows},evaluations:[e,{...e,query:{...q,clockMinute:600}}],tasks:{8:[3],16:[4],other:[5]},queries:{8:q.i,16:q.i,other:24}};
 const result=openingFrame(data);assert.equal(result.evaluations.length,1);assert.deepEqual(Object.keys(result.tasks).sort(),['16','8']);assert.ok(isOpeningCase(result.evaluations[0].query));
 assert.throws(()=>openingFrame({...data,evaluations:[e,e]}),/Duplicate/);
 assert.throws(()=>openingFrame({...data,evaluations:[]}),/No complete/);
});
const rows=Array.from({length:5*48},(_,i)=>{const d=Math.floor(i/48),j=i%48,t=stamp('2026-10-'+String(12+d),240+j*15),c=600+d+j*.15+(j>21?(j-21)*.15:0)+Math.sin(j)*.05;return {t,open:c-.1,c,high:c+.2,low:c-.2,pv:[Math.log(c),.4,.2,.7,1,.3,0,0,.6,.2],x:[0,.2,.6,0]};});
test('daily causal snapshots equal full-history prefix replay for predictive fields',()=>{const full=channelSnapshots(rows,{fullHistory:true}),short=channelSnapshots(rows);assert.deepEqual(short.map(r=>r.channel),full.map(r=>r.channel));assert.ok(short.some(r=>r.channel.active));});
test('future prices and SPY V cannot revise an earlier channel snapshot',()=>{const full=channelSnapshots(rows);for(const at of [28,65,111]){assert.deepEqual(channelSnapshots(rows.slice(0,at+1)).map(r=>r.channel),full.slice(0,at+1).map(r=>r.channel));const changed=rows.map((r,i)=>i<=at?r:{...r,c:r.c*1.3,high:r.high*1.4,low:r.low*.8,x:[0,-9,-9,0]});assert.deepEqual(channelSnapshots(changed)[at].channel,full[at].channel);if(full[at].channel.active)assert.ok(full[at].channel.confirmedAt<=rows[at].t+STEP);}});
test('center and anchored-slope extrapolation use known fit only; missing channel falls back flat',()=>{const q={c0:101,atr:1},s={active:true,center:100,slope:.2};assert.ok(Math.abs(linePrediction(q,s,'LINE_CENTER')[0]+.8)<1e-10);assert.ok(Math.abs(linePrediction(q,s,'LINE_SLOPE')[7]-1.6)<1e-10);assert.deepEqual(linePrediction(q,{active:false},'LINE_CENTER'),Array(8).fill(0));});
test('paired comparison rejects unequal cases and respects day count',()=>{const a=Array.from({length:34},(_,i)=>({day:String(i),issuedAt:i,loss:.2})),b=a.map(r=>({...r,loss:.1})),r=comparePaths(a,b);assert.ok(Math.abs(r.gainPct-.1)<1e-10);assert.equal(r.confidence,.975);assert.throws(()=>comparePaths(a,b.slice(1)),/Unequal/);});
test('shared geometry distances match actual STUMPY',{skip:!process.env.CHANNEL_TASKS},()=>{const data=JSON.parse(fs.readFileSync(process.env.CHANNEL_TASKS)),profiles=JSON.parse(fs.readFileSync(process.env.CHANNEL_PROFILES)),keys=Object.keys(profiles.ranked),sample=[...keys.slice(0,4),...keys.slice(-4)];let count=0;for(const key of sample){const m=+key.split(':')[1],end=data.queries[key],q=data.rows.slice(end-m+1,end+1);for(const [variant,ranked]of Object.entries(profiles.ranked[key]))for(const r of [...ranked.slice(0,4),...ranked.slice(-4)]){const distance=channelDistance(q,data.rows.slice(r.index,r.index+m),variant);assert.ok(Math.abs(distance-r.distance)<2e-5,`${variant}: ${distance} != ${r.distance}`);count++;}}assert.ok(count>0);console.log(`Compared ${count} real STUMPY channel distances`);});

