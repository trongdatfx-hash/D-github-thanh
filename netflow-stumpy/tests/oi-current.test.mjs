import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CurrentOiLoader,RunningOiState} from '../oi-current.mjs';
const row={t:900000,end:1799999},flow={t:900000,net:250};
test('running OI and CVD before close, without candle confirmation',()=>{
 const s=new RunningOiState().read({oi:102,time:910000},[{timestamp:900000,sumOpenInterest:100}],row,flow,912000,{chartFresh:true});
 assert.equal(s.pct,2);assert.equal(s.cvd,250);assert.equal(s.stale,false);assert.equal(s.partial,false);
});
test('missing boundary uses fixed observed baseline and labels partial',()=>{
 const state=new RunningOiState();
 assert.equal(state.read({oi:100,time:910000},[],row,flow,912000).partial,true);
 assert.equal(state.read({oi:101,time:915000},[],row,flow,916000).pct,1);
 assert.equal(state.read({oi:101,time:915000},[{timestamp:900000,sumOpenInterest:99}],row,flow,916000).partial,false);
});
test('new candle resets partial baseline; cannot carry prior sample into new candle',()=>{
 const state=new RunningOiState();state.read({oi:100,time:910000},[],row,flow,912000);
 const next={t:1800000,end:2699999};
 assert.equal(state.read({oi:100,time:910000},[],next,flow,1801000).ready,false);
 assert.equal(state.read({oi:110,time:1801000},[],next,flow,1802000).pct,0);
});
test('stale OI retained and delayed/mismatched CVD cannot claim current flow',()=>{
 const state=new RunningOiState(),s=state.read({oi:102,time:910000},[{timestamp:900000,sumOpenInterest:100}],row,flow,930000);
 assert.equal(s.ready,true);assert.equal(s.stale,true);assert.equal(s.flowFresh,false);
 assert.equal(state.read({oi:102,time:910000},[],row,{t:0,net:99},912000,{chartFresh:true}).cvd,null);
 assert.equal(state.read({oi:102,time:910000},[],row,flow,1800000).ready,false);
});
test('poll is deduplicated, throttled, and errors retain last sample with backoff',async()=>{
 let now=910000,calls=0,fail=false;
 const loader=new CurrentOiLoader({now:()=>now,get:async()=>{calls++;if(fail)throw Error('offline');return {symbol:'SPYUSDT',openInterest:'100',time:now};}});
 const a=loader.start(),b=loader.start();assert.equal(a,b);await a;
 await loader.start();assert.equal(calls,1);
 now+=3000;await loader.start();assert.equal(calls,2);
 const last=loader.sample;now+=3000;fail=true;await loader.start();
 assert.equal(loader.sample,last);assert(loader.error);now+=3000;await loader.start();assert.equal(calls,3);
 now+=3000;fail=false;await loader.start();assert.equal(calls,4);assert.equal(loader.error,null);
});
for(const [label,value] of [['wrong symbol',{symbol:'QQQUSDT',openInterest:100,time:910000}],['stale',{symbol:'SPYUSDT',openInterest:100,time:890000}],['invalid',{symbol:'SPYUSDT',openInterest:0,time:910000}],['future',{symbol:'SPYUSDT',openInterest:100,time:920000}]]){
 test('reject '+label+' OI',async()=>{
  const loader=new CurrentOiLoader({now:()=>910000,get:async()=>value});await loader.start();assert.equal(loader.sample,null);assert(loader.error);
 });
}
test('reject out of order responses',async()=>{
 let now=910000,time=910000;const loader=new CurrentOiLoader({now:()=>now,get:async()=>({symbol:'SPYUSDT',openInterest:100,time})});
 await loader.start();now+=3000;time--;await loader.start();assert.equal(loader.sample.time,910000);assert(loader.error);
});
test('badge updates running state despite WAIT confirmation and reports source age',()=>{
 const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function updateSpectrumBadge(currentPrice){'),source.indexOf('\nfunction inspectSpectrum'));
 class El{constructor(){this.dataset={};}replaceChildren(...children){this.children=children;}setAttribute(){}}
 const badge=new El(),sample={oi:102,time:910000};
 const group={ready:true,cvd:100,netOi:5,count:2,state:'buy-oi-increase',low:1,high:2,opened:5,closed:0,grossOi:5,levels:3};
 const sandbox={$:id=>id==='oi-price-group-badge'?badge:id==='symbol'?{value:'SPYUSDT'}:id==='interval'?{value:'15m'}:{checked:true},
 document:{createElement:()=>new El()},spectrumPriceGroup:()=>group,spectrumComparison:{rows:[],count:2,day:'test'},
 confirmSpectrumGroup:()=>({state:'WAIT',count:0,share:0,support:0}),oiBarState:{points:new Map()},rows:{SPYUSDT:[row],COMPOSITE:[flow]},oiAppliedSamples:[{timestamp:900000,sumOpenInterest:100}],currentOiLoader:{sample},cvdBadgeBorder:{update:input=>{sandbox.borderInput=input;return 'sell';}},flowPriceReaction:{update:()=>({ready:true,state:'absorption',label:'BÁN HẤP THỤ'})},STEPS:{'15m':900000},cache:{serverTime:912000},runningOiState:new RunningOiState(),isChartLive:()=>true,serverOffsetMs:0,Date:{now:()=>912000},Intl,requestAnimationFrame:()=>{},positionForecastReadout(){},fmtK:String,signed:String,fmt:String};
 vm.runInNewContext(code+';updateSpectrumBadge(1);',sandbox);
 assert.equal(badge.children.length,3);assert.match(badge.children[0].textContent,/MUA CĐ.*BÁN HẤP THỤ/);assert.equal(badge.dataset.priceReaction,'absorption');assert.equal(badge.dataset.borderState,'sell');assert.match(badge.children[0].textContent,/MUA CĐ.*OI ↑/);assert.match(badge.children[1].textContent,/2.00%/);assert.match(badge.children[2].textContent,/2s/);assert.equal(badge.dataset.currentOi,'running');
 sandbox.currentOiLoader.sample=null;vm.runInNewContext('updateSpectrumBadge(1)',sandbox);assert.equal(sandbox.borderInput.fresh,true,'OI missing does not alter CVD border freshness');assert.equal(sandbox.borderInput.cvd,250);
 sandbox.currentOiLoader.sample=sample;sandbox.Date.now=()=>930000;vm.runInNewContext('updateSpectrumBadge(1)',sandbox);assert.match(badge.children[2].textContent,/CŨ/);
});
