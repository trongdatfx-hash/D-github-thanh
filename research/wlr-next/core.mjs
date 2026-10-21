import {knownQuery,median,onePerDay,cycleDistance} from '../../netflow-stumpy/wlr-aba-core.mjs';
import {shapeDistance,percentile} from '../../netflow-stumpy/analogs-core.mjs';
import {ny,stamp,postEnd,STEP} from '../../netflow-stumpy/rth-structure.mjs';

export const NEXT_SPEC=Object.freeze({version:1,selectionStart:'2026-06-01',validationStart:'2026-07-17',testStart:'2026-08-21',forwardStart:'2026-10-22',minimumDays:12,maximumMatches:20,models:['STUMPY8','STUMPY16','CYCLE8','CYCLE16'],target:'Full median of the immediate next differently colored WLR segment after B, whether A or third color C; same contiguous PRE-to-POST frame',anchor:'Last closed WLR at the first eligible B query, frozen',selection:'Choose on daily direction accuracy Jun1-Jul16; fixed choice checked Jul17-Aug20 and retrospective Aug21-Oct21. No test retuning.',publication:'Research only; no chart, label or production forecast changes'});
export function nextQuery(rows,segments,i){
 const q=knownQuery(rows,segments,i);if(!q)return null;
 const b=segments[q.segment],a=segments[q.segment-1];
 if(!a||a.frame!==b.frame||!a.complete||a.confirmedAt>q.issuedAt||a.color===b.color)return null;
 // A is finished and observable. B is only the closed prefix: no final B values.
 const mids=rows.slice(i-7,i+1).map(r=>r.mid),slope8=mids.reduce((sum,v,j)=>sum+(j-3.5)*v,0);
 return {...q,previousColor:a.color,thirdColor:[-1,0,1].find(c=>c!==a.color&&c!==b.color),aBars:a.end-a.start+1,aMedian:a.median,aDeltaAtr:(a.median-q.currentWlr)/q.atr,naiveSides:{momentum1:Math.sign(rows[i].mid-rows[i-1].mid),slope8:Math.sign(slope8)}};
}
export function nextLabel(rows,segments,q,asOf){
 const cutoff=stamp(q.day,postEnd(q.day)),b=segments[q.segment],next=segments[q.segment+1];
 const seen=next&&next.frame===b.frame&&next.startTime<cutoff&&next.startTime+STEP<=asOf;
 const role=seen?(next.color===q.previousColor?'RETURN_A':'THIRD_C'):null;
 const color=seen?next.color:null;
 if(asOf<cutoff)return {status:'RIGHT_CENSORED',role,color,transition:null,matureAt:cutoff,target:null};
 const times=new Set(rows.map(r=>r.t));
 for(let t=q.issuedAt;t<cutoff;t+=STEP)if(!times.has(t))return {status:'MISSING_FUTURE',role,color,transition:null,matureAt:cutoff,target:null};
 if(!seen)return {status:'NO_NEXT_BY_POST_END',role:null,color:null,transition:0,matureAt:cutoff,target:null};
 if(!next.complete||next.confirmedAt>cutoff)return {status:'NEXT_OPEN_AT_POST_END',role,color,transition:1,matureAt:cutoff,target:null};
 return {status:'COMPLETE_NEXT',role,color,transition:1,matureAt:cutoff,target:{median:next.median,deltaAtr:(next.median-q.currentWlr)/q.atr,start:next.startTime,end:next.endTime,knownAt:next.confirmedAt,bars:next.end-next.start+1}};
}
export function nextPool(cases,q){
 return cases.filter(c=>c.day!==q.day&&c.previousColor===q.previousColor&&c.color===q.color&&c.phase===q.phase&&c.label.transition!==null&&c.label.matureAt<=q.inputStart);
}
export function rankNext(rows,q,pool,model){
 const m=model.endsWith('16')?16:8,query=rows.slice(q.i-m+1,q.i+1);
 return pool.map(c=>{
  const base=shapeDistance(query,rows.slice(c.i-m+1,c.i+1),{technique:'price-volume'});
  const dA=((Math.min(q.aBars,64)-Math.min(c.aBars,64))/64)**2+(Math.tanh(q.aDeltaAtr)-Math.tanh(c.aDeltaAtr))**2;
  const distance=model.startsWith('CYCLE')?Math.sqrt(.9*cycleDistance(base,q,c)**2+.1*dA/2):base;
  return {case:c,distance};
 }).sort((a,b)=>a.distance-b.distance||a.case.i-b.case.i);
}
const probabilities=examples=>{
 const resolved=examples.filter(c=>c.label.role!==null),returns=resolved.filter(c=>c.label.role==='RETURN_A').length;
 return {n:examples.length,colorN:resolved.length,returnN:returns,thirdN:resolved.length-returns,unresolvedN:examples.length-resolved.length,pReturn:(returns+1)/(resolved.length+2),pTransition:(examples.filter(c=>c.label.transition===1).length+1)/(examples.length+2),membershipBounds:examples.length?[returns/examples.length,(returns+examples.length-resolved.length)/examples.length]:[0,1]};
};
export function distribution(q,examples){
 const deltas=examples.map(c=>c.label.target.deltaAtr),ready=examples.length>=NEXT_SPEC.minimumDays;
 if(!ready)return {ready:false,n:examples.length,p10:null,p50:null,p90:null,pAbove:null,pBelow:null,anchorPercentile:null,side:null};
 const up=deltas.filter(v=>v>1e-10).length,down=deltas.filter(v=>v< -1e-10).length,flat=deltas.length-up-down,p50=q.currentWlr+q.atr*median(deltas);
 return {ready:true,n:examples.length,p10:q.currentWlr+q.atr*percentile(deltas,.1),p50,p90:q.currentWlr+q.atr*percentile(deltas,.9),pAbove:(up+1)/(up+down+2),pBelow:(down+1)/(up+down+2),anchorPercentile:(down+.5*flat)/deltas.length,side:Math.abs(p50-q.currentWlr)<=1e-10*Math.max(1,q.currentWlr)?0:Math.sign(p50-q.currentWlr)};
}
export function predictNext(q,pool,ranked=null){
 const prior=!ranked,ordered=prior?[...pool].sort((a,b)=>Math.abs(a.clockMinute-q.clockMinute)-Math.abs(b.clockMinute-q.clockMinute)||b.i-a.i):ranked.map(r=>r.case);
 const limit=prior?Infinity:NEXT_SPEC.maximumMatches,all=onePerDay(ordered,limit),resolved=onePerDay(ordered.filter(c=>c.label.role!==null),limit),prices=onePerDay(ordered.filter(c=>c.label.target!==null),limit);
 const availability=probabilities(all),color=probabilities(resolved);
 // Color is conditional on a next segment appearing. Keep no-next counts and
 // bounds separately; do not turn unfinished/no-next samples into C or losses.
 const readyColor=resolved.length>=NEXT_SPEC.minimumDays;
 const price=distribution(q,prices),byRole=Object.fromEntries(['RETURN_A','THIRD_C'].map(role=>[role,distribution(q,onePerDay(ordered.filter(c=>c.label.target!==null&&c.label.role===role),limit))]));
 return {anchor:q.currentWlr,previousColor:q.previousColor,currentColor:q.color,thirdColor:q.thirdColor,colorN:color.colorN,returnN:color.returnN,thirdN:color.thirdN,pReturn:color.pReturn,availability:{n:availability.n,unresolvedN:availability.unresolvedN,pTransition:availability.pTransition,membershipBounds:availability.membershipBounds},readyColor,predictedRole:readyColor&&color.pReturn!==.5?(color.pReturn>.5?'RETURN_A':'THIRD_C'):null,price,byRole};
}
