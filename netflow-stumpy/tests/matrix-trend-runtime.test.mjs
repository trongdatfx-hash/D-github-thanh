import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {matrixTrendText} from '../matrix-trend-status.mjs';
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
test('status renderer works without old probability fields and hides on other symbols',()=>{
 const app=read('app.mjs'),start=app.indexOf('function updateGeometryReadout('),end=app.indexOf('\nfunction ',start+1),host={style:{},dataset:{}},controls={symbol:{value:'SPYUSDT'},interval:{value:'15m'},'geometry-readout':host};
 const ctx={matrixTrendText,serverOffsetMs:0,matrixTrendState:{phase:'SUPPORTED',direction:1,score:3,oiText:'OI thiếu'},$:id=>controls[id],requestAnimationFrame:()=>{},updateH1TrendAgeReadout(){},positionForecastReadout(){}};
 vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);ctx.updateGeometryReadout();assert.equal(host.hidden,false);assert.ok(host.textContent.includes('Được ủng hộ'));assert.ok(!host.textContent.includes('%'));assert.equal(host.dataset.forecastStatus,'CHUA_DU_MAU');
 controls.symbol.value='QQQUSDT';ctx.updateGeometryReadout();assert.equal(host.style.display,'none');
});
test('real M15 pipeline preserves H1/weekday outputs without old age predictions',()=>{
 const fixture=n=>JSON.parse(readFileSync(new URL('../../netflow-ml/tests/fixtures/'+n,import.meta.url),'utf8').replace(/^\uFEFF/,'')),now=fixture('time.json').serverTime;
 const raw={SPYUSDT:parseKlines(fixture('SPYUSDT.json'),now,STEPS['15m']),QQQUSDT:parseKlines(fixture('QQQUSDT.json'),now,STEPS['15m'])},trend=analyzeTrendSource(raw,now);
 const r=computeStudies({rows:trend.rows,volumeRows:trend.volume,symbol:'SPYUSDT',interval:'15m',now,trend,options:{minScore:55,maxLines:4,matrixGeometry:false}});
 assert.equal(r.rev63,undefined);assert.equal(r.trendAgeHistory,undefined);assert.ok(r.h1CandleColors.length>0);assert.ok(r.h1H4CandleColors.length>0);assert.equal(r.weekly.cells.length,7);assert.equal(r.weekly.continuation,undefined);
 assert.ok(r.h1CandleColors.every(c=>Number.isFinite(c.blockStart)&&[-1,0,1].includes(c.direction)));
});
