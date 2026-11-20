import test from 'node:test';
import assert from 'node:assert/strict';
import {reversalTrendReadings} from '../netflow-stumpy/spy-body-reversal-trend.mjs';
import {backtestReversalTrades} from '../netflow-stumpy/spy-body-reversal-trades.mjs';
const STEP=900000,T=Date.UTC(2026,10,10,12);
function scenario(direction=-1){
  const close=i=>200+direction*(i*.15+i*i*.001);
  const bars=Array.from({length:36},(_,i)=>{const o=close(i-1),c=close(i);return {t:T+i*STEP,o,c,h:Math.max(o,c)+.1,l:Math.min(o,c)-.1};});
  const bodyRows=bars.map((b,i)=>({t:b.t,adjusted:i<20?-direction*.3:direction*(i===20?.1:.3)}));
  const point=i=>({time:bars[i].t/1000,value:bars[i].c-direction,knownAt:bars[i].t+STEP,direction});
  return {bars,bodyRows,points:[point(20),point(25)],now:T+36*STEP,trendFilter:true};
}
test('BUY and SELL wait for closed strength confirmation and enter next open; TP still waits four entry bars',()=>{
  for(const d of [-1,1]){
    const input=scenario(d),r=backtestReversalTrades(input),t=r.trades[0];
    assert.equal(r.trades.length,1);assert.equal(t.direction,d);assert.equal(t.flipTime,T+20*STEP);
    assert.equal(t.signalTime,T+21*STEP);assert.equal(t.entryTime,T+22*STEP);assert.equal(t.firstLineTime,T+20*STEP);
    assert.equal(t.reason,'TP_SIGNAL');assert.equal(t.heldBars,4);assert.equal('stop' in t,false);
  }
});
test('a live confirmation cannot enter; the same signal enters only at the next observed open',()=>{
  const input=scenario();
  const live=backtestReversalTrades({...input,now:T+21.5*STEP});
  assert.equal(live.open,null);assert.equal(live.pending,null);assert.ok(live.watching);
  const closed=backtestReversalTrades({...input,now:T+22*STEP});
  assert.equal(closed.open.entryTime,T+22*STEP);
});
test('weak setups expire after three additional candles and cannot chase later strengthening',()=>{
  const input=scenario();input.bodyRows=input.bodyRows.map((r,i)=>i>=20&&i<25?{...r,adjusted:-.05}:r);
  const r=backtestReversalTrades(input);
  assert.equal(r.trades.length,0);assert.equal(r.open,null);assert.equal(r.watching,null);assert.equal(r.skipped.weakTrend,1);
});
test('WLR against the SPY sign blocks a countertrend entry',()=>{
  const input=scenario(1);input.bodyRows=input.bodyRows.map((r,i)=>({...r,adjusted:-r.adjusted}));input.points=input.points.map(p=>({...p,direction:-1}));
  const r=backtestReversalTrades(input);assert.equal(r.trades.length,0);assert.equal(r.open,null);
});
test('opposite closed sign cancels setup; missing readings cannot confirm it',()=>{
  for(const value of [.3,null]){
    const input=scenario();input.bodyRows[21].adjusted=value;
    const r=backtestReversalTrades({...input,now:T+24*STEP});assert.equal(r.open,null);assert.equal(r.pending,null);
  }
});
test('future candles cannot alter a prefix result or trend reading',()=>{
  const input=scenario(),now=T+23.5*STEP;
  assert.deepEqual(backtestReversalTrades({...input,now}),backtestReversalTrades({...input,bars:input.bars.slice(0,24),bodyRows:input.bodyRows.slice(0,24),now}));
  const full=reversalTrendReadings(input.bars,input.bodyRows),short=reversalTrendReadings(input.bars.slice(0,24),input.bodyRows.slice(0,24));
  assert.deepEqual(full.get(T+23*STEP),short.get(T+23*STEP));
});
test('missing candles reset ATR warmup and cannot carry a confirmation across the gap',()=>{
  const input=scenario();input.bars.splice(21,1);
  const r=backtestReversalTrades({...input,now:T+25*STEP});assert.equal(r.open,null);assert.equal(r.pending,null);assert.equal(r.watching,null);
});
test('strength that is fading cannot qualify even while price and WLR agree',()=>{
  const input=scenario();input.bodyRows[20].adjusted=-.5;input.bodyRows[21].adjusted=-.3;
  const read=reversalTrendReadings(input.bars,input.bodyRows).get(T+21*STEP);
  assert.equal(read.wlrAligned,true);assert.equal(read.ready,false);
});
