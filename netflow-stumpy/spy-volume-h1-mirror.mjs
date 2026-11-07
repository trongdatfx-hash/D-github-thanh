// Display-only mirror of ORIGINAL SPY V. Closed H1 scores affect smoothing
// speed from the next hour. No retained weight mass after a strong H1 expires.
export function h1ScoreMirror(sourceRows,records,{step=900000,now=Date.now(),halfLife=.65}={}){
  if(!(step>0)||!(halfLife>0)||!Number.isFinite(now))throw Error('Invalid mirror smoothing settings');
  const scores=records.filter(r=>r?.status==='LOCKED'&&r.closedBars===4&&r.missing?.length===0&&Number.isInteger(r.score)&&Math.abs(r.score)<=5&&Number.isFinite(r.blockStart)&&r.blockEnd===r.blockStart+3600000-1&&r.lockedAt===r.blockEnd+1).sort((a,b)=>a.blockEnd-b.blockEnd);
  const decay=2**(-1/halfLife),rows=[];let cursor=0,last=null,previousTime=null,smoothed=null,previousRaw=null;
  for(const row of sourceRows){
    if(!Number.isFinite(row.t)||row.t>now)continue;
    while(cursor<scores.length&&scores[cursor].lockedAt<=row.t)last=scores[cursor++];
    if(previousTime===null||row.t-previousTime!==step){smoothed=null;previousRaw=null;}
    previousTime=row.t;
    const valid=last&&row.t-last.lockedAt<3600000,score=valid?last.score:null,weight=1+(score===null?0:Math.abs(score));
    const raw=row.adjusted;
    if(!Number.isFinite(raw)){rows.push({t:row.t,end:row.end,adjusted:null,raw:null,weight,h1Score:score});smoothed=null;previousRaw=null;continue;}
    let alpha=Math.min(.85,1-decay**Math.sqrt(weight));
    // Quiet variation remains smoothed; a material reversal opens the filter.
    if(previousRaw!==null&&Math.abs(raw-previousRaw)<.035)alpha*=.65;
    const reversing=smoothed!==null&&raw*smoothed<0&&Math.abs(raw)>=.08;
    if(reversing)alpha=Math.min(.98,Math.max(alpha,.90,Math.abs(smoothed)/(Math.abs(smoothed)+Math.abs(raw))+.02));
    if(smoothed===null){smoothed=raw;alpha=1;}else smoothed+=alpha*(raw-smoothed);
    previousRaw=raw;
    rows.push({t:row.t,end:row.end,adjusted:smoothed===0?0:-smoothed,smoothed,raw,weight,alpha,reversing,h1Score:score,scoreKnownAt:valid?last.lockedAt:null,provisional:(row.end??row.t+step-1)>=now});
  }
  return rows;
}
