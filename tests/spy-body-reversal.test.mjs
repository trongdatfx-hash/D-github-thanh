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
      const prefix=bars.filter(b=>b.t<=point.time*1000),anchor=prefix.at(-1),delta=point.value-anchor.c;
      assert.equal(point.anchor,point.direction<0?anchor.h:anchor.l);
      assert.ok(point.direction<0?point.value>=anchor.h:point.value<=anchor.l);
      let open=anchor.c;
      for(let k=1;k<=2;k++){const o=open,c=anchor.c+delta*(k===1?point.firstFraction:1),t=anchor.t+k*STEP;prefix.push({t,end:t+STEP-1,o,c,h:Math.max(o,c),l:Math.min(o,c),v:Math.abs(c-o),...sessionAt(t)});open=c;}
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
  assert.deepEqual(bodyReversalHistory([...bars.slice(0,cut),open],states,{now:now+STEP/2,adaptive:true}).points,prefix.points);
});

test('missing bars break the line and require the full strength warmup again',()=>{
  const bars=fixture(1250);bars.splice(650,1);
  const result=bodyReversalHistory(bars,new Map(),{now:bars.at(-1).t+STEP});
  assert.ok(result.points.some(p=>p.time*1000<bars[650].t));
  assert.ok(!result.points.some(p=>p.time*1000>=bars[650].t&&p.time*1000<bars[650+506].t));
  const before=result.points.findLast(p=>p.time*1000<bars[650].t),after=result.points.find(p=>p.time*1000>bars[650].t);
  assert.ok(after&&after.segment!==before.segment);
});

test('no bounded solution stays missing; live wick changes reuse locked history',()=>{
  assert.equal(solveBodyReversal(createBodyState(),fixture(1)[0],1,{maxDistance:1}),null);
  const bars=fixture(717),now=bars.at(-1).t+STEP/2,cache=bodyReversalCache();
  const first=cache.get(bars,new Map(),{now,adaptive:false});
  assert.ok(first.preview);
  const changed=bars.map((b,i)=>i===bars.length-1?{...b,h:b.h+.02,l:b.l-.02}:b);
  const updated=cache.get(changed,new Map(),{now,adaptive:false});
  assert.equal(updated.points,first.points);
  assert.ok(updated.preview);
  assert.equal(updated.preview.anchor,first.preview.anchor+(first.preview.direction<0?.02:-.02));
  assert.ok(Math.abs(updated.preview.value-first.preview.value-(first.preview.direction<0?.02:-.02))<1e-6);
  assert.deepEqual(updated,bodyReversalHistory(changed,new Map(),{now,adaptive:false}));
});

test('red anchors at High and green at Low even when the price body has the opposite direction',()=>{
  const bars=fixture(),snapshot=createBodyState();
  for(const b of bars)advanceBodyState(snapshot.raw,snapshot.pools,b);
  const bar={...bars.at(-1),h:690,l:650};
  for(const direction of [-1,1]){
    const result=solveBodyReversal(snapshot,bar,direction,{maxDistance:40});assert.ok(result);
    assert.equal(result.anchor,direction<0?690:650);
    assert.equal(result.reference,direction<0?'high':'low');
    assert.ok(direction<0?result.value>=690:result.value<=650);
  }
});

test('live direction follows the same current H1 preview as candle coloring',()=>{
  const bars=fixture(717),now=bars.at(-1).t+STEP/2,states=statesFor(bars);
  const live=bars.at(-1),blockStart=Math.floor(live.t/3600000)*3600000;
  states.set(live.t,{t:live.t,blockStart,blockEnd:blockStart+3600000-1,direction:1,quality:.9,preview:true});
  const actual=h1AdaptiveVolumeRows(bars,states,{step:STEP,now}).at(-1);
  const result=bodyReversalHistory(bars,states,{now,adaptive:true});
  assert.ok(result.preview);assert.equal(result.preview.direction,Math.sign(actual.adjusted));
  assert.equal(result.preview.knownAt,now);assert.equal(result.preview.preview,true);
  const extreme=result.preview.direction<0?live.h:live.l;
  assert.equal(result.preview.anchor,extreme);
});

test('live updates never double count impulses; at close the point locks once',()=>{
  const bars=fixture(717),last=bars.at(-1),cache=bodyReversalCache(),states=new Map();
  const before=cache.get(bars,states,{now:last.t+STEP/4,adaptive:false});
  cache.get(bars.map((b,i)=>i===bars.length-1?{...b,c:b.c+.3,h:b.h+.3}:b),states,{now:last.t+STEP/2,adaptive:false});
  const restored=cache.get(bars,states,{now:last.t+STEP*3/4,adaptive:false});
  assert.equal(restored.points,before.points);closeEnough(restored.preview.value,before.preview.value);
  const locked=cache.get(bars,states,{now:last.t+STEP,adaptive:false});
  assert.equal(locked.preview,null);assert.equal(locked.points.filter(p=>p.time===last.t/1000).length,1);
  assert.equal(locked.last.preview,false);closeEnough(locked.last.value,before.preview.value);
  assert.deepEqual(locked,bodyReversalHistory(bars,states,{now:last.t+STEP,adaptive:false}));
});

test('wick reference does not add a fictitious gap to the genuine reversal distance',()=>{
  const bars=fixture(703),snapshot=createBodyState();let reading;
  for(const b of bars)reading=advanceBodyState(snapshot.raw,snapshot.pools,b);
  const bar=bars.at(-1),direction=Math.sign(reading.adjusted);
  const before=solveBodyReversal(snapshot,bar,direction,{maxDistance:2});
  const after=solveBodyReversal(snapshot,{...bar,h:bar.h+.03,l:bar.l-.03},direction,{maxDistance:2});
  assert.ok(before&&after);assert.equal(before.start,bar.c);
  assert.ok(Math.abs(before.value-after.value)<1e-6);
  assert.ok(Math.abs(before.value-bar.c-before.distance*-direction)<1e-8);
});

test('all displayed thresholds stay within the causal two-bar budget and 3 ATR',()=>{
  const bars=fixture(),states=statesFor(bars);
  for(const adaptive of [false,true]){
    const result=bodyReversalHistory(bars,states,{now:bars.at(-1).t+STEP/2,adaptive});
    assert.ok(result.points.length>10);
    for(const p of [...result.points,...(result.preview?[result.preview]:[])]){
      assert.ok(p.distance<=p.moveLimit+1e-8);
      assert.ok(p.distance<=3*p.atr+1e-8);
      assert.ok(p.second*p.direction<0); // no price clipping that invents a reversal
    }
  }
});

test('no plausible two-bar reversal is left missing instead of clamped to a nearby price',()=>{
  const bars=fixture(),result=bodyReversalHistory(bars,new Map(),{now:bars.at(-1).t+STEP});
  assert.equal(result.last,null);
  assert.ok(!result.points.some(p=>p.time===bars.at(-1).t/1000));
  const s=createBodyState();for(const b of bars)advanceBodyState(s.raw,s.pools,b);
  const bar=bars.at(-1);
  assert.equal(solveBodyReversal(s,{...bar,h:bar.c+2},-1,{maxDistance:.5}),null);
  assert.equal(solveBodyReversal(s,{...bar,l:bar.c-2},1,{maxDistance:.5}),null);
});
