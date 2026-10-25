import {segmentWlr} from './wlr-aba-core.mjs?v=20261025-dcommon-all1';
export const ABA_BAND_COLORS={A:'#1ae0a3',B:'#ff4d70',neutral:'#4aa3ff'};
// Display phases A/B, independent of their original WLR direction/color.
// Only the currently qualified research track may supply phase colors.
export function abaBandPhases(features=[],state={}){
 const p=state.track?.prediction,neutral=reason=>({phases:new Map(),status:reason});
 if(!state.enabled||!state.live||!state.verified||!state.synced||state.version!==3||state.preview?.emit!==true)return neutral('WAIT_QUALITY');
 if(!p?.ready||!p.memberReady||!Number.isFinite(p.pMembership)||p.pMembership<.5)return neutral('WAIT_MEMBERSHIP');
 const frame=segmentWlr(features),track=state.track,a=frame.segments.find(s=>s.day===track.day&&s.startTime===track.originStart);
 if(!a)return neutral('WAIT_CONTEXT');
 const b=frame.segments[a.id+1],next=frame.segments[a.id+2];
 if((b&&b.frame!==a.frame)||(next&&(next.frame!==a.frame||next.color!==a.color)))return neutral('PATTERN_BROKEN');
 const phases=new Map();
 for(const [segment,phase] of [[a,'A'],[b,'B'],[next,'A']]){
  if(!segment)continue;
  for(let i=segment.start;i<=segment.end;i++){
   const row=frame.rows[i];if(row.t<=state.lastTime)phases.set(row.t,phase);
  }
 }
 return {phases,status:'QUALIFIED_RESEARCH'};
}
export function abaBandLineData(bands,field,phases){
 return bands.map(row=>Number.isFinite(row[field])?{time:row.t/1000,value:row[field],color:ABA_BAND_COLORS[phases.get(row.t)]??ABA_BAND_COLORS.neutral}:{time:row.t/1000});
}
