import test from 'node:test';
import assert from 'node:assert/strict';
import {DepthBook,groupBook,autoBookStep,BinanceDepthFeed} from '../orderbook-core.mjs';

const snapshot={lastUpdateId:100,bids:[['99','2'],['98','3']],asks:[['101','4'],['102','5']]};
const event=(changes={})=>({e:'depthUpdate',s:'SPYUSDT',U:99,u:101,pu:98,b:[],a:[],...changes});
test('snapshot bridge uses futures overlap and absolute sizes, including zero deletion',()=>{
  const book=new DepthBook('SPYUSDT');book.snapshot(snapshot);
  assert.equal(book.apply(event({U:90,u:99})),'old');
  assert.equal(book.apply(event({b:[['99','7']],a:[['101','0']]})),'applied');
  assert.equal(book.bids.get(99),7);assert.equal(book.asks.has(101),false);
  assert.equal(book.apply(event({U:102,u:105,pu:101,b:[['99','1']]})),'applied');
  assert.equal(book.bids.get(99),1);
  assert.equal(book.apply(event({U:102,u:105,pu:101})),'old');
});
test('missing bridge, sequence gaps and wrong symbol never mutate book',()=>{
  const book=new DepthBook('SPYUSDT');book.snapshot(snapshot);
  assert.equal(book.apply(event({U:102,b:[['99','99']]})),'gap');
  assert.equal(book.id,100);assert.equal(book.bids.get(99),2);
  assert.equal(book.apply(event({s:'QQQUSDT'})),'foreign');
  book.apply(event());assert.equal(book.apply(event({U:105,u:106,pu:104})),'gap');
  assert.equal(book.id,101);
});
test('unknown far depth is excluded and grouping preserves quantities on each side',()=>{
  const book=new DepthBook('SPYUSDT');book.snapshot(snapshot);
  book.apply(event({b:[['97','900'],['98.5','1']],a:[['103','900']]}));
  assert.equal(book.bids.has(97),false);assert.equal(book.asks.has(103),false);
  const rows=groupBook(book,1);assert.equal(rows.filter(x=>x.side==='bid').reduce((a,x)=>a+x.quantity,0),6);
  assert.equal(rows.filter(x=>x.side==='ask').reduce((a,x)=>a+x.quantity,0),9);
  assert.equal(groupBook(book,1,{min:100,max:102}).length,2);
  assert.equal(groupBook(book,0).length,0);assert.ok(autoBookStep(20,500)>=20/(500/7));
});
class MockSocket {
  static sockets=[];
  constructor(url){this.url=url;MockSocket.sockets.push(this);}
  close(){this.closed=true;}
  sendFrame(data){this.onmessage?.({data:JSON.stringify(data)});}
}
test('feed buffers while fetching, clears on gap and cancels stale symbol requests',async()=>{
  let resolve;const states=[],books=[];
  const feed=new BinanceDepthFeed({fallback:false,Socket:MockSocket,fetcher:()=>new Promise(r=>{resolve=r;}),onState:s=>states.push(s),onBook:b=>books.push(b),now:()=>1000});
  try{
    feed.start('SPYUSDT');const first=MockSocket.sockets.at(-1),pending=first.onopen();
    first.sendFrame(event());resolve({ok:true,json:async()=>snapshot});await pending;
    assert.equal(states.at(-1),'live');assert.equal(feed.book.id,101);
    first.sendFrame(event({u:110,U:108,pu:107}));assert.equal(states.at(-1),'offline');assert.equal(books.at(-1),null);
    feed.start('QQQUSDT');const second=MockSocket.sockets.at(-1),late=second.onopen();
    feed.start('SPYUSDT');resolve({ok:true,json:async()=>snapshot});await late;
    assert.equal(feed.book,null);assert.equal(second.closed,true);
  }finally{feed.stop();}
});
test('delayed server updates are never labelled LIVE',async()=>{
  const states=[];const feed=new BinanceDepthFeed({fallback:false,Socket:MockSocket,fetcher:async()=>({ok:true,json:async()=>snapshot}),onState:s=>states.push(s),now:()=>100000});
  try{feed.start('SPYUSDT');const socket=MockSocket.sockets.at(-1);await socket.onopen();socket.sendFrame(event({E:1000}));assert.equal(states.at(-1),'offline');assert.equal(feed.book,null);}finally{feed.stop();}
});
test('REST fallback supplies fresh book and drops stale snapshots without exposing old data',async()=>{
  const states=[],books=[];let stale=false;
  const feed=new BinanceDepthFeed({fallback:false,Socket:MockSocket,fetcher:async()=>({ok:true,json:async()=>({...snapshot,E:stale?1000:100000})}),onState:s=>states.push(s),onBook:b=>books.push(b),now:()=>100000});
  try{
    feed.start('SPYUSDT');await feed.pollSnapshot();clearTimeout(feed.pollTimer);
    assert.equal(states.at(-1),'live');assert.equal(books.at(-1).transport,'REST');
    stale=true;await feed.pollSnapshot();assert.equal(states.at(-1),'offline');assert.equal(books.at(-1),null);
  }finally{feed.stop();}
});
