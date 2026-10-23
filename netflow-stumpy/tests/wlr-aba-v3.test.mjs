import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICY_SPEC,buildPolicy,applyPolicy} from '../wlr-aba-policy.mjs';
import {POLICY_V3_SPEC,selectV3Policy} from '../wlr-aba-policy-v3.mjs';
import {buildFrozenV3,verifyV3Lock} from '../../research/wlr-aba/v3.mjs';
import {activePolicy,policyKey,usableSignal} from '../wlr-aba-status.mjs';
import {validateSnapshot} from '../wlr-aba-snapshot.mjs';
import {SPEC,europeOpen} from '../wlr-aba-core.mjs';
const freezeNow=Date.parse('2026-10-23T03:00:00Z'),sourceAsOf=Date.parse('2026-10-22T00:00:00Z'),modelCodeHash='a'.repeat(64);
function fixture(model){
 const out=[];
 for(const [start,days]of [['2026-06-01',20],['2026-07-17',25],['2026-08-21',30],['2026-10-02',15],['2026-10-26',5]]){
  for(let k=0;k<days;k++)for(let j=0;j<3;j++){
   const day=new Date(Date.parse(start+'T00:00:00Z')+k*86400000).toISOString().slice(0,10),i=k*3+j,y=i%2?1:-1,correct=model==='CYCLE8'?i%5!==0:i%3!==0,side=correct?y:-y;
   out.push({day,issuedAt:Date.parse(day+'T14:00:00Z')+j*900000,target:100+y,prediction:{ready:true,value:100+side*2,low:98,high:102},direction:{anchor:100,side,ready:true,pAbove:side>0?.8:.2,pBelow:side>0?.2:.8,baseline:{side:1,ready:true,pAbove:.55,pBelow:.45}}});
  }
 }
 return out;
}
const records=()=>({CYCLE8:fixture('CYCLE8'),CYCLE16:fixture('CYCLE16')});
test('V3 gate is a fixed six weeks; V2 dates and sample thresholds are preserved',()=>{
 assert.equal((Date.parse(POLICY_V3_SPEC.testStart)-Date.parse(POLICY_V3_SPEC.gateStart))/86400000,42);
 assert.equal(POLICY_SPEC.gateStart,'2026-08-07');assert.equal(POLICY_SPEC.testStart,'2026-08-21');
 assert.equal(POLICY_V3_SPEC.minimumGateN,20);assert.equal(POLICY_V3_SPEC.minimumGateDays,5);assert.equal(POLICY_V3_SPEC.minimumGateCoverage,.3);
 const p=selectV3Policy(records());assert.equal(p.version,3);assert.equal(p.selectedModel,'CYCLE8');assert.equal(p.calibration.model.n,75);
 assert.equal(p.status,'READY');assert.ok(p.gateValidation.trials.some(t=>t.valid&&t.score.n>=20));assert.equal(buildPolicy(records()).version,2);
});
test('changing holdout or forward outcomes cannot change model, calibrator or gate',()=>{
 const a=records(),b=Object.fromEntries(Object.entries(a).map(([m,rs])=>[m,rs.map(r=>r.day>=POLICY_V3_SPEC.testStart?{...r,target:100-r.direction.side}:r)]));
 assert.deepEqual(selectV3Policy(a),selectV3Policy(b));
});
test('V3 is frozen once before forward; new outcomes never refit an existing lock',()=>{
 const first=buildFrozenV3(records(),{now:freezeNow,sourceAsOf,modelCodeHash});
 assert.equal(first.report.freeze.status,'FROZEN');assert.equal(first.report.forward.queries,0);assert.equal(first.report.forward.phase,'NOT_STARTED');
 const changed=records();for(const rs of Object.values(changed))for(const r of rs)r.target=100-r.direction.side;
 const later=buildFrozenV3(changed,{lock:first.lock,now:Date.parse('2026-11-04T00:00:00Z'),sourceAsOf:Date.parse('2026-11-03T00:00:00Z'),modelCodeHash});
 assert.deepEqual(later.lock,first.lock);assert.deepEqual(later.report.calibration,first.report.calibration);assert.equal(later.report.policyId,first.report.policyId);
 assert.equal(later.report.forward.queries,15);assert.equal(later.report.forward.kind,'POST_FREEZE_REPLAY');assert.equal(later.report.forward.liveLedgerVerified,false);
 assert.equal(later.report.test.kind,'PREVIOUSLY_INSPECTED_RETROSPECTIVE');
});
test('late freezing, incomplete gate, tampered policy and changed model code fail closed',()=>{
 const first=buildFrozenV3(records(),{now:freezeNow,sourceAsOf,modelCodeHash});
 assert.throws(()=>buildFrozenV3(records(),{now:europeOpen(POLICY_V3_SPEC.forwardStart),sourceAsOf,modelCodeHash}),/before/);
 assert.throws(()=>buildFrozenV3(records(),{now:freezeNow,sourceAsOf:Date.parse('2026-09-20T00:00:00Z'),modelCodeHash}),/incomplete/);
 assert.throws(()=>verifyV3Lock({...first.lock,policy:{...first.lock.policy,gate:{gap:.99,band:'any'}}},modelCodeHash),/mismatch/);
 assert.throws(()=>verifyV3Lock(first.lock,'b'.repeat(64)),/mismatch/);
 assert.throws(()=>verifyV3Lock(first.lock,undefined),/missing/);
});
test('V3 respects its own policy start and remains separate from usable signals',()=>{
 const r=records().CYCLE8.find(r=>r.day==='2026-08-21'),frozen=buildFrozenV3(records(),{now:freezeNow,sourceAsOf,modelCodeHash}),p=frozen.report;
 assert.equal(applyPolicy(r,p).signal.reason,'BEFORE_POLICY_WINDOW');
 const report={activePolicyVersion:3,v2:{status:'WAIT_GATE_VALIDATION'},v3:p,decision:'NOT_ESTABLISHED'};
 assert.equal(activePolicy(report),p);assert.equal(activePolicy({...report,activePolicyVersion:4}),null);
 assert.equal(usableSignal({policyKey:policyKey(p)},report,freezeNow,{live:true,verified:true}).reason,'WAIT_FORWARD_START');
 const base={schema:'wlr-aba-v2',sourceAsOf,inputScope:SPEC.inputScope,activePolicyVersion:3,policyId:p.policyId,snapshotId:'same'};
 const full={...report,schema:base.schema,sourceAsOf,spec:SPEC,snapshotId:'same',v2:{version:2}};
 assert.doesNotThrow(()=>validateSnapshot(base,full));
 assert.throws(()=>validateSnapshot({...base,policyId:'wrong'},full),/V3/);
});
