import test from 'node:test';import assert from 'node:assert/strict';
import {wlrAgreementStatistics,WLR_HORIZONS} from '../wlr-agreement-stats.mjs';

const step=60_000;
function build(){
  const price=[],composite=[],volume=[];
  for(let i=0;i<120;i++){
    const t=i*step,up=(Math.floor(i/8)%2)===0,base=100+i*.02,dir=up?1:-1;
    price.push({t,day:'2026-10-15',c:base,h:base+.12,l:base-.12});
    composite.push({t,adjusted:dir*(.35+(i%10)/20)});
    const agree=i%6!==0;
    volume.push({t,adjusted:(agree?dir:-dir)*(.3+(i%7)/20)});
  }
  return {price,composite,volume};
}
test('WLR agreement stats expose all horizons and causal percentile states',()=>{
  const {price,composite,volume}=build(),r=wlrAgreementStatistics(price,composite,volume,step,{minSamples:2});
  assert.deepEqual(Object.keys(r.summaries).map(Number),WLR_HORIZONS);
  assert.equal(r.states.length,price.length);
  assert.equal(r.states.slice(0,20).every(x=>x.bucket===null),true);
  assert(r.states.slice(20).some(x=>x.bucket!==null));
  assert(r.summaries[3].thick.n>0);assert(r.summaries[3].thin.n>0);
  assert(r.summaries[3].p90_100.n+r.summaries[3].p75_90.n+r.summaries[3].p50_75.n+r.summaries[3].p25_50.n+r.summaries[3].p0_25.n>0);
});
test('future mutation does not alter earlier state classification',()=>{
  const {price,composite,volume}=build(),a=wlrAgreementStatistics(price,composite,volume,step,{minSamples:2});
  const changed=volume.map((x,i)=>i===volume.length-1?{...x,adjusted:-x.adjusted}:x),b=wlrAgreementStatistics(price,composite,changed,step,{minSamples:2});
  assert.deepEqual(a.states.slice(0,-1),b.states.slice(0,-1));
});
test('same-cohort outcome windows do not overlap',()=>{
  const {price,composite,volume}=build(),r=wlrAgreementStatistics(price,composite,volume,step,{minSamples:1});
  for(const h of WLR_HORIZONS){
    const naive=Math.floor(price.length/(h+1));
    assert(r.summaries[h].thick.n<=naive+1);
    assert(r.summaries[h].thin.n<=naive+1);
  }
});
test('rejects invalid parameters',()=>assert.throws(()=>wlrAgreementStatistics([],[],[],0),/không hợp lệ/));
