// Current OI stays separate from closed-bar history and price-bin estimates.
export class CurrentOiLoader {
  constructor({get,onData=()=>{},now=Date.now}){Object.assign(this,{get,onData,now});this.sample=null;this.pending=null;this.next=0;this.failures=0;this.error=null;}
  start(){
    if(this.pending)return this.pending;
    if(this.now()<this.next)return Promise.resolve();
    this.pending=(async()=>{
      try{
        const row=await this.get('/fapi/v1/openInterest?symbol=SPYUSDT',AbortSignal.timeout(4000));
        const oi=Number(row?.openInterest),time=Number(row?.time),now=this.now();
        if(row?.symbol!=='SPYUSDT'||!Number.isFinite(oi)||oi<=0||!Number.isSafeInteger(time)||time<=0||time>now+5000||now-time>15000)throw Error('Current OI invalid or stale');
        if(this.sample&&time<this.sample.time)throw Error('Current OI out of order');
        this.sample={oi,time};this.error=null;this.failures=0;this.next=now+3000;
      }catch(error){this.error=error;this.failures++;this.next=this.now()+Math.min(60000,3000*2**this.failures);}
      this.onData(this.sample,this.error);
    })().finally(()=>{this.pending=null;});
    return this.pending;
  }
}
export class RunningOiState {
  constructor(){this.baseline=null;}
  read(sample,history,row,flow,now,{chartFresh=false}={}){
    if(!row||!(row.t<=now&&row.end>=now))return {ready:false,reason:'CHỜ NẾN HIỆN TẠI'};
    const age=sample?Math.max(0,now-sample.time):Infinity;
    if(!sample||sample.time<row.t)return {ready:false,reason:'CHỜ OI HIỆN TẠI',age};
    const boundary=history.find(x=>Number(x.timestamp)===row.t);
    if(boundary&&Number(boundary.sumOpenInterest)>0)this.baseline={t:row.t,oi:Number(boundary.sumOpenInterest),time:row.t,partial:false};
    else if(this.baseline?.t!==row.t)this.baseline={t:row.t,oi:sample.oi,time:sample.time,partial:true};
    const base=this.baseline,delta=sample.oi-base.oi,pct=100*delta/base.oi;
    const matchedFlow=flow?.t===row.t&&Number.isFinite(flow.net);
    return {ready:true,delta,pct,age,stale:age>15000,partial:base.partial,baseTime:base.time,cvd:matchedFlow?flow.net:null,flowFresh:matchedFlow&&chartFresh,t:row.t};
  }
}
