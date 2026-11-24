import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderBookMomentum,classifyWindow} from '../orderbook-momentum.mjs';
import {BinanceDepthFeed} from '../orderbook-core.mjs';
test('long-window thresholds are symmetric and reject the former half-spread move',()=>{
 for(const seconds of [180,300,600])for(const direction of [1,-1]){
  const minMove=seconds===180?2:seconds===300?3:4,minCount=seconds===180?20:seconds===300?30:50;
  const w={seconds,ready:true,count:100,total:10000,flow:.5*direction,obi:.3*direction,ofi:0,microBps:0,samples:100,moveSpreads:.5*direction,rangeSpreads:10};
  assert.equal(classifyWindow(w),'mixed');w.moveSpreads=(minMove+.001)*direction;assert.equal(classifyWindow(w),direction>0?'buy':'sell');
  w.count=minCount-1;assert.equal(classifyWindow(w),'quiet');w.count=100;w.flow=.29*direction;assert.equal(classifyWindow(w),'mixed');
 }
});
test('five and ten minute windows need actual history, retain totals and clear after a gap',()=>{
 let now=100000,id=0;const m=new OrderBookMomentum({now:()=>now});m.reset('SPYUSDT');m.setTapeState(true);
 const b={symbol:'SPYUSDT',transport:'WS',bridged:true,bids:new Map(),asks:new Map()};let r;
 for(let i=0;i<=630;i++,now+=1000){
  const mid=100+i*.01;b.bids=new Map([[mid-.05,20]]);b.asks=new Map([[mid+.05,5]]);m.onBook(b);
  for(let j=0;j<2;j++)m.onTrade({e:'aggTrade',s:'SPYUSDT',E:now,a:id++,p:String(mid),q:'2',m:false});r=m.read();
  if(i===180){assert.equal(r.summary.seconds,180);assert.equal(r.summary.targetSeconds,300);}
  if(i===300){assert.equal(r.summary.seconds,300);assert.equal(r.windows.find(w=>w.seconds===600).ready,false);}
 }
 assert.equal(r.state,'buy');assert.ok(m.buckets.size<=603);assert.equal(r.windows.find(w=>w.seconds===600).ready,true);
 m.setHorizon(600);r=m.read();assert.equal(r.summary.seconds,600);assert.equal(r.summary.targetSeconds,600);assert.ok(r.summary.delta>0);
 m.onBook(null);assert.equal(m.read().quality,'offline');assert.equal(m.buckets.size,0);
});
test('planned depth rotation permits ten minute accumulation without dropping sequence checks',async()=>{
 let now=100000,tick;const interval=globalThis.setInterval,clear=globalThis.clearInterval;
 globalThis.setInterval=fn=>{tick=fn;return 1;};globalThis.clearInterval=()=>{};
 class Socket{constructor(){Socket.last=this;}close(){this.closed=true;}}
 const f=new BinanceDepthFeed({fallback:false,Socket,now:()=>now,fetcher:async()=>({ok:true,json:async()=>({lastUpdateId:100,bids:[['99','2']],asks:[['101','2']]})})});
 try{
  f.start('SPYUSDT');const socket=Socket.last;await socket.onopen();
  socket.onmessage({data:JSON.stringify({e:'depthUpdate',s:'SPYUSDT',E:now,U:99,u:101,pu:98,b:[],a:[]})});
  now+=610000;f.lastReceived=now;tick();assert.equal(f.streamLive,true);assert.notEqual(socket.closed,true);
  socket.onmessage({data:JSON.stringify({e:'depthUpdate',s:'SPYUSDT',E:now,U:105,u:106,pu:104,b:[],a:[]})});
  assert.equal(f.streamLive,false);assert.equal(socket.closed,true);
 }finally{f.stop();globalThis.setInterval=interval;globalThis.clearInterval=clear;}
});
