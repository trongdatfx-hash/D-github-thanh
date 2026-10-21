import fs from 'node:fs';import path from 'node:path';
import {loadSource} from './source.mjs';
import {ROLLING_SPEC,rollingQuery,rollingLabel,rollingPool,rankRolling,predictRolling,rollingIssue} from './rolling-core.mjs';
import {paired} from '../../netflow-stumpy/wlr-aba-core.mjs';
import {sideOf} from '../../netflow-stumpy/wlr-aba-direction.mjs';
const {root,asOf,frame,source}=loadSource(),out=path.join(root,'research/wlr-next/output'),avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
fs.mkdirSync(out,{recursive:true});
const save=(name,value,pretty=true)=>fs.writeFileSync(path.join(out,name),typeof value==='string'?value:JSON.stringify(value,null,pretty?2:0));
const cases=[],labelCache=new Map();
for(let i=15;i<frame.rows.length;i++){
 const q=rollingQuery(frame.rows,frame.segments,i);if(!q)continue;
 // Within one contiguous segment, all queries share the same next segment and
 // any later data gap. Only their anchor/ATR and next-bar continuation differ.
 let label=labelCache.get(q.segment);
 if(!label){label=rollingLabel(frame.rows,frame.segments,q,asOf);labelCache.set(q.segment,label);}
 const nextBar=frame.rows[i+1],sameFrame=nextBar&&nextBar.t===q.issuedAt&&nextBar.segment!==null&&frame.segments[nextBar.segment].frame===frame.segments[q.segment].frame;
 const l={...label,target:label.target?{...label.target,deltaAtr:(label.target.median-q.currentWlr)/q.atr}:null,continue1:sameFrame&&nextBar.t+900000<=asOf?Number(nextBar.color===q.color):null};
 cases.push({...q,label:l});
}
const cohorts=new Map(),cohort=c=>`${c.color}:${c.phase}:${c.ageBucket}`;
for(const c of cases){const key=cohort(c);if(!cohorts.has(key))cohorts.set(key,[]);cohorts.get(key).push(c);}
console.log('ROLLING_FRAME '+JSON.stringify({source,cases:cases.length,segments:labelCache.size,evaluations:cases.filter(c=>c.day>=ROLLING_SPEC.selectionStart).length}));
const ledger=[];
for(const q of cases.filter(c=>c.day>=ROLLING_SPEC.selectionStart)){
 const pool=rollingPool(cohorts.get(cohort(q)),q),baseline=predictRolling(q,pool),models=Object.fromEntries(ROLLING_SPEC.models.map(m=>[m,predictRolling(q,pool,rankRolling(frame.rows,q,pool,m))]));
 ledger.push({day:q.day,issuedAt:q.issuedAt,inputStart:q.inputStart,phase:q.phase,targetId:rollingIssue(q,null).targetId,originStart:q.originStart,currentColor:q.color,previousColor:q.previousColor,knownBars:q.knownBars,anchor:q.currentWlr,naiveSides:q.naiveSides,label:q.label,baseline,models});
 if(ledger.length%500===0)console.log('ROLLING_PROGRESS '+ledger.length);
}
const groups=(rs,key)=>{const m=new Map();for(const r of rs){const k=r[key];if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return [...m.values()];};
function targetMeans(rs,key){return groups(rs,'targetId').map(a=>({day:a[0].day,issuedAt:a.at(-1).issuedAt,loss:avg(a.map(r=>r[key]))}));}
const hierarchical=(rs,key)=>avg(groups(targetMeans(rs,key),'day').map(a=>avg(a.map(r=>r.loss))));
const comparison=(rs,trial,base)=>paired(targetMeans(rs,base),targetMeans(rs,trial));
const loss=(p,y,a)=>Math.max(a*(y-p),(a-1)*(y-p));
const emit=r=>{const p=r.p.price,b=r.b.price,confidence=p.side===1?p.pAbove:p.pBelow,base=p.side===1?b.pAbove:b.pBelow;return [-1,1].includes(p.side)&&confidence>.5&&confidence>base+1e-12;};
function score(records,model,filtered=false){
 const rs=records.map(r=>({...r,p:r.models[model],b:r.baseline}));
 const color=rs.filter(r=>r.label.transition!==null&&r.label.color!==null&&r.p.color.ready&&r.b.color.ready).map(r=>({...r,hit:Number(r.p.color.predictedColor===r.label.color),baseHit:Number(r.b.color.predictedColor===r.label.color),wrong:Number(r.p.color.predictedColor!==r.label.color),baseWrong:Number(r.b.color.predictedColor!==r.label.color),brier:[-1,0,1].reduce((s,c)=>s+(r.p.color.probabilities[c]-Number(r.label.color===c))**2,0),baseBrier:[-1,0,1].reduce((s,c)=>s+(r.b.color.probabilities[c]-Number(r.label.color===c))**2,0)}));
 const price=rs.filter(r=>r.label.transition!==null&&r.label.target!==null&&r.p.price.ready&&r.b.price.ready&&(!filtered||emit(r))).map(r=>{
  const target=r.label.target.median,p=r.p.price,b=r.b.price,actual=sideOf(target,r.anchor),hit=Number(p.side===actual),baseHit=Number(b.side===actual),momentumHit=Number(r.naiveSides.momentum1===actual);
  return {...r,actual,hit,baseHit,momentumHit,wrong:1-hit,baseWrong:1-baseHit,momentumWrong:1-momentumHit,brier:(p.pAbove-Number(actual===1))**2,baseBrier:(b.pAbove-Number(actual===1))**2,mae:100*Math.abs(p.p50-target)/r.anchor,baseMae:100*Math.abs(b.p50-target)/r.anchor,flatMae:100*Math.abs(r.anchor-target)/r.anchor,pinball:100*avg([.1,.5,.9].map(a=>loss(p['p'+Math.round(a*100)],target,a)))/r.anchor,basePinball:100*avg([.1,.5,.9].map(a=>loss(b['p'+Math.round(a*100)],target,a)))/r.anchor,covered:Number(target>=p.p10&&target<=p.p90),baseCovered:Number(target>=b.p10&&target<=b.p90),widthPct:100*(p.p90-p.p10)/r.anchor};
 }).filter(r=>[-1,1].includes(r.actual));
 const summary=a=>({revisions:a.length,targets:new Set(a.map(r=>r.targetId)).size,days:new Set(a.map(r=>r.day)).size,hits:a.filter(r=>r.hit).length,baselineHits:a.filter(r=>r.baseHit).length,queryAccuracy:avg(a.map(r=>r.hit)),baselineQueryAccuracy:avg(a.map(r=>r.baseHit)),balancedAccuracy:hierarchical(a,'hit'),baselineBalancedAccuracy:hierarchical(a,'baseHit'),brier:hierarchical(a,'brier'),baselineBrier:hierarchical(a,'baseBrier'),accuracyComparison:comparison(a,'wrong','baseWrong'),brierComparison:comparison(a,'brier','baseBrier')});
 const p={...summary(price),momentumHits:price.filter(r=>r.momentumHit).length,momentumQueryAccuracy:avg(price.map(r=>r.momentumHit)),momentumBalancedAccuracy:hierarchical(price,'momentumHit'),vsMomentum:comparison(price,'wrong','momentumWrong'),maePct:hierarchical(price,'mae'),baselineMaePct:hierarchical(price,'baseMae'),flatMaePct:hierarchical(price,'flatMae'),maeComparison:comparison(price,'mae','baseMae'),vsFlat:comparison(price,'mae','flatMae'),pinball:hierarchical(price,'pinball'),baselinePinball:hierarchical(price,'basePinball'),pinballComparison:comparison(price,'pinball','basePinball'),coverageP10P90:hierarchical(price,'covered'),queryCoverageP10P90:avg(price.map(r=>r.covered)),baselineCoverage:hierarchical(price,'baseCovered'),widthPct:hierarchical(price,'widthPct')};
 const ready=rs.filter(r=>r.p.price.ready&&r.b.price.ready&&(!filtered||emit(r))).length;
 return {queries:records.length,targets:new Set(records.map(r=>r.targetId)).size,priceReady:ready,priceAvailability:records.length?ready/records.length:0,color:summary(color),price:p};
}
const inRange=(start,end)=>ledger.filter(r=>r.day>=start&&r.day<end&&r.label.transition!==null),selection=inRange(ROLLING_SPEC.selectionStart,ROLLING_SPEC.validationStart),validation=inRange(ROLLING_SPEC.validationStart,ROLLING_SPEC.testStart),test=inRange(ROLLING_SPEC.testStart,ROLLING_SPEC.forwardStart);
const selectionScores=Object.fromEntries(ROLLING_SPEC.models.map(m=>[m,score(selection,m)])),eligible=ROLLING_SPEC.models.filter(m=>selectionScores[m].price.targets>=40&&selectionScores[m].price.days>=15),selected=eligible.sort((a,b)=>selectionScores[b].price.balancedAccuracy-selectionScores[a].price.balancedAccuracy||a.localeCompare(b))[0]??null;
const validationScore=selected?score(validation,selected):null,testScore=selected?score(test,selected):null,filteredValidation=selected?score(validation,selected,true):null,filteredTest=selected?score(test,selected,true):null;
function convergence(records,model){
 const pairs=groups(records.filter(r=>r.label.target!==null&&r.models[model].price.ready),'targetId').filter(a=>a.length>=2).map(a=>{
  const first=a[0],last=a.at(-1),p=first.models[model].price,q=last.models[model].price,y=first.label.target.median;
  return {day:first.day,issuedAt:last.issuedAt,targetId:first.targetId,revisions:a.length,firstIssue:first.issuedAt,lastIssue:last.issuedAt,firstLoss:100*Math.abs(p.p50-y)/first.anchor,lastLoss:100*Math.abs(q.p50-y)/first.anchor,firstWidth:100*(p.p90-p.p10)/first.anchor,lastWidth:100*(q.p90-q.p10)/first.anchor,firstCoverage:Number(y>=p.p10&&y<=p.p90),lastCoverage:Number(y>=q.p10&&y<=q.p90),narrowed:Number(q.p90-q.p10<p.p90-p.p10),errorImproved:Number(Math.abs(q.p50-y)<Math.abs(p.p50-y))};
 });
 const daily=key=>avg(groups(pairs,'day').map(a=>avg(a.map(r=>r[key]))));
 return {targets:pairs.length,days:new Set(pairs.map(r=>r.day)).size,firstMaePct:daily('firstLoss'),lastMaePct:daily('lastLoss'),maeImprovement:paired(pairs.map(r=>({day:r.day,issuedAt:r.issuedAt,loss:r.firstLoss})),pairs.map(r=>({day:r.day,issuedAt:r.issuedAt,loss:r.lastLoss}))),firstWidthPct:daily('firstWidth'),lastWidthPct:daily('lastWidth'),firstCoverage:daily('firstCoverage'),lastCoverage:daily('lastCoverage'),fractionNarrowed:avg(pairs.map(r=>r.narrowed)),fractionErrorImproved:avg(pairs.map(r=>r.errorImproved)),note:'Diagnostic first-ready versus latest-ready forecast before the actual next segment begins; not a rule that knows in advance which B candle is final. Each closed issue is retained.'};
}
const colorSource=validationScore&&validationScore.color.brier<validationScore.color.baselineBrier?'CYCLE_MODEL':'CURRENT_COLOR_PHASE_AGE_PRIOR';
const established=Boolean(testScore&&testScore.price.days>=30&&testScore.price.coverageP10P90>=.8&&[testScore.price.accuracyComparison,testScore.price.vsMomentum,testScore.price.maeComparison,testScore.price.pinballComparison,testScore.color.brierComparison].every(x=>x.status==='PROMISING_REQUIRES_FORWARD_TEST'));
const counts=rs=>({revisions:rs.length,targets:new Set(rs.map(r=>r.targetId)).size,days:new Set(rs.map(r=>r.day)).size,statuses:Object.fromEntries([...new Set(rs.map(r=>r.label.status))].map(k=>[k,rs.filter(r=>r.label.status===k).length])),pre0:rs.filter(r=>r.previousColor===null&&r.knownBars===1&&r.phase==='PRE').length});
const report={schema:'wlr-next-continuous-research-v1',generatedAt:new Date().toISOString(),spec:ROLLING_SPEC,source,sourceCommit:'9223935348c53b0585d715ec37363e3a6ed5a44b',selectedModel:selected,colorSource,decision:established?'PROMISING_REQUIRES_FORWARD_TEST':'NOT_ESTABLISHED',counts:{all:counts(ledger),selection:counts(selection),validation:counts(validation),test:counts(test),missing:counts(ledger.filter(r=>r.label.status==='MISSING_FUTURE')),pending:counts(ledger.filter(r=>r.label.status==='RIGHT_CENSORED')),forward:counts(ledger.filter(r=>r.day>=ROLLING_SPEC.forwardStart))},selection:selectionScores,validation:validationScore,test:testScore,filteredValidation,filteredTest,convergence:selected?convergence(test,selected):null,limits:['Retrospective already-inspected archive, not clean holdout or forward validation.','Primary scores average revisions within each target, then targets within each NY day; confidence resamples days, not overlapping bar snapshots. Query-level hit rates are descriptive.','The target is next color-changing WLR segment, so its color cannot equal the current segment color. Current-color persistence for the next candle is a separate output, not a missing third-color probability.','All three literal colors can be current or next across the series. Color probabilities are conditional on a next segment appearing; WLR quantiles additionally require a completed next-segment median.','Per-color distributions require12 distinct completed target days; broad distribution uses all next colors, never picks a branch using the true future color.','Convergence is measured, not imposed. Do not narrow P10-P90 to look confident or smooth the curve using future targets.','Current anchor updates only at a newly closed M15 issue. Previously issued anchors and forecasts remain frozen in the ledger; duplicate and older asynchronous snapshots cannot overwrite newer ones.','No chart, label, CVD overlay, trend-age, Strength or production-forecast changes.']};
save('continuous-report.json',report);save('continuous-ledger.json',{spec:ROLLING_SPEC,source,records:ledger},false);save('continuous-summary.md',`# Continuous next-WLR research\n\n${report.decision}; selected ${selected??'WAIT'}.\n\n${JSON.stringify({counts:report.counts.test,test:report.test,filtered:report.filteredTest,convergence:report.convergence},null,2)}\n\n${report.limits.map(x=>'- '+x).join('\n')}\n`);
console.log('ROLLING_RESULT '+JSON.stringify({...report,source:{...source,files:undefined},selection:undefined}));
