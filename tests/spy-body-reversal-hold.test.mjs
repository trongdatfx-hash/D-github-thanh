import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestReversalTrades} from '../netflow-stumpy/spy-body-reversal-trades.mjs';
const STEP=900000,T=Date.UTC(2026,10,10,10);
function scenario(direction=-1){
  const close=i=>200+direction*(i*.15+i*i*.001);
  const bars=Array.from({length:36},(_,i)=>{const o=close(i-1),c=close(i);return {t:T+i*STEP,o,c,h:Math.max(o,c)+.1,l:Math.min(o,c)-.1};});
  const bodyRows=bars.map((b,i)=>({t:b.t,adjusted:i<20||i>=30?-direction*.3:direction*(i===20?.1:.3)}));
  const point=i=>({time:bars[i].t/1000,value:bars[i].c-direction,knownAt:bars[i].t+STEP,direction});
  return {bars,bodyRows,points:[point(20),point(25)],now:T+36*STEP,trendFilter:true,holdStrongTrend:true};
}
test('BUY and SELL hold the eligible second V2 point until a closed sign flip; next-open fill',()=>{
  for(const direction of [-1,1]){
    const input=scenario(direction),r=backtestReversalTrades(input),t=r.trades[0];
    assert.equal(t.entryTime,T+22*STEP);
    assert.equal(t.deferredTpTime,T+25*STEP);
    assert.equal(t.exitTime,T+31*STEP);assert.equal(t.reason,'SPY_FLIP');
    assert.equal(t.exit,input.bars[31].o);
    const old=backtestReversalTrades({...input,holdStrongTrend:false}).trades[0];
    assert.equal(old.exitTime,T+26*STEP);assert.equal(old.reason,'TP_SIGNAL');
  }
});
test('weakened price/WLR alignment releases held V2 without needing another point',()=>{
  const input=scenario();input.bars[27]={...input.bars[27],c:205,h:206};
  const t=backtestReversalTrades(input).trades[0];
  assert.equal(t.reason,'TP_SIGNAL');assert.equal(t.tpSignalTime,T+29*STEP);
  assert.equal(t.exitTime,T+30*STEP);assert.equal(t.deferredTpTime,T+25*STEP);
});
test('a live weakening candle cannot release a held exit',()=>{
  const input=scenario();input.bars[27]={...input.bars[27],c:205,h:206};
  const r=backtestReversalTrades({...input,now:T+29.5*STEP});
  assert.equal(r.trades.length,0);assert.equal(r.open.holdingTrend,true);assert.equal(r.open.tpDue,null);
});
test('early second V2 still waits for sign flip and does not use hold-release',()=>{
  const input=scenario();input.points[1]={...input.points[1],time:(T+23*STEP)/1000,knownAt:T+24*STEP};
  input.bars[27]={...input.bars[27],c:205,h:206};
  const t=backtestReversalTrades(input).trades[0];
  assert.equal(t.reason,'SPY_FLIP');assert.equal(t.deferredTpTime,null);assert.equal(t.waitForFlip,true);
});
test('unknown body data cannot produce synthetic weakness TP',()=>{
  const input=scenario();input.bodyRows[27].adjusted=null;
  const t=backtestReversalTrades(input).trades[0];
  assert.equal(t.reason,'SPY_FLIP');assert.equal(t.exitTime,T+31*STEP);
});
test('data gap censors a held position instead of fabricating an exit',()=>{
  const input=scenario();input.bars.splice(27,1);
  const r=backtestReversalTrades(input);assert.equal(r.trades.length,0);assert.equal(r.censored[0].reason,'DATA_GAP');
});
test('future values cannot change a live prefix result',()=>{
  const input=scenario(),now=T+27.5*STEP;
  assert.deepEqual(backtestReversalTrades({...input,now}),backtestReversalTrades({...input,bars:input.bars.slice(0,28),bodyRows:input.bodyRows.slice(0,28),now}));
});
test('hold option is independent of entry filter and validates its type',()=>{
  const input=scenario();
  const r=backtestReversalTrades({...input,trendFilter:false});
  assert.equal(r.trades[0].entryTime,T+21*STEP);assert.equal(r.trades[0].exitTime,T+31*STEP);
  assert.throws(()=>backtestReversalTrades({...input,holdStrongTrend:'yes'}));
});
