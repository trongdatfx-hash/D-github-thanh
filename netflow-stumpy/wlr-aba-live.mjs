import {policyKey,activePolicy,YELLOW_PREVIEW_MIN_N,YELLOW_PREVIEW_MIN_CONFIDENCE} from './wlr-aba-status.mjs?v=20261025-dcommon-all1';
import {segmentWlr,knownQuery,abaStartMinute,candidatePool,predict,cycleDistance,median} from './wlr-aba-core.mjs?v=20261025-dcommon-all1';
import {shapeDistance} from './analogs-core.mjs?v=20261025-dcommon-all1';
import {ny,tradingDay,postEnd,STEP} from './rth-structure.mjs?v=20261025-dcommon-all1';
import {forecastFromWlr} from './wlr-aba-direction.mjs?v=20261025-dcommon-all1';
import {applyPolicy} from './wlr-aba-policy.mjs?v=20261025-dcommon-all1';
function withPolicy(track,policy){
 if(!policy)return {...track,signal:{emit:false,reason:'WAIT_POLICY'}};
 if(track.model!==policy.selectedModel)return {...track,signal:{emit:false,reason:'MODEL_CHANGED'},policyVersion:policy.version??2};
 if(track.policyKey&&track.policyKey!==policyKey(policy))return {...track,signal:{emit:false,reason:policy.status!=='READY'?(policy.status??'WAIT_POLICY'):'POLICY_CHANGED'},policyVersion:policy.version??2};
 if(!policy.calibration?.model||!policy.calibration?.baseline)return {...track,signal:{emit:false,reason:'WAIT_CALIBRATION'},policyVersion:policy.version??2};
 const rawDirection=track.rawDirection??track.direction,applied=applyPolicy({day:track.day,issuedAt:track.q.issuedAt,direction:rawDirection,prediction:track.prediction},policy);
 const signal=policy.status==='READY'?applied.signal:{emit:false,reason:policy.status??'WAIT_POLICY'};
 return {...track,rawDirection,direction:applied.direction,signal,policyVersion:policy.version??2,policyKey:policyKey(policy),policyCalibration:policy.calibration};
}
export const COLOR_NAMES={'1':'Xanh','-1':'Đỏ','0':'Vàng'};
export function liveGate(rows,now){
 const p=ny(now),last=rows.at(-1);
 if(!tradingDay(p.day)||p.minute<abaStartMinute(p.day)||p.minute>=postEnd(p.day))return 'Ngoài Âu–POST · mẫu chưa xác nhận được giữ nguyên, không gán sai';
 if(!last||ny(last.t).day!==p.day||now-last.t-STEP<0||now-last.t-STEP>STEP+15000)return 'Chờ dữ liệu M15 đã đóng còn mới';
 return null;
}
export function startTrack(frame,archive,report,now){
 const current=frame.segments[frame.rows.at(-1)?.segment];if(!current)return null;
 const q=knownQuery(frame.rows,frame.segments,current.end);
 if(!q)return null;
 if(q.day<report.spec.testStart)return null;
 const policy=activePolicy(report),model=policy?policy.selectedModel:report.selectedTrial;if(!['CYCLE8','CYCLE16'].includes(model))return null;
 const m=model.endsWith('16')?16:8,pool=candidatePool(archive.cases,q),query=frame.rows.slice(q.i-m+1,q.i+1),ranked=pool.map(c=>{
  const window=c.window.slice(-m).map(i=>({pv:archive.vectors[i]})),base=shapeDistance(query,window,{technique:'price-volume'});
  return {case:c,distance:cycleDistance(base,q,c)};
 }).sort((a,b)=>a.distance-b.distance||a.case.i-b.case.i),prediction=predict(q,pool,ranked,model),baseline=predict(q,pool,null,'COLOR_PRIOR'),direction=forecastFromWlr(q,prediction,pool,ranked,model);
 return withPolicy({day:q.day,originStart:current.startTime,q,prediction,baseline,direction,model,computedAt:now,sourceAsOf:archive.sourceAsOf},policy);
}
export function historicalAbaBandRanges(archive,report){
 const policy=activePolicy(report),model=policy?.selectedModel;
 if(policy?.version!==3||policy.status!=='READY'||!policy.gate||policy.freeze?.status!=='FROZEN'||policy.freeze.id!==policy.policyId||!['CYCLE8','CYCLE16'].includes(model))return [];
 const m=model.endsWith('16')?16:8,from=policy.spec?.testStart??report.spec?.testStart??'',seen=new Set(),ranges=[];
 for(const q of archive?.cases??[]){
  const target=q.label?.target;if(q.day<from||q.label?.status!=='COMPLETE_ABA'||!target)continue;
  const pool=candidatePool(archive.cases,q),query=q.window.slice(-m).map(i=>({pv:archive.vectors[i]}));
  if(query.length!==m||query.some(row=>row.pv?.length!==10||!row.pv.every(Number.isFinite)))continue;
  const ranked=pool.map(c=>{
   const window=c.window.slice(-m).map(i=>({pv:archive.vectors[i]})),base=shapeDistance(query,window,{technique:'price-volume'});
   return {case:c,distance:cycleDistance(base,q,c)};
  }).sort((a,b)=>a.distance-b.distance||a.case.i-b.case.i),prediction=predict(q,pool,ranked,model),baseline=predict(q,pool,null,'COLOR_PRIOR'),direction=forecastFromWlr(q,prediction,pool,ranked,model),track=withPolicy({day:q.day,originStart:q.issuedAt-q.knownBars*STEP,q,prediction,baseline,direction,model,computedAt:q.issuedAt,sourceAsOf:archive.sourceAsOf},policy),gate=track.signal;
  if(gate?.emit!==true||!prediction.ready||!prediction.memberReady||!Number.isFinite(prediction.pMembership)||prediction.pMembership<.5)continue;
  const sampleN=Number.isFinite(track.direction?.n)?track.direction.n:0,confidence=gate.confidence;
  if(q.color===0&&(sampleN<YELLOW_PREVIEW_MIN_N||!Number.isFinite(confidence)||confidence<YELLOW_PREVIEW_MIN_CONFIDENCE))continue;
  const aStart=q.issuedAt-q.knownBars*STEP,nextStart=target.start,bStart=nextStart-target.betweenBars*STEP,end=target.end,key=[aStart,bStart,nextStart,end].join('|');
  if(![aStart,bStart,nextStart,end].every(Number.isFinite)||!(aStart<bStart&&bStart<nextStart&&nextStart<end)||seen.has(key))continue;
  seen.add(key);ranges.push({day:q.day,issuedAt:q.issuedAt,aStart,bStart,nextStart,end,pMembership:prediction.pMembership,sampleN,confidence});
 }
 return ranges.sort((a,b)=>a.aStart-b.aStart||a.issuedAt-b.issuedAt);
}
export function followTrack(frame,track){
 const a=frame.segments.find(s=>s.day===track.day&&s.startTime===track.originStart);if(!a)return {stage:'LOST_CONTEXT'};
 const b=frame.segments[a.id+1],next=frame.segments[a.id+2];
 if(!b||b.frame!==a.frame)return {stage:'A_FORMING'};
 if(!next||next.frame!==a.frame)return {stage:'B_FORMING',betweenColor:b.color};
 if(next.color!==a.color)return {stage:'PATTERN_BROKEN',betweenColor:b.color,observedColor:next.color,knownAt:next.startTime+STEP};
 const observedMedian=median(frame.rows.slice(next.start,next.end+1).map(r=>r.mid));
 if(!next.complete)return {stage:'NEXT_A_FORMING',betweenColor:b.color,observedMedian,observedBars:next.end-next.start+1};
 return {stage:'COMPLETE_ABA',betweenColor:b.color,actualMedian:next.median,knownAt:next.confirmedAt,observedBars:next.end-next.start+1};
}
export function updateAba({rows,archive,report,now,previous=null,reset=false}){
 const gate=liveGate(rows,now);if(gate)return {status:'WAIT',message:gate,state:previous};
 const frame=segmentWlr(rows),day=ny(now).day,history=[...(previous?.history??[])].slice(-8);let track=reset?null:previous?.track;
 if(track&&(track.day!==day||track.computedAt>now||!frame.segments.some(s=>s.startTime===track.originStart&&s.day===day))){
  history.push({day:track.day,color:track.q.color,stage:'UNCONFIRMED_FRAME',computedAt:track.computedAt,value:track.prediction.ready?track.prediction.value:null});track=null;
 }
 if(!track)track=startTrack(frame,archive,report,now);
 if(!track)return {status:'WAIT',message:'Chờ nến Âu–POST đã đóng, đủ lịch sử M15 liên tục (có thể dùng trước phiên Âu) và mô hình validation sẵn sàng',state:{track:null,history:history.slice(-8)}};
 let progress=followTrack(frame,track);
 if(['PATTERN_BROKEN','COMPLETE_ABA'].includes(progress.stage)){
  history.push({day:track.day,color:track.q.color,stage:progress.stage,computedAt:track.computedAt,knownAt:progress.knownAt,reference:track.q.currentMedian,value:track.prediction.ready?track.prediction.value:null,actualMedian:progress.actualMedian??null});
  const next=startTrack(frame,archive,report,now);if(next){track=next;progress=followTrack(frame,track);}
 }
 // Upgrade an older frozen track only using labels available at its own issue time.
 if((!track.direction||!track.baseline)&&track.sourceAsOf===archive.sourceAsOf){
  const q=track.q,m=track.model.endsWith('16')?16:8,index=frame.rows.findIndex(r=>r.t+STEP===q.issuedAt),pool=candidatePool(archive.cases,q),query=frame.rows.slice(index-m+1,index+1);
  if(index>=m-1){const ranked=pool.map(c=>({case:c,distance:cycleDistance(shapeDistance(query,c.window.slice(-m).map(i=>({pv:archive.vectors[i]})),{technique:'price-volume'}),q,c)})).sort((a,b)=>a.distance-b.distance||a.case.i-b.case.i);track={...track,baseline:predict(q,pool,null,'COLOR_PRIOR'),direction:forecastFromWlr(q,track.prediction,pool,ranked,track.model)};}
 }
 // Recheck locks on every snapshot, including frozen/restored tracks.
 track=withPolicy(track,activePolicy(report));
 const prediction=track.prediction,changePct=prediction.ready?100*(prediction.value/track.q.currentWlr-1):null;
 return {status:'READY',track,progress,changePct,lastTime:rows.at(-1).t,state:{track,history:history.slice(-8)},report:{sourceAsOf:report.sourceAsOf,selectedTrial:activePolicy(report)?.selectedModel??report.selectedTrial,test:report.test[track.model],reference:report.test.CURRENT_MEDIAN,decision:report.decision}};
}

