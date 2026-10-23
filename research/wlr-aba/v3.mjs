import {createHash} from 'node:crypto';
import {POLICY_V3_SPEC,selectV3Policy,scoreV3Policy} from '../../netflow-stumpy/wlr-aba-policy-v3.mjs';
import {europeOpen} from '../../netflow-stumpy/wlr-aba-core.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const V3_LOCK_SCHEMA='wlr-aba-v3-policy-lock';
export function verifyV3Lock(lock,modelCodeHash){
 if(typeof modelCodeHash!=='string'||!(/^[a-f0-9]{64}$/).test(modelCodeHash))throw Error('V3 model code hash is missing');
 const {id,...body}=lock??{};
 if(lock?.schema!==V3_LOCK_SCHEMA||lock.version!==3||lock.policy?.version!==3||lock.modelCodeHash!==modelCodeHash||JSON.stringify(lock.spec)!==JSON.stringify(POLICY_V3_SPEC)||JSON.stringify(lock.policy?.spec)!==JSON.stringify(POLICY_V3_SPEC)||id!==digest(body))throw Error('V3 frozen policy mismatch; do not refit an existing forward cohort');
 if(!Number.isFinite(lock.createdAt)||lock.createdAt>=europeOpen(POLICY_V3_SPEC.forwardStart)||lock.sourceAsOf>lock.createdAt||lock.sourceAsOf<Date.parse(POLICY_V3_SPEC.testStart+'T00:00:00Z'))throw Error('V3 lock was not frozen with completed gate data before forward');
 return lock;
}
export function buildFrozenV3(records,{lock=null,now=Date.now(),sourceAsOf,modelCodeHash}){
 const forwardOpen=europeOpen(POLICY_V3_SPEC.forwardStart);
 if(!lock){
  if(now>=forwardOpen)throw Error('V3 must be frozen before 2026-10-26 Europe open; define a new future protocol instead of backdating');
  if(!Number.isFinite(sourceAsOf)||sourceAsOf<Date.parse(POLICY_V3_SPEC.testStart+'T00:00:00Z')||sourceAsOf>now)throw Error('V3 gate window is incomplete or source clock is invalid');
  const policy=selectV3Policy(records),body={schema:V3_LOCK_SCHEMA,version:3,spec:POLICY_V3_SPEC,createdAt:now,sourceAsOf,modelCodeHash,policy};
  lock={...body,id:digest(body)};
 }
 verifyV3Lock(lock,modelCodeHash);
 const scored=scoreV3Policy(records,lock.policy,{now,forwardOpen});
 return {lock,report:{...scored,policyId:lock.id,freeze:{status:'FROZEN',id:lock.id,createdAt:lock.createdAt,sourceAsOf:lock.sourceAsOf,modelCodeHash:lock.modelCodeHash},forwardOpen}};
}
