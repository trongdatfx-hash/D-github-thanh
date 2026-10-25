import {SPEC,candidatePool,onePerDay,paired} from './wlr-aba-core.mjs?v=20261025-dcommon-all1';
export function sideOf(value,anchor){
 if(!Number.isFinite(value)||!Number.isFinite(anchor))return null;
 const delta=value-anchor,epsilon=1e-10*Math.max(1,Math.abs(anchor));return Math.abs(delta)<=epsilon?0:Math.sign(delta);
}
export function forecastFromWlr(q,p,pool,ranked,model){
 const safe=candidatePool(pool,q),allowed=new Set(safe),byClock=[...safe].sort((a,b)=>Math.abs(a.clockMinute-q.clockMinute)-Math.abs(b.clockMinute-q.clockMinute)||b.i-a.i),prior=['CURRENT_MEDIAN','LAST_SAME','COLOR_PRIOR'].includes(model);
 const selected=prior?byClock:(ranked??[]).map(r=>r.case).filter(c=>allowed.has(c)),completed=c=>c.label.event===1&&Number.isFinite(c.label.target?.median)&&Number.isFinite(c.currentWlr);
 const examples=onePerDay(selected.filter(completed),prior?Infinity:SPEC.maximumMatches),background=onePerDay(byClock.filter(completed));
 // Project the unchanged model's conditional price distribution at this known
 // query, and compare it with the last closed WLR at issue.
 const projected=examples.map(c=>sideOf(q.currentMedian+q.atr*c.label.target.deltaAtr,q.currentWlr)),priorSides=background.map(c=>sideOf(c.label.target.median,c.currentWlr));
 const rates=sides=>{const up=sides.filter(v=>v===1).length,down=sides.filter(v=>v===-1).length,n=up+down;return {n,up,down,flat:sides.filter(v=>v===0).length,pAbove:(up+1)/(n+2),pBelow:(down+1)/(n+2)};};
 const trial=rates(projected),baseline=rates(priorSides),side=sideOf(p.value,q.currentWlr),baselineSide=baseline.up===baseline.down?null:baseline.up>baseline.down?1:-1;
 return {anchor:q.currentWlr,side,ready:p.ready&&trial.n>=SPEC.minimumMatches&&side!==null&&side!==0,...trial,baseline:{...baseline,side:baselineSide,ready:baseline.n>=SPEC.minimumMatches&&baselineSide!==null}};
}
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export function directionScore(records){
 const completed=records.filter(r=>Number.isFinite(r.target)),labeled=completed.map(r=>({...r,actual:sideOf(r.target,r.direction?.anchor)})),common=labeled.filter(r=>r.direction?.ready&&r.direction.baseline.ready&&[-1,1].includes(r.actual));
 const scored=common.map(r=>({...r,hit:Number(r.direction.side===r.actual),baseHit:Number(r.direction.baseline.side===r.actual),probLoss:(r.direction.pAbove-Number(r.actual===1))**2,baseProbLoss:(r.direction.baseline.pAbove-Number(r.actual===1))**2}));
 const daily=key=>avg([...new Set(scored.map(r=>r.day))].map(day=>avg(scored.filter(r=>r.day===day).map(r=>r[key]))));
 const trial=scored.map(r=>({day:r.day,issuedAt:r.issuedAt,loss:1-r.hit,brier:r.probLoss})),base=scored.map(r=>({day:r.day,issuedAt:r.issuedAt,loss:1-r.baseHit,brier:r.baseProbLoss})),comparison=paired(base,trial),probabilityComparison=paired(base,trial,'brier');
 return {queries:records.length,completed:completed.length,n:scored.length,days:new Set(scored.map(r=>r.day)).size,hits:scored.filter(r=>r.hit).length,baselineHits:scored.filter(r=>r.baseHit).length,accuracy:avg(scored.map(r=>r.hit)),baselineAccuracy:avg(scored.map(r=>r.baseHit)),dayAccuracy:daily('hit'),baselineDayAccuracy:daily('baseHit'),brier:daily('probLoss'),baselineBrier:daily('baseProbLoss'),flatTargets:labeled.filter(r=>r.actual===0).length,excluded:completed.length-scored.length,unfinished:records.length-completed.length,comparison,probabilityComparison,status:comparison.status??'WAIT'};
}
