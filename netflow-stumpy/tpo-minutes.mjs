import {parseTpoMinutes} from './tpo-profile.mjs?v=20261123-tpo-trades1';
// At most three session-sized requests; separate cache from indicator history.
export class TpoMinuteLoader{
  constructor(get){this.get=get;this.entries=new Map();this.pending=null;this.controller=null;this.generation=0;}
  cancel(){this.generation++;this.controller?.abort();this.controller=null;this.pending=null;}
  read(symbol,windows){return windows.flatMap(w=>this.entries.get(symbol+':'+w.start)?.bars??[]);}
  async refresh(symbol,windows,now){
    if(this.pending)return this.pending;
    if(!['SPYUSDT','QQQUSDT'].includes(symbol))return false;
    const token=this.generation,controller=new AbortController();this.controller=controller;
    const due=windows.filter(w=>{const e=this.entries.get(symbol+':'+w.start);return !e||(!e.complete&&now-e.at>=60000);});
    if(!due.length)return false;
    const task=(async()=>{
      let changed=false;
      for(const w of due){
        if(controller.signal.aborted)break;
        const key=symbol+':'+w.start,old=this.entries.get(key);
        const from=old?.bars.length?Math.max(w.start,old.bars.at(-1).t-60000):w.start;
        const end=Math.min(now-1,w.end-1);if(end<from)continue;
        try{
          const fresh=[];let cursor=from;
          // Daily profiles can span 1,500 minutes on the autumn DST change.
          for(let page=0;cursor<=end&&page<3;page++){
            const raw=await this.get(`/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=1000&startTime=${cursor}&endTime=${end}`,controller.signal);
            const parsed=parseTpoMinutes(raw,now);fresh.push(...parsed);
            if(raw.length<1000||!parsed.length)break;
            const next=parsed.at(-1).t+60000;if(next<=cursor)break;cursor=next;
          }
          if(token!==this.generation||controller.signal.aborted)break;
          const merged=new Map((old?.bars??[]).map(b=>[b.t,b]));for(const b of fresh)if(b.t>=w.start&&b.t<w.end)merged.set(b.t,b);
          const bars=[...merged.values()].sort((a,b)=>a.t-b.t);
          // Missing ranges must be retried in full, rather than frozen forever.
          const expected=Math.ceil((Math.min(now,w.end)-w.start)/60000);
          const contiguous=bars.length===expected&&bars.every((b,i)=>b.t===w.start+i*60000);
          this.entries.set(key,{bars,at:now,complete:now>=w.end&&contiguous,error:false});changed=true;
          if(!contiguous)this.entries.set(key,{bars:[],at:now,complete:false,error:true});
        }catch(error){
          if(token!==this.generation||controller.signal.aborted)break;
          this.entries.set(key,{bars:old?.bars??[],at:now,complete:false,error:true});
        }
      }
      // Keep a bounded cache across symbol switches and trading days.
      while(this.entries.size>18)this.entries.delete(this.entries.keys().next().value);
      return changed;
    })();
    this.pending=task;
    try{return await task;}finally{if(this.pending===task){this.pending=null;this.controller=null;}}
  }
}

