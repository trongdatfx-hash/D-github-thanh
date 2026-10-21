import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {caseAt,ny,STEP} from '../rth-structure.mjs';
import {FORECAST_MODELS,predictPath,pathLoss,evaluatePaths} from '../rth-forecast-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/rth-forecast'),save=(name,value)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),JSON.stringify(value));},finalize=process.argv.includes('--finalize');
if(!finalize){
 const source=JSON.parse(fs.readFileSync(path.join(root,'data/rth-structure/tasks.json'))),rows=source.rows.SPYUSDT,lookup=new Map(rows.map(r=>[r.t,r])),cases=[];
 for(let i=15;i<rows.length;i++){
  const minute=ny(rows[i].t).minute+15;if(minute<570||minute>840)continue;
  const q=caseAt(rows,i,16,8,lookup);if(!q||q.h!==8||q.targetStart!==q.inputEnd||!q.outcome)continue;
  const c0=rows[i].c,p=Array.from({length:8},(_,j)=>lookup.get(q.inputEnd+j*STEP));if(p.some(r=>!Number.isFinite(r?.c)))continue;
  const {outcome,...known}=q;cases.push({...known,c0,path:p.map(r=>(r.c-c0)/q.atr)});
 }
 const days=[...new Set(cases.map(c=>c.targetDay))].sort(),validationStart=days[Math.floor(days.length*.5)],testStart=days[Math.floor(days.length*.7)],tasks={},queries={},evaluations=[];
 for(const q of cases.filter(c=>c.targetDay>=validationStart)){
  const candidates=cases.filter(c=>c.clockMinute===q.clockMinute&&c.targetEnd<=q.inputStart);if(candidates.length<20)continue;
  const keys={};for(const m of [8,16]){const key=`SPYUSDT:${m}:8:price-volume:line:at:${q.i}`;keys[m]=key;queries[key]=q.i;tasks[key]=candidates.map(c=>c.i-m+1);}
  evaluations.push({query:q,candidateStarts:candidates.map(c=>c.startIndex),keys,split:q.targetDay<testStart?'validation':'test'});
 }
 save('tasks.json',{rows:{SPYUSDT:rows},tasks,queries,cases,evaluations,validationStart,testStart,asOf:source.asOf,sourceRange:source.sourceRange});
 console.log(JSON.stringify({forecastCases:cases.length,forecastTasks:Object.keys(tasks).length,validationStart,testStart}));
}else{
 const data=JSON.parse(fs.readFileSync(path.join(dir,'tasks.json'))),profiles=JSON.parse(fs.readFileSync(path.join(dir,'profiles.json'))),byStart=new Map(data.cases.map(c=>[c.startIndex,c])),records={validation:{},test:{}};
 for(const split of ['validation','test'])for(const model of FORECAST_MODELS)records[split][model]=[];
 for(const e of data.evaluations){
  const q=e.query,candidates=e.candidateStarts.map(i=>byStart.get(i)),rankings={};for(const m of [8,16])rankings[m]=profiles.ranked[e.keys[m]].map(r=>({...r,index:r.index-(16-m)}));
  const flatLoss=q.path.reduce((s,v)=>s+Math.abs(v),0)/8*q.atr/q.c0*100;
  for(const model of FORECAST_MODELS){const p=predictPath(q,candidates,model,rankings);if(!p||p.n<12)throw Error('Unequal candidate coverage in path evaluation');records[e.split][model].push({day:q.targetDay,issuedAt:q.inputEnd,loss:pathLoss(p,q),endLoss:Math.abs(p.median[7]-q.path[7])*q.atr/q.c0*100,flatLoss,n:p.n,level:p.level});}
 }
 const validation=Object.fromEntries(FORECAST_MODELS.map(m=>[m,evaluatePaths(records.validation[m])])),test=Object.fromEntries(FORECAST_MODELS.map(m=>[m,evaluatePaths(records.test[m])])),selectedModel=[...FORECAST_MODELS].sort((a,b)=>(validation[a].pathMaePct??Infinity)-(validation[b].pathMaePct??Infinity)||FORECAST_MODELS.indexOf(a)-FORECAST_MODELS.indexOf(b))[0],ready=validation[selectedModel].days>=10;
 const report={version:1,generatedAt:Date.now(),sourceAsOf:data.asOf,sourceRange:data.sourceRange,selectedModel:ready?selectedModel:null,validationStart:data.validationStart,testStart:data.testStart,validation,test,records,protocol:{target:'8 next M15 closes wholly within same NY RTH; anchor is latest CLOSED SPY close, including gap to next open',selection:'First 50% target days initial history; next20% validation chooses lowest 8-step path MAE%; last30% untouched by this selector. No selection by final test. Original research archive already viewed: exploratory, not pristine forward validation.',source:'SPY price + original-volume SPY V + Composite Strength + WLR/candle features; aeon3 excluded because different horizon',purge:'same NY minute; each candidate target completed before query 16-bar input start; up to20 non-overlap analogs, one/day; prior uses all eligible same-minute days',line:'pointwise median, not one most likely coherent path; P10/P90 descriptive pointwise envelope, not 80% simultaneous coverage; percent frequency not calibrated probability',criterion:'Path MAE%, lower is better; FLAT is eligible and may win; bootstrap by target day (5-day blocks) vs FLAT',stumpyVersion:profiles.libraryVersion}};
 save('report.json',report);
 // Full-precision vectors preserve browser/MASS parity; reuse rows by index.
 save('archive.json',{version:1,sourceAsOf:data.asOf,sourceRange:data.sourceRange,rows:data.rows.SPYUSDT.map(r=>({t:r.t,pv:r.pv})),cases:data.cases});
 console.log(JSON.stringify({selectedModel:report.selectedModel,validation,test}));
}
