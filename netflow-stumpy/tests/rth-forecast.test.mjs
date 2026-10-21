import test from 'node:test';import assert from 'node:assert/strict';
import {forecastQuery,forecastCandidates,predictPath,projectPath,evaluatePaths,forecastRanking} from '../rth-forecast-core.mjs';
import {stamp,STEP} from '../rth-structure.mjs';
const start=stamp('2026-10-19',240),rows=Array.from({length:64},(_,i)=>({t:start+i*STEP,c:600+i*.05,open:600+i*.05,high:600.2+i*.05,low:599.8+i*.05,pv:Array(10).fill(.2)}));
test('exact eight future RTH bars; no POST, stale chart, holiday or close truncation',()=>{
 const at=minute=>{const source=rows.filter(r=>r.t+STEP<=stamp('2026-10-19',minute));return forecastQuery(source,{now:stamp('2026-10-19',minute)+1000});};
 assert.equal(at(570).h,8);assert.equal(at(840).h,8);assert.equal(at(855),null);assert.equal(at(540),null);assert.equal(at(990),null);
 assert.equal(forecastQuery(rows.slice(0,30),{now:stamp('2026-10-20',700)}),null);
});
const c=(i,path)=>({i:i*20+15,startIndex:i*20,inputStart:i*100000000,inputEnd:i*100000000+100,targetEnd:i*100000000+1000,targetDay:String(i),clockMinute:600,path,pivot:null});
test('candidate outcomes are mature before query input, one day each, fallback and flat stay explicit',()=>{
 const candidates=Array.from({length:30},(_,i)=>c(i,Array(8).fill(i%2?-.5:.3))),q={inputStart:2500000000,targetDay:'25',clockMinute:600};
 const pool=forecastCandidates(candidates,q);assert.ok(pool.every(c=>c.targetEnd<=q.inputStart));assert.ok(pool.every(c=>c.targetDay!==q.targetDay));
 const rankings={8:pool.map(c=>({index:c.startIndex,distance:0})),16:pool.map(c=>({index:c.startIndex,distance:0}))};
 assert.deepEqual(predictPath(q,pool,'FLAT',rankings).median,Array(8).fill(0));assert.equal(predictPath(q,pool,'PIVOT8',rankings).level,'BASE');
 const p=predictPath(q,pool,'STUMPY8',rankings);assert.equal(p.n,20);assert.ok(Math.abs(p.up+p.down+p.flat-1)<1e-12);
});
test('price line anchors to known close, includes next-open gap, and has eight forecast timestamps',()=>{
 const q={c0:600,atr:2,queryTime:100*STEP,inputEnd:101*STEP},p={median:[1,2,3,4,3,2,1,.5],low:Array(8).fill(-2),high:Array(8).fill(5)};
 const line=projectPath(p,q);assert.equal(line.points.length,8);assert.equal(line.points[0].time,101*STEP/1000);assert.equal(line.points[0].value,602);assert.equal(line.points[7].value,601);assert.equal(line.anchor,600);
});
test('path MAE and day-block comparison do not invent classification confidence',()=>{
 const records=Array.from({length:40},(_,i)=>({day:String(i),loss:.1,endLoss:.2,flatLoss:.3})),r=evaluatePaths(records);assert.ok(Math.abs(r.gain-.2)<1e-10);assert.equal(r.days,40);assert.equal(r.status,'PROMISING_REQUIRES_FORWARD_TEST');
});
