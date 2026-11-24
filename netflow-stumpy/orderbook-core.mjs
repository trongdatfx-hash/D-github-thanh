// Binance USD-M depth: snapshot + sequenced absolute-size updates.
export class DepthBook {
  constructor(symbol){this.symbol=symbol;this.bids=new Map();this.asks=new Map();this.id=null;this.bridged=false;}
  snapshot(data){
    if(!Number.isSafeInteger(data.lastUpdateId)||!data.bids?.length||!data.asks?.length)throw Error('Invalid depth snapshot');
    this.bids=new Map(data.bids.map(([p,q])=>[Number(p),Number(q)]).filter(([p,q])=>p>0&&q>0));
    this.asks=new Map(data.asks.map(([p,q])=>[Number(p),Number(q)]).filter(([p,q])=>p>0&&q>0));
    this.bidFloor=Math.min(...this.bids.keys());this.askCeiling=Math.max(...this.asks.keys());
    this.id=data.lastUpdateId;this.bridged=false;
  }
  apply(event){
    if(event.s!==this.symbol)return 'foreign';
    if(!Number.isSafeInteger(event.u)||!Number.isSafeInteger(event.U)||!Array.isArray(event.b)||!Array.isArray(event.a))throw Error('Invalid depth update');
    if(this.id===null)return 'pending';
    if(event.u<this.id||(this.bridged&&event.u===this.id))return 'old';
    if(this.bridged?event.pu!==this.id:event.U>this.id)return 'gap';
    for(const [rows,book,bid] of [[event.b,this.bids,true],[event.a,this.asks,false]]){
      for(const [rawPrice,rawQty] of rows){
        const p=Number(rawPrice),q=Number(rawQty);
        if(!Number.isFinite(p)||!Number.isFinite(q)||p<=0||q<0)throw Error('Invalid depth level');
        // Only the price band covered by the initial snapshot is known complete.
        if(bid?p<this.bidFloor:p>this.askCeiling)continue;
        if(q===0)book.delete(p);else book.set(p,q);
      }
    }
    this.id=event.u;this.bridged=true;return 'applied';
  }
}

export function autoBookStep(priceSpan,paneHeight){
  const raw=Math.max(0.01,priceSpan/Math.max(12,paneHeight/7));
  const power=10**Math.floor(Math.log10(raw));
  return [1,2,5,10].map(n=>n*power).find(n=>n>=raw)??power*10;
}

export function groupBook(book,step,{min=-Infinity,max=Infinity}={}){
  if(!(step>0)||!Number.isFinite(step))return [];
  const bins=[];
  for(const [side,levels] of [['bid',book.bids],['ask',book.asks]]){
    const grouped=new Map();
    for(const [price,quantity] of levels){
      if(price<min||price>max||!(quantity>0))continue;
      const key=Math.floor(price/step+1e-8);
      grouped.set(key,(grouped.get(key)??0)+quantity);
    }
    for(const [key,quantity] of grouped)bins.push({side,price:(key+.5)*step,low:key*step,high:(key+1)*step,quantity});
  }
  return bins.sort((a,b)=>a.price-b.price);
}

