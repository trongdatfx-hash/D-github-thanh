export class OiFastLoader {
  constructor({history,get,onData=()=>{},onState=()=>{},now=Date.now}){
    Object.assign(this,{history,get,onData,onState,now});this.active=null;this.generation=0;this.pending=null;this.controller=null;this.schedule=new Map();
  }
  start(interval){
    const changed=this.active!==interval;
    if(changed){this.controller?.abort();this.active=interval;this.generation++;this.pending=null;this.onData({interval,...this.history.peek(interval,this.now()),source:'memory'});}
    if(this.pending)return this.pending;
    const plan=this.schedule.get(interval)??{next:0,failures:0};
    if(this.now()<plan.next)return Promise.resolve();
    const token=++this.generation,controller=new AbortController();this.controller=controller;
    const current=()=>this.generation===token&&this.active===interval;
    const publish=(data,source,received=null)=>{if(current())this.onData({interval,...data,source,received});};
    const persist=samples=>{void this.history.append(interval,samples,this.now()).then(data=>publish(data,'saved')).catch(()=>{});};
    const fetchOi=async(limit,timeout)=>{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(timeout)]);
      const samples=await this.get(`/futures/data/openInterestHist?symbol=SPYUSDT&period=${interval}&limit=${limit}`,signal);
      if(!Array.isArray(samples)||!samples.length||samples.some(row=>row.symbol!=='SPYUSDT'))throw Error('OI response invalid');
      return samples;
    };
    // Disk restoration and network start together. Neither storage nor price
    // history can hold up the first usable OI response.
    let receivedTail=false,tailError=null;
    void this.history.load(interval,this.now()).then(data=>{publish(data,receivedTail?'cache-merged':'cache');if(tailError&&current())this.onState({interval,phase:'error',error:tailError});}).catch(()=>{});
    this.onState({interval,phase:'loading'});
    const run=async()=>{
      try{
        const warm=this.history.peek(interval,this.now()).samples.length>0;
        const tail=await fetchOi(warm?32:128,5000);if(!current())return;receivedTail=true;
        const before=this.history.peek(interval,this.now()).samples;
        publish(this.history.stage(interval,tail,this.now()),'tail',tail);persist(tail);
        plan.failures=0;plan.next=this.now()+15000;this.schedule.set(interval,plan);
        const first=Math.min(...tail.map(r=>Number(r.timestamp))),last=before.at(-1)?.timestamp??0;
        if(before.length<=128||last<first-({ '5m':300000,'15m':900000,'30m':1800000,'1h':3600000 }[interval]??0)){
          try{
            const full=await fetchOi(500,8000);if(!current())return;
            publish(this.history.stage(interval,full,this.now()),'history',full);persist(full);
          }catch(error){if(current())this.onState({interval,phase:'history-error',error});}
        }
      }catch(error){
        if(!current())return;
        tailError=error;plan.failures++;plan.next=this.now()+Math.min(120000,15000*2**plan.failures);this.schedule.set(interval,plan);
        this.onState({interval,phase:'error',error});
      }
    };
    this.pending=run().finally(()=>{if(current())this.pending=null;});return this.pending;
  }
}
