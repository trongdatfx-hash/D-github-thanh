import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestReversalTrades} from '../netflow-stumpy/spy-body-reversal-trades.mjs';
import {reversalTradeDisplay,reversalTradePrimitive} from '../netflow-stumpy/spy-body-reversal-display.mjs';
const STEP=900000,T=Date.UTC(2026,10,19,15);
function scenario(count=9){
 const bars=Array.from({length:count},(_,i)=>({t:T+i*STEP,o:100+i,c:100.5+i,h:101+i,l:99+i}));
 return {bars,bodyRows:bars.map((b,i)=>({t:b.t,adjusted:i<1?.2:i<6?-.2:.2})),points:[{time:(T+STEP)/1000,value:101,direction:-1,knownAt:T+2*STEP}],now:T+count*STEP};
}
test('markers use actual next-open fills and never signal candle times or V2 threshold prices',()=>{
 const input=scenario(),report=backtestReversalTrades(input),d=reversalTradeDisplay(report);
 assert.equal(report.trades.length,1);
 assert.deepEqual(d.events.map(e=>[e.kind,e.time,e.value]),[['entry',(T+2*STEP)/1000,102],['exit',(T+7*STEP)/1000,107]]);
 assert.equal(d.latest.reason,'SPY_FLIP');assert.equal(d.status,'Đứng ngoài');
});
test('open and queued exits remain open; no fabricated exit marker before next bar exists',()=>{
 const report=backtestReversalTrades(scenario(7)),d=reversalTradeDisplay(report);
 assert.equal(d.events.length,1);assert.equal(d.events[0].kind,'entry');
 assert.equal(d.position.pendingReason,'SPY_FLIP');assert.equal(d.status,'Chờ thoát · đổi dấu');
});
test('a live color flip cannot add an exit or waiting exit status',()=>{
 const input=scenario(7);input.now=T+6*STEP+1000;
 const d=reversalTradeDisplay(backtestReversalTrades(input));
 assert.equal(d.events.length,1);assert.equal(d.status,'Đang giữ lệnh');
});
test('pending setups are statuses without fill markers, gaps have entry but no invented exit',()=>{
 const pending=reversalTradeDisplay(backtestReversalTrades(scenario(2)));
 assert.equal(pending.status,'Chờ vào SELL');assert.equal(pending.events.length,0);
 const input=scenario();input.bars=input.bars.filter((_,i)=>i!==4);
 const d=reversalTradeDisplay(backtestReversalTrades(input));
 assert.equal(d.events.length,1);assert.equal(d.events[0].kind,'entry');assert.match(d.status,/gián đoạn/);
});
test('clearing context clears all markers and distinguishes strong hold and early TP',()=>{
 assert.deepEqual(reversalTradeDisplay(null).events,[]);
 const report=backtestReversalTrades(scenario(5));report.open.holdingTrend=true;
 assert.equal(reversalTradeDisplay(report).status,'Giữ trend khỏe');
 report.open.waitForFlip=true;assert.equal(reversalTradeDisplay(report).status,'Giữ lệnh · chờ đổi dấu');
});
test('chart primitive shares fills and redraws when disabled or cleared',()=>{
 let attached;const chart={timeScale:()=>({timeToCoordinate:t=>t})},price={attachPrimitive:p=>attached=p,priceToCoordinate:x=>x};
 const layer=reversalTradePrimitive(chart,price);assert.ok(attached);
 layer.setData(backtestReversalTrades(scenario()));layer.setData(null,false);
});
