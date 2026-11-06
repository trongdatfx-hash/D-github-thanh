// Display-only CVD border filter. OI sign/freshness never drives the border.
export class CvdBadgeBorder {
 constructor({confirmMs=9000,minUpdates=3,minHoldMs=15000,weakHoldMs=20000,staleHoldMs=20000,enter=.05,exit=.02}={}){
  Object.assign(this,{confirmMs,minUpdates,minHoldMs,weakHoldMs,staleHoldMs,enter,exit});this.reset();
 }
 reset(key=null){this.key=key;this.state='neutral';this.changedAt=-Infinity;this.lastTime=null;this.lastValid=null;this.pending=null;this.weakSince=null;}
 update({cvd,quote,time,now,fresh=false,key='SPYUSDT:15m'}={}){
  if(key!==this.key)this.reset(key);
  const valid=fresh&&[cvd,quote,time,now].every(Number.isFinite)&&quote>0&&Math.abs(cvd)<=quote+1e-6&&time<=now+2000&&now-time<=10000;
  if(!valid){
   this.pending=null;
   if(!Number.isFinite(now)||this.lastValid===null||now-this.lastValid>=this.staleHoldMs)this.reset(key);
   return this.state;
  }
  if(this.lastTime!==null&&time<=this.lastTime)return this.state;
  if(this.lastValid!==null&&time-this.lastValid>=this.staleHoldMs)this.reset(key);
  if(this.lastTime!==null&&time-this.lastTime>12000)this.pending=null;
  this.lastTime=time;this.lastValid=time;
  const direction=cvd>0?'buy':cvd<0?'sell':'neutral',ratio=Math.abs(cvd)/quote;
  const candidate=ratio>=(direction===this.state?this.exit:this.enter)?direction:'neutral';
  if(candidate===this.state){this.pending=null;this.weakSince=null;return this.state;}
  if(candidate==='neutral'){
   this.pending=null;this.weakSince??=time;
   if(time-this.weakSince>=this.weakHoldMs&&time-this.changedAt>=this.minHoldMs){this.state='neutral';this.changedAt=time;this.weakSince=null;}
   return this.state;
  }
  this.weakSince=null;
  this.pending=this.pending?.state===candidate?{...this.pending,count:this.pending.count+1}:{state:candidate,since:time,count:1};
  if(this.pending.count>=this.minUpdates&&time-this.pending.since>=this.confirmMs&&time-this.changedAt>=this.minHoldMs){
   this.state=candidate;this.changedAt=time;this.pending=null;
  }
  return this.state;
 }
}
