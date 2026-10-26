// Geometric channel annotations, not forecasts or V3 probabilities.
// startTime is the retrospective drawn origin; confirmationTime is when the
// causal channel became known. Final channel display filters remain upstream.
export function causalChannelAba({channels=[],bands=[],now=Date.now()}={}){
 const times=new Set(bands.filter(x=>Number.isFinite(x.t)&&x.t+899999<now).map(x=>x.t)),phases=new Map(),events=[],assignments=[];
 const day=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
 const ordered=[...channels].filter(c=>c.confirmed===true&&c.volumeQualified!==false&&c.displayQualified!==false&&[-1,1].includes(c.direction)&&[c.startTime,c.confirmationTime,c.insideEndTime].every(Number.isFinite)&&c.startTime<=c.confirmationTime&&c.confirmationTime<=c.insideEndTime&&c.confirmationTime+899999<now).sort((a,b)=>a.confirmationTime-b.confirmationTime||a.startTime-b.startTime);
 let origin=null,stage=null,previousDay=null;
 for(const channel of ordered){
  const d=day(channel.startTime);let phase;
  if(d!==previousDay||!origin||stage==='A2'){origin=channel.direction;phase='A1';}
  else if(stage==='A1'&&channel.direction!==origin)phase='B';
  else if(stage==='B'&&channel.direction===origin)phase='A2';
  else if(stage==='B')phase='B';
  else{origin=channel.direction;phase='A1';}
  previousDay=d;stage=phase;
  const assignment={phase,direction:channel.direction,start:channel.startTime,end:channel.insideEndTime,confirmationTime:channel.confirmationTime,issuedAt:channel.confirmationTime+900000,provisional:channel.provisional===true};assignments.push(assignment);
  for(const t of times)if(t>=assignment.start&&t<=assignment.end)phases.set(t,phase);
  if(times.has(assignment.start))events.push({t:assignment.start,phase,kind:'origin',issuedAt:assignment.issuedAt});
  if(assignment.confirmationTime!==assignment.start&&times.has(assignment.confirmationTime))events.push({t:assignment.confirmationTime,phase,kind:'confirmed',issuedAt:assignment.issuedAt});
 }
 return {phases,events:events.sort((a,b)=>a.t-b.t),assignments,channelCount:assignments.length,status:'CAUSAL_CHANNEL_GEOMETRY'};
}
