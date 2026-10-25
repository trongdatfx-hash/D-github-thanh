import {COMPOSITE_STRENGTH_VERSION} from './engine.mjs?v=20261025-dcommon-all1';
import {SPEC} from './wlr-aba-core.mjs?v=20261025-dcommon-all1';
export function compactArchive(data,report){
 if(data.strengthVersion!==COMPOSITE_STRENGTH_VERSION||report.strengthVersion!==COMPOSITE_STRENGTH_VERSION)throw Error('Composite Strength schema mismatch; rebuild archive');
 if(data.asOf!==report.sourceAsOf)throw Error('A-B-A source/report mismatch');
 if(data.spec?.inputScope!==SPEC.inputScope||report.spec?.inputScope!==SPEC.inputScope)throw Error('A-B-A input scope mismatch; rebuild European opening candle 0 cases and report');
 const testCount=data.evaluations.filter(e=>e.split==='test').length;
 if(testCount!==report.test.CURRENT_MEDIAN.queries)throw Error('A-B-A evaluation frame mismatch');
 const vectors=[],indices=new Map(),source=data.rows.SPYUSDT;
 const cases=data.cases.map(c=>({...c,window:Array.from({length:16},(_,j)=>{
  const index=c.i-15+j;if(!indices.has(index)){const pv=source[index]?.pv;if(pv?.length!==10||!pv.every(Number.isFinite))throw Error('A-B-A vector missing');indices.set(index,vectors.length);vectors.push(pv);}return indices.get(index);
 })}));
 const {records,...summary}=report;
 return {archive:{strengthVersion:COMPOSITE_STRENGTH_VERSION,schema:'wlr-aba-v2',version:2,activePolicyVersion:report.activePolicyVersion??2,policyId:report.v3?.policyId??null,inputScope:SPEC.inputScope,sourceAsOf:data.asOf,source:data.source,vectors,cases},report:{...summary,strengthVersion:COMPOSITE_STRENGTH_VERSION,schema:'wlr-aba-v2',publishedAt:Date.now(),publication:'Experimental web publication explicitly authorized by user on 2026-10-21; no established price edge',liveLimit:'Historical scores concern first eligible segment snapshots, including European opening candle 0 using preceding closed history when ready. An already-open segment may be selected for a new causal live forecast; that later entry has not been separately forward validated.'}};
}
