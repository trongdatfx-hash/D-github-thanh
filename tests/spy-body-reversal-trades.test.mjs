import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestReversalTrades,summarizeReversalTrades,reversalEntryAllowed} from '../netflow-stumpy/spy-body-reversal-trades.mjs';
const STEP=900000,T=Date.UTC(2026,10,10,14);
const bar=(i,o=100,h=102,l=99.5,c=101)=>({t:T+i*STEP,o,h,l,c});
const line=(i,value,direction,extra={})=>({time:(T+i*STEP)/1000,value,direction,knownAt:T+(i+1)*STEP,preview:false,...extra});
const rows=signs=>signs.map((adjusted,i)=>({t:T+i*STEP,adjusted}));
function run({bars=[bar(0),bar(1,100,102,98,101),bar(2),bar(3,102,103,101,102)],signs=[-1,1,1,1],points=[line(1,99,1),line(2,100.5,1)],...options}={}){
  // Isolate execution/session regressions from the configurable hold guard.
  return backtestReversalTrades({bars,bodyRows:rows(signs),points,now:T+bars.length*STEP,minHoldBars:0,...options});
}

test('BUY enters after the flip, records first V2 level and exits next open after second same-phase point',()=>{
  const r=run();assert.equal(r.trades.length,1);const t=r.trades[0];
  assert.equal(t.entryTime,T+2*STEP);assert.equal(t.entry,100);assert.equal(t.firstLine,99);
  assert.equal(t.reason,'TP_SIGNAL');assert.equal(t.exit,102);assert.equal(t.secondLine,100.5);
  assert.equal(t.netPoints,2);assert.equal(r.summary.winRate,100);
});
test('SELL mirrors BUY; TP line price is never assumed filled',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,99),bar(2,100,100.5,98,99),bar(3,98,99,97,98)],signs:[1,-1,-1,-1],points:[line(1,101,-1),line(2,99.5,-1)]});
  assert.equal(r.trades[0].direction,-1);assert.equal(r.trades[0].netPoints,2);assert.equal(r.trades[0].exit,98);
});
test('crossing first V2 level intrabar does not stop a trade',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2,100,102,98.5,101),bar(3,110,111,109,110)]});
  assert.equal(r.trades[0].reason,'TP_SIGNAL');assert.equal(r.trades[0].exit,110);assert.equal(r.summary.netPoints,10);
});
test('gap past first V2 level still executes queued signal exit at observed open',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2),bar(3,98,99,97,98)]});
  assert.equal(r.trades[0].reason,'TP_SIGNAL');assert.equal(r.trades[0].exit,98);assert.equal(r.summary.netPoints,-2);
});
test('opposite color closes by SPY flip, never as same-phase TP',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2),bar(3),bar(4)],signs:[-1,1,-1,1,1],points:[line(1,99,1),line(2,103,-1),line(3,99.2,1),line(4,99.3,1)]});
  assert.equal(r.trades.length,1);assert.equal(r.trades[0].reason,'SPY_FLIP');assert.equal(r.trades[0].firstLine,99);assert.equal(r.summary.flip,1);
});
test('missing first V2 level skips the flip and does not invent a later entry',()=>{
  const r=run({points:[line(2,99,1)]});assert.equal(r.trades.length,0);assert.equal(r.open,null);assert.equal(r.skipped.noFirstLine,1);
});
test('live preview and unobserved future knownAt never create TP',()=>{
  for(const extra of [{preview:true},{knownAt:T+10*STEP}]){
    const r=run({points:[line(1,99,1),line(2,100.5,1,extra)]});assert.equal(r.trades.length,0);assert.ok(r.open);assert.equal(r.open.tpDue,null);
  }
});
test('live candle open may execute a known TP; its evolving high/low cannot affect closed results',()=>{
  const input={bars:[bar(0),bar(1,100,102,98,101),bar(2),bar(3,102,110,80,81)],now:T+3*STEP+STEP/2};
  const r=run(input);assert.equal(r.trades[0].reason,'TP_SIGNAL');assert.equal(r.trades[0].exit,102);assert.equal(r.closedBars,3);
  const pending=run({...input,points:[line(1,99,1)]});assert.equal(pending.trades.length,0);assert.ok(pending.open);
});
test('data gaps do not create favorable SL fills or TP fills',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2),bar(5)],now:T+6*STEP});
  assert.equal(r.trades.length,0);assert.equal(r.censored.length,1);assert.equal(r.censored[0].reason,'DATA_GAP');
});
test('TP event is not automatically a winning trade; fee scenarios reduce net PnL',()=>{
  const bars=[bar(0),bar(1,100,102,98,101),bar(2),bar(3,99.8,101,99.5,100)];
  const r=run({bars,roundTripBps:10});const t=r.trades[0];
  assert.equal(t.reason,'TP_SIGNAL');assert.equal(r.summary.wins,0);assert.equal(r.summary.losses,1);
  assert.ok(Math.abs(t.costPoints-.0999)<1e-9);assert.ok(Math.abs(t.netPoints+.2999)<1e-9);
});
test('entry remains eligible when open crosses the first V2 level',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2,98,102,97,101),bar(3)]});
  assert.equal(r.trades.length,1);assert.equal(r.trades[0].entry,98);assert.equal(r.trades[0].reason,'TP_SIGNAL');
});
test('future bars and future preview points cannot change an as-of result',()=>{
  const bars=[bar(0),bar(1,100,102,98,101),bar(2),bar(3,102,110,80,81)],now=T+2*STEP+STEP/2;
  const full=run({bars,now}),prefix=run({bars:bars.slice(0,3),now});assert.deepEqual(full,prefix);
  assert.equal(full.trades.length,0);assert.ok(full.open);
});

