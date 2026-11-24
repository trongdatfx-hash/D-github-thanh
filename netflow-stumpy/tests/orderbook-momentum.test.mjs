import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderBookMomentum,bookMetrics,quoteOfi,BinanceAggTradeFeed} from '../orderbook-momentum.mjs';

const book=(symbol='SPYUSDT')=>({symbol,transport:'WS',bridged:true,bids:new Map([[99.95,20],[99.9,15]]),asks:new Map([[100.05,5],[100.1,5]])});
const trade=(time,id,overrides={})=>({e:'aggTrade',s:'SPYUSDT',E:time,a:id,p:'100',q:'2',m:false,...overrides});
function simulation({direction=1,absorb=false,until=72000}={}){
  let time=100000,id=0;const start=time,model=new OrderBookMomentum({now:()=>time}),b=book();model.reset('SPYUSDT');model.setTapeState(true);
  function advance(ms){
    for(;time<=start+ms;time+=200){
      const moved=absorb?0:direction*(time-start)/1000*.06;
      b.bids=new Map([[99.95+moved,direction>0?20:5],[99.9+moved,10]]);
      b.asks=new Map([[100.05+moved,direction>0?5:20],[100.1+moved,10]]);
      if(absorb){const refill=5+(time-start)/200*.3;if(direction>0)b.asks.set(100.05,refill);else b.bids.set(99.95,refill);}
      model.onBook(b);model.onTrade(trade(time,id++,{m:direction<0}));model.read();
    }
  }
  advance(until);return {model,b,read:()=>model.read(),advance,setTime:t=>{time=t;},get time(){return time;},get id(){return id;}};
}

test('weighted depth and microprice use the opposing quote; OFI signs are symmetric',()=>{
  const a=bookMetrics(book());assert.ok(a.obi>0);assert.ok(a.micro>a.mid);assert.ok(a.micro<a.ask);
  assert.equal(quoteOfi(a,{...a,bidQty:25}),5);
  assert.equal(quoteOfi(a,{...a,askQty:8}),-3);
  assert.equal(quoteOfi(a,{...a,bid:a.bid+.01,ask:a.ask+.01}),25);
  assert.equal(bookMetrics({...book(),asks:new Map([[99,1]])}),null);
});
test('buy and sell pressure require executed flow and price response across mature windows',()=>{
  for(const direction of [1,-1]){
    const s=simulation({direction}),r=s.read();assert.equal(r.quality,'live');assert.equal(r.state,direction>0?'buy':'sell');
    assert.deepEqual(r.windows.map(w=>w.ready),[true,true,true]);assert.ok(r.windows.every(w=>w.state===(direction>0?'buy':'sell')));
  }
});
test('absorption needs flat price, executed turnover and visible same-price replenishment',()=>{
  for(const direction of [1,-1])assert.equal(simulation({direction,absorb:true}).read().state,direction>0?'buyAbsorbed':'sellAbsorbed');
  let time=100000;const m=new OrderBookMomentum({now:()=>time}),b=book();m.reset('SPYUSDT');m.setTapeState(true);
  for(let id=0;id<150;id++,time+=200){m.onBook(b);m.onTrade(trade(time,id));m.read();}
  assert.equal(m.read().state,'mixed','flat trades alone must not be called absorption');
});
test('warm-up is continuous and does not pretend 15/60 second history exists',()=>{
  const s=simulation({until:8000}),r=s.read();assert.equal(r.windows[0].ready,true);assert.equal(r.windows[1].ready,false);assert.equal(r.windows[2].ready,false);
  s.model.onBook({...s.b,transport:'REST',bridged:false});assert.equal(s.read().quality,'snapshot');assert.equal(s.model.buckets.size,0);
});
test('depth gaps, tape disconnect and symbol changes immediately clear directional conclusions',()=>{
  const s=simulation();assert.equal(s.read().state,'buy');s.model.onBook(null);assert.equal(s.read().quality,'offline');
  s.model.onBook(s.b);assert.equal(s.read().quality,'warming');
  s.model.setTapeState(false);assert.equal(s.read().quality,'offline');
  s.model.reset('QQQUSDT');s.model.onBook(s.b);assert.equal(s.read().quality,'offline');
  assert.equal(s.model.onTrade(trade(s.time,9999)),'invalid');
});
test('duplicate, delayed, foreign and malformed trades are excluded; missing IDs restart warm-up',()=>{
  const s=simulation(),m=s.model,t=s.time,id=s.id-1;
  assert.equal(m.onTrade(trade(t,id)),'old');assert.equal(m.onTrade(trade(t-6000,id+1)),'invalid');
  assert.equal(m.onTrade(trade(t,id+1,{s:'QQQUSDT'})),'invalid');assert.equal(m.onTrade(trade(t,id+1,{m:undefined})),'invalid');
  assert.equal(m.onTrade(trade(t,id+2)),'gap');assert.equal(m.read().quality,'warming');
});
test('old depth, no recent trades and REST never retain an actionable headline',()=>{
  const s=simulation();s.setTime(s.time+6000);assert.equal(s.read().quality,'offline');
  const q=simulation();q.setTime(q.time+16000);q.model.onBook(q.b);assert.notEqual(q.read().quality,'live');
});
test('bounded one-second storage and repeated reads do not manufacture confirmations',()=>{
  const s=simulation({until:180000});assert.ok(s.model.buckets.size<=63);
  const m=s.model;m.stable='mixed';m.candidate=null;m.lastConfirmAt=null;for(let i=0;i<100;i++)m.read();assert.equal(m.stable,'mixed');
});
class Socket {
  static sockets=[];
  constructor(url){this.url=url;Socket.sockets.push(this);}
  close(){this.closed=true;}
  frame(data){this.onmessage?.({data:JSON.stringify(data)});}
}
test('trade feed uses USD-M market endpoint and drops stale handlers after a symbol change',()=>{
  const received=[],states=[],f=new BinanceAggTradeFeed({Socket,now:()=>100000,onTrade:t=>received.push(t),onState:s=>states.push(s)});
  try{
    f.start('SPYUSDT');const a=Socket.sockets.at(-1),old=a.onmessage;
    assert.equal(a.url,'wss://fstream.binance.com/market/ws/spyusdt@aggTrade');a.onopen();a.frame(trade(100000,1));assert.equal(received.length,1);
    f.start('QQQUSDT');old({data:JSON.stringify(trade(100000,2))});assert.equal(received.length,1);assert.equal(a.closed,true);
    const b=Socket.sockets.at(-1);b.onopen();b.frame(trade(1000,3,{s:'QQQUSDT'}));assert.equal(states.at(-1),false);assert.equal(b.closed,true);
  }finally{f.stop();}
});
