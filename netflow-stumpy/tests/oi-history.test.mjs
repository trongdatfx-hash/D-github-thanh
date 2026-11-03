import test from 'node:test';
import assert from 'node:assert/strict';
import {OiHistory,mergeOiHistory} from '../oi-history.mjs';
import {oiWidthByBar} from '../oi-width.mjs';
import {oiCandleBars} from '../oi-candle-bars.mjs';
import {oiSpectrum} from '../oi-spectrum.mjs';
const step=900000,now=Date.parse('2026-11-04T18:00:00Z');
const sample=(ago,oi=100)=>({timestamp:now-ago*step,sumOpenInterest:oi,symbol:'SPYUSDT'});
test('retains multi-day history, replaces corrections and rejects invalid periods',()=>{
  const old=sample(300),recent=sample(1);
  const merged=mergeOiHistory('15m',[[old,recent],[{...recent,sumOpenInterest:120},sample(-1),sample(9000),{...recent,symbol:'QQQUSDT'},{...sample(2),sumOpenInterest:0},{...sample(3),timestamp:now-100}]],now);
  assert.deepEqual(merged,[old,{...recent,sumOpenInterest:120}]);
});
test('reopen restores historical observations even when network has no samples',async()=>{
  const disk=new Map(),adapter={read:async k=>disk.get(k),write:async(k,v)=>{disk.set(k,v);return v;}};
  await new OiHistory(adapter).append('15m',[sample(300),sample(1)],now);
  const reopened=await new OiHistory(adapter).load('15m',now+86400000);
  assert.equal(reopened.saved,true);assert.equal(reopened.samples.length,2);
  assert.deepEqual((await new OiHistory(adapter).load('1h',now)).samples,[]);
});
test('storage failure keeps in-memory history and explicitly reports unsaved',async()=>{
  const history=new OiHistory({read:async()=>{throw Error('disabled');},write:async()=>{throw Error('quota');}});
  const result=await history.append('15m',[sample(1)],now);assert.equal(result.saved,false);assert.equal(result.samples.length,1);
  assert.equal((await history.load('15m',now)).samples.length,1);
});
test('a restored previous-day candle stays marked while daily price profile stays empty',async()=>{
  const t=now-2*86400000,row={t,end:t+step-1,o:100,c:101,l:99,h:102};
  let disk=[];const adapter={read:async()=>disk,write:async(_,v)=>{disk=v;return v;}};
  await new OiHistory(adapter).append('15m',[{timestamp:t,sumOpenInterest:100},{timestamp:t+step,sumOpenInterest:110}],now);
  const restored=await new OiHistory(adapter).load('15m',now+86400000),oi=oiWidthByBar(restored.samples,step,now+86400000);
  const result=oiCandleBars([row],[{t,value:1}],[{t,net:20}],oi,step,now+86400000,{history:true});
  assert.equal(result.matched,1);assert.equal(result.data[0].value,10);
  assert.equal(oiSpectrum([row],oi,step,now+86400000).ready,false);
});
