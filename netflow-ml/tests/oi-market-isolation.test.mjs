import test from 'node:test';
import assert from 'node:assert/strict';
import {OiHistory} from '../oi-history.mjs';
import {OiFastLoader} from '../oi-fast-load.mjs';
import {spectrumPriceGroup} from '../paired-spectrum.mjs';
const now=Date.parse('2026-11-04T15:00:00Z');
test('XAU and EUR hot snapshots cannot leak across market or timeframe',()=>{
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 try{
  new OiHistory({symbol:'XAUUSDT'}).stage('15m',[{symbol:'XAUUSDT',timestamp:now,sumOpenInterest:100}],now);
  const eur=new OiHistory({symbol:'EURUSDT'});assert.equal(eur.peek('15m',now).samples.length,0);
  eur.stage('15m',[{symbol:'EURUSDT',timestamp:now,sumOpenInterest:200},{symbol:'XAUUSDT',timestamp:now-900000,sumOpenInterest:100}],now);
  assert.equal(new OiHistory({symbol:'EURUSDT'}).peek('15m',now).samples[0].sumOpenInterest,200);
  assert.equal(new OiHistory({symbol:'XAUUSDT'}).peek('15m',now).samples[0].sumOpenInterest,100);
  assert.equal(new OiHistory({symbol:'EURUSDT'}).peek('1h',now).samples.length,0);
 }finally{delete globalThis.localStorage;}
});
test('EUR loader requests EUR, rejects other symbol, cancellation suppresses stale callbacks',async()=>{
 const history=new OiHistory({symbol:'EURUSDT',read:async()=>[],write:async(_,s)=>s});let resolve,signal;const events=[];
 const loader=new OiFastLoader({symbol:'EURUSDT',history,now:()=>now,onData:d=>events.push(d),get:(path,s)=>{assert.match(path,/symbol=EURUSDT/);signal=s;return new Promise(r=>resolve=r);}});
 const pending=loader.start('15m');loader.cancel();assert(signal.aborted);resolve([{symbol:'EURUSDT',timestamp:now,sumOpenInterest:100}]);await pending;assert(!events.some(x=>x.source==='tail'));
 const errors=[];const wrong=new OiFastLoader({symbol:'EURUSDT',history,now:()=>now,onState:s=>errors.push(s.phase),get:async()=>[{symbol:'XAUUSDT',timestamp:now,sumOpenInterest:100}]});await wrong.start('15m');assert(errors.includes('error'));assert.equal(history.peek('15m',now).samples.length,0);
});
test('EUR three-level price group preserves fractional pip-sized bins',()=>{
 const group=spectrumPriceGroup({binStep:.0005,rows:[{price:1.08,cvd:12,opened:30,closed:5}],count:1,pairedReady:true},1.08);
 assert.equal(group.state,'buy-oi-increase');assert(Math.abs((group.high-group.low)-.0015)<1e-10);assert(group.low<=1.08&&group.high>1.08);
});
