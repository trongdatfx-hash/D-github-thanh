// SPY-only executed-trade profile. Every tier is recorded from the same feed.
const STEP=900000,DAY=86400000,TIERS=[.61,.85,.90,.95];
const ny=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export const dayNY=t=>ny.format(t);
const tier=p=>TIERS.includes(Number(p))?Number(p):.90;
const tag=p=>'P'+Math.round(p*100);
function quantileSorted(a,p){if(!a.length)return null;const i=(a.length-1)*p;return a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i%1);}
export function percentile95(values){return quantileSorted([...values].sort((a,b)=>a-b),.95);}
export class LargeTakerBook{
  constructor({minSamples=200,baselineLimit=5000}={}){this.minSamples=minSamples;this.baselineLimit=baselineLimit;this.pool=[];this.buckets=[];this.lastId=null;this.lastTime=null;this.firstTime=null;this.gaps=0;}
  ingest(batch,now=Date.now()){
    const list=[...batch].sort((a,b)=>Number(a.a)-Number(b.a));let added=0;
    for(const r of list){
      const id=Number(r.a),t=Number(r.T),p=Number(r.p),q=Number(r.q),value=p*q;
      if(!Number.isSafeInteger(id)||id<0||!Number.isFinite(t)||t<=0||t>now||!(p>0)||!(q>0)||!Number.isFinite(value)||typeof r.m!=='boolean'||(this.lastId!==null&&id<=this.lastId))continue;
      if(this.lastTime!==null&&t<this.lastTime){this.gaps++;continue;}
      if(this.lastId!==null&&id!==this.lastId+1)this.gaps++;
      const start=Math.floor(t/STEP)*STEP;
      if(this.pool[0]?.[0]<t-DAY)this.pool=this.pool.filter(x=>x[0]>=t-DAY);
      let b=this.buckets.at(-1);
      if(!b||b.t!==start){
        const sorted=this.pool.length>=this.minSamples?this.pool.map(x=>x[1]).sort((a,b)=>a-b):[];
        const levels=Object.fromEntries(TIERS.map(p=>[tag(p),{threshold:quantileSorted(sorted,p),bins:{},large:0}]));
        b={t:start,baseline:this.pool.length,total:0,levels,threshold:levels.P90.threshold,bins:levels.P90.bins,large:0};this.buckets.push(b);
      }
      b.total++;
      for(const part of Object.values(b.levels))if(part.threshold!==null&&value>=part.threshold){
        const key=String(Math.round(p/.5)),bin=part.bins[key]??={buy:0,sell:0,count:0};
        bin[r.m?'sell':'buy']+=value;bin.count++;part.large++;
      }
      b.large=b.levels.P90.large;
      this.pool.push([t,value]);if(this.pool.length>this.baselineLimit)this.pool.splice(0,this.pool.length-this.baselineLimit);
      this.lastId=id;this.lastTime=t;this.firstTime??=t;added++;
      this.buckets=this.buckets.filter(x=>x.t>=start-2*DAY);
    }
    return added;
  }
  profile({now=Date.now(),cutoff=now,center=null,range=12,percentile=.90,fallbackToLastDay=false}={}){
    const p=tier(percentile),label=tag(p),all=this.buckets.filter(b=>b.t+STEP<=Math.min(cutoff,now));
    let day=dayNY(now);
    if(fallbackToLastDay&&!all.some(b=>dayNY(b.t)===day)&&all.length)day=dayNY(all.at(-1).t);
    const closed=all.filter(b=>dayNY(b.t)===day),ready=closed.filter(b=>b.levels[label].threshold!==null),bins=new Map();
    for(const b of ready)for(const [k,v] of Object.entries(b.levels[label].bins)){let row=bins.get(k);if(!row){row={price:Number(k)*.5,buy:0,sell:0,count:0};bins.set(k,row);}row.buy+=v.buy;row.sell+=v.sell;row.count+=v.count;}
    const rows=[...bins.values()].filter(r=>!Number.isFinite(center)||Math.abs(r.price-center)<=range).sort((a,b)=>a.price-b.price).map(r=>({...r,total:r.buy+r.sell,buyPercent:r.count>=5?100*r.buy/(r.buy+r.sell):null}));
    return {rows,day,dayOld:day!==dayNY(now),percentile:p,percentileLabel:label,maxTotal:Math.max(0,...rows.map(r=>r.total)),ready:ready.length>0,closed:ready.length,large:ready.reduce((s,b)=>s+b.levels[label].large,0),observed:closed.reduce((s,b)=>s+b.total,0),first:ready[0]?.t??null,last:ready.at(-1)?.t??null,threshold:ready.at(-1)?.levels[label].threshold??null,baseline:ready.at(-1)?.baseline??this.pool.length,gaps:this.gaps,partial:true};
  }
  save(){return {version:2,pool:this.pool,buckets:this.buckets,lastId:this.lastId,lastTime:this.lastTime,firstTime:this.firstTime,gaps:this.gaps};}
  restore(value,now=Date.now()){
    if(value?.version!==2||!Array.isArray(value.pool)||!Array.isArray(value.buckets)||!Number.isSafeInteger(value.lastId)||!Number.isFinite(value.lastTime)||value.lastTime>now||now-value.lastTime>DAY)return false;
    if(value.pool.length>this.baselineLimit||value.buckets.length>200||value.pool.some(x=>!Array.isArray(x)||!Number.isFinite(x[0])||x[0]>now||!(x[1]>0)||!Number.isFinite(x[1])))return false;
    const validPart=p=>p&&(p.threshold===null||Number.isFinite(p.threshold)&&p.threshold>0)&&Number.isFinite(p.large)&&p.large>=0&&p.bins&&Object.entries(p.bins).every(([k,v])=>Number.isFinite(Number(k))&&['buy','sell','count'].every(f=>Number.isFinite(v[f])&&v[f]>=0));
    if(value.buckets.some(b=>!Number.isFinite(b.t)||!Number.isFinite(b.total)||!b.levels||TIERS.some(p=>!validPart(b.levels[tag(p)]))))return false;
    this.pool=value.pool;this.buckets=value.buckets;this.lastId=value.lastId;this.lastTime=value.lastTime;this.firstTime=value.firstTime;this.gaps=value.gaps??0;return true;
  }
}
export class LargeTakerLoader{
  constructor({get,onData=()=>{},storage=null,now=()=>Date.now()}={}){this.get=get;this.onData=onData;this.storage=storage;this.now=now;this.book=new LargeTakerBook();this.percentile=.90;this.active=false;this.loading=false;this.error=null;this.updatedAt=null;this.timer=null;this.key='dvp:large-taker:SPYUSDT:tiers:v2';try{this.book.restore(JSON.parse(storage?.getItem(this.key)??'null'),now());}catch{}}
  setPercentile(value){this.percentile=tier(value);this.onData();}
  start(){if(this.active)return;this.active=true;void this.poll();this.timer=setInterval(()=>{if(typeof document==='undefined'||!document.hidden)void this.poll();},15000);}
  stop(){this.active=false;clearInterval(this.timer);this.timer=null;}
  async poll(){
    if(this.loading||!this.active)return;this.loading=true;
    try{
      for(let page=0;page<5&&this.active;page++){
        const id=this.book.lastId,base='/fapi/v1/aggTrades?symbol=SPYUSDT&limit=1000';
        const url=base+(id===null?'&startTime='+Math.max(0,this.now()-3600000):'&fromId='+(id+1));
        let data=await this.get(url,AbortSignal.timeout(6000));
        if(!this.active)break;
        if(!Array.isArray(data))throw new Error('Phản hồi aggTrade không hợp lệ');
        if(id===null&&!data.length){data=await this.get(base,AbortSignal.timeout(6000));if(!this.active)break;if(!Array.isArray(data))throw new Error('Phản hồi aggTrade không hợp lệ');}
        const added=this.book.ingest(data,this.now());if(data.length<1000||!added)break;
      }
      if(this.active){this.error=null;this.updatedAt=this.now();try{this.storage?.setItem(this.key,JSON.stringify(this.book.save()));}catch{}}
    }catch(error){this.error=String(error?.message??error);}
    finally{this.loading=false;this.onData();}
  }
  snapshot(options={}){
    const now=this.now(),state=this.book.profile({...options,now,percentile:this.percentile,fallbackToLastDay:true});
    const stale=this.error!==null||state.dayOld||!Number.isFinite(this.book.lastTime)||now-this.book.lastTime>120000;
    return {...state,stale,error:this.error,status:this.book.lastId===null?(this.error?'LỖI API':'CHỜ DATA'):stale?'CŨ / THIẾU':state.ready?'MỘT PHẦN NGÀY':'CHỜ NỀN / M15 ĐÓNG'};
  }
}
export function largeTakerDetail(state,level){
  const r=Number.isFinite(level)?state.rows.find(r=>Math.abs(r.price-level)<=.25):null;
  const money=n=>(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+'K',label=state.percentileLabel??'P90';
  const detail=r?`Giá ${r.price} · Buy ${money(r.buy)} / Sell ${money(r.sell)} USDT · ${r.count} giao dịch lớn · Buy ${r.buyPercent===null?'CHƯA ĐỦ MẪU':r.buyPercent.toFixed(1)+'%'}`:`${state.closed} M15 đóng · ${state.large} giao dịch lớn · ${label} ${state.threshold===null?'—':money(state.threshold)+' USDT'}`;
  return `Taker lớn SPY ${label} · ${state.status} · ${state.day} NY · ${detail}${state.gaps?' · CÓ KHOẢNG TRỐNG':''}. ${label} khóa đầu M15 từ tối đa 5.000 aggTrade trước đó trong 24h; tối thiểu 200 mẫu. Mới mở nạp lùi một giờ khi có dữ liệu. Chỉ phần đã thu, không phải trọn ngày. OI khác phạm vi thời gian; không xác định Long/Short.`;
}
