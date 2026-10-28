import {COMPOSITE_STRENGTH_VERSION,requireCompositeStrengthVersion} from '../engine.mjs?v=20261029-price-delta1';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {caseAt,candidatesFor,selectCases,probabilities,summarizeCases,scoreForecasts,SHAPES,STEP,ny} from '../rth-structure.mjs?v=20261029-price-delta1';
import {attachPivotStates,choosePivotCohort,pivotGroups,PIVOT_PROTOCOL} from '../rth-pivot.mjs?v=20261029-price-delta1';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),get=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const payloadFile=get('--input',path.join(root,'data/rth-structure/tasks.json')),output=get('--output',path.join(root,'data/rth-structure/report.json'));
const save=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({...data,strengthVersion:COMPOSITE_STRENGTH_VERSION}));};
if(args.includes('--finalize')){
 const data=JSON.parse(fs.readFileSync(payloadFile)),profiles=JSON.parse(fs.readFileSync(get('--profiles',path.join(root,'data/rth-structure/profiles.json')))),results={};
 requireCompositeStrengthVersion(data);
 requireCompositeStrengthVersion(profiles);
 for(const [key,config]of Object.entries(data.configs)){
  if(!config.query){results[key]={status:'WAIT',reason:'Không có cửa sổ PRE→POST hợp lệ'};continue;}
  const ranking=profiles.ranked[config.snapshotKey]??[],picked=selectCases(ranking,config.candidates),summary=summarizeCases(config.query,picked,config.candidates),records=[],pivotRecords=[],pairedRecords=[],coverage={EXACT:0,STRUCTURE:0,DIVERGENCE:0,BASE:0};
  const cohort=choosePivotCohort(ranking,config.candidates,config.query),pivotSummary=summarizeCases(config.query,cohort.picked,config.candidates);
  for(const evaluation of config.evaluations){
   const candidates=evaluation.candidateStarts.map(start=>config.history.find(c=>c.startIndex===start)).filter(Boolean),matches=selectCases(profiles.ranked[evaluation.key]??[],candidates);
   if(matches.length<12||candidates.length<20)continue;
   const record={day:evaluation.query.targetDay,issuedAt:evaluation.query.inputEnd,targetStart:evaluation.query.targetStart,targetEnd:evaluation.query.targetEnd,y:SHAPES.indexOf(evaluation.query.outcome.label),pred:probabilities(matches),base:probabilities(candidates),n:matches.length};
   records.push(record);
   const grouped=choosePivotCohort(profiles.ranked[evaluation.key]??[],candidates,evaluation.query),prediction=probabilities(grouped.picked);
   coverage[grouped.level]++;
   pivotRecords.push({...record,pred:prediction,n:grouped.picked.length,cohortLevel:grouped.level,cohortKey:evaluation.query.pivot?.key});
   pairedRecords.push({...record,pred:prediction,base:record.pred,n:grouped.picked.length,cohortLevel:grouped.level});
  }
  results[key]={...summary,outOfSample:scoreForecasts(records),engine:'STUMPY MASS · z-price + 9 raw state/Strength channels',libraryVersion:profiles.libraryVersion,pivot:{...pivotSummary,cohort:{level:cohort.level,poolSizes:cohort.poolSizes},groups:pivotGroups(config.candidates,config.query),outOfSample:scoreForecasts(pivotRecords),pairedVsOriginal:scoreForecasts(pairedRecords),coverage:{...coverage,total:records.length,grouped:coverage.EXACT+coverage.STRUCTURE+coverage.DIVERGENCE},engine:'STUMPY MASS + nhóm Pivot/phân kỳ causal',libraryVersion:profiles.libraryVersion}};
 }
 save(output,{version:3,generatedAt:Date.now(),sourceAsOf:data.asOf,sourceRange:data.sourceRange,sourceContract:{price:'SPYUSDT',strengths:['SPY V from original SPY volume','D common Strength from normalized taker delta: 70% SPY + 30% QQQ']},protocol:{pivot:PIVOT_PROTOCOL,pivotSelection:'Fixed hierarchy: same structure + divergence, same structure, active divergence only, original STUMPY; >=12 selected matches per informative group, max20; unresolved structure skips structural levels; no-signal skips divergence-only level; no test-outcome tuning',pivotEvaluation:'Same timestamps/labels/candidate history as original, keep fallback days; paired 5-day bootstrap, report coverage. Divergence-only fallback added after inspecting sparse PRE coverage in the first pivot trial; not selected by predictive gain. Added after viewing V2 history: exploratory, requires future validation.',pivotSources:'SPY high/low; independent original-volume SPY V and Composite Strength; confirmed at right=2 bar CLOSE; daily PRE-to-POST pivots reset, original causal ATR warm-up retained; divergence expires after 8 closed bars',inputScope:'contiguous M15 windows within NY PRE 04:00 through POST 20:00; early close days end POST 17:00',target:'RTH geometry only; PRE=current RTH opening, RTH=unobserved remaining bars, POST=next trading-day RTH opening',clockMatch:'same New York minute, phase and effective target length',labels:SHAPES,pseudoCount:1,minimumMatches:12,outOfSample:'last 40% of target days, one forecast per RTH day; candidates fully complete before input start',featureHistory:'Strength and WLR retain original causal chart warm-up, which may include NIGHT bars; sample windows exclude NIGHT',limitations:'Rule-defined geometry families and conditional analog frequencies are exploratory; not calibrated trading win probabilities. V1 aeon/ensemble has a different 3-bar target and is not combined with these six RTH labels.',calendarSource:'https://www.nyse.com/trade/hours-calendars'},results});
 console.log(JSON.stringify({rthResults:Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{status:r.status,n:r.n,testN:r.outOfSample?.n,testDays:r.outOfSample?.days}]))}));
}else{
 const input=JSON.parse(fs.readFileSync(get('--features',path.join(root,'data/analogs/features.json')))),manifest=JSON.parse(fs.readFileSync(path.join(root,'data/binance/m15/manifest.json'))),opens=new Map();
 requireCompositeStrengthVersion(input);
 for(const month of manifest.months){const doc=JSON.parse(fs.readFileSync(path.join(root,'data/binance/m15',month+'.json')));for(const r of doc.SPYUSDT??[])opens.set(r[0],r[1]);}
 const rows=attachPivotStates(input.rows.SPYUSDT.map(r=>({...r,open:opens.get(r.t)})));if(rows.some(r=>!Number.isFinite(r.open)))throw Error('Missing raw SPY open: do not substitute QQQ/composite prices');
 const lookup=new Map(rows.map(r=>[r.t,r])),tasks={},queries={},configs={};
 for(const [mode,clock]of [['AUTO',null],['PRE_0900',540],['RTH_1000',600],['RTH_1300',780],['POST_2000',1200]])for(const m of [8,16])for(const h of [4,8,26]){
  let query=null;for(let i=rows.length-1;i>=m-1;i--){if(clock!==null&&ny(rows[i].t).minute+15!==clock)continue;query=caseAt(rows,i,m,h,lookup);if(query&&mode!=='AUTO'&&!mode.startsWith(query.phase))query=null;if(query)break;}
  const key=`SPYUSDT:${m}:${h}:price-volume:rth`,configKey=`${mode}:${m}:${h}`,snapshotKey=key+':at:'+query?.i;
  if(!query){configs[configKey]={query:null};continue;}
  const history=[];
  for(let i=m-1;i<=query.i;i++){
   if(ny(rows[i].t).minute+15!==query.clockMinute)continue;
   const c=caseAt(rows,i,m,h,lookup);if(c&&c.outcome&&c.phase===query.phase&&c.clockMinute===query.clockMinute&&c.h===query.h)history.push(c);
  }
  const candidates=candidatesFor(history,query);tasks[snapshotKey]=candidates.map(c=>c.startIndex);queries[snapshotKey]=query.i;
  const days=[...new Set(history.map(c=>c.targetDay))].sort(),testDays=new Set(days.slice(Math.floor(days.length*.6))),evaluations=[];
  for(const c of history.filter(c=>testDays.has(c.targetDay))){
   const earlier=candidatesFor(history,c);if(earlier.length<20)continue;
   const task=key+':at:'+c.i;tasks[task]=earlier.map(x=>x.startIndex);queries[task]=c.i;evaluations.push({key:task,query:c,candidateStarts:earlier.map(x=>x.startIndex)});
  }
  configs[configKey]={query,candidates,history,evaluations,snapshotKey};
 }
 save(payloadFile,{version:1,asOf:input.asOf,provenance:input.provenance,sourceRange:{first:rows[0]?.t,last:rows.at(-1)?.t,bars:rows.length,tradingDays:new Set(rows.filter(r=>r.eligible).map(r=>r.day)).size},rows:{SPYUSDT:rows},tasks,queries,configs});
 console.log(JSON.stringify({rthTasks:Object.keys(tasks).length,configs:Object.fromEntries(Object.entries(configs).map(([k,c])=>[k,{phase:c.query?.phase,clock:c.query?.clockMinute,n:c.candidates?.length,evaluations:c.evaluations?.length}]))}));
}
