import {COMPOSITE_STRENGTH_VERSION,requireCompositeStrengthVersion} from '../engine.mjs?v=20261029-price-delta1';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {macdFeatures,readyMacdWindow,MACD_SPEC,MACD_MODELS,pairedMacd} from '../macd-research.mjs?v=20261029-price-delta1';
import {forecastPaths,pathLoss,evaluatePaths} from '../rth-forecast-core.mjs?v=20261029-price-delta1';
import {selectCases} from '../rth-structure.mjs?v=20261029-price-delta1';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/macd'),source=path.join(root,'data/rth-forecast'),read=file=>JSON.parse(fs.readFileSync(file)),save=(name,value)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),JSON.stringify({...value,strengthVersion:COMPOSITE_STRENGTH_VERSION}));};
if(!process.argv.includes('--finalize')){
 const data=read(path.join(source,'tasks.json')),rows=macdFeatures(data.rows.SPYUSDT),cases=data.cases.filter(c=>readyMacdWindow(rows,c)),allowed=new Set(cases.map(c=>c.startIndex)),tasks={},queries={},evaluations=[];
 requireCompositeStrengthVersion(data);
 for(const e of data.evaluations){if(!readyMacdWindow(rows,e.query))continue;const candidateStarts=e.candidateStarts.filter(i=>allowed.has(i));if(candidateStarts.length<20)continue;
  for(const m of [8,16]){const key=e.keys[m];queries[key]=e.query.i;tasks[key]=candidateStarts.map(i=>i+(16-m));}evaluations.push({...e,candidateStarts});
 }
 save('tasks.json',{version:1,asOf:data.asOf,sourceRange:data.sourceRange,validationStart:data.validationStart,testStart:data.testStart,rows,cases,tasks,queries,evaluations});
 console.log(JSON.stringify({macdCases:cases.length,macdQueries:Object.keys(tasks).length,excludedCases:data.cases.length-cases.length}));
}else{
 const data=read(path.join(dir,'tasks.json')),profiles=read(path.join(dir,'profiles.json')),original=read(path.join(source,'profiles.json')),cases=new Map(data.cases.map(c=>[c.startIndex,c])),records={validation:{},test:{}};
 requireCompositeStrengthVersion(data);
 requireCompositeStrengthVersion(profiles);
 requireCompositeStrengthVersion(original);
 for(const split of ['validation','test'])for(const model of MACD_MODELS)records[split][model]=[];
 for(const e of data.evaluations){const q=e.query,candidates=e.candidateStarts.map(i=>cases.get(i)),flatLoss=q.path.reduce((s,v)=>s+Math.abs(v),0)/8*q.atr/q.c0*100;
  for(const model of MACD_MODELS){let picked=candidates;const m=model.endsWith('16')?16:8,variant=model.replace(/\d+$/,'');
   if(!['FLAT','PRIOR'].includes(model)){const ranked=variant==='ORIGINAL'?original.ranked[e.keys[m]]:profiles.ranked[e.keys[m]][variant];picked=selectCases(ranked.map(r=>({...r,index:r.index-(16-m)})),candidates);}
   const p=forecastPaths(candidates,picked,{flat:model==='FLAT'});if(!p||p.n<12)throw Error('Unequal MACD comparison coverage');
   // FLAT is a path benchmark; its probability reference remains the same prior.
   const probabilities=[p.up,p.down,p.flat],y=q.path[7]>0?0:q.path[7]<0?1:2,brier=probabilities.reduce((s,v,j)=>s+(v-Number(y===j))**2,0),correct=Number(probabilities.indexOf(Math.max(...probabilities))===y);
   records[e.split][model].push({day:q.targetDay,issuedAt:q.inputEnd,loss:pathLoss(p,q),endLoss:Math.abs(p.median[7]-q.path[7])*q.atr/q.c0*100,flatLoss,brier,correct,n:p.n});
  }
 }
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,score=split=>Object.fromEntries(MACD_MODELS.map(m=>[m,{...evaluatePaths(records[split][m]),brier:mean(records[split][m].map(r=>r.brier)),directionAccuracy:mean(records[split][m].map(r=>r.correct))}])),validation=score('validation'),test=score('test'),comparisons={};
 for(const m of [8,16]){comparisons['MACD'+m]=pairedMacd(records.test['PAIR'+m],records.test['MACD'+m],{alpha:.025});comparisons['COMBINED'+m]=pairedMacd(records.test['PAIR'+m],records.test['COMBINED'+m]);}
 const selectedWindows=Object.fromEntries(['PRICE','PAIR','MACD','COMBINED','ORIGINAL'].map(prefix=>[prefix,[8,16].sort((a,b)=>validation[prefix+a].pathMaePct-validation[prefix+b].pathMaePct)[0]]));
 save('report.json',{version:1,generatedAt:Date.now(),sourceAsOf:data.asOf,sourceRange:data.sourceRange,validationStart:data.validationStart,testStart:data.testStart,selectedWindows,validation,test,comparisons,records,protocol:{...MACD_SPEC,target:'same exact next eight M15 closes wholly inside NY RTH, anchor last closed SPY close',split:'reuse original path study 50/20/30 chronological target-day boundaries; no selection by final test; this archive has already been inspected, so exploratory not new untouched evidence',ema:'SMA seeds for EMA12/26; EMA9 of MACD; histogram=MACD-signal. Never reset at session, advance on observed bars. Same causal 14-TR mean for normalization. Drop first34 warm-up bars and every non-finite 16-bar candidate identically for all variants.',ablation:'Common log price, WLR width/slope/R2; remove all Price×SPY V candle-cluster channels from clean comparisons. PAIR adds tanh(SPY V), tanh(Composite). MACD adds tanh(MACD/ATR), tanh(histogram/ATR). Combined splits same30% indicator budget across4. PRICE control normalizes70% common weights to100%. ORIGINAL unchanged ten-channel STUMPY is a separate reference.',purge:'same NY decision minute; all candidate targets completed before sixteen-bar query start; max20 non-overlap, one/day; identical cases/timestamps for all models',metric:'primary eight-step path MAE% vs clean PAIR of same input length; endpoint MAE%, direction Brier/accuracy secondary. Percent frequencies add one pseudo-count per class; uncalibrated.',multiplicity:'Two predeclared MACD-vs-PAIR primary comparisons (8 and16): 97.5% intervals each, Bonferroni familywise5%. Combined is secondary, unadjusted95%. Intervals use5000 paired five-day block bootstrap draws. No parameter or channel-weight tuning after test.',stumpyVersion:profiles.libraryVersion,chart:'research only; does not replace indicators or AUTO forecast selection',formulaSource:'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd'}});
 console.log(JSON.stringify({macdValidation:validation,macdTest:test,macdComparisons:comparisons,selectedWindows}));
}
