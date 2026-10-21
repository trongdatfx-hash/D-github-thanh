import {directionScore,sideOf} from './wlr-aba-direction.mjs';
import {paired} from './wlr-aba-core.mjs';
export const POLICY_SPEC=Object.freeze({version:2,selectionStart:'2026-06-01',calibrationStart:'2026-07-17',gateStart:'2026-08-07',testStart:'2026-08-21',forwardStart:'2026-10-22',minimumSelectionDays:15,minimumSelectionN:40,minimumCalibrationDays:8,minimumCalibrationN:40,minimumGateDays:5,minimumGateN:20,minimumGateCoverage:.3,ridge:.02,gaps:[0,.05,.10],bands:['any','whole']});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),sigmoid=x=>1/(1+Math.exp(-clamp(x,-30,30))),logit=p=>Math.log(clamp(p,.001,.999)/(1-clamp(p,.001,.999))),mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const inRange=(r,a,b)=>r.day>=a&&r.day<b;
function common(rs){return rs.filter(r=>r.direction?.ready&&r.direction.baseline.ready&&[-1,1].includes(sideOf(r.target,r.direction.anchor)));}
export function fitCalibration(records,field='model'){
 const rs=common(records),counts=new Map();for(const r of rs)counts.set(r.day,(counts.get(r.day)??0)+1);
 const days=counts.size;if(rs.length<POLICY_SPEC.minimumCalibrationN||days<POLICY_SPEC.minimumCalibrationDays)return {status:'WAIT',method:'identity-unfitted',a:1,b:0,n:rs.length,days};
 const samples=rs.map(r=>({x:logit(field==='model'?r.direction.pAbove:r.direction.baseline.pAbove),y:Number(r.target>r.direction.anchor),w:1/(days*counts.get(r.day))}));
 let a=1,b=0;
 for(let step=0;step<60;step++){
  let ga=POLICY_SPEC.ridge*(a-1),gb=POLICY_SPEC.ridge*b,haa=POLICY_SPEC.ridge,hab=0,hbb=POLICY_SPEC.ridge;
  for(const s of samples){const p=sigmoid(a*s.x+b),e=p-s.y,v=p*(1-p);ga+=s.w*e*s.x;gb+=s.w*e;haa+=s.w*v*s.x*s.x;hab+=s.w*v*s.x;hbb+=s.w*v;}
  const det=haa*hbb-hab*hab;if(!(det>1e-12))break;
  const da=(hbb*ga-hab*gb)/det,db=(haa*gb-hab*ga)/det,nextA=clamp(a-.7*da,0,4),nextB=clamp(b-.7*db,-3,3);
  if(Math.abs(nextA-a)+Math.abs(nextB-b)<1e-9){a=nextA;b=nextB;break;}a=nextA;b=nextB;
 }
 return {status:'READY',method:'day-weighted ridge sigmoid',a,b,n:rs.length,days,ridge:POLICY_SPEC.ridge};
}
export function calibratedProbability(p,fit){return Number.isFinite(p)&&fit?.status==='READY'?(fit.a===1&&fit.b===0?p:sigmoid(fit.a*logit(p)+fit.b)):null;}
export function calibrateDirection(direction,calibration){
 if(!direction)return null;
 const p=calibratedProbability(direction.pAbove,calibration.model),base=calibratedProbability(direction.baseline.pAbove,calibration.baseline);
 if(p===null||base===null)return {...direction,ready:false,calibrationReady:false,rawPAbove:direction.pAbove,baseline:{...direction.baseline,ready:false}};
 const side=base>.5?1:base<.5?-1:null;
 return {...direction,pAbove:p,pBelow:1-p,rawPAbove:direction.pAbove,calibrationReady:true,baseline:{...direction.baseline,pAbove:base,pBelow:1-base,side,ready:direction.baseline.ready&&side!==null}};
}
export function gateSignal(record,config){
 const d=record.direction,p=record.prediction??record;
 if(!d?.ready||!d.calibrationReady||!d.baseline.ready)return {emit:false,reason:'WAIT_HISTORY'};
 const side=d.side,confidence=side===1?d.pAbove:1-d.pAbove,base=side===1?d.baseline.pAbove:1-d.baseline.pAbove,edge=confidence-base;
 if(!(confidence>.5))return {emit:false,reason:'CALIBRATION_DISAGREES',confidence,base,edge};
 if(!config)return {emit:false,reason:'WAIT_GATE_VALIDATION',confidence,base,edge};
 if(!(edge>config.gap+1e-12))return {emit:false,reason:'NEAR_BASE',confidence,base,edge};
 const whole=side===1?p.low>d.anchor:p.high<d.anchor;
 if(config.band==='whole'&&!whole)return {emit:false,reason:'BAND_CROSSES_WLR',confidence,base,edge};
 return {emit:true,reason:'READY',confidence,base,edge,wholeBand:whole};
}
export function applyPolicy(record,policy){
 const direction=calibrateDirection(record.direction,policy.calibration),out={...record,direction};
 const signal=record.day<POLICY_SPEC.testStart?{emit:false,reason:'BEFORE_POLICY_WINDOW'}:gateSignal(out,policy.gate);
 return {...out,signal};
}
function chooseCalibration(fit,records,field){
 const identity={status:'READY',method:'identity selected on later validation',a:1,b:0,n:fit.n,days:fit.days},rs=common(records),days=[...new Set(rs.map(r=>r.day))];
 const loss=c=>mean(days.map(day=>mean(rs.filter(r=>r.day===day).map(r=>{const raw=field==='model'?r.direction.pAbove:r.direction.baseline.pAbove,p=calibratedProbability(raw,c);return (p-Number(r.target>r.direction.anchor))**2;}))));
 const identityLoss=loss(identity),candidateLoss=fit.status==='READY'?loss(fit):null,chosen=Number.isFinite(candidateLoss)&&candidateLoss<identityLoss?fit:identity;
 return {...chosen,validation:{n:rs.length,days:days.length,identityBrier:identityLoss,candidateBrier:candidateLoss,usedFit:chosen===fit},fittedCandidate:fit};
}
function reliability(rs,key){
 const scored=common(rs);return Array.from({length:5},(_,i)=>{
  const group=scored.filter(r=>{const p=key==='model'?r.direction.pAbove:r.direction.baseline.pAbove;return p>=i/5&&(i===4?p<=1:p<(i+1)/5);});
  return {from:i/5,to:(i+1)/5,n:group.length,days:new Set(group.map(r=>r.day)).size,forecast:mean(group.map(r=>key==='model'?r.direction.pAbove:r.direction.baseline.pAbove)),actual:mean(group.map(r=>Number(r.target>r.direction.anchor)))};
 });
}
function intervals(rs){
 const eligible=rs.filter(r=>{const p=r.prediction??r;return p.ready&&[r.target,p.low,p.high].every(Number.isFinite);}),pairs=eligible.map(r=>{const p=r.prediction??r;return {day:r.day,issuedAt:r.issuedAt,loss:-(r.target>=p.low&&r.target<=p.high?1:0)};}),zero=pairs.map(r=>({...r,loss:0})),ci=paired(zero,pairs);
 return {n:eligible.length,days:ci.days,nominal:.8,coverage:ci.gain??null,hits:eligible.filter(r=>{const p=r.prediction??r;return r.target>=p.low&&r.target<=p.high;}).length,queryCoverage:eligible.length?eligible.filter(r=>{const p=r.prediction??r;return r.target>=p.low&&r.target<=p.high;}).length/eligible.length:null,low:ci.low??null,high:ci.high??null,confidence:.975,status:eligible.length?'MEASURED_NOT_CALIBRATED':'WAIT'};
}
export function policyScore(records,policy){
 const applied=records.map(r=>applyPolicy(r,policy)),signals=applied.filter(r=>r.signal.emit),raw=directionScore(records),calibrated=directionScore(applied),filtered=directionScore(signals),ids=new Set(signals.map(r=>r.issuedAt)),matchedRaw=directionScore(records.filter(r=>ids.has(r.issuedAt)));
 const commonRaw=common(records).filter(r=>ids.has(r.issuedAt)),byIssue=new Map(commonRaw.map(r=>[r.issuedAt,r])),filteredCommon=common(signals).filter(r=>byIssue.has(r.issuedAt));
 const trial=filteredCommon.map(r=>({day:r.day,issuedAt:r.issuedAt,loss:1-Number(r.direction.side===sideOf(r.target,r.direction.anchor)),brier:(r.direction.pAbove-Number(r.target>r.direction.anchor))**2})),old=filteredCommon.map(r=>{const raw=byIssue.get(r.issuedAt);return {day:r.day,issuedAt:r.issuedAt,loss:1-Number(raw.direction.side===sideOf(raw.target,raw.direction.anchor)),brier:(raw.direction.pAbove-Number(raw.target>raw.direction.anchor))**2};});
 const reasons={};for(const r of applied)if(!r.signal.emit)reasons[r.signal.reason]=(reasons[r.signal.reason]??0)+1;
 return {queries:records.length,emitted:signals.length,signalCoverage:records.length?signals.length/records.length:0,raw,calibrated,filtered,matchedRaw,calibrationVsRaw:paired(old,trial,'brier'),waiting:reasons,reliability:{model:reliability(applied,'model'),baseline:reliability(applied,'baseline')},intervals:intervals(records)};
}
export function buildPolicy(recordsByModel){
 const selection=Object.fromEntries(['CYCLE8','CYCLE16'].map(m=>[m,directionScore(recordsByModel[m].filter(r=>inRange(r,POLICY_SPEC.selectionStart,POLICY_SPEC.calibrationStart)))]));
 const candidates=['CYCLE8','CYCLE16'].filter(m=>selection[m].days>=POLICY_SPEC.minimumSelectionDays&&selection[m].n>=POLICY_SPEC.minimumSelectionN).sort((a,b)=>selection[b].dayAccuracy-selection[a].dayAccuracy||selection[a].brier-selection[b].brier||a.localeCompare(b));
 const selectedModel=candidates[0]??null;
 if(!selectedModel)return {version:2,spec:POLICY_SPEC,selectedModel:null,status:'WAIT_SELECTION',selection};
 const rs=recordsByModel[selectedModel],calibrationRows=rs.filter(r=>inRange(r,POLICY_SPEC.calibrationStart,POLICY_SPEC.gateStart)),gateRaw=rs.filter(r=>inRange(r,POLICY_SPEC.gateStart,POLICY_SPEC.testStart)),calibration={model:chooseCalibration(fitCalibration(calibrationRows),gateRaw,'model'),baseline:chooseCalibration(fitCalibration(calibrationRows,'baseline'),gateRaw,'baseline')},gateRows=gateRaw.map(r=>({...r,direction:calibrateDirection(r.direction,calibration)})),eligible=common(gateRows),trials=[];
 for(const band of POLICY_SPEC.bands)for(const gap of POLICY_SPEC.gaps){
  const config={band,gap},kept=gateRows.filter(r=>gateSignal(r,config).emit),score=directionScore(kept),coverage=eligible.length?score.n/eligible.length:0,valid=score.n>=POLICY_SPEC.minimumGateN&&score.days>=POLICY_SPEC.minimumGateDays&&coverage>=POLICY_SPEC.minimumGateCoverage;
  trials.push({config,score,coverage,valid});
 }
 const gates=trials.filter(t=>t.valid&&t.score.comparison.gain>0).sort((a,b)=>b.score.dayAccuracy-a.score.dayAccuracy||b.coverage-a.coverage||a.config.gap-b.config.gap),gate=gates[0]?.config??null;
 const policy={version:2,spec:POLICY_SPEC,selectedModel,status:calibration.model.status!=='READY'||calibration.baseline.status!=='READY'?'WAIT_CALIBRATION':gate?'READY':'WAIT_GATE_VALIDATION',selection,calibration,gate,gateValidation:{eligible:eligible.length,days:new Set(eligible.map(r=>r.day)).size,trials},sourceLimit:'All historical windows were previously inspected. Exploratory retrospective comparison; forward evaluation begins 2026-10-22. Do not tune from test or forward outcomes.'};
 return {...policy,test:policyScore(rs.filter(r=>inRange(r,POLICY_SPEC.testStart,POLICY_SPEC.forwardStart)),policy),forward:policyScore(rs.filter(r=>r.day>=POLICY_SPEC.forwardStart),policy)};
}
