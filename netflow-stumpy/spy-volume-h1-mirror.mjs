// Display-only mirror of ORIGINAL SPY V. A signed H1 score is confidence weight,
// never a negative averaging weight. Closed H1 scores take effect next hour.
export function h1ScoreMirror(sourceRows,records,{step=900000,now=Date.now(),halfLife=2}={}){
  if(!(step>0)||!(halfLife>0)||!Number.isFinite(now))throw Error('Invalid mirror smoothing settings');
  const scores=records.filter(r=>r?.status==='LOCKED'&&r.closedBars===4&&r.missing?.length===0&&Number.isInteger(r.score)&&Math.abs(r.score)<=5&&Number.isFinite(r.blockStart)&&r.blockEnd===r.blockStart+3600000-1&&r.lockedAt===r.blockEnd+1).sort((a,b)=>a.blockEnd-b.blockEnd);
  const decay=2**(-1/halfLife),rows=[];let cursor=0,last=null,previousTime=null,numerator=0,mass=0;
  for(const row of sourceRows){
    if(!Number.isFinite(row.t)||row.t>now)continue;
    while(cursor<scores.length&&scores[cursor].lockedAt<=row.t)last=scores[cursor++];
    if(previousTime===null||row.t-previousTime!==step){numerator=0;mass=0;}
    previousTime=row.t;
    const valid=last&&row.t-last.lockedAt<3600000,score=valid?last.score:null,weight=1+(score===null?0:Math.abs(score));
    const raw=row.adjusted;
    if(!Number.isFinite(raw)){rows.push({t:row.t,end:row.end,adjusted:null,raw:null,weight,h1Score:score});numerator=0;mass=0;continue;}
    numerator=decay*numerator+weight*raw;mass=decay*mass+weight;
    const smoothed=numerator/mass;
    rows.push({t:row.t,end:row.end,adjusted:smoothed===0?0:-smoothed,smoothed,raw,weight,h1Score:score,scoreKnownAt:valid?last.lockedAt:null,provisional:(row.end??row.t+step-1)>=now});
  }
  return rows;
}
