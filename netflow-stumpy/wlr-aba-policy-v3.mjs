import {POLICY_SPEC,buildPolicy,policyScore} from './wlr-aba-policy.mjs?v=20261025-dcommon-all1';
export const POLICY_V3_SPEC=Object.freeze({...POLICY_SPEC,version:3,protocolId:'wlr-aba-v3-six-week-gate-20261023',gateStart:'2026-08-21',testStart:'2026-10-02',historicalEnd:'2026-10-23',forwardStart:'2026-10-26',gateCalendarWeeks:6,minimumForwardDays:30,minimumForwardN:40});
export function selectV3Policy(records){
 const {test,forward,...policy}=buildPolicy(records,POLICY_V3_SPEC);
 return policy;
}
export function scoreV3Policy(records,policy,{now,forwardOpen}){
 const rs=policy.selectedModel?(records[policy.selectedModel]??[]).filter(r=>r.issuedAt<=now):[];
 const test=policyScore(rs.filter(r=>r.day>=POLICY_V3_SPEC.testStart&&r.day<POLICY_V3_SPEC.historicalEnd),policy);
 const forward=policyScore(rs.filter(r=>r.day>=POLICY_V3_SPEC.forwardStart),policy);
 return {...policy,test:{...test,kind:'PREVIOUSLY_INSPECTED_RETROSPECTIVE'},forward:{...forward,kind:'POST_FREEZE_REPLAY',phase:now<forwardOpen?'NOT_STARTED':forward.queries?'COLLECTING':'WAIT_DATA',minimumDays:POLICY_V3_SPEC.minimumForwardDays,minimumN:POLICY_V3_SPEC.minimumForwardN,liveLedgerVerified:false},evidence:'RESEARCH_ONLY'};
}
