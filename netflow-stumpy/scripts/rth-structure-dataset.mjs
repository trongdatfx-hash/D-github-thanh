import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {caseAt,candidatesFor,selectCases,probabilities,summarizeCases,scoreForecasts,SHAPES,STEP,ny} from '../rth-structure.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),get=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const payloadFile=get('--input',path.join(root,'data/rth-structure/tasks.json')),output=get('--output',path.join(root,'data/rth-structure/report.json'));
const save=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data));};
if(args.includes('--finalize')){
 const data=JSON.parse(fs.readFileSync(payloadFile)),profiles=JSON.parse(fs.readFileSync(get('--profiles',path.join(root,'data/rth-structure/profiles.json')))),results={};
 for(const [key,config]of Object.entries(data.configs)){
  if(!config.query){results[key]={status:'WAIT',reason:'Không có cửa sổ PRE→POST hợp lệ'};continue;}
  const picked=selectCases(profiles.ranked[config.snapshotKey]??[],config.candidates),summary=summarizeCases(config.query,picked,config.candidates),records=[];
  for(const evaluation of config.evaluations){
   const candidates=evaluation.candidateStarts.map(start=>config.history.find(c=>c.startIndex===start)).filter(Boolean),matches=selectCases(profiles.ranked[evaluation.key]??[],candidates);
   if(matches.length<12||candidates.length<20)continue;
   records.push({day:evaluation.query.targetDay,issuedAt:evaluation.query.inputEnd,targetStart:evaluation.query.targetStart,targetEnd:evaluation.query.targetEnd,y:SHAPES.indexOf(evaluation.query.outcome.label),pred:probabilities(matches),base:probabilities(candidates),n:matches.length});
  }
  results[key]={...summary,outOfSample:scoreForecasts(records),engine:'STUMPY MASS · z-price + 9 raw state/Strength channels',libraryVersion:profiles.libraryVersion};
 }
 save(output,{version:2,generatedAt:Date.now(),sourceAsOf:data.asOf,sourceRange:data.sourceRange,sourceContract:{price:'SPYUSDT',strengths:['SPY V from original SPY volume','Composite Strength from SPY+QQQ taker NetFlow']},protocol:{inputScope:'contiguous M15 windows within NY PRE 04:00 through POST 20:00; early close days end POST 17:00',target:'RTH geometry only; PRE=current RTH opening, RTH=unobserved remaining bars, POST=next trading-day RTH opening',clockMatch:'same New York minute, phase and effective target length',labels:SHAPES,pseudoCount:1,minimumMatches:12,outOfSample:'last 40% of target days, one forecast per RTH day; candidates fully complete before input start',featureHistory:'Strength and WLR retain original causal chart warm-up, which may include NIGHT bars; sample windows exclude NIGHT',limitations:'Rule-defined geometry families and conditional analog frequencies are exploratory; not calibrated trading win probabilities. V1 aeon/ensemble has a different 3-bar target and is not combined with these six RTH labels.',calendarSource:'https://www.nyse.com/trade/hours-calendars'},results});
 console.log(JSON.stringify({rthResults:Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{status:r.status,n:r.n,testN:r.outOfSample?.n,testDays:r.outOfSample?.days}]))}));
}else{
 const input=JSON.parse(fs.readFileSync(get('--features',path.join(root,'data/analogs/features.json')))),manifest=JSON.parse(fs.readFileSync(path.join(root,'data/binance/m15/manifest.json'))),opens=new Map();
 for(const month of manifest.months){const doc=JSON.parse(fs.readFileSync(path.join(root,'data/binance/m15',month+'.json')));for(const r of doc.SPYUSDT??[])opens.set(r[0],r[1]);}
 const rows=input.rows.SPYUSDT.map(r=>({...r,open:opens.get(r.t)}));if(rows.some(r=>!Number.isFinite(r.open)))throw Error('Missing raw SPY open: do not substitute QQQ/composite prices');
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
