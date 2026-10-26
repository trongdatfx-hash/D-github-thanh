import {segmentWlr} from './wlr-aba-core.mjs?v=20261025-dcommon-all1';
export const ABA_BAND_COLORS={neutral:'rgba(145,165,189,.35)'};
// Phase identity is text only; qualified rails inherit the displayed WLR color.
const STEP=900000;
function paintRange(phases,times,start,end,phase){for(let t=start;t<end;t+=STEP)if(times.has(t))phases.set(t,phase);}
// Completed historical patterns are retrospective research. The live track is
// still painted only while the current V3 preview and membership gates pass.
export function abaBandPhases(features=[],state={},displayRows=features){
 // History follows chart timestamps, independently of live feature synchronization.
 const times=new Set(displayRows.map(row=>row.t)),phases=new Map();
 for(const range of state.historyBands??[]){
  if(![range.aStart,range.bStart,range.nextStart,range.end].every(Number.isFinite)||!(range.aStart<range.bStart&&range.bStart<range.nextStart&&range.nextStart<range.end))continue;
  paintRange(phases,times,range.aStart,range.bStart,'A1');paintRange(phases,times,range.bStart,range.nextStart,'B');paintRange(phases,times,range.nextStart,range.end,'A2');
 }
 const historical=phases.size,p=state.track?.prediction,finish=status=>({phases,status,historical});
 if(!state.enabled||!state.live||!state.verified||!state.synced||state.version!==3||state.preview?.emit!==true)return finish(historical?'QUALIFIED_HISTORY':'WAIT_QUALITY');
 if(!p?.ready||!p.memberReady||!Number.isFinite(p.pMembership)||p.pMembership<.5)return finish(historical?'QUALIFIED_HISTORY':'WAIT_MEMBERSHIP');
 const frame=segmentWlr(features);
 const track=state.track,a=frame.segments.find(s=>s.day===track.day&&s.startTime===track.originStart);
 if(!a)return finish(historical?'QUALIFIED_HISTORY':'WAIT_CONTEXT');
 const b=frame.segments[a.id+1],next=frame.segments[a.id+2];
 if((b&&b.frame!==a.frame)||(next&&(next.frame!==a.frame||next.color!==a.color)))return finish(historical?'QUALIFIED_HISTORY':'PATTERN_BROKEN');
 for(const [segment,phase] of [[a,'A1'],[b,'B'],[next,'A2']]){
  if(!segment)continue;
  for(let i=segment.start;i<=segment.end;i++){
   const row=frame.rows[i];if(row.t<=state.lastTime)phases.set(row.t,phase);
  }
 }
 return finish('QUALIFIED_RESEARCH');
}
export function abaBandLineData(bands,field,phases,wlrColors=new Map()){
 return bands.map(row=>Number.isFinite(row[field])?{time:row.t/1000,value:row[field],color:phases.has(row.t)?wlrColors.get(row.t)?.color??ABA_BAND_COLORS.neutral:ABA_BAND_COLORS.neutral}:{time:row.t/1000});
}
export function abaBandMarkers(bands,phases,wlrColors=new Map()){
 const markers=[];let previous=null,lastTime=null;
 for(const row of bands){
  const phase=phases.get(row.t);
  if(!phase||!Number.isFinite(row.upper)){previous=null;lastTime=row.t;continue;}
  if(phase!==previous||row.t-lastTime!==STEP)markers.push({time:row.t/1000,position:'aboveBar',shape:'circle',size:0,color:wlrColors.get(row.t)?.color??'#91a5bd',text:({A1:'A₁',B:'B',A2:'A₂'})[phase]??phase});
  previous=phase;lastTime=row.t;
 }
 return markers;
}