test('profit factor and drawdown use net points without a stop-risk denominator',()=>{
  const r=summarizeReversalTrades([
    {netPoints:1,grossPoints:1,heldBars:1,reason:'TP_SIGNAL'},
    {netPoints:-2,grossPoints:-2,heldBars:1,reason:'SPY_FLIP'}
  ]);
  assert.equal(r.profitFactor,.5);assert.equal(r.netPoints,-1);assert.equal(r.drawdownPoints,2);
  assert.equal(r.meanPoints,-.5);
});

test('PRE through POST uses New York 04:00 inclusive and 20:00 exclusive in winter and summer',()=>{
  for(const [day,offset] of [['2026-11-19','-05:00'],['2026-07-10','-04:00']]){
    for(const [clock,expected] of [['03:59:59',false],['04:00:00',true],['09:30:00',true],['16:00:00',true],['19:59:59',true],['20:00:00',false]]){
      assert.equal(reversalEntryAllowed(Date.parse(day+'T'+clock+offset)),expected,day+' '+clock);
    }
  }
  assert.equal(reversalEntryAllowed(Date.parse('2026-11-19T08:30:00Z')),false);
  assert.equal(reversalEntryAllowed(Date.parse('2026-07-10T08:30:00Z')),true);
});

test('weekends are excluded even inside the New York clock window',()=>{
  assert.equal(reversalEntryAllowed(Date.parse('2026-11-21T12:00:00-05:00')),false);
  assert.equal(reversalEntryAllowed(Date.parse('2026-11-22T12:00:00-05:00')),false);
});

function shiftedScenario(entryClock,{stopAfterClose=false}={}){
  const entry=Date.parse(entryClock),start=entry-2*STEP;
  const bars=[bar(0),bar(1,100,102,98,101),bar(2),stopAfterClose?bar(3,100,101,98,100):bar(3,102,103,101,102)].map((b,i)=>({...b,t:start+i*STEP,session:'PRE'}));
  const bodyRows=[-1,1,1,1].map((adjusted,i)=>({t:bars[i].t,adjusted}));
  const points=(stopAfterClose?[line(1,99,1)]:[line(1,99,1),line(2,100.5,1)]).map((p,i)=>({...p,time:bars[i+1].t/1000,knownAt:bars[i+1].t+STEP}));
  return {bars,bodyRows,points,now:bars.at(-1).t+STEP,minHoldBars:0};
}

