// Read-only USD-M microstructure analytics. Percentages describe flow, not win probability.
export const MOMENTUM_WINDOWS=[5,15,60];
export const MOMENTUM_LABELS={buy:'MUA ĐẨY GIÁ',sell:'BÁN ÉP GIÁ',buyAbsorbed:'MUA BỊ HẤP THỤ',sellAbsorbed:'BÁN BỊ HẤP THỤ',mixed:'CHƯA RÕ',quiet:'CHỜ GIAO DỊCH',warming:'ĐANG TÍCH LŨY',offline:'MẤT KẾT NỐI',snapshot:'CHỈ CÓ LỆNH CHỜ'};
const clamp=(x,lo=-1,hi=1)=>Math.max(lo,Math.min(hi,x));
const sum=values=>values.reduce((a,b)=>a+b,0);
export function bookMetrics(book,levels=20){
  if(!book?.bids?.size||!book?.asks?.size)return null;
  const bids=[...book.bids].filter(([p,q])=>Number.isFinite(p)&&Number.isFinite(q)&&p>0&&q>0).sort((a,b)=>b[0]-a[0]).slice(0,levels);
  const asks=[...book.asks].filter(([p,q])=>Number.isFinite(p)&&Number.isFinite(q)&&p>0&&q>0).sort((a,b)=>a[0]-b[0]).slice(0,levels);
  if(!bids.length||!asks.length||bids[0][0]>=asks[0][0])return null;
  const [bid,bidQty]=bids[0],[ask,askQty]=asks[0],mid=(bid+ask)/2,spread=ask-bid;
  const bidDepth=sum(bids.map(([p,q],i)=>p*q/(i+1))),askDepth=sum(asks.map(([p,q],i)=>p*q/(i+1)));
  const micro=(ask*bidQty+bid*askQty)/(bidQty+askQty);
  return {bids,asks,bid,ask,bidQty,askQty,mid,spread,bidDepth,askDepth,obi:(bidDepth-askDepth)/(bidDepth+askDepth),micro,microBps:(micro-mid)/mid*10000};
}

// Cont-style best-quote OFI: quote moves and changes of the queue at the touch.
export function quoteOfi(previous,next){
  if(!previous||!next)return 0;
  return (next.bid>=previous.bid?next.bidQty:0)-(next.bid<=previous.bid?previous.bidQty:0)
    -(next.ask<=previous.ask?next.askQty:0)+(next.ask>=previous.ask?previous.askQty:0);
}

export function classifyWindow(w){
  if(!w.ready)return 'warming';
  if(w.count<5||w.total<=0)return 'quiet';
  const direction=Math.sign(w.flow),strong=Math.abs(w.flow)>=.25;
  const supports=direction*w.obi>=.08||direction*w.ofi>=.08||direction*w.microBps>0;
  if(strong&&direction*w.moveSpreads>=.5&&supports)return direction>0?'buy':'sell';
  // Absorption is a hypothesis requiring repeated quotes, turnover and replenishment.
  const refill=direction>0?w.askRefill:w.bidRefill,opposing=direction>0?w.askDepth:w.bidDepth;
  if(strong&&w.samples>=5&&Math.abs(w.moveSpreads)<=.25&&w.rangeSpreads<=2
    &&opposing>0&&w.total/opposing>=.15&&refill>=Math.abs(w.delta)*.1){
    return direction>0?'buyAbsorbed':'sellAbsorbed';
  }
  return 'mixed';
}

