import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {closedColorSourceKey,readH1ColorCache,saveH1ColorCache,H1_COLOR_CACHE_VERSION} from '../h1-color-cache.mjs';
import {chartFresh} from '../chart-live.mjs';
const H=3600000,Q=900000,T=Date.parse('2026-10-30T08:00:00Z');
function raw(interval='15m'){
  const step=interval==='1h'?H:Q,rows=Array.from({length:12},(_,i)=>({t:T+i*step,end:T+(i+1)*step-1,o:100,h:103,l:99,c:102,v:10,q:1000,buy:600}));
  return {interval,days:30,serverTime:T+11*step+step/2,SPYUSDT:rows,QQQUSDT:structuredClone(rows)};
}
const state=(t=T,preview=false)=>({t,direction:1,quality:.75,score:80,spyV:.5,priceVector:.5,preview,dayKey:'2026-10-30',blockStart:T,blockEnd:T+H-1});
function storage(){let value=null;return {getItem:()=>value,setItem:(key,text)=>{value=text},get value(){return value},set value(v){value=v}};}
const write=(s,r,extra={})=>saveH1ColorCache(s,r,{archiveRevision:'archive1',h1:[state()],strip:[state()],now:T,...extra});
test('matching raw data restores only locked states and never supplies raw or LIVE',()=>{
  const s=storage(),r=raw();assert(write(s,r,{h1:[state(),{...state(T+Q),preview:true}]}));
  const saved=readH1ColorCache(s,r,{archiveRevision:'archive1',now:T+1});
  assert.equal(saved.h1.length,1);assert.equal(saved.version,H1_COLOR_CACHE_VERSION);
  assert.equal(saved.SPYUSDT,undefined);assert.equal(saved.live,undefined);
  assert.equal(chartFresh(saved,r.serverTime,T,T),false);
});
test('running OHLC updates leave the key unchanged but closing the candle invalidates it',()=>{
  const r=raw(),key=closedColorSourceKey(r);r.SPYUSDT.at(-1).c=101;assert.equal(closedColorSourceKey(r),key);
  r.serverTime=r.SPYUSDT.at(-1).end+1;assert.notEqual(closedColorSourceKey(r),key);
});
for(const symbol of ['SPYUSDT','QQQUSDT'])test(symbol+' corrections before the tail invalidate colors',()=>{
  for(const field of ['o','h','l','c','v','q','buy']){
    const s=storage(),r=raw();write(s,r);r[symbol][1][field]+=.01;
    assert.equal(readH1ColorCache(s,r,{now:T+1}),null);
  }
});
test('archive revisions, missing sources, intervals and history choices reject cache',()=>{
  const s=storage(),r=raw();write(s,r);
  assert.equal(readH1ColorCache(s,r,{archiveRevision:'archive2',now:T+1}),null);
  for(const mutate of [r=>r.QQQUSDT=[],r=>r.interval='1h',r=>r.days=7,r=>r.partial=true]){
    const changed=structuredClone(r);mutate(changed);
    assert.equal(readH1ColorCache(s,changed,{now:T+1}),null);
  }
});
test('H1/H4 states have a separate key and are supported',()=>{
  const s=storage(),r=raw('1h');assert(write(s,r));assert(readH1ColorCache(s,r,{now:T+1}));
  assert.notEqual(closedColorSourceKey(r),closedColorSourceKey(raw()));
});
test('corrupt, expired, future, different algorithm and malformed states reject safely',()=>{
  const s=storage(),r=raw();write(s,r);const good=s.value;
  for(const mutate of [x=>x.version='old',x=>x.savedAt=T-2*86400000,x=>x.savedAt=T+100,x=>x.h1[0].direction=2,x=>x.h1[0].preview=true,x=>x.h1[0].blockEnd=r.serverTime+1,x=>x.h1.push({...x.h1[0]}),x=>x.strip[0].score='NaN']){
    const saved=JSON.parse(good);mutate(saved);s.value=JSON.stringify(saved);assert.equal(readH1ColorCache(s,r,{now:T+1}),null);
  }
  s.value='bad JSON';assert.equal(readH1ColorCache(s,r),null);
});
test('storage denial and quota failures cannot break rendering',()=>{
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
  assert.equal(write(denied,raw()),false);assert.equal(readH1ColorCache(denied,raw()),null);
  assert.equal(write(null,raw()),false);
});
test('closed-color key rejects invalid numbers, unsorted data and unsupported intervals',()=>{
  for(const mutate of [r=>r.SPYUSDT[0].c=NaN,r=>r.QQQUSDT.reverse(),r=>r.interval='5m']){
    const r=raw();mutate(r);assert.equal(closedColorSourceKey(r),null);
  }
});
test('prefetch overlaps chart requests, sends no study result, and shares its history load',async()=>{
  let release,loads=0,computed=0;const pending=new Promise(resolve=>release=resolve),messages=[];
  const code=(await readFile(new URL('../studies-worker.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  const self={postMessage:message=>messages.push(message)};
  vm.runInNewContext(code,{self,performance,AbortSignal,loadPersistentHistory:()=>{loads++;return pending},analyzeTrendSource:()=>({}),computeStudies:data=>{computed++;data.onH1Ready([],[]);return {};}});
  const prefetch=self.onmessage({data:{type:'prefetch'}});
  const r=raw(),request=self.onmessage({data:{key:'study1',raw:r,now:r.serverTime,sourceKey:'source1'}});
  assert.equal(loads,1);assert.equal(computed,0);
  release({manifest:{updatedAt:1},SPYUSDT:r.SPYUSDT,QQQUSDT:r.QQQUSDT});await Promise.all([prefetch,request]);
  assert.equal(computed,1);assert.equal(messages[0].type,'history-ready');assert.equal(messages[1].partial,'h1');assert.deepEqual(JSON.parse(JSON.stringify(messages[1].archive)),{updatedAt:1});
});
test('main restores cache without setting LIVE and removes it on archive mismatch',async()=>{
  const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),start=app.indexOf('function colorStorage(){'),end=app.indexOf('function requestStudies(){',start);
  const helpers=app.slice(start,end).replaceAll('import.meta.url',JSON.stringify('https://example.test/app.mjs'));
  const r=raw(),s=storage(),archive={updatedAt:1};
  const {archiveColorRevision}=await import('../h1-color-cache.mjs');
  write(s,r,{archiveRevision:archiveColorRevision(archive),now:Date.now()});
  const host={dataset:{}},sandbox={localStorage:s,performance,URL,closedColorSourceKey,readH1ColorCache,saveH1ColorCache,archiveColorRevision,requestAnimationFrame:callback=>callback()};
  sandbox.Worker=class{constructor(){sandbox.worker=this}};
  sandbox.$=id=>id==='chart'?host:id==='symbol'?{value:'SPYUSDT'}:{checked:true};
  vm.runInNewContext(`let studiesWorker=null,studyKey='current',studyColorInput=null,h1CacheAttempt='',h1CacheArchive=null,h1HistoryKnown=false,h1HistoryRevision=null,h1CandleMap=new Map(),h1H4CandleMap=new Map(),cache={},chartLiveResponse=false;function render(){}function updateH1TrendAgeReadout(){}function scheduleH1H4Strip(){}${helpers};this.runRestore=restoreH1Colors;this.start=ensureStudiesWorker;this.inspect=()=>({h1:h1CandleMap.size,strip:h1H4CandleMap.size,live:chartLiveResponse});`,sandbox);
  sandbox.runRestore(r);assert.equal(sandbox.inspect().h1,1);assert.equal(sandbox.inspect().live,false);assert.equal(host.dataset.h1ColorCache,'restored');
  sandbox.start();sandbox.worker.onmessage({data:{key:'old',partial:'h1',result:{h1CandleColors:[]}}});assert.equal(sandbox.inspect().h1,1);
  sandbox.worker.onmessage({data:{type:'history-ready',archive:{updatedAt:2}}});
  assert.equal(sandbox.inspect().h1,0);assert.equal(sandbox.inspect().strip,0);assert.equal(sandbox.inspect().live,false);assert.equal(host.dataset.h1ColorCache,'rejected');
});
