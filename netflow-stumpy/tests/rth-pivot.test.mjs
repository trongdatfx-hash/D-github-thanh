import test from 'node:test';
import assert from 'node:assert/strict';
import {attachPivotStates,pivotState,choosePivotCohort,pivotGroups,PIVOT_PROTOCOL} from '../rth-pivot.mjs';
import {stamp,STEP} from '../rth-structure.mjs';
const rows=Array.from({length:288},(_,i)=>{const t=stamp('2026-10-19',0)+i*STEP,c=600+Math.abs((i%20)-10)*.4+.03*i;return {t,open:c-.1,c,high:c+.2,low:c-.2,x:[Math.log(c),Math.sin(i/7),Math.cos(i/6),.1],pv:Array(10).fill(.1)};});
test('pivot stream is prefix-invariant; future prices/Strength do not revise known features',()=>{
 const full=attachPivotStates(rows);let informative=0;
 for(let i=28;i<rows.length;i+=7){
  const prefix=attachPivotStates(rows.slice(0,i+1));assert.deepEqual(prefix.map(r=>r.pivot),full.slice(0,i+1).map(r=>r.pivot));
  const changed=rows.map((r,j)=>j<=i?r:{...r,c:r.c*1.2,high:r.high*1.3,low:r.low*.8,x:[0,99,-99,0]});
  assert.deepEqual(attachPivotStates(changed)[i].pivot,full[i].pivot);
  if(full[i].pivot?.structure!=='UNRESOLVED'&&full[i].pivot)informative++;
  if(full[i].pivot?.latestPivot)assert.ok(full[i].pivot.latestPivot.confirmedAt<=rows[i].t+STEP);
 }
 assert.ok(informative>0);
});
test('right-two confirmation is enforced, daily/gap reset and NIGHT excluded',()=>{
 const state=attachPivotStates(rows),at=t=>state.find(r=>r.t===t);
 assert.equal(at(stamp('2026-10-19',180)).pivot,null);
 assert.equal(at(stamp('2026-10-20',240)).pivot.pivotCount,0);
 const cut=rows.filter((r,i)=>i!==50),gap=attachPivotStates(cut),next=gap.find(r=>r.t===rows[51].t);assert.equal(next.pivot.pivotCount,0);
 for(const r of state){if(r.pivot?.latestPivot)assert.equal(r.pivot.latestPivot.confirmedAt-r.pivot.latestPivot.pivotAt,3*STEP);}
 const pivots=[{type:'high',index:1,confirmedIndex:3,t:0,confirmedAt:2*STEP,value:5},{type:'high',index:7,confirmedIndex:9,t:6*STEP,confirmedAt:8*STEP,value:7},{type:'low',index:2,confirmedIndex:4,t:STEP,confirmedAt:3*STEP,value:1},{type:'low',index:8,confirmedIndex:10,t:7*STEP,confirmedAt:9*STEP,value:2}];
 assert.equal(pivotState(pivots,[],9,{},1).structure,'UNRESOLVED');assert.equal(pivotState(pivots,[],10,{},1).structure,'UP');
});
test('SPY V and Composite divergence can disagree and expire independently after eight bars',()=>{
 const events=[{source:'spyV',atIndex:10,at:0,direction:'bullish',volumeDelta:.2},{source:'composite',atIndex:11,at:STEP,direction:'bearish',spyDelta:-.2}];
 assert.equal(pivotState([],events,10,{},1).divergence,'bullish');
 const both=pivotState([],events,11,{},1);assert.equal(both.divergence,'mixed');assert.equal(both.spyV.direction,'bullish');assert.equal(both.composite.direction,'bearish');
 assert.equal(pivotState([],events,18,{},1).divergence,'bearish');assert.equal(pivotState([],events,19,{},1).divergence,'none');
});
const make=(i,structure,divergence='none')=>({startIndex:i,inputStart:i*100,inputEnd:i*100+10,targetEnd:i*100+90,targetDay:String(i),pivot:{structure,divergence,key:structure+':'+divergence},outcome:{label:'UP_TREND'}});
test('fixed hierarchy uses exact group, broad structure, then original without dropping sparse days',()=>{
 const candidates=Array.from({length:40},(_,i)=>make(i,i<25?'UP':'DOWN',i<13?'bullish':'none')),ranked=candidates.map(c=>({index:c.startIndex,distance:c.startIndex/100})),q={pivot:{structure:'UP',divergence:'bullish',key:'UP:bullish'}};
 let result=choosePivotCohort(ranked,candidates,q);assert.equal(result.level,'EXACT');assert.equal(result.picked.length,13);
 result=choosePivotCohort(ranked,candidates,{pivot:{structure:'UP',divergence:'bearish'}});assert.equal(result.level,'STRUCTURE');assert.equal(result.picked.length,20);
 result=choosePivotCohort(ranked,candidates.slice(0,10),q);assert.equal(result.level,'BASE');assert.equal(result.picked.length,10);
 result=choosePivotCohort(ranked,candidates,{pivot:{structure:'UNRESOLVED',divergence:'none'}});assert.equal(result.level,'BASE');
 result=choosePivotCohort(ranked,candidates,{pivot:{structure:'UNRESOLVED',divergence:'bullish'}});assert.equal(result.level,'DIVERGENCE');assert.equal(result.picked.length,13);
 const groups=pivotGroups(candidates,q);assert.equal(groups.reduce((s,g)=>s+g.n,0),candidates.length);assert.equal(groups[0].current,true);
 // Changing future labels cannot affect membership or STUMPY rank order.
 const mutated=candidates.map(c=>({...c,outcome:{label:'DOWN_TREND'}}));assert.deepEqual(choosePivotCohort(ranked,mutated,q).picked.map(c=>c.startIndex),choosePivotCohort(ranked,candidates,q).picked.map(c=>c.startIndex));
 assert.equal(PIVOT_PROTOCOL.minimumMatches,12);
});