export class OrderBookMomentum {
  constructor({now=()=>Date.now()}={}){this.now=now;this.reset('');}
  reset(symbol){
    this.symbol=symbol;this.buckets=new Map();this.latest=null;this.previous=null;this.bookSince=null;this.tapeSince=null;
    this.lastBookAt=null;this.lastTradeAt=null;this.lastTradeId=null;this.lastSampleAt=null;this.bookRef=null;this.tapeConnected=false;
    this.transport='';this.stable='mixed';this.candidate=null;this.candidateSince=0;this.lastConfirmAt=null;this.confirmations=0;
  }
  clearWindows(){
    this.buckets.clear();this.previous=null;this.bookSince=null;this.tapeSince=this.tapeConnected?this.now():null;
    this.lastSampleAt=null;this.stable='mixed';this.candidate=null;this.confirmations=0;
  }
  setTapeState(connected){
    if(connected!==this.tapeConnected){this.tapeConnected=connected;this.clearWindows();this.lastTradeAt=null;this.lastTradeId=null;}
  }
  bucket(now){
    const key=Math.floor(now/1000);
    for(const k of this.buckets.keys())if(k<key-61)this.buckets.delete(k);
    if(!this.buckets.has(key))this.buckets.set(key,{time:key*1000,buy:0,sell:0,count:0,samples:0,obi:0,micro:0,ofi:0,ofiScale:0,bidRefill:0,askRefill:0});
    return this.buckets.get(key);
  }
  onBook(book){
    const now=this.now();
    if(!book||book.symbol!==this.symbol||book.transport!=='WS'||!book.bridged){
      if(this.latest||this.bookSince!==null)this.clearWindows();
      this.latest=null;this.lastBookAt=null;this.bookRef=null;this.transport=book?.transport??'';return;
    }
    const next=bookMetrics(book);
    if(!next){this.onBook(null);return;}
    if(this.bookRef!==book){this.clearWindows();this.bookRef=book;}
    if(this.lastBookAt!==null&&now-this.lastBookAt>5000)this.clearWindows();
    this.transport='WS';this.lastBookAt=now;this.latest=next;if(this.bookSince===null)this.bookSince=now;
    const bucket=this.bucket(now),previous=this.previous;
    bucket.ofi+=quoteOfi(previous,next);bucket.ofiScale+=previous?(previous.bidQty+previous.askQty+next.bidQty+next.askQty)/2:0;
    // Compare the same price levels; newly entering levels are not called replenishment.
    if(previous)for(const side of ['bid','ask']){
      const old=new Map(previous[side==='bid'?'bids':'asks']);
      for(const [p,q] of next[side==='bid'?'bids':'asks'])if(old.has(p))bucket[side+'Refill']+=Math.max(0,q-old.get(p))*p;
    }
    this.previous=next;
    if(this.lastSampleAt===null||now-this.lastSampleAt>=200){
      bucket.samples++;bucket.obi+=next.obi;bucket.micro+=next.microBps;
      if(bucket.first===undefined)bucket.first=next.mid;
      bucket.last=next.mid;bucket.high=Math.max(bucket.high??next.mid,next.mid);bucket.low=Math.min(bucket.low??next.mid,next.mid);
      bucket.spread=(bucket.spread??0)+next.spread;bucket.bidDepth=(bucket.bidDepth??0)+next.bidDepth;bucket.askDepth=(bucket.askDepth??0)+next.askDepth;
      this.lastSampleAt=now;
    }
  }
  onTrade(event){
    const now=this.now(),p=Number(event.p),q=Number(event.q);
    if(event.e!=='aggTrade'||event.s!==this.symbol||typeof event.m!=='boolean'||!Number.isSafeInteger(event.a)
      ||!Number.isFinite(event.E)||Math.abs(now-event.E)>5000||!(p>0)||!(q>0)||!Number.isFinite(p*q))return 'invalid';
    if(this.lastTradeId!==null&&event.a<=this.lastTradeId)return 'old';
    const gap=this.lastTradeId!==null&&event.a>this.lastTradeId+1;
    if(gap)this.clearWindows();
    this.lastTradeId=event.a;this.lastTradeAt=now;
    const bucket=this.bucket(now);bucket[event.m?'sell':'buy']+=p*q;bucket.count++;
    return gap?'gap':'applied';
  }
  window(seconds,now){
    // Use complete one-second buckets, never a partially included boundary bucket.
    const end=Math.floor(now/1000)*1000,start=end-seconds*1000;
    const rows=[...this.buckets.values()].filter(b=>b.time>=start&&b.time<end),quoted=rows.filter(b=>b.samples);
    const buy=sum(rows.map(b=>b.buy)),sell=sum(rows.map(b=>b.sell)),total=buy+sell,samples=sum(quoted.map(b=>b.samples));
    const spread=samples?sum(quoted.map(b=>b.spread))/samples:0,first=quoted[0]?.first,last=quoted.at(-1)?.last;
    const w={seconds,ready:this.bookSince!==null&&this.tapeSince!==null&&start>=Math.max(this.bookSince,this.tapeSince)&&quoted.length>=Math.max(3,seconds*.5),
      buy,sell,total,delta:buy-sell,flow:total?(buy-sell)/total:0,count:sum(rows.map(b=>b.count)),samples,
      obi:samples?sum(quoted.map(b=>b.obi))/samples:0,microBps:samples?sum(quoted.map(b=>b.micro))/samples:0,
      ofi:clamp(sum(rows.map(b=>b.ofi))/Math.max(1e-12,sum(rows.map(b=>b.ofiScale)))),
      bidDepth:samples?sum(quoted.map(b=>b.bidDepth))/samples:0,askDepth:samples?sum(quoted.map(b=>b.askDepth))/samples:0,
      bidRefill:sum(rows.map(b=>b.bidRefill)),askRefill:sum(rows.map(b=>b.askRefill)),
      moveSpreads:spread>0?(last-first)/spread:0,rangeSpreads:spread>0?(Math.max(...quoted.map(b=>b.high))-Math.min(...quoted.map(b=>b.low)))/spread:0};
    w.state=classifyWindow(w);return w;
  }
  read(){
    const now=this.now(),windows=MOMENTUM_WINDOWS.map(s=>this.window(s,now));
    let quality='live',reason='';
    if(this.transport==='REST'){quality='snapshot';reason='Snapshot REST không đủ để đọc động lực theo giây.';}
    else if(!this.latest||this.lastBookAt===null||now-this.lastBookAt>5000){quality='offline';reason='Orderbook chưa đồng bộ hoặc đã cũ.';}
    else if(!this.tapeConnected){quality='offline';reason='Luồng giao dịch khớp chưa kết nối.';}
    else if(!windows[0].ready){quality='warming';reason='Chờ ít nhất 5 giây dữ liệu liên tục.';}
    else if(this.lastTradeAt===null||now-this.lastTradeAt>15000){quality='quiet';reason='Chưa có giao dịch khớp mới để kết luận.';}
    if(quality!=='live'){
      this.stable='mixed';this.candidate=null;this.confirmations=0;
      return {quality,state:quality,label:MOMENTUM_LABELS[quality],reason,windows,book:this.latest};
    }
    const primary=windows[1].ready?windows[1]:windows[0];let raw=primary.state;
    const fast=windows[0].state,slow=windows[2];
    // Withhold a directional headline when the fast window or mature 60s window opposes it.
    if((raw==='buy'&&(fast==='sell'||(slow.ready&&slow.state==='sell')))||(raw==='sell'&&(fast==='buy'||(slow.ready&&slow.state==='buy'))))raw='mixed';
    if(this.lastConfirmAt===null||now-this.lastConfirmAt>=500){
      this.lastConfirmAt=now;
      if(raw!==this.candidate){this.candidate=raw;this.candidateSince=now;this.confirmations=1;}
      else this.confirmations++;
      if(now-this.candidateSince>=2500&&this.confirmations>=4)this.stable=raw;
    }
    return {quality,state:this.stable,label:MOMENTUM_LABELS[this.stable],pending:raw!==this.stable,raw,windows,book:this.latest};
  }
}

