import test from 'node:test';
import assert from 'node:assert/strict';
import {OiFastLoader} from '../oi-fast-load.mjs';
import {OiHistory} from '../oi-history.mjs';
const now=Date.parse('2026-11-04T15:00:00Z'),sample={symbol:'SPYUSDT',timestamp:now,sumOpenInterest:100};
const memory=()=>new OiHistory({read:async()=>[],write:async(_,data)=>data});
test('tail begins without waiting for disk and becomes visible before full history',async()=>{
  let restore,full;const events=[],calls=[],history=new OiHistory({read:()=>new Promise(resolve=>{restore=resolve;}),write:async(_,data)=>data});
  const loader=new OiFastLoader({history,now:()=>now,onData:d=>events.push(d),get:async path=>{calls.push(path);if(path.includes('limit=500'))return new Promise(resolve=>{full=resolve;});return [sample];}});
  const pending=loader.start('15m');await new Promise(resolve=>setImmediate(resolve));
  assert(calls[0].includes('limit=128'));assert(events.some(d=>d.source==='tail'&&d.samples.length===1));assert(full);
  restore([]);full([sample]);await pending;
});
test('warm start uses a small tail, deduplicates calls and backs off without clearing history',async()=>{
  const history=memory();await history.append('15m',Array.from({length:150},(_,i)=>({...sample,timestamp:now-i*900000})),now);
  let calls=0,clock=now;const events=[];
  const loader=new OiFastLoader({history,now:()=>clock,onData:d=>events.push(d),get:async path=>{calls++;assert(path.includes('limit=32'));throw Error('offline');}});
  const first=loader.start('15m');assert.equal(loader.start('15m'),first);await first;
  assert(events.some(d=>d.source==='memory'&&d.samples.length===150));assert.equal(history.peek('15m',now).samples.length,150);
  await loader.start('15m');assert.equal(calls,1);clock+=30000;await loader.start('15m');assert.equal(calls,2);
});
test('switching timeframe aborts the old request and suppresses its late data',async()=>{
  let resolveOld,oldSignal;const events=[];
  const loader=new OiFastLoader({history:memory(),now:()=>now,onData:d=>events.push(d),get:async(path,signal)=>{
    if(path.includes('period=15m')){oldSignal=signal;return new Promise(resolve=>{resolveOld=resolve;});}
    return [sample];
  }});
  const old=loader.start('15m');await loader.start('1h');assert.equal(oldSignal.aborted,true);resolveOld([sample]);await old;
  assert.equal(events.filter(d=>d.interval==='15m'&&d.source==='tail').length,0);
  assert(events.some(d=>d.interval==='1h'&&d.source==='tail'));
});
