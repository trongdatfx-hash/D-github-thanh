import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {chartWlrRows,segmentWlr,knownQuery,labelQuery,candidatePool,predict,cycleDistance,paired,onePerDay,SPEC} from './core.mjs';
import {weightedPriceBands,strengthPhaseLineStyle} from '../../netflow-stumpy/engine.mjs';
import {shapeDistance} from '../../netflow-stumpy/analogs-core.mjs';
import {stamp,STEP} from '../../netflow-stumpy/rth-structure.mjs';
const synthetic=(day='2026-10-19')=>Array.from({length:65},(_,i)=>({t:stamp(day,240+i*15),open:600+i*.1,c:600.05+i*.1,high:600.2+i*.1,low:599.8+i*.1,mid:600+i*.1,color:i<25?1:i<27?-1:i<30?1:-1,pv:Array(10).fill(.2),x:[0,.3,.5,0]}));
const make=(raw=synthetic())=>{const f=segmentWlr(raw),q=knownQuery(f.rows,f.segments,22);return {...f,q};};
test('WLR median uses existing WLR50 centerline and exact three-color Strength agreement',()=>{
 const raw=Array.from({length:80},(_,i)=>({t:i*STEP,c:100+i*.1})),features=raw.map((r,i)=>({...r,pv:Array(10).fill(.2),x:[0,i%3===0?.5:-.5,i%3===2?.5:i%3===0?.5:-.5,0]})),rows=chartWlrRows(raw,features),bands=weightedPriceBands(raw,STEP);
 for(let i=50;i<80;i++){assert.equal(rows[i].mid,bands[i].mid);assert.equal(rows[i].color,strengthPhaseLineStyle({adjusted:features[i].x[1]},{adjusted:features[i].x[2]}).direction);}
 assert.deepEqual(rows.slice(51,54).map(r=>r.color),[1,-1,0]);
});
test('A-B-A requires exactly one intervening literal color; complete median may occur anywhere PRE-to-POST',()=>{
 const f=make(),label=labelQuery(f.rows,f.segments,f.q,stamp(f.q.day,1215));
 assert.equal(f.q.issuedAt,stamp(f.q.day,585));assert.equal(f.q.currentMedian,601.1);assert.equal(label.status,'COMPLETE_ABA');assert.equal(label.target.median,602.8);assert.equal(label.event8,1);assert.equal(label.target.knownAt,stamp(f.q.day,705));
 const changed=synthetic().map((r,i)=>i>=27&&i<30?{...r,color:0}:r),broken=make(changed);
 assert.equal(labelQuery(broken.rows,broken.segments,broken.q,stamp(f.q.day,1215)).status,'PATTERN_BROKEN');
 const late=make(synthetic().map((r,i)=>i>=27?{...r,color:1}:r));assert.equal(labelQuery(late.rows,late.segments,late.q,stamp(f.q.day,1215)).status,'NEXT_A_OPEN_AT_POST_END');
});
test('future changes cannot revise current median, known age or context; days/gaps never close a segment',()=>{
 const full=make(),cut=make(synthetic().slice(0,23)),future=make(synthetic().map((r,i)=>i<=22?r:{...r,mid:r.mid+80,color:0,c:r.c+100}));
 assert.deepEqual(full.q,cut.q);assert.deepEqual(full.q,future.q);
 const gap=segmentWlr([{...synthetic()[22],color:1},{...synthetic()[24],color:-1}]);assert.equal(gap.segments[0].complete,false);
 const next=segmentWlr([{...synthetic()[22],color:1},{...synthetic('2026-10-20')[22],color:-1}]);assert.equal(next.segments[0].complete,false);
 assert.equal(labelQuery(full.rows,full.segments,full.q,stamp(full.q.day,600)).event,null);
 assert.equal(labelQuery(full.rows.filter(r=>r.t!==stamp(full.q.day,660)),full.segments,full.q,stamp(full.q.day,1215)).status,'MISSING_FUTURE');
});
test('unfinished samples retain provisional predictions; missing confirmation is never a false membership label',()=>{
 const f=make(),partial=labelQuery(f.rows,f.segments,f.q,stamp(f.q.day,660));assert.equal(partial.member,1);assert.equal(partial.event,null);assert.equal(partial.target,null);
 const noReturn=make(synthetic().map(r=>({...r,color:0}))),unconfirmed=labelQuery(noReturn.rows,noReturn.segments,noReturn.q,stamp(f.q.day,1200));assert.equal(unconfirmed.member,null);assert.equal(unconfirmed.event,0);assert.equal(unconfirmed.status,'UNCONFIRMED_BY_POST_END');
 const open=make(synthetic().map((r,i)=>i>=27?{...r,color:1}:r)),label=labelQuery(open.rows,open.segments,open.q,stamp(f.q.day,1200));assert.equal(label.member,1);assert.equal(label.target,null);assert.equal(label.status,'NEXT_A_OPEN_AT_POST_END');
 const early=knownQuery(f.rows,f.segments,15),late=knownQuery(f.rows,f.segments,60);assert.equal(early.phase,'PRE');assert.equal(late.phase,'POST');
 const prediction=predict(f.q,[],null,'CYCLE8');assert.equal(prediction.patternCandidate,'ABA');assert.equal(prediction.predictedMembership,null);assert.equal(prediction.pMembership,.5);
});
test('many intraday windows count as one independent day; analogs select at most one sample per day',()=>{
 const a=Array.from({length:40},(_,i)=>({day:'same',issuedAt:i,loss:.2})),b=a.map(r=>({...r,loss:.1})),comparison=paired(a,b);assert.equal(comparison.n,40);assert.equal(comparison.days,1);assert.equal(comparison.status,'NOT_ESTABLISHED');
 assert.equal(onePerDay(a).length,1);
});
test('training label maturity is purged before 16-bar input; failed sequences stay in event denominator',()=>{
 const q={day:'now',phase:'RTH',color:1,clockMinute:585,inputStart:1000,currentMedian:100,atr:1,lastSameMedian:null},cases=Array.from({length:24},(_,i)=>({i,day:String(i),phase:'RTH',color:1,clockMinute:585,label:{event:Number(i<12),event8:0,matureAt:900,target:i<12?{deltaAtr:1}:null}}));
 const pool=candidatePool([...cases,{...cases[0],day:'unmatured',label:{...cases[0].label,matureAt:1001}},{...cases[0],day:'wrong',color:0}],q);
 assert.equal(pool.length,24);const p=predict(q,pool,null,'COLOR_PRIOR');assert.equal(p.n,12);assert.equal(p.pEvent,.5);assert.equal(p.event,undefined);assert.equal(p.value,101);assert.equal(p.ready,true);
 const sparse=predict(q,pool.slice(1),null,'COLOR_PRIOR');assert.equal(sparse.ready,false);assert.equal(sparse.value,100);assert.match(sparse.fallback,/INSUFFICIENT/);
});
test('cycle distance uses only known context and comparisons require identical timestamps',()=>{
 const q={context:Array(9).fill(.2)},c={context:Array(9).fill(.2)};assert.ok(Math.abs(cycleDistance(1,q,c)-Math.sqrt(.8))<1e-12);
 const a=Array.from({length:35},(_,i)=>({day:String(i),issuedAt:i,loss:.2})),b=a.map(r=>({...r,loss:.1}));assert.equal(paired(a,b).status,'PROMISING_REQUIRES_FORWARD_TEST');assert.throws(()=>paired(a,b.slice(1)),/Unequal/);assert.equal(SPEC.decision,'first eligible closed-bar snapshot per color segment');
});
test('actual STUMPY profiles preserve every mature same-color candidate and match browser-equivalent distance',{skip:!process.env.WLR_TASKS},()=>{
 const d=JSON.parse(fs.readFileSync(process.env.WLR_TASKS)),p=JSON.parse(fs.readFileSync(process.env.WLR_PROFILES)),cases=new Map(d.cases.map(c=>[c.i,c]));let n=0;
 for(const e of [...d.evaluations.slice(0,4),...d.evaluations.slice(-4)])for(const m of [8,16]){
  const ranked=p.ranked[e.keys[m]];assert.equal(ranked.length,e.candidateIds.length);
  for(const r of [...ranked.slice(0,3),...ranked.slice(-3)]){const c=cases.get(r.index+m-1);assert.ok(c.label.matureAt<=e.query.inputStart);assert.equal(c.color,e.query.color);assert.equal(c.phase,e.query.phase);const distance=shapeDistance(d.rows.SPYUSDT.slice(e.query.i-m+1,e.query.i+1),d.rows.SPYUSDT.slice(r.index,r.index+m),{technique:'price-volume'});assert.ok(Math.abs(distance-r.distance)<2e-5);n++;}
 }
 assert.ok(n>0);console.log(`Verified ${n} actual STUMPY WLR-cycle distances`);
});
