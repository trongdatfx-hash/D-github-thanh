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

test('cold load previews validated latest prices before slow older history',async()=>{
 let release;const waiting=new Promise(r=>release=r),mock=api(base+step/2),storage=memory();
 const previews=[];let settled=false;
 const get=async path=>{
  if(path.includes('/klines')&&+new URL('https://test'+path).searchParams.get('startTime')<base-1000*step)await waiting;
  return mock.get(path);
 };
 const task=load('15m',30,{get,storage,onPreview:data=>previews.push(data)}).then(data=>{settled=true;return data});
 await new Promise(r=>setImmediate(r));
 assert.equal(previews.length,1);assert.equal(settled,false);
 const preview=previews[0];assert.equal(preview.partial,true);assert.equal(preview.contracts.length,2);
 assert.equal(storage.getItem(),null);
 for(const symbol of symbols){assert(preview[symbol].length>100);assert(preview[symbol].length<=1000);assert.equal(preview[symbol].at(-1).t,base);}
 release();const full=await task;
 const reference=await load('15m',30,{get:api(base+step/2).get,storage:null});
 assert.deepEqual(full.SPYUSDT,reference.SPYUSDT);assert.deepEqual(full.QQQUSDT,reference.QQQUSDT);
 assert.equal(full.partial,undefined);assert.equal(previews.length,1);
});
test('preview waits for valid contracts and is skipped on warm history',async()=>{
 let release;const waiting=new Promise(r=>release=r),mock=api(base,{waitInfo:waiting}),previews=[];
 const task=load('15m',30,{get:mock.get,storage:null,onPreview:data=>previews.push(data)});
 await new Promise(r=>setImmediate(r));assert.equal(previews.length,0);release();const full=await task;
 assert.equal(previews.length,1);
 await load('15m',30,{get:api(base+step).get,storage:null,previous:full,onPreview:()=>assert.fail('warm load preview')});
 await assert.rejects(load('15m',30,{get:api(base,{badInfo:true}).get,storage:null,onPreview:()=>assert.fail('unvalidated preview')}));
});
test('failed and aborted loads cannot emit a late preview',async()=>{
 for(const aborted of [false,true]){
  let release;const waiting=new Promise(r=>release=r),mock=api(base),controller=new AbortController(),previews=[];
  const get=async path=>{
   if(path.includes('/klines')){
    const from=+new URL('https://test'+path).searchParams.get('startTime');
    if(from>=base-1000*step)await waiting;
    else if(!aborted)throw Error('older page failed');
   }
   return mock.get(path);
  };
  const task=load('15m',30,{get,storage:null,signal:controller.signal,onPreview:data=>previews.push(data)});
  if(aborted){controller.abort();release();await assert.rejects(task,{name:'AbortError'});}
  else{await assert.rejects(task,/older page failed/);release();}
  await new Promise(r=>setImmediate(r));assert.equal(previews.length,0);
 }
});
