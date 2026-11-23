const BLOCK=1800000,RETENTION=48*3600000;
export function parseTpoTrades(raw){
  if(!Array.isArray(raw))throw Error('Giao dịch không hợp lệ');
  let previous=null;
  return raw.map(r=>{
    const a=Number(r.a),t=Number(r.T),p=Number(r.p);
    if(!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(t)||!(p>0)||!Number.isFinite(p))throw Error('Giao dịch không hợp lệ');
    if(previous&&(a!==previous.a+1||t<previous.t))throw Error('Thiếu chuỗi giao dịch');
    const trade={a,t,p};previous=trade;return trade;
  });
}
// Store distinct traded prices, not millions of raw trades. Only publish ranges
// whose end was reached. A paginated, failed or cancelled range stays hidden.
export class TpoTradeLoader{
  constructor(get,{budget=8,wallNow=()=>Date.now()}={}){this.get=get;this.budget=budget;this.wallNow=wallNow;this.entries=new Map();this.pending=null;this.generation=0;this.lastRun=-Infinity;this.note='';}
  cancel(){this.generation++;this.controller?.abort();this.pending=null;this.lastRun=-Infinity;}
  read(symbol,window,now){
    const result=[];
    for(let t=window.start;t<Math.min(window.end,now);t+=BLOCK){
      const e=this.entries.get(symbol+':'+t),end=Math.min(t+BLOCK,window.end,now);
      if(e&&((e.until>=Math.min(t+BLOCK,window.end)&&e.until>=end)||(end===now&&e.until>=end-30000&&e.until>t)))
        result.push({start:t,until:e.until,prices:[...e.prices]});
    }return result;
  }
  async refresh(symbol,windows,now){
    if(this.pending)return this.pending;
    if(this.wallNow()-this.lastRun<30000)return false;
    this.lastRun=this.wallNow();
    const token=this.generation,controller=new AbortController();this.controller=controller;
    const task=(async()=>{
      let changed=false,left=this.budget;this.note='';
      const targets=[];
      for(const w of windows)for(let start=w.start;start<Math.min(w.end,now-2000);start+=BLOCK){
        const end=Math.min(start+BLOCK,w.end,now-2000);
        if(start<this.wallNow()-RETENTION+60000){this.note='Ngoài 48h: dùng M1';continue;}
        targets.push({start,end});
      }
      targets.sort((a,b)=>b.start-a.start);
      for(const {start,end} of targets){
        if(!left||controller.signal.aborted)break;
        const key=symbol+':'+start,old=this.entries.get(key);
        if(old?.until>=end)continue;
        let e=old?{...old,prices:new Set(old.prices),work:old.work?{...old.work,prices:new Set(old.work.prices)}:null}:{until:start,prices:new Set(),lastId:null,work:null};
        if(!e.work)e.work={from:e.until,target:end,next:null,lastId:e.lastId,prices:new Set(e.prices)};
        const w=e.work;
        try{
          while(left>0){
            left--;
            const params=w.next===null?`startTime=${w.from}&endTime=${w.target-1}`:`fromId=${w.next}`;
            const raw=await this.get(`/fapi/v1/aggTrades?symbol=${encodeURIComponent(symbol)}&limit=1000&${params}`,controller.signal);
            const trades=parseTpoTrades(raw);
            if(token!==this.generation||controller.signal.aborted)return changed;
            if(trades.length&&w.lastId!==null&&trades[0].a!==w.lastId+1)throw Error('Thiếu chuỗi giao dịch');
            let crossed=false;
            for(const t of trades){
              if(t.t>=w.target){crossed=true;break;}
              if(t.t<w.from)throw Error('Sai khoảng giao dịch');
              w.prices.add(t.p);w.lastId=t.a;
              if(w.prices.size>30000)throw Error('Quá nhiều mức giá');
            }
            if(crossed||raw.length<1000){
              e={until:w.target,prices:w.prices,lastId:w.lastId,work:null};changed=true;break;
            }
            if(!trades.length)throw Error('Không tiến được trang giao dịch');
            w.next=trades.at(-1).a+1;
          }
          this.entries.set(key,e);
        }catch(error){
          if(token!==this.generation||controller.signal.aborted)return changed;
          this.note=error.message+' · dùng M1';
          // Retry from the last published boundary, not from a broken chain.
          if(old)this.entries.set(key,{...old,work:null});else this.entries.delete(key);
          break;
        }
      }
      while(this.entries.size>160)this.entries.delete(this.entries.keys().next().value);
      return changed;
    })();
    this.pending=task;
    try{return await task;}finally{if(this.pending===task){this.pending=null;this.controller=null;}}
  }
}
