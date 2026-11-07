// Experimental SPY-only execution profile. Never fabricates a full NY day.
const STEP=900000, DAY=86400000;
const ny=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export const dayNY=t=>ny.format(t);
export function percentile95(values){
  if(!values.length)return null;
  const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*.95;
  return a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i%1);
}
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
        const threshold=this.pool.length>=this.minSamples?percentile95(this.pool.map(x=>x[1])):null;
        b={t:start,threshold,baseline:this.pool.length,bins:{},total:0,large:0};this.buckets.push(b);
      }
      b.total++;
      if(b.threshold!==null&&value>=b.threshold){
        const key=String(Math.round(p/.5)),bin=b.bins[key]??={buy:0,sell:0,count:0};
        // m=true: buyer is maker, therefore seller is the taker.
        bin[r.m?'sell':'buy']+=value;bin.count++;b.large++;
      }
      this.pool.push([t,value]);if(this.pool.length>this.baselineLimit)this.pool.splice(0,this.pool.length-this.baselineLimit);
      this.lastId=id;this.lastTime=t;this.firstTime??=t;added++;
      this.buckets=this.buckets.filter(x=>x.t>=start-2*DAY);
    }
    return added;
  }
  profile({now=Date.now(),cutoff=now,center=null,range=12}={}){
    const day=dayNY(now),closed=this.buckets.filter(b=>b.t+STEP<=Math.min(cutoff,now)&&dayNY(b.t)===day),ready=closed.filter(b=>b.threshold!==null),bins=new Map();
    for(const b of ready)for(const [k,v] of Object.entries(b.bins)){let row=bins.get(k);if(!row){row={price:Number(k)*.5,buy:0,sell:0,count:0};bins.set(k,row);}row.buy+=v.buy;row.sell+=v.sell;row.count+=v.count;}
    const rows=[...bins.values()].filter(r=>!Number.isFinite(center)||Math.abs(r.price-center)<=range).sort((a,b)=>a.price-b.price).map(r=>({...r,total:r.buy+r.sell,buyPercent:r.count>=5?100*r.buy/(r.buy+r.sell):null}));
    return {rows,day,maxTotal:Math.max(0,...rows.map(r=>r.total)),ready:ready.length>0,closed:ready.length,large:ready.reduce((s,b)=>s+b.large,0),observed:closed.reduce((s,b)=>s+b.total,0),first:ready[0]?.t??null,last:ready.at(-1)?.t??null,threshold:ready.at(-1)?.threshold??null,baseline:ready.at(-1)?.baseline??this.pool.length,gaps:this.gaps,partial:true};
  }
  save(){return {version:1,pool:this.pool,buckets:this.buckets,lastId:this.lastId,lastTime:this.lastTime,firstTime:this.firstTime,gaps:this.gaps};}
  restore(value,now=Date.now()){
    if(value?.version!==1||!Array.isArray(value.pool)||!Array.isArray(value.buckets)||!Number.isSafeInteger(value.lastId)||!Number.isFinite(value.lastTime)||value.lastTime>now||now-value.lastTime>DAY)return false;
    if(value.pool.length>this.baselineLimit||value.buckets.length>200||value.pool.some(x=>!Array.isArray(x)||!Number.isFinite(x[0])||!(x[1]>0)||!Number.isFinite(x[1])))return false;
    if(value.buckets.some(b=>!Number.isFinite(b.t)||!Number.isFinite(b.total)||!Number.isFinite(b.large)||(b.threshold!==null&&!(Number.isFinite(b.threshold)&&b.threshold>0))||!b.bins||Object.entries(b.bins).some(([k,v])=>!Number.isFinite(Number(k))||!['buy','sell','count'].every(f=>Number.isFinite(v[f])&&v[f]>=0))))return false;
    this.pool=value.pool;this.buckets=value.buckets;this.lastId=value.lastId;this.lastTime=value.lastTime;this.firstTime=value.firstTime;this.gaps=value.gaps??0;return true;
  }
}
export class LargeTakerLoader{
  constructor({get,onData=()=>{},storage=null,now=()=>Date.now()}={}){this.get=get;this.onData=onData;this.storage=storage;this.now=now;this.book=new LargeTakerBook();this.active=false;this.loading=false;this.error=null;this.updatedAt=null;this.timer=null;this.key='dvp:large-taker:SPYUSDT:p95:v1';try{this.book.restore(JSON.parse(storage?.getItem(this.key)??'null'),now());}catch{}}
  start(){if(this.active)return;this.active=true;void this.poll();this.timer=setInterval(()=>{if(typeof document==='undefined'||!document.hidden)void this.poll();},15000);}
  stop(){this.active=false;clearInterval(this.timer);this.timer=null;}
  async poll(){
    if(this.loading||!this.active)return;this.loading=true;
    try{
      // Bounded backfill; remaining pages continue on next poll. Initial view is partial.
      for(let page=0;page<5&&this.active;page++){
        const id=this.book.lastId,url='/fapi/v1/aggTrades?symbol=SPYUSDT&limit=1000'+(id===null?'':'&fromId='+(id+1));
        const data=await this.get(url,AbortSignal.timeout(6000));
        if(!this.active)break;
        if(!Array.isArray(data))throw new Error('Phản hồi aggTrade không hợp lệ');
        const added=this.book.ingest(data,this.now());if(data.length<1000||!added)break;
      }
      if(this.active){this.error=null;this.updatedAt=this.now();try{this.storage?.setItem(this.key,JSON.stringify(this.book.save()));}catch{}}
    }catch(error){this.error=String(error?.message??error);}
    finally{this.loading=false;this.onData();}
  }
  snapshot(options={}){
    const now=this.now(),state=this.book.profile({...options,now});
    const stale=this.error!==null||!Number.isFinite(this.book.lastTime)||now-this.book.lastTime>120000;
    return {...state,stale,error:this.error,status:this.book.lastId===null?(this.error?'LỖI API':'CHỜ DATA'):stale?'TRỄ / THIẾU':state.ready?'MỘT PHẦN NGÀY':'CHỜ NỀN / M15 ĐÓNG'};
  }
}
export function largeTakerDetail(state,level){
  const r=Number.isFinite(level)?state.rows.find(r=>Math.abs(r.price-level)<=.25):null;
  const money=n=>(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+'K';
  const detail=r?`Giá ${r.price} · Buy ${money(r.buy)} / Sell ${money(r.sell)} USDT · ${r.count} giao dịch lớn · Buy ${r.buyPercent===null?'CHƯA ĐỦ MẪU':r.buyPercent.toFixed(1)+'%'}`:`${state.closed} M15 đóng · ${state.large} giao dịch lớn · P95 ${state.threshold===null?'—':money(state.threshold)+' USDT'}`;
  return `Taker lớn SPY · ${state.status} · ${state.day} NY · ${detail}${state.gaps?' · CÓ KHOẢNG TRỐNG':''}. P95 khóa đầu M15, tối đa 5.000 aggTrade trước đó trong 24h; tối thiểu 200 mẫu. Chỉ phần đã thu, không phải trọn ngày. OI khác phạm vi thời gian; không xác định Long/Short.`;
}