export class BinanceDepthFeed {
  constructor({onState=()=>{},onBook=()=>{},fetcher=(...args)=>globalThis.fetch(...args),Socket=globalThis.WebSocket,now=()=>Date.now(),fallback=true}={}){
    Object.assign(this,{onState,onBook,fetcher,Socket,now,fallback});this.generation=0;this.pollGeneration=0;this.enabled=false;this.retry=1000;
  }
  start(symbol){
    this.stop();this.enabled=true;this.symbol=symbol;this.retry=1000;this.connect();if(this.fallback)void this.pollSnapshot();
  }
  stop(){
    this.enabled=false;this.generation++;this.pollGeneration++;this.streamLive=false;this.restReceived=0;clearTimeout(this.pollTimer);clearTimeout(this.reconnect);clearInterval(this.watchdog);clearTimeout(this.timeout);
    this.pollController?.abort();
    this.controller?.abort();const socket=this.socket;this.socket=null;
    if(socket){socket.onopen=socket.onmessage=socket.onclose=socket.onerror=null;socket.close();}
    this.book=null;this.lastReceived=0;
  }
  async pollSnapshot(){
    if(!this.enabled)return;
    const epoch=this.pollGeneration,symbol=this.symbol;let timeout;
    try{
      if(!this.streamLive){
        this.pollController=new AbortController();timeout=setTimeout(()=>this.pollController?.abort(),10000);
        const response=await this.fetcher(`https://fapi.binance.com/fapi/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=1000`,{signal:this.pollController.signal,cache:'no-store'});
        if(!response.ok)throw Error('Depth unavailable');const data=await response.json();
        if(!this.enabled||epoch!==this.pollGeneration||this.streamLive)return;
        if(Number.isFinite(data.E)&&Math.abs(this.now()-data.E)>15000)throw Error('Stale depth snapshot');
        const book=new DepthBook(symbol);book.snapshot(data);book.transport='REST';this.restReceived=this.now();
        this.onState('live');this.onBook(book);
      }
    }catch(error){
      if(this.enabled&&epoch===this.pollGeneration&&!this.streamLive){this.restReceived=0;this.onBook(null);this.onState('offline',error.message);}
    }finally{
      clearTimeout(timeout);if(this.enabled&&epoch===this.pollGeneration)this.pollTimer=setTimeout(()=>this.pollSnapshot(),3000);
    }
  }
  clearDisplay(state){
    if(this.restReceived&&this.now()-this.restReceived<8000)return;
    this.onBook(null);this.onState(state);
  }
  connect(){
    if(!this.enabled)return;
    const generation=++this.generation,symbol=this.symbol,current=()=>this.enabled&&generation===this.generation;
    this.book=null;this.lastReceived=0;this.streamLive=false;this.clearDisplay('connecting');
    const buffer=[];let snapshotReady=false;
    const fail=()=>{
      if(!current())return;
      this.generation++;this.controller?.abort();clearInterval(this.watchdog);clearTimeout(this.timeout);
      const socket=this.socket;this.socket=null;if(socket){socket.onclose=socket.onerror=socket.onmessage=socket.onopen=null;socket.close();}
      this.book=null;this.streamLive=false;this.clearDisplay('offline');
      const delay=this.retry;this.retry=Math.min(30000,this.retry*2);this.reconnect=setTimeout(()=>this.connect(),delay);
    };
    const accept=event=>{
      const result=this.book.apply(event);
      if(result==='gap')return fail();
      if(result!=='applied')return;
      if(Number.isFinite(event.E)&&Math.abs(this.now()-event.E)>15000)return fail();
      if(!this.book.bids.size||!this.book.asks.size||Math.max(...this.book.bids.keys())>=Math.min(...this.book.asks.keys()))return fail();
      this.lastReceived=this.now();this.retry=1000;this.streamLive=true;this.book.transport='WS';this.onState('live');this.onBook(this.book);
    };
    try{
      this.socket=new this.Socket(`wss://fstream.binance.com/public/ws/${symbol.toLowerCase()}@depth@100ms`);
      this.timeout=setTimeout(fail,15000);
      this.socket.onopen=async()=>{
        this.controller=new AbortController();
        try{
          const response=await this.fetcher(`https://fapi.binance.com/fapi/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=1000`,{signal:this.controller.signal,cache:'no-store'});
          if(!response.ok)throw Error('Depth snapshot unavailable');
          const data=await response.json();if(!current())return;
          this.book=new DepthBook(symbol);this.book.snapshot(data);snapshotReady=true;
          for(const event of buffer){if(!current())break;accept(event);}buffer.length=0;
          if(!current())return;
          clearTimeout(this.timeout);const started=this.now();
          this.watchdog=setInterval(()=>{if(!current())return;if(this.now()-(this.lastReceived||started)>10000||this.now()-started>180000)fail();},1000);
        }catch{fail();}
      };
      this.socket.onmessage=message=>{
        if(!current())return;
        try{
          const event=JSON.parse(message.data);if(event.e!=='depthUpdate'||event.s!==symbol)return;
          if(!snapshotReady){buffer.push(event);if(buffer.length>2000)fail();return;}
          accept(event);
        }catch{fail();}
      };
      this.socket.onerror=fail;this.socket.onclose=fail;
    }catch{fail();}
  }
}
