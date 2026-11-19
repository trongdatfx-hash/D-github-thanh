import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,calculateVolumeStrength,sessionAt} from '../netflow-stumpy/engine.mjs';
import {h1AdaptiveVolumeRows,h1VolumeAlphaSchedule} from '../netflow-stumpy/spy-volume-h1.mjs';
import {advanceBodyState,createBodyState,bodyReversalHistory,solveBodyReversal,bodyReversalCache} from '../netflow-stumpy/spy-body-reversal.mjs';

const STEP=900000;
function fixture(n=720){
  let close=670;
  return Array.from({length:n},(_,i)=>{
    const t=Date.UTC(2026,10,2)+i*STEP,o=close;
    close+=.27*Math.sin(i*.53)+.13*Math.cos(i*.19)+(Math.floor(i/19)%2?.09:-.09);
    return {t,end:t+STEP-1,o,c:close,h:Math.max(o,close)+.14,l:Math.min(o,close)-.12,v:Math.abs(close-o),...sessionAt(t)};
  });
}
function statesFor(bars){
  return new Map(bars.filter((_,i)=>i%4===3).map((b,i)=>[b.t,{t:b.t,blockStart:b.t-3*STEP,blockEnd:b.t+STEP-1,direction:i%3?1:-1,quality:.8,preview:false}]));
}
const closeEnough=(a,b)=>{if(a===null||b===null)assert.equal(a,b);else assert.ok(Math.abs(a-b)<1e-11,`${a} != ${b}`);};

test('incremental state matches the actual candle-color formula including H1 and session mapping',()=>{
  const bars=fixture(),states=statesFor(bars),now=bars.at(-1).t+STEP;
  for(const adaptive of [false,true]){
    const expected=adaptive?h1AdaptiveVolumeRows(bars,states,{step:STEP,now}):analyze(bars,STEP,{strength:calculateVolumeStrength(bars,STEP)});
    const schedule=adaptive?h1VolumeAlphaSchedule(bars,states,{step:STEP,now}):new Map(),s=createBodyState();
    bars.forEach((b,i)=>{const actual=advanceBodyState(s.raw,s.pools,b,schedule.get(b.t));closeEnough(actual.raw,expected[i].raw);closeEnough(actual.adjusted,expected[i].adjusted);});
  }
});

test('solved two-candle prices really reverse the production indicator',()=>{
  const bars=fixture(),states=statesFor(bars),now=bars.at(-1).t+STEP;
  for(const adaptive of [false,true]){
    const history=bodyReversalHistory(bars,states,{now,adaptive});assert.ok(history.points.length>30);
    for(const point of history.points.filter((_,i)=>i%23===0)){
      const prefix=bars.filter(b=>b.t<=point.time*1000),anchor=prefix.at(-1),d=(point.value-anchor.c)/2;
      for(let k=1;k<=2;k++){const o=anchor.c+(k-1)*d,c=o+d,t=anchor.t+k*STEP;prefix.push({t,end:t+STEP-1,o,c,h:Math.max(o,c),l:Math.min(o,c),v:Math.abs(d),...sessionAt(t)});}
      const known=new Map([...states].filter(([,s])=>s.blockEnd<point.knownAt));
      const rows=adaptive?h1AdaptiveVolumeRows(prefix,known,{step:STEP,now:prefix.at(-1).t+STEP}):analyze(prefix,STEP,{strength:calculateVolumeStrength(prefix,STEP)});
      assert.ok(rows.at(-1).adjusted*point.direction<0);closeEnough(rows.at(-1).adjusted,point.second);
    }
  }
});

test('history is causal: future prices and future H1 confirmations never change a past point',()=>{
  const bars=fixture(),states=statesFor(bars),cut=640,now=bars[cut-1].t+STEP;
  const prefix=bodyReversalHistory(bars.slice(0,cut),states,{now,adaptive:true});
  const full=bodyReversalHistory(bars,states,{now:bars.at(-1).t+STEP,adaptive:true});
  assert.deepEqual(full.points.filter(p=>p.knownAt<=now),prefix.points);
  const open={...bars[cut],c:900,h:901};
  assert.deepEqual(bodyReversalHistory([...bars.slice(0,cut),open],states,{now:now+STEP/2,adaptive:true}),prefix);
});

test('missing bars break the line and require the full strength warmup again',()=>{
  const bars=fixture(1250);bars.splice(650,1);
  const result=bodyReversalHistory(bars,new Map(),{now:bars.at(-1).t+STEP});
  assert.ok(result.points.some(p=>p.time*1000<bars[650].t));
  assert.ok(!result.points.some(p=>p.time*1000>=bars[650].t&&p.time*1000<bars[650+506].t));
  const before=result.points.findLast(p=>p.time*1000<bars[650].t),after=result.points.find(p=>p.time*1000>bars[650].t);
  assert.ok(after&&after.segment!==before.segment);
});

test('no bounded solution stays missing; cache ignores changing open-candle prices',()=>{
  assert.equal(solveBodyReversal(createBodyState(),fixture(1)[0],1,{maxDistance:1}),null);
  const bars=fixture(),now=bars.at(-1).t+STEP/2,cache=bodyReversalCache();
  const first=cache.get(bars,new Map(),{now,adaptive:false});
  const changed=bars.map((b,i)=>i===bars.length-1?{...b,c:b.c+20,h:b.h+20}:b);
  assert.equal(cache.get(changed,new Map(),{now,adaptive:false}),first);
});