test('a signal confirmed exactly at PRE open can enter at 04:00 NY',()=>{
  const r=backtestReversalTrades(shiftedScenario('2026-11-19T04:00:00-05:00'));
  assert.equal(r.trades.length,1);assert.equal(r.trades[0].entryTime,Date.parse('2026-11-19T04:00:00-05:00'));
});

test('entry at POST end or NIGHT is excluded by timestamp, ignoring misleading session labels',()=>{
  for(const clock of ['2026-11-19T20:00:00-05:00','2026-11-19T02:00:00-05:00']){
    const input=shiftedScenario(clock),r=backtestReversalTrades(input);
    assert.equal(r.trades.length,0);assert.equal(r.open,null);assert.equal(r.skipped.outsideSession,1);
    assert.equal(backtestReversalTrades({...input,entryWindow:'ALL'}).trades.length,1);
  }
});

test('existing trades may take TP after POST ends; price crossing alone leaves them open',()=>{
  const clock='2026-11-19T19:45:00-05:00';
  const tp=backtestReversalTrades(shiftedScenario(clock));
  assert.equal(tp.trades.length,1);assert.equal(tp.trades[0].reason,'TP_SIGNAL');
  assert.equal(tp.trades[0].exitTime,Date.parse('2026-11-19T20:00:00-05:00'));
  const sl=backtestReversalTrades(shiftedScenario(clock,{stopAfterClose:true}));
  assert.equal(sl.trades.length,0);assert.ok(sl.open);
});

test('entering the clock window does not replay an earlier NIGHT flip',()=>{
  const start=Date.parse('2026-11-19T03:15:00-05:00');
  const bars=Array.from({length:5},(_,i)=>({...bar(i),t:start+i*STEP}));
  const bodyRows=[-1,1,1,1,1].map((adjusted,i)=>({t:bars[i].t,adjusted}));
  const points=bars.slice(1).map(b=>({time:b.t/1000,value:99,direction:1,knownAt:b.t+STEP}));
  const r=backtestReversalTrades({bars,bodyRows,points,now:bars.at(-1).t+STEP});
  assert.equal(r.trades.length,0);assert.equal(r.open,null);assert.equal(r.signals,1);assert.equal(r.skipped.outsideSession,1);
});

function holdingScenario({secondAt=5,flipAt=null,direction=1}={}){
  const bars=Array.from({length:8},(_,i)=>direction>0?bar(i):bar(i,100,100.5,98,99));
  bars[1]=direction>0?bar(1,100,102,98,101):bar(1,100,102,98,99);
  const signs=bars.map((_,i)=>i===0?-direction:flipAt!==null&&i>=flipAt?-direction:direction);
  const stop=direction>0?99:101;
  const points=[line(1,stop,direction)];
  if(secondAt!==null)points.push(line(secondAt,direction>0?100.5:99.5,direction));
  return {bars,bodyRows:rows(signs),points,now:T+bars.length*STEP};
}

test('default TP minimum is exactly four completed M15 candles from ENTRY, not from signal',()=>{
  for(const direction of [1,-1]){
    const input=holdingScenario({direction});
    input.bars[6]=direction>0?bar(6,102,103,101,102):bar(6,98,99,97,98);
    const before=backtestReversalTrades({...input,now:T+5*STEP+STEP/2});
    assert.equal(before.trades.length,0);assert.ok(before.open);
    const r=backtestReversalTrades(input),t=r.trades[0];
    assert.equal(r.minHoldBars,4);assert.equal(t.reason,'TP_SIGNAL');assert.equal(t.heldBars,4);
    assert.equal(t.entryTime,T+2*STEP);assert.equal(t.exitTime,T+6*STEP);assert.equal(t.netPoints,2);
  }
});

