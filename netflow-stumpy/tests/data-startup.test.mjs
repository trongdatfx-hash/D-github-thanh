import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../data.mjs';
const step=900000,base=1793001600000;
const symbols=['SPYUSDT','QQQUSDT'];
const info={symbols:symbols.map(symbol=>({symbol,status:'TRADING',quoteAsset:'USDT',contractType:'PERPETUAL'}))};
function memory(){let value=null;return {getItem:()=>value,setItem:(k,v)=>{value=v},set:v=>{value=v}};}
function api(now,{waitInfo=null,badInfo=false,fail=false}={}){
 const calls=[];let transferred=0;
 const get=async path=>{
  calls.push(path);
  if(path.endsWith('exchangeInfo')){if(waitInfo)await waitInfo;return badInfo?{symbols:[]}:info;}
  if(path.endsWith('/time'))return {serverTime:now};
  if(fail)throw Error('offline');
  const p=new URL('https://test'+path).searchParams;
  const out=[];for(let t=+p.get('startTime');t<=+p.get('endTime');t+=step){
   const running=t+step>now;out.push([t,100,102,98,101,running?7:10,t+step-1,running?70:100,0,0,running?40:60]);
  }
  transferred+=out.length;return out;
 };
 return {get,calls,get transferred(){return transferred}};
}
test('reopen restores full history and refreshes closed/open bars; identical to cold load',async()=>{
 const storage=memory(),cold=api(base+step/2);
 const first=await load('15m',30,{get:cold.get,storage});
 const warm=api(base+step*2.5);
 const restored=await load('15m',30,{get:warm.get,storage});
 const full=await load('15m',30,{get:api(base+step*2.5).get,storage:null});
 assert(restored.restored);assert.deepEqual(restored.SPYUSDT,full.SPYUSDT);assert.deepEqual(restored.QQQUSDT,full.QQQUSDT);
 assert.equal(restored.SPYUSDT.find(r=>r.t===base).q,100);
 assert(warm.transferred<20);assert(cold.transferred>5700);
 console.log(JSON.stringify({coldBars:cold.transferred,warmBars:warm.transferred,coldRequests:cold.calls.length,warmRequests:warm.calls.length}));
});
test('klines start while contract validation is pending; result waits for validation',async()=>{
 let release;const waiting=new Promise(r=>release=r),mock=api(base,{waitInfo:waiting});let done=false;
 const task=load('15m',7,{get:mock.get,storage:null}).then(x=>{done=true;return x});
 await new Promise(r=>setImmediate(r));
 assert(mock.calls.some(x=>x.includes('klines')));assert.equal(done,false);release();await task;
});
test('invalid contracts and network failures never publish cached data as live',async()=>{
 const storage=memory();await load('15m',7,{get:api(base).get,storage});
 await assert.rejects(load('15m',7,{get:api(base+step,{badInfo:true}).get,storage}));
 await assert.rejects(load('15m',7,{get:api(base+step,{fail:true}).get,storage}),/offline/);
});
test('corrupt, expired, different timeframe cache falls back to full load',async()=>{
 for(const value of ['bad JSON',JSON.stringify({version:1,interval:'15m',days:30,serverTime:base-2*86400000}),JSON.stringify({version:1,interval:'5m',days:30,serverTime:base})]){
  const storage=memory();storage.set(value);const mock=api(base);
  const result=await load('15m',30,{get:mock.get,storage});assert.equal(result.restored,false);assert(mock.transferred>5700);
 }
});
test('storage denied and aborted request remain safe',async()=>{
 const storage={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 assert((await load('15m',7,{get:api(base).get,storage})).SPYUSDT.length);
 const controller=new AbortController();controller.abort();
 await assert.rejects(load('15m',7,{get:api(base).get,storage:null,signal:controller.signal}),{name:'AbortError'});
});
test('historical fallback is not reused as a full live seed',async()=>{
 const mock=api(base);
 const result=await load('15m',30,{get:mock.get,storage:null,previous:{historical:true,interval:'15m',days:30,serverTime:base}});
 assert.equal(result.incremental,false);assert(mock.transferred>5700);
});
