import {knownQuery,onePerDay,cycleDistance} from '../../netflow-stumpy/wlr-aba-core.mjs';
import {shapeDistance} from '../../netflow-stumpy/analogs-core.mjs';
import {STEP} from '../../netflow-stumpy/rth-structure.mjs';
import {nextLabel,distribution} from './core.mjs';
export const ROLLING_SPEC=Object.freeze({version:1,models:['CYCLE8','CYCLE16'],minimumDays:12,maximumMatches:20,selectionStart:'2026-06-01',validationStart:'2026-07-17',testStart:'2026-08-21',forwardStart:'2026-10-22',cadence:'Each closed M15 bar throughout PRE-to-POST, including PRE0 with closed NIGHT warmup',target:'Median of the immediately next different-color WLR segment in the same PRE-to-POST frame, all green/yellow/red target colors; ongoing current-color segment is separate',ageBuckets:'1;2-3;4-7;8-15;16-31;32+',publication:'Off-web research only; existing chart, readouts, CVD geometry and ABA model unchanged'});
export const ageBucket=n=>Math.min(5,Math.floor(Math.log2(Math.max(1,n))));
export function rollingQuery(rows,segments,i){
 const q=knownQuery(rows,segments,i);if(!q)return null;
 const current=segments[q.segment],previous=segments[q.segment-1],hasA=previous?.frame===current.frame&&previous.complete&&previous.confirmedAt<=q.issuedAt;
 const mids=rows.slice(i-7,i+1).map(r=>r.mid),slope8=mids.reduce((s,v,j)=>s+(j-3.5)*v,0);
 return {...q,originStart:current.startTime,previousColor:hasA?previous.color:null,ageBucket:ageBucket(q.knownBars),naiveSides:{momentum1:Math.sign(rows[i].mid-rows[i-1].mid),slope8:Math.sign(slope8)}};
}
export function rollingLabel(rows,segments,q,asOf){
 const label=nextLabel(rows,segments,q,asOf),nextBar=rows[q.i+1],sameFrame=nextBar&&nextBar.t===q.issuedAt&&nextBar.segment!==null&&segments[nextBar.segment]?.frame===segments[q.segment].frame;
 return {...label,continue1:sameFrame&&nextBar.t+STEP<=asOf?Number(nextBar.color===q.color):null};
}
export function rollingPool(cases,q){return cases.filter(c=>c.color===q.color&&c.phase===q.phase&&c.ageBucket===q.ageBucket&&c.day!==q.day&&c.label.transition!==null&&c.label.matureAt<=q.inputStart);}
export function rankRolling(rows,q,pool,model){
 const m=model.endsWith('16')?16:8,query=rows.slice(q.i-m+1,q.i+1);
 return pool.map(c=>({case:c,distance:cycleDistance(shapeDistance(query,rows.slice(c.i-m+1,c.i+1),{technique:'price-volume'}),q,c)})).sort((a,b)=>a.distance-b.distance||a.case.i-b.case.i);
}
export function predictRolling(q,pool,ranked=null){
 const ordered=ranked?ranked.map(r=>r.case):[...pool].sort((a,b)=>Math.abs(a.knownBars-q.knownBars)-Math.abs(b.knownBars-q.knownBars)||Math.abs(a.clockMinute-q.clockMinute)-Math.abs(b.clockMinute-q.clockMinute)||b.i-a.i),limit=ranked?ROLLING_SPEC.maximumMatches:Infinity;
 const all=onePerDay(ordered,limit),colorExamples=onePerDay(ordered.filter(c=>c.label.color!==null),limit),priceExamples=onePerDay(ordered.filter(c=>c.label.target!==null),limit),continuations=onePerDay(ordered.filter(c=>c.label.continue1!==null),limit),readyColor=colorExamples.length>=ROLLING_SPEC.minimumDays;
 const colors=Object.fromEntries([-1,0,1].map(color=>[color,color===q.color?0:(colorExamples.filter(c=>c.label.color===color).length+1)/(colorExamples.length+2)])),top=[-1,0,1].filter(c=>c!==q.color).sort((a,b)=>colors[b]-colors[a]),predictedColor=readyColor&&colors[top[0]]!==colors[top[1]]?top[0]:null;
 return {anchor:q.currentWlr,currentColor:q.color,previousColor:q.previousColor,knownBars:q.knownBars,color:{ready:readyColor,n:colorExamples.length,probabilities:colors,predictedColor},availability:{n:all.length,pNextByPost:(all.filter(c=>c.label.transition===1).length+1)/(all.length+2),unresolved:all.filter(c=>c.label.color===null).length},continue1:{n:continuations.length,p:(continuations.filter(c=>c.label.continue1===1).length+1)/(continuations.length+2)},price:distribution(q,priceExamples),byColor:Object.fromEntries([-1,0,1].map(color=>[color,color===q.color?{ready:false,n:0,reason:'CURRENT_SEGMENT_CONTINUES_SEPARATELY'}:distribution(q,onePerDay(ordered.filter(c=>c.label.target!==null&&c.label.color===color),limit))]))};
}
export function rollingIssue(q,prediction){return {targetId:`${q.day}:${q.originStart}:NEXT`,issuedAt:q.issuedAt,anchor:q.currentWlr,currentColor:q.color,prediction};}
export function acceptClosedRevision(previous,q,prediction){
 const issue=rollingIssue(q,prediction);
 if(previous&&q.issuedAt<=previous.issuedAt)return previous;
 return issue;
}
