import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spyBars,hybridSpy,loadSpy,SPY_SCHEMA} from '../spy-data.mjs';
import {weightedPriceBands,projectNetFlowToPrice} from '../engine.mjs';
import {analyzeTrendSource,computeStudies} from '../studies-core.mjs';
const t=Date.UTC(2026,9,20,14),bar=(i,c=600+i)=>({t:t+i*300000,o:c-1,h:c+1,l:c-2,c,v:100+i});
const doc=bars=>({schema:SPY_SCHEMA,symbol:'SPY',fetchedAt:t,bars});
test('SPY aggregates actual OHLCV by UTC and keeps PRE/POST session metadata',()=>{
 const bars=spyBars(doc([bar(2),bar(0),bar(1)]),'15m',t+900000,7);
 assert.equal(bars.length,1);assert.deepEqual([bars[0].o,bars[0].h,bars[0].l,bars[0].c,bars[0].v],[599,603,598,602,303]);assert.equal(bars[0].session,'RTH');
});
test('SPY omits incomplete closed aggregates, rejects invalid prices and duplicate timestamps',()=>{
 assert.equal(spyBars(doc([bar(0),bar(2)]),'15m',t+900000,7).length,0);
 assert.equal(spyBars(doc([bar(0),bar(0),bar(1),bar(2)]),'15m',t+900000,7)[0].v,303);
 assert.equal(spyBars(doc([{...bar(0),l:1000},bar(1),bar(2)]),'15m',t+900000,7).length,0);
 assert.equal(spyBars(doc([bar(0)]),'15m',t+1,7).length,1);
 assert.throws(()=>spyBars({...doc([]),symbol:'SPYUSDT'},'15m'));
});
test('hybrid retains ETF prices/volume and matches Binance flow only at exact timestamp',()=>{
 const p=[bar(0),bar(1)],f=[{t:t,c:9999,v:50000,q:1000,buy:650,sell:350,net:300,nf:30}];
 const h=hybridSpy(p,f);assert.equal(h[0].c,600);assert.equal(h[0].v,100);assert.equal(h[0].net,300);assert.equal(h[1].net,null);assert.equal(h[1].priceSource,'SPY ETF / Yahoo Finance');
 const projected=projectNetFlowToPrice(h,f);assert.equal(projected.length,1);assert.equal(projected[0].c,600);
});
test('SPY WLR follows ETF price, never the perpetual price',()=>{
 const p=Array.from({length:55},(_,i)=>bar(i)),h=hybridSpy(p,p.map(b=>({...b,c:b.c+10000,q:100,buy:70,sell:30,net:40,nf:40})));
 const a=weightedPriceBands(h,300000),b=weightedPriceBands(p,300000);assert.deepEqual(a,b);assert.ok(a.at(-1).mid<1000);
});
test('SPY source loader fails closed on a missing provider snapshot',async()=>{
 await assert.rejects(loadSpy('15m',7,{now:t,get:async()=>({ok:false,status:404})}),/SPY.*404/);
});
test('SPY studies use ETF price for geometry, WLR and trend, with Binance strengths',()=>{
 const spy=Array.from({length:100},(_,i)=>({...bar(i,600+i*.1),t:t+i*900000,end:t+(i+1)*900000-1,q:100,buy:70,sell:30,net:40,nf:40,session:'RTH',day:'2026-10-20'}));
 const raw={SPYUSDT:spy.map(b=>({...b,c:b.c+100})),QQQUSDT:spy,SPY:spy};
 const now=spy.at(-1).end+1,trend=analyzeTrendSource(raw,now);assert.equal(trend.rows.SPY[0].c,600);
 const result=computeStudies({rows:trend.rows,volumeRows:trend.volume,symbol:'SPY',interval:'15m',options:{},now,trend});
 assert.equal(result.abaRows.length,100);assert.equal(result.abaRows[0].c,600);
});
test('SPY and SPYUSDT forecast state is isolated across source changes',async()=>{
 const ui=await readFile(new URL('../wlr-aba-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/c\.symbol!==activeSymbol/);assert.match(ui,/worker\?\.terminate\(\)/);assert.match(ui,/pre0:v2:'\+activeSymbol/);
 const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');assert.match(app,/\$\('symbol'\)\.onchange=.*refresh\(true\)/);assert.match(app,/pivotFlowRealtime\(pivotZoneState.flow,selectedPrice\(\)/);
});
