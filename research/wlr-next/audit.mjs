import fs from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('./output/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('continuous-ledger.json',root))),report=JSON.parse(fs.readFileSync(new URL('continuous-report.json',root))),targets=new Map();
let complete=0;
for(const r of data.records){
 assert.ok(r.inputStart<r.issuedAt);assert.ok(Number.isFinite(r.anchor)&&r.anchor>0);
 const previous=targets.get(r.targetId);
 if(previous){assert.ok(r.issuedAt>previous.issuedAt);assert.ok(r.knownBars>previous.knownBars);assert.equal(r.currentColor,previous.currentColor);assert.equal(r.label.target?.median,previous.label.target?.median);}
 targets.set(r.targetId,r);
 if(r.label.target){complete++;assert.equal(r.label.status,'COMPLETE_NEXT');assert.ok(r.issuedAt<=r.label.target.start);assert.ok(r.label.target.knownAt<=r.label.matureAt);assert.notEqual(r.label.color,r.currentColor);}
 if(['RIGHT_CENSORED','MISSING_FUTURE','NO_NEXT_BY_POST_END','NEXT_OPEN_AT_POST_END'].includes(r.label.status))assert.equal(r.label.target,null);
 for(const p of [r.baseline,...Object.values(r.models)]){
  assert.equal(p.anchor,r.anchor);assert.equal(p.color.probabilities[r.currentColor],0);assert.ok(Math.abs(Object.values(p.color.probabilities).reduce((s,v)=>s+v,0)-1)<1e-12);
  if(p.color.predictedColor!==null)assert.notEqual(p.color.predictedColor,r.currentColor);
  for(const d of [p.price,...Object.values(p.byColor)])if(d.ready){assert.ok(d.n>=12);assert.ok(d.p10<=d.p50&&d.p50<=d.p90);assert.ok(Math.abs(d.pAbove+d.pBelow-1)<1e-12);}
 }
}
assert.equal(data.records.length,report.counts.all.revisions);assert.equal(targets.size,report.counts.all.targets);
assert.equal(report.counts.test.revisions,data.records.filter(r=>r.day>=data.spec.testStart&&r.day<data.spec.forwardStart&&r.label.transition!==null).length);
console.log(JSON.stringify({audit:'PASS',revisions:data.records.length,distinctTargets:targets.size,completedMedianRevisions:complete,sourceAsOf:data.source.asOf,decision:report.decision}));
