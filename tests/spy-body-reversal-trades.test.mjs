import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestReversalTrades,summarizeReversalTrades,reversalEntryAllowed} from '../netflow-stumpy/spy-body-reversal-trades.mjs';
const STEP=900000,T=Date.UTC(2026,10,10,14);
const bar=(i,o=100,h=102,l=99.5,c=101)=>({t:T+i*STEP,o,h,l,c});
const line=(i,value,direction,extra={})=>({time:(T+i*STEP)/1000,value,direction,knownAt:T+(i+1)*STEP,preview:false,...extra});
const rows=signs=>signs.map((adjusted,i)=>({t:T+i*STEP,adjusted}));
function run({bars=[bar(0),bar(1,100,102,98,101),bar(2),bar(3,102,103,101,102)],signs=[-1,1,1,1],points=[line(1,99,1),line(2,100.5,1)],...options}={}){
  return backtestReversalTrades({bars,bodyRows:rows(signs),points,now:T+bars.length*STEP,...options});
}

test('BUY enters after the flip, locks first SL and exits next open after second same-phase point',()=>{
  const r=run();assert.equal(r.trades.length,1);const t=r.trades[0];
  assert.equal(t.entryTime,T+2*STEP);assert.equal(t.entry,100);assert.equal(t.stop,99);
  assert.equal(t.reason,'TP_SIGNAL');assert.equal(t.exit,102);assert.equal(t.secondLine,100.5);
  assert.equal(t.netR,2);assert.equal(r.summary.winRate,100);
});
test('SELL mirrors BUY; TP line price is never assumed filled',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,99),bar(2,100,100.5,98,99),bar(3,98,99,97,98)],signs:[1,-1,-1,-1],points:[line(1,101,-1),line(2,99.5,-1)]});
  assert.equal(r.trades[0].direction,-1);assert.equal(r.trades[0].netR,2);assert.equal(r.trades[0].exit,98);
});
test('SL touched before second line becomes known takes precedence over TP',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2,100,102,98.5,101),bar(3,110,111,109,110)]});
  assert.equal(r.trades[0].reason,'SL');assert.equal(r.trades[0].exit,99);assert.equal(r.summary.netR,-1);
});
test('gap through SL fills at worse open even with a queued TP signal',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2),bar(3,98,99,97,98)]});
  assert.equal(r.trades[0].reason,'SL_GAP');assert.equal(r.trades[0].exit,98);assert.equal(r.summary.netR,-2);
});
test('opposite-color point and same-color point in a NEW phase cannot count as TP',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2),bar(3),bar(4)],signs:[-1,1,-1,1,1],points:[line(1,99,1),line(2,103,-1),line(3,99.2,1),line(4,99.3,1)]});
  assert.equal(r.trades.length,0);assert.ok(r.open);assert.equal(r.open.tpExpired,true);assert.equal(r.open.stop,99);
});
test('missing first SL skips the flip and does not invent a later entry',()=>{
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
  assert.ok(Math.abs(t.costPoints-.0999)<1e-9);assert.ok(Math.abs(t.netR+.2999)<1e-9);
});
test('entry open on wrong side of fixed SL is skipped',()=>{
  const r=run({bars:[bar(0),bar(1,100,102,98,101),bar(2,98,102,97,101),bar(3)]});
  assert.equal(r.trades.length,0);assert.equal(r.skipped.invalidStop,1);
});
test('future bars and future preview points cannot change an as-of result',()=>{
  const bars=[bar(0),bar(1,100,102,98,101),bar(2),bar(3,102,110,80,81)],now=T+2*STEP+STEP/2;
  const full=run({bars,now}),prefix=run({bars:bars.slice(0,3),now});assert.deepEqual(full,prefix);
  assert.equal(full.trades.length,0);assert.ok(full.open);
});

test('profit factor and drawdown use the same 1R-per-trade risk convention as total R',()=>{
  const r=summarizeReversalTrades([
    {netPoints:1,grossPoints:1,netR:2,heldBars:1,reason:'TP_SIGNAL'},
    {netPoints:-2,grossPoints:-2,netR:-1,heldBars:1,reason:'SL'}
  ]);
  assert.equal(r.profitFactor,2);assert.equal(r.profitFactorPoints,.5);assert.equal(r.netR,1);assert.equal(r.drawdownR,1);
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
  return {bars,bodyRows,points,now:bars.at(-1).t+STEP};
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

test('existing trades may still take TP or SL after POST ends',()=>{
  const clock='2026-11-19T19:45:00-05:00';
  const tp=backtestReversalTrades(shiftedScenario(clock));
  assert.equal(tp.trades.length,1);assert.equal(tp.trades[0].reason,'TP_SIGNAL');
  assert.equal(tp.trades[0].exitTime,Date.parse('2026-11-19T20:00:00-05:00'));
  const sl=backtestReversalTrades(shiftedScenario(clock,{stopAfterClose:true}));
  assert.equal(sl.trades[0].reason,'SL');assert.equal(sl.trades[0].exitTime,Date.parse('2026-11-19T20:00:00-05:00'));
});

test('entering the clock window does not replay an earlier NIGHT flip',()=>{
  const start=Date.parse('2026-11-19T03:15:00-05:00');
  const bars=Array.from({length:5},(_,i)=>({...bar(i),t:start+i*STEP}));
  const bodyRows=[-1,1,1,1,1].map((adjusted,i)=>({t:bars[i].t,adjusted}));
  const points=bars.slice(1).map(b=>({time:b.t/1000,value:99,direction:1,knownAt:b.t+STEP}));
  const r=backtestReversalTrades({bars,bodyRows,points,now:bars.at(-1).t+STEP});
  assert.equal(r.trades.length,0);assert.equal(r.open,null);assert.equal(r.signals,1);assert.equal(r.skipped.outsideSession,1);
});
