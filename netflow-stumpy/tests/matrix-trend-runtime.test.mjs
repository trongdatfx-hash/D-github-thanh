import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {matrixOi8Reading} from '../matrix-oi8-reading.mjs';
import {m15FlowWindow,describeM15Flow} from '../m15-flow-status.mjs';
import {computeStudies,analyzeTrendSource} from '../studies-core.mjs';
import {parseKlines,STEPS} from '../engine.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('main/worker no longer calculate or display the retired age predictor',()=>{
 const app=read('app.mjs'),core=read('studies-core.mjs');
 for(const code of [app,core])for(const token of ['pre-rth-wlr-trend.mjs','preRthWlrTrend(','historicalTrendAgeStates(','rev63State','Kaplan','TREND CÒN'])assert.ok(!code.includes(token),token);
 assert.ok(!app.includes('candle-trend-age-color'));assert.ok(app.includes('m15FlowWindow(p,cache.serverTime)'));assert.ok(core.includes('buildWeeklyDailyPackets('));assert.ok(core.includes('onH1Ready(h1CandleColors,h1H4CandleColors)'));
 for(const html of [read('index.html'),readFileSync(new URL('../../index.html',import.meta.url),'utf8')]){assert.ok(!html.includes('trend-cohort-card'));assert.ok(!html.includes('Kaplan'));}
 assert.ok(readFileSync(new URL('../../index.html',import.meta.url),'utf8').includes('weekly-days'));
});
test('M15 status renders closed group, opens details and hides on other charts',()=>{
 const app=read('app.mjs'),start=app.indexOf('function updateMatrixFlowReadout('),end=app.indexOf('\nfunction ',start+1);
 const step=STEPS['15m'],hour=4*step,from=hour*100,cutoff=from+3*step;
 const bars=Array.from({length:3},(_,i)=>({t:from+i*step,end:from+(i+1)*step-1,o:100+i,h:101+i,l:100+i,c:101+i,q:100,buy:70}));
 const el=()=>({dataset:{},children:[],append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}});
 const host=el(),controls={symbol:{value:'SPYUSDT'},interval:{value:'15m'},'geometry-readout':host};
 const ctx={
   updateH1MatrixOi8:()=>null,describeM15Flow,matrixFlowWindow:m15FlowWindow(bars,cutoff),matrixLiveOi:null,
   usesH1WlrStyle:()=>controls.symbol.value==='SPYUSDT'&&controls.interval.value==='15m',
   oiStamp:'15m',oiWidths:new Map(),oiReceipts:new Map(),largeTakerLoader:{book:{windowP95(){return null;}}},
   chartLiveResponse:false,Date:{now:()=>cutoff},$:id=>controls[id],
   document:{createElement:el},scheduleForecastReadout(){},showMatrixFlowDetails(){}
 };
 const helpers=app.slice(app.indexOf('let matrixTakerShare='),app.indexOf('\nfunction matrixFlowDetails('));
 vm.createContext(ctx);vm.runInContext(helpers+app.slice(start,end),ctx);
 ctx.updateMatrixFlowReadout();
 assert.equal(host.hidden,false);
 assert.equal(host.children.length,2);
 assert.equal(host.children[0].textContent,'M15 3/4 · Chờ OI');
 assert.deepEqual(host.children[1].children.filter(x=>typeof x!=='string').map(x=>x.dataset.metric),['buy','sell','threshold','price-oi']);
 assert.equal(host.children[1].children[0].textContent,'M 70%');
 assert.equal(host.onclick,ctx.showMatrixFlowDetails);
 assert.equal(host.dataset.state,'WAIT');
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

test('matrix OI8 votes for each closed candle positioning state',()=>{
 const step=STEPS['15m'], now=6*step;
 const types={openLong:[1,.4],openShort:[-1,.4],closeLong:[-1,-.4],closeShort:[1,-.4],neutral:[1,0],unclear:[0,.4]};
 const top=new Map(Array.from({length:7},(_,i)=>[i*step,.5+i*.001]));
 const read=(kinds,{positions=new Map(),window=4,gap=false}={})=>{
   const rows=[...kinds,'openShort'].map((kind,i)=>{
     const [dir,value]=types[kind],t=(i+(gap&&i>=4?1:0))*step;
     return {t,o:100,c:100+dir,buy:dir===-1?30:70,q:100,value};
   });
   return matrixOi8Reading(rows,rows.map(b=>({time:b.t/1000,value:b.value})),now,positions,{window});
 };
 const sample=(main,minor='unclear')=>['neutral','neutral',main,main,minor,main];
 for(const key of ['openLong','openShort','closeLong','closeShort','neutral']){
   assert.equal(read(sample(key)).state,key);
   assert.equal(read(sample(key)).votes[key],3);
 }
 const mixed=['neutral','neutral','openLong','openShort','openLong','openShort'];
 assert.equal(read(mixed).state,'mixed');
 assert.equal(read(sample('openLong'),{positions:top}).topTraderContext,'Top Trader cùng hướng');
 assert.equal(read(sample('openShort'),{positions:top}).topTraderContext,'Lệch Top Trader');
 assert.equal(read(sample('closeShort')).topTraderContext,'Chờ Top Trader');
 assert.equal(read(sample('openLong'),{gap:true}).state,'wait');
 assert.equal(read(['unclear',...Array(5).fill('closeLong')],{window:6}).label,'Nghi đóng Long 5/6');
});