export class BinanceAggTradeFeed {
  constructor({onTrade=()=>{},onState=()=>{},Socket=globalThis.WebSocket,now=()=>Date.now()}={}){Object.assign(this,{onTrade,onState,Socket,now});this.epoch=0;}
  start(symbol){this.stop();this.enabled=true;this.symbol=symbol;this.retry=1000;this.connect();}
  stop(){this.enabled=false;this.epoch++;clearTimeout(this.reconnect);clearTimeout(this.timeout);const s=this.socket;this.socket=null;if(s){s.onopen=s.onmessage=s.onclose=s.onerror=null;s.close();}this.onState(false);}
  connect(){
    if(!this.enabled)return;
    const epoch=++this.epoch,current=()=>this.enabled&&this.epoch===epoch;
    const fail=()=>{
      if(!current())return;this.epoch++;clearTimeout(this.timeout);const s=this.socket;this.socket=null;
      if(s){s.onopen=s.onmessage=s.onclose=s.onerror=null;s.close();}this.onState(false);
      const delay=this.retry;this.retry=Math.min(30000,this.retry*2);this.reconnect=setTimeout(()=>this.connect(),delay);
    };
    try{
      const s=this.socket=new this.Socket(`wss://fstream.binance.com/market/ws/${this.symbol.toLowerCase()}@aggTrade`);
      this.timeout=setTimeout(fail,15000);
      s.onopen=()=>{if(!current())return;clearTimeout(this.timeout);this.onState(true);};
      s.onmessage=message=>{if(!current())return;try{const e=JSON.parse(message.data);if(e.e!=='aggTrade'||e.s!==this.symbol)return;if(!Number.isFinite(e.E)||Math.abs(this.now()-e.E)>5000)return fail();this.retry=1000;if(this.onTrade(e)==='invalid')fail();}catch{fail();}};
      s.onclose=s.onerror=fail;
    }catch{fail();}
  }
}
