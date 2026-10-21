import {weightedPriceBands,strengthPhaseLineStyle} from './engine.mjs';
import {percentile} from './analogs-core.mjs';
import {ny,tradingDay,closeMinute,postEnd,stamp,STEP} from './rth-structure.mjs';

export const SPEC=Object.freeze({version:2,scope:'PRE through POST; all three literal WLR colors',decision:'first eligible closed-bar snapshot per color segment',m:[8,16],minimumMatches:12,maximumMatches:20,minimumValidationDays:10,minimumTestDays:30,contextWeight:.20,validationStart:'2026-07-17',testStart:'2026-08-21'});
export const MODELS=['CURRENT_MEDIAN','LAST_SAME','COLOR_PRIOR','STUMPY8','STUMPY16','CYCLE8','CYCLE16'];
export const median=a=>percentile(a,.5);
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export function chartWlrRows(raw,features){
 const bands=weightedPriceBands(raw,STEP),featureMap=new Map(features.map(r=>[r.t,r]));
 return raw.map((b,i)=>{
  const f=featureMap.get(b.t),phase=strengthPhaseLineStyle({adjusted:f?.x?.[1]},{adjusted:f?.x?.[2]}),valid=f?.pv?.length===10&&f.pv.every(Number.isFinite)&&Number.isFinite(bands[i].mid);
  return {...f,t:b.t,open:b.o,c:b.c,high:b.h,low:b.l,mid:bands[i].mid,color:valid?phase.direction:null};
 });
}
export function segmentWlr(rows){
 const segments=[],annotated=rows.map(r=>({...r,segment:null}));let previous=null,frame=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],p=ny(r.t),eligible=tradingDay(p.day)&&p.minute>=240&&p.minute<postEnd(p.day)&&Number.isFinite(r.mid)&&[-1,0,1].includes(r.color);
  if(!eligible){previous=null;continue;}
  const continuous=previous&&r.t-previous.t===STEP&&p.day===previous.day;
  if(!continuous)frame++;
  let s=segments.at(-1);
  if(!continuous||s.color!==r.color){
   if(continuous){s.complete=true;s.confirmedAt=r.t+STEP;}
   s={id:segments.length,day:p.day,frame,color:r.color,start:i,end:i,startTime:r.t,endTime:r.t+STEP,complete:false,confirmedAt:null,median:null};segments.push(s);
  }
  s.end=i;s.endTime=r.t+STEP;annotated[i].segment=s.id;previous={t:r.t,day:p.day};
 }
 for(const s of segments)s.median=median(rows.slice(s.start,s.end+1).map(r=>r.mid));
 return {rows:annotated,segments};
}
export function knownQuery(rows,segments,i){
 if(i<15)return null;const r=rows[i],p=ny(r.t),clockMinute=p.minute+15;
 if(clockMinute<=240||clockMinute>=postEnd(p.day)||!tradingDay(p.day)||r.segment===null)return null;
 const input=rows.slice(i-15,i+1);
 if(input.some((b,j)=>ny(b.t).day!==p.day||ny(b.t).minute<240||b.pv?.length!==10||!b.pv.every(Number.isFinite)||(j&&b.t-input[j-1].t!==STEP)))return null;
 const ranges=rows.slice(i-13,i+1).map((b,j)=>{const prev=rows[i-14+j]?.c;return Math.max(b.high-b.low,Number.isFinite(prev)?Math.abs(b.high-prev):0,Number.isFinite(prev)?Math.abs(b.low-prev):0);}),atr=mean(ranges);
 if(!(atr>0))return null;
 const s=segments[r.segment],known=rows.slice(s.start,i+1).map(b=>b.mid),currentMedian=median(known),lastSame=segments.slice(0,s.id).reverse().find(b=>b.frame===s.frame&&b.color===s.color&&b.complete&&b.confirmedAt<=r.t+STEP),previous=segments[s.id-1],lastSameMedian=lastSame?.median??null;
 // All progress statistics stop at i. Final segment length/end/median are never query features.
 const context=[Math.min(64,known.length)/64,Math.tanh((r.mid-currentMedian)/atr),Math.tanh((Math.max(...known)-Math.min(...known))/atr),Math.tanh((r.mid-rows[i-1].mid)/atr),Math.tanh(r.x[1]),Math.tanh(r.x[2]),Number(lastSame!==undefined),lastSame?Math.tanh((lastSameMedian-currentMedian)/atr):0,previous?.frame===s.frame?previous.color/2:0];
 const phase=clockMinute<570?'PRE':clockMinute<closeMinute(p.day)?'RTH':'POST';
 return {i,day:p.day,phase,issuedAt:r.t+STEP,inputStart:input[0].t,clockMinute,color:r.color,segment:s.id,currentMedian,knownBars:known.length,currentWlr:r.mid,lastSameMedian,atr,context};
}
export function labelQuery(rows,segments,q,asOf){
 const cutoff=stamp(q.day,postEnd(q.day)),matureAt=cutoff,lookup=new Map(rows.map(r=>[r.t,r]));
 const a=segments[q.segment],b=segments[q.segment+1],next=segments[q.segment+2],member=next&&next.frame===a.frame&&next.startTime<cutoff&&next.startTime+STEP<=asOf?Number(next.color===a.color):null;
 // The complete PRE-to-POST frame is required for the completion-within-frame label.
 if(asOf<matureAt)return {status:'RIGHT_CENSORED',member,event:null,event8:null,matureAt,target:null};
 for(let t=q.issuedAt;t<cutoff;t+=STEP)if(!lookup.has(t))return {status:'MISSING_FUTURE',member,event:null,event8:null,matureAt,target:null};
 if(!b||b.frame!==a.frame||b.startTime>=cutoff)return {status:'UNCONFIRMED_BY_POST_END',member:null,event:0,event8:0,matureAt,target:null};
 if(!next||next.frame!==a.frame||next.startTime>=cutoff)return {status:'UNCONFIRMED_BY_POST_END',member:null,event:0,event8:0,matureAt,target:null};
 if(next.color!==a.color)return {status:'PATTERN_BROKEN',member:0,event:0,event8:0,matureAt,target:null};
 if(!next.complete||next.endTime>cutoff||next.confirmedAt>matureAt)return {status:'NEXT_A_OPEN_AT_POST_END',member:1,event:0,event8:0,matureAt,target:null};
 const target={median:next.median,deltaAtr:(next.median-q.currentMedian)/q.atr,start:next.startTime,end:next.endTime,knownAt:next.confirmedAt,bars:next.end-next.start+1,betweenColor:b.color,betweenBars:b.end-b.start+1};
 return {status:'COMPLETE_ABA',member:1,event:1,event8:Number(next.confirmedAt<=q.issuedAt+8*STEP),matureAt,target};
}
export function candidatePool(cases,q){return cases.filter(c=>c.day!==q.day&&c.color===q.color&&c.phase===q.phase&&c.label.event!==null&&c.label.matureAt<=q.inputStart);}
export function onePerDay(ordered,limit=Infinity){const seen=new Set(),result=[];for(const c of ordered){if(seen.has(c.day))continue;seen.add(c.day);result.push(c);if(result.length===limit)break;}return result;}
export function contextDistance(a,b){return a.context.reduce((s,v,i)=>s+((v-b.context[i])*([1,3,4,5,7,8].includes(i)?.5:1))**2,0)/a.context.length;}
export function cycleDistance(base,q,c){return Math.sqrt((1-SPEC.contextWeight)*base**2+SPEC.contextWeight*contextDistance(q,c));}
export function predict(q,pool,ranked,model){
 const ordered=ranked??pool.map(c=>({case:c,distance:0})),prior=model==='COLOR_PRIOR'||['CURRENT_MEDIAN','LAST_SAME'].includes(model),byClock=[...pool].sort((a,b)=>Math.abs(a.clockMinute-q.clockMinute)-Math.abs(b.clockMinute-q.clockMinute)||b.i-a.i),all=onePerDay(prior?byClock:ordered.map(r=>r.case),prior?Infinity:SPEC.maximumMatches),positive=onePerDay((prior?byClock:ordered.map(r=>r.case)).filter(c=>c.label.event),prior?Infinity:SPEC.maximumMatches),n=positive.length,ready=n>=SPEC.minimumMatches,eventReady=all.length>=SPEC.minimumMatches;
 let value=q.currentMedian,fallback=null;
 if(model==='LAST_SAME')value=q.lastSameMedian??q.currentMedian;
 else if(model!=='CURRENT_MEDIAN'){if(ready)value=q.currentMedian+q.atr*median(positive.map(c=>c.label.target.deltaAtr));else fallback='CURRENT_MEDIAN_INSUFFICIENT_TARGETS';}
 const event=(all.filter(c=>c.label.event).length+1)/(all.length+2),event8=(all.filter(c=>c.label.event8).length+1)/(all.length+2),deltas=positive.map(c=>c.label.target.deltaAtr);
 const resolved=all.filter(c=>c.label.member!==null&&c.label.member!==undefined),members=resolved.filter(c=>c.label.member===1).length,unresolved=all.length-resolved.length,pMembership=(members+1)/(resolved.length+2);
 return {patternCandidate:'ABA',predictionStatus:eventReady?'FORMING_ABA':'WAIT_HISTORY',predictedMembership:resolved.length>=SPEC.minimumMatches?pMembership>=.5:null,value,ready:['CURRENT_MEDIAN','LAST_SAME'].includes(model)||ready,eventReady,pEvent:event,pEvent8:event8,pMembership,memberReady:resolved.length>=SPEC.minimumMatches,memberN:resolved.length,unresolvedN:unresolved,membershipBounds:all.length?[members/all.length,(members+unresolved)/all.length]:[0,1],n,nEvents:all.length,fallback,low:ready?q.currentMedian+q.atr*percentile(deltas,.1):null,high:ready?q.currentMedian+q.atr*percentile(deltas,.9):null,pUpConditional:ready?(deltas.filter(v=>v>0).length+1)/(deltas.length+2):null};
}
export function paired(reference,trial,key='loss'){
 if(reference.length!==trial.length||reference.some((r,i)=>r.day!==trial[i].day||r.issuedAt!==trial[i].issuedAt))throw Error('Unequal paired timestamps');
 const pairs=reference.flatMap((r,i)=>Number.isFinite(r[key])&&Number.isFinite(trial[i][key])?[{day:r.day,value:r[key]-trial[i][key]}]:[]),days=[...new Set(pairs.map(r=>r.day))].sort(),values=days.map(day=>mean(pairs.filter(r=>r.day===day).map(r=>r.value))),n=values.length;
 if(!n)return {n:0,days:0,status:'WAIT'};
 let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},draws=[];
 for(let b=0;b<5000;b++){const a=[];while(a.length<n){const at=Math.floor(random()*n);for(let j=0;j<5;j++)a.push(values[(at+j)%n]);}draws.push(mean(a.slice(0,n)));}
 const low=percentile(draws,.0125),high=percentile(draws,.9875);
 return {n:pairs.length,days:n,gain:mean(values),low,high,confidence:.975,status:n>=SPEC.minimumTestDays&&low>0?'PROMISING_REQUIRES_FORWARD_TEST':'NOT_ESTABLISHED'};
}
export function metrics(records){
 const target=records.filter(r=>Number.isFinite(r.loss)),ready=target.filter(r=>r.ready),events=records.filter(r=>Number.isFinite(r.brier));
 const dayCount=rs=>new Set(rs.map(r=>r.day)).size,dailyMean=(rs,key)=>mean([...new Set(rs.map(r=>r.day))].map(day=>mean(rs.filter(r=>r.day===day).map(r=>r[key]))));
 const resolved=records.filter(r=>Number.isFinite(r.membershipBrier));
 return {queries:records.length,days:dayCount(records),targetN:target.length,targetDays:dayCount(target),readyTargetN:ready.length,readyTargetDays:dayCount(ready),coverage:records.length?records.filter(r=>r.ready).length/records.length:0,maePct:dailyMean(target,'loss'),queryMaePct:mean(target.map(r=>r.loss)),readyMaePct:dailyMean(ready,'loss'),brier:dailyMean(events,'brier'),brier8:dailyMean(events,'brier8'),membershipBrier:dailyMean(resolved,'membershipBrier'),membershipN:resolved.length,unconfirmedN:records.length-resolved.length};
}
