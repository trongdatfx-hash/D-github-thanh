import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {m15FlowWindow,describeM15Flow} from '../m15-flow-status.mjs';
import {computeStudies,analyzeTrendSource} from '../studies-core.mjs';
import {parseKlines,STEPS} from '../engine.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('main/worker no longer calculate or display the retired age predictor',()=>{
 const app=read('app.mjs'),core=read('studies-core.mjs');
 for(const code of [app,core])for(const token of ['pre-rth-wlr-trend.mjs','preRthWlrTrend(','historicalTrendAgeStates(','rev63State','Kaplan','TREND CÒN'])assert.ok(!code.includes(token),token);
 assert.ok(!app.includes('candle-trend-age-color'));assert.ok(app.includes('matrixTrendStatus(h1ScoreRecords'));assert.ok(core.includes('buildWeeklyDailyPackets('));assert.ok(core.includes('onH1Ready(h1CandleColors,h1H4CandleColors)'));
 for(const html of [read('index.html'),readFileSync(new URL('../../index.html',import.meta.url),'utf8')]){assert.ok(!html.includes('trend-cohort-card'));assert.ok(!html.includes('Kaplan'));}
 assert.ok(readFileSync(new URL('../../index.html',import.meta.url),'utf8').includes('weekly-days'));
});
test('M15 status renders closed group, opens details and hides on other charts',()=>{
 const app=read('app.mjs'),start=app.indexOf('function updateMatrixFlowReadout('),end=app.indexOf('\nfunction ',start+1);
 const step=STEPS['15m'],hour=4*step,from=hour*100,cutoff=from+3*step;
 const bars=Array.from({length:4},(_,i)=>({t:from+i*step,end:from+(i+1)*step-1,o:100+i,h:101+i,l:100+i,c:101+i,q:100,buy:70}));
 const host={dataset:{}},controls={symbol:{value:'SPYUSDT'},interval:{value:'15m'},'geometry-readout':host};
 const ctx={
   describeM15Flow,matrixFlowWindow:m15FlowWindow(bars,cutoff),matrixTrendState:null,
   usesH1WlrStyle:()=>controls.symbol.value==='SPYUSDT'&&controls.interval.value==='15m',
   getH1MatrixOptions:()=>({size:3}),oiStamp:'15m',oiWidths:new Map(),oiReceipts:new Map(),largeTakerEnabled:()=>false,
   chartLiveResponse:false,Date:{now:()=>cutoff},$:id=>controls[id],
   requestAnimationFrame:()=>{},positionForecastReadout(){},showMatrixFlowDetails(){}
 };
 vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);
 ctx.updateMatrixFlowReadout();
 assert.equal(host.hidden,false);
 assert.equal(host.textContent,'M15 3/4 · ↑ Tăng có lực mua · OI chờ');
 assert.equal(host.onclick,ctx.showMatrixFlowDetails);
 assert.equal(host.dataset.state,'SUPPORTED');
 controls.interval.value='1h';ctx.updateMatrixFlowReadout();assert.equal(host.hidden,true);
 controls.interval.value='15m';controls.symbol.value='QQQUSDT';ctx.updateMatrixFlowReadout();assert.equal(host.hidden,true);
});
test('real M15 pipeline preserves H1/weekday outputs without old age predictions',()=>{
 const fixture=n=>JSON.parse(readFileSync(new URL('../../netflow-ml/tests/fixtures/'+n,import.meta.url),'utf8').replace(/^\uFEFF/,'')),now=fixture('time.json').serverTime;
 const raw={SPYUSDT:parseKlines(fixture('SPYUSDT.json'),now,STEPS['15m']),QQQUSDT:parseKlines(fixture('QQQUSDT.json'),now,STEPS['15m'])},trend=analyzeTrendSource(raw,now);
 const r=computeStudies({rows:trend.rows,volumeRows:trend.volume,symbol:'SPYUSDT',interval:'15m',now,trend,options:{minScore:55,maxLines:4,matrixGeometry:false}});
 assert.equal(r.rev63,undefined);assert.equal(r.trendAgeHistory,undefined);assert.ok(r.h1CandleColors.length>0);assert.ok(r.h1H4CandleColors.length>0);assert.equal(r.weekly.cells.length,7);assert.equal(r.weekly.continuation,undefined);
 assert.ok(r.h1CandleColors.every(c=>Number.isFinite(c.blockStart)&&[-1,0,1].includes(c.direction)));
});
