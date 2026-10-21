export function compactArchive(data,report){
 if(data.asOf!==report.sourceAsOf)throw Error('A-B-A source/report mismatch');
 const testCount=data.evaluations.filter(e=>e.split==='test').length;
 if(testCount!==report.test.CURRENT_MEDIAN.queries)throw Error('A-B-A evaluation frame mismatch');
 const vectors=[],indices=new Map(),source=data.rows.SPYUSDT;
 const cases=data.cases.map(c=>({...c,window:Array.from({length:16},(_,j)=>{
  const index=c.i-15+j;if(!indices.has(index)){const pv=source[index]?.pv;if(pv?.length!==10||!pv.every(Number.isFinite))throw Error('A-B-A vector missing');indices.set(index,vectors.length);vectors.push(pv);}return indices.get(index);
 })}));
 const {records,...summary}=report;
 return {archive:{schema:'wlr-aba-v1',version:1,sourceAsOf:data.asOf,source:data.source,vectors,cases},report:{...summary,schema:'wlr-aba-v1',publishedAt:Date.now(),publication:'Experimental web publication explicitly authorized by user on 2026-10-21; no established price edge',liveLimit:'Historical scores concern first eligible segment snapshots. An already-open segment may be selected for a new causal live forecast; that later entry has not been separately forward validated.'}};
}
