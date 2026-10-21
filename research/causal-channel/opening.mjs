import {forecastQuery} from '../../netflow-stumpy/rth-forecast-core.mjs';
import {ny,STEP} from '../../netflow-stumpy/rth-structure.mjs';

export const OPENING_PROTOCOL=Object.freeze({
 id:'first-rth-close-plus8-v1',decisionMinute:585,horizon:8,
 input:'Last 8/16 closed M15 bars: 7/15 PRE bars plus the first RTH bar; no waiting for 8/16 RTH bars.',
 target:'Issue at 09:45 America/New_York after the 09:30 RTH bar closes; predict the next eight bars, 09:45-11:45. Reuse PRE history; never use the running second RTH bar.',
});
export function isOpeningCase(q){
 return q?.phase==='RTH'&&q.clockMinute===585&&ny(q.queryTime).minute===570&&
  q.h===8&&q.targetDay===q.queryDay&&q.targetStart===q.inputEnd&&q.targetEnd===q.inputEnd+8*STEP;
}
export function openingQuery(rows,options){
 const q=forecastQuery(rows,options);return isOpeningCase(q)?q:null;
}
export function openingFrame(data){
 const evaluations=data.evaluations.filter(e=>isOpeningCase(e.query)),keys=new Set(),days=new Set();
 if(!evaluations.length)throw Error('No complete first-RTH-close queries');
 for(const e of evaluations){
  const q=e.query;if(days.has(q.targetDay))throw Error('Duplicate opening decision day');days.add(q.targetDay);
  const window=data.rows.SPYUSDT.slice(q.i-15,q.i+1);
  if(window.length!==16||window.some((r,j)=>ny(r.t).day!==q.queryDay||ny(r.t).minute!==345+j*15))throw Error('Opening input must be 15 PRE bars plus one RTH bar');
  if(!e.candidateStarts.length)throw Error('Missing same-minute opening candidates');
  for(const m of [8,16]){const key=e.keys[m];if(!data.tasks[key]||data.queries[key]!==q.i)throw Error('Opening profile query mismatch');keys.add(key);}
 }
 return {...data,evaluations,tasks:Object.fromEntries([...keys].map(k=>[k,data.tasks[k]])),queries:Object.fromEntries([...keys].map(k=>[k,data.queries[k]]))};
}
