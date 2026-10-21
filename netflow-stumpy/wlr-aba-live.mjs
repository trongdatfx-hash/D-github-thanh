import {segmentWlr,knownQuery,candidatePool,predict,cycleDistance,median} from './wlr-aba-core.mjs';
import {shapeDistance} from './analogs-core.mjs';
import {ny,tradingDay,postEnd,STEP} from './rth-structure.mjs';
export const COLOR_NAMES={'1':'Xanh','-1':'Đỏ','0':'Vàng'};
export function liveGate(rows,now){
 const p=ny(now),last=rows.at(-1);
 if(!tradingDay(p.day)||p.minute<240||p.minute>=postEnd(p.day))return 'Ngoài PRE–POST · mẫu chưa xác nhận được giữ nguyên, không gán sai';
 if(!last||ny(last.t).day!==p.day||now-last.t-STEP<0||now-last.t-STEP>STEP+15000)return 'Chờ dữ liệu M15 đã đóng còn mới';
 return null;
}
export function startTrack(frame,archive,report,now){
 const current=frame.segments[frame.rows.at(-1)?.segment];if(!current)return null;
 const q=knownQuery(frame.rows,frame.segments,current.end);
 if(!q)return null;
 if(q.day<report.spec.testStart)return null;
 const model=report.selectedTrial;if(!['CYCLE8','CYCLE16'].includes(model))return null;
 const m=model.endsWith('16')?16:8,pool=candidatePool(archive.cases,q),query=frame.rows.slice(q.i-m+1,q.i+1),ranked=pool.map(c=>{
  const window=c.window.slice(-m).map(i=>({pv:archive.vectors[i]})),base=shapeDistance(query,window,{technique:'price-volume'});
  return {case:c,distance:cycleDistance(base,q,c)};
 }).sort((a,b)=>a.distance-b.distance||a.case.i-b.case.i),prediction=predict(q,pool,ranked,model);
 return {day:q.day,originStart:current.startTime,q,prediction,model,computedAt:now,sourceAsOf:archive.sourceAsOf};
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
 if(!track)return {status:'WAIT',message:'Cần 16 nến M15 liên tục trong PRE–POST và mô hình đã được chọn bằng validation',state:{track:null,history:history.slice(-8)}};
 let progress=followTrack(frame,track);
 if(['PATTERN_BROKEN','COMPLETE_ABA'].includes(progress.stage)){
  history.push({day:track.day,color:track.q.color,stage:progress.stage,computedAt:track.computedAt,knownAt:progress.knownAt,reference:track.q.currentMedian,value:track.prediction.ready?track.prediction.value:null,actualMedian:progress.actualMedian??null});
  const next=startTrack(frame,archive,report,now);if(next){track=next;progress=followTrack(frame,track);}
 }
 const prediction=track.prediction,changePct=prediction.ready?100*(prediction.value/track.q.currentMedian-1):null;
 return {status:'READY',track,progress,changePct,lastTime:rows.at(-1).t,state:{track,history:history.slice(-8)},report:{sourceAsOf:report.sourceAsOf,selectedTrial:report.selectedTrial,test:report.test[track.model],reference:report.test.CURRENT_MEDIAN,decision:report.decision}};
}