test('a second point before four bars switches permanently to waiting for SPY flip',()=>{
  const input=holdingScenario({secondAt:4,flipAt:6});
  input.points.push(line(5,100.7,1)); // now four bars, but the early-TP fallback stays latched
  const waiting=backtestReversalTrades({...input,now:T+5*STEP});
  assert.equal(waiting.trades.length,0);assert.equal(waiting.open.waitForFlip,true);assert.equal(waiting.open.earlyTpHeldBars,3);
  const r=backtestReversalTrades(input);
  assert.equal(r.trades[0].reason,'SPY_FLIP');assert.equal(r.trades[0].exitTime,T+7*STEP);
  assert.equal(r.summary.tp,0);assert.equal(r.summary.flip,1);
});

test('early TP without a subsequent SPY flip stays open even after the minimum elapses',()=>{
  const input=holdingScenario({secondAt:2});input.points.push(line(5,100.7,1));
  const r=backtestReversalTrades(input);
  assert.equal(r.trades.length,0);assert.equal(r.open.waitForFlip,true);assert.equal(r.open.firstLine,99);
});

test('a confirmed SPY flip may close before four candles and does not require a V2 point',()=>{
  for(const secondAt of [2,null]){
    const input=holdingScenario({secondAt,flipAt:3});
    const r=backtestReversalTrades(input),t=r.trades[0];
    assert.equal(t.reason,'SPY_FLIP');assert.equal(t.exitTime,T+4*STEP);assert.equal(t.heldBars,2);
  }
});

test('a changing live SPY sign cannot close a position until that candle is confirmed',()=>{
  const input=holdingScenario({secondAt:2,flipAt:3});
  const live=backtestReversalTrades({...input,now:T+3*STEP+STEP/2});
  assert.equal(live.trades.length,0);assert.ok(live.open);assert.equal(live.open.tpDue,null);
  const confirmed=backtestReversalTrades({...input,now:T+4*STEP});
  assert.equal(confirmed.trades[0].reason,'SPY_FLIP');
});

test('crossing first line before four bars or while waiting cannot stop the position',()=>{
  for(const stopAt of [2,3]){
    const input=holdingScenario({secondAt:2,flipAt:3});input.bars[stopAt]=bar(stopAt,100,102,98.5,101);
    const r=backtestReversalTrades(input);
    assert.equal(r.trades[0].reason,'SPY_FLIP');assert.equal(r.trades[0].exitTime,T+4*STEP);assert.equal(r.trades[0].exit,100);
  }
});

test('a gap past first line executes queued flip exit without a stop reason',()=>{
  const input=holdingScenario({secondAt:2,flipAt:3});input.bars[4]=bar(4,98,99,97,98);
  const r=backtestReversalTrades(input);
  assert.equal(r.trades[0].reason,'SPY_FLIP');assert.equal(r.trades[0].exit,98);
});

test('flip exits remain active after POST while new entries remain filtered',()=>{
  const input=holdingScenario({secondAt:2,flipAt:4}),entry=Date.parse('2026-11-19T19:45:00-05:00'),delta=entry-(T+2*STEP);
  input.bars=input.bars.map(b=>({...b,t:b.t+delta}));input.bodyRows=input.bodyRows.map(r=>({...r,t:r.t+delta}));
  input.points=input.points.map(p=>({...p,time:p.time+delta/1000,knownAt:p.knownAt+delta}));input.now+=delta;
  const r=backtestReversalTrades(input);
  assert.equal(r.trades[0].reason,'SPY_FLIP');assert.equal(r.trades[0].exitTime,entry+3*STEP);
});

test('first level on either side of entry is a reference, never an SL entry gate',()=>{
  for(const firstLine of [98,100,103]){
    const r=run({points:[line(1,firstLine,1),line(2,100.5,1)]});
    assert.equal(r.trades.length,1);assert.equal(r.trades[0].firstLine,firstLine);
    assert.equal(r.trades[0].reason,'TP_SIGNAL');assert.equal(r.trades[0].netPoints,2);
    assert.equal('stop' in r.trades[0],false);assert.equal('risk' in r.trades[0],false);
  }
});
