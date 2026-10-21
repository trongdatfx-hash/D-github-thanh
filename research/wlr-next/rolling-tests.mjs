import test from 'node:test';import assert from 'node:assert/strict';
import {segmentWlr} from '../../netflow-stumpy/wlr-aba-core.mjs';
import {stamp,STEP} from '../../netflow-stumpy/rth-structure.mjs';
import {ageBucket,rollingQuery,rollingLabel,rollingPool,predictRolling,acceptClosedRevision} from './rolling-core.mjs';
const day='2026-06-02',pre=stamp(day,240),end=stamp(day,1200),row=(t,color,mid=100)=>({t,color,mid,c:mid,high:mid+1,low:mid-1,x:[Math.log(mid),.2,.3,0],pv:[Math.log(mid),.2,.1,.8,0,.1,0,0,.2,.3]});
function frame(colors=[1,1,0,0,-1,-1,0]){const rows=Array.from({length:16},(_,i)=>row(pre-(16-i)*STEP,1));for(let j=0;j<64;j++)rows.push(row(pre+j*STEP,colors[Math.min(j,colors.length-1)],100+j/10));return segmentWlr(rows);}
test('Continuous next-WLR forecasts can begin at PRE0 without a previous A',()=>{
 const f=frame(),q=rollingQuery(f.rows,f.segments,16);assert.ok(q);assert.equal(q.previousColor,null);assert.equal(q.currentWlr,100);assert.equal(q.knownBars,1);assert.equal(q.issuedAt,pre+STEP);
});
test('Each closed bar updates a frozen issue; repeated/older snapshots do not repaint',()=>{
 const f=frame(),q=rollingQuery(f.rows,f.segments,16),q2=rollingQuery(f.rows,f.segments,17),p={price:{p50:101}},a=acceptClosedRevision(null,q,p);
 assert.equal(acceptClosedRevision(a,q,{price:{p50:500}}),a);assert.equal(acceptClosedRevision(a,{...q,issuedAt:q.issuedAt-STEP,originStart:0},{}),a);
 const b=acceptClosedRevision(a,q2,{price:{p50:102}});assert.equal(b.targetId,a.targetId);assert.equal(b.anchor,100.1);assert.equal(a.anchor,100);assert.equal(a.prediction.price.p50,101);assert.equal(b.prediction.price.p50,102);
 assert.equal(acceptClosedRevision(null,{...q,segment:999},p).targetId,a.targetId);
});
test('Target switches only when a differently colored closed segment begins',()=>{
 const f=frame(),a=acceptClosedRevision(null,rollingQuery(f.rows,f.segments,17),{}),b=acceptClosedRevision(a,rollingQuery(f.rows,f.segments,18),{});assert.notEqual(a.targetId,b.targetId);assert.equal(b.currentColor,0);
});
test('Target color and one-bar continuation are separate outcomes',()=>{
 const f=frame(),q=rollingQuery(f.rows,f.segments,16),l=rollingLabel(f.rows,f.segments,q,end),last=rollingLabel(f.rows,f.segments,rollingQuery(f.rows,f.segments,17),end);
 assert.equal(l.color,0);assert.equal(l.continue1,1);assert.equal(last.continue1,0);assert.equal(l.target.median,100.25);
});
test('Future color and WLR changes cannot change the closed query features',()=>{
 const a=frame([1,1,0,0,-1]),b=frame([1,1,0,0,0,0,1]);assert.deepEqual(rollingQuery(a.rows,a.segments,18),rollingQuery(b.rows,b.segments,18));
});
test('All three colors receive literal next-color forecasts; continuing color is not a new segment',()=>{
 for(const current of [-1,0,1]){
  const possible=[-1,0,1].filter(c=>c!==current),q={currentWlr:100,atr:2,color:current,previousColor:null,knownBars:1,clockMinute:255},pool=Array.from({length:20},(_,i)=>({day:'d'+i,i,knownBars:1,clockMinute:255,label:{color:possible[i<13?0:1],transition:1,continue1:i<10?1:0,target:{deltaAtr:i<13?1:-1}}})),p=predictRolling(q,pool);
  assert.equal(p.color.probabilities[current],0);assert.equal(Object.values(p.color.probabilities).reduce((s,v)=>s+v,0),1);assert.equal(p.color.predictedColor,possible[0]);assert.equal(p.price.n,20);assert.equal(p.continue1.p,.5);assert.equal(p.byColor[current].reason,'CURRENT_SEGMENT_CONTINUES_SEPARATELY');
 }
});
test('Age cohorts, mature history and distinct days constrain samples',()=>{
 assert.deepEqual([1,2,3,4,7,8,15,16,31,32,64].map(ageBucket),[0,1,1,2,2,3,3,4,4,5,5]);
 const q={color:1,phase:'PRE',ageBucket:0,day:'2026-06-02',inputStart:100},c={...q,day:'2026-06-01',label:{transition:1,matureAt:90}};
 assert.deepEqual(rollingPool([c,{...c,ageBucket:1},{...c,day:q.day},{...c,label:{transition:1,matureAt:101}}],q),[c]);
 const p=predictRolling({currentWlr:100,atr:2,color:1,knownBars:1,clockMinute:255},Array.from({length:20},(_,i)=>({day:'one-day',i,knownBars:1,clockMinute:255,label:{color:0,transition:1,continue1:1,target:{deltaAtr:1}}})));
 assert.equal(p.price.ready,false);assert.equal(p.color.ready,false);assert.equal(p.price.n,1);
});
