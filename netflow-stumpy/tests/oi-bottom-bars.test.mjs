import test from 'node:test';
import assert from 'node:assert/strict';
import {oiBottomBars,mountOiBottomBars} from '../oi-bottom-bars.mjs';
import {CHART_SETUP_KEY} from '../chart-setup-state.mjs';
const step=60000,bars=[1,2,3,4].map(i=>({t:i*step,end:(i+1)*step-1}));
const oi=new Map([[0,{oi:100}],[step,{oi:125}],[2*step,{oi:110}],[3*step,{oi:110}],[4*step,{oi:140}]]);
test('all consecutive closed OI changes plot as magnitudes; colors follow OI rather than candle direction',()=>{
 const before=JSON.stringify([...oi]),data=oiBottomBars(bars,oi,step,240000);
 assert.deepEqual(data.map(p=>p.value),[25,15,0,undefined]);
 assert.match(data[0].color,/38,211,154/);assert.match(data[1].color,/246,96,125/);
 assert.equal(JSON.stringify([...oi]),before);assert.deepEqual(data.map(p=>p.time),[60,120,180,240]);
});
test('missing periods stay blank; future/current candles and invalid OI are not extrapolated',()=>{
 const gap=new Map(oi);gap.delete(step);const data=oiBottomBars(bars,gap,step,240000);
 assert.equal(data[0].value,undefined);assert.equal(data[1].value,undefined);assert.equal(data[2].value,0);
 gap.set(3*step,{oi:NaN});assert.equal(oiBottomBars(bars,gap,step,240000)[2].value,undefined);
 assert.deepEqual(oiBottomBars(bars,oi,0,240000),[]);
});
test('pane 0 overlay has its own scale; toggle clears/restores data, persists and cannot mix SPY OI into QQQ',()=>{
 const originals={document:globalThis.document,localStorage:globalThis.localStorage};const storage=new Map();let mounted,options={},scale={},writes=[];
 class Element{constructor(){this.children=[];this.handlers={};this.dataset={};}append(...n){this.children.push(...n);}addEventListener(e,fn){this.handlers[e]=fn;}setAttribute(k,v){this[k]=v;}}
 globalThis.document={createElement:()=>new Element()};globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const saved={version:1,controls:{symbol:'SPYUSDT','dao-v2-toggle':false},tkV2:{showTrades:true},timeRange:{from:1,to:2}};storage.set(CHART_SETUP_KEY,JSON.stringify(saved));
 const series={priceScale:()=>({applyOptions:o=>{scale=o;}}),applyOptions:o=>Object.assign(options,o)};
 const chart={addSeries:(type,o,pane)=>{mounted={type,o,pane};return series;}};const actions=new Element(),host=new Element();
 try{
  const layer=mountOiBottomBars({chart,actions,host,L:{HistogramSeries:'histogram'},writeSeries:(id,s,data)=>writes.push(data)});
  layer.update({bars,oiByTime:oi,step,now:240000,symbol:'SPYUSDT',interval:'1m',oiInterval:'1m'});
  assert.equal(mounted.pane,0);assert.equal(mounted.o.priceScaleId,'oi-bottom-overlay');assert.equal(scale.bottom??scale.scaleMargins.bottom,0);assert.ok(scale.scaleMargins.top>=.8);
  assert.equal(host.dataset.oiBottomState,'ready');assert.equal(options.visible,true);assert.equal(writes.at(-1)[0].value,25);
  layer.button.handlers.click();assert.equal(options.visible,false);assert.deepEqual(writes.at(-1),[]);
  const stored=JSON.parse(storage.get(CHART_SETUP_KEY));assert.equal(stored.controls['oi-bottom-toggle'],false);assert.equal(stored.controls['dao-v2-toggle'],false);assert.deepEqual(stored.tkV2,saved.tkV2);assert.deepEqual(stored.timeRange,saved.timeRange);
  layer.button.handlers.click();assert.equal(writes.at(-1)[0].value,25);
  layer.update({bars,oiByTime:oi,step,now:240000,symbol:'QQQUSDT',interval:'1m',oiInterval:'1m'});assert.deepEqual(writes.at(-1),[]);assert.equal(options.visible,false);
  layer.update({bars,oiByTime:oi,step,now:240000,symbol:'SPYUSDT',interval:'5m',oiInterval:'1m'});assert.deepEqual(writes.at(-1),[]);
  storage.set(CHART_SETUP_KEY,JSON.stringify({...saved,controls:{'oi-bottom-toggle':false}}));const next=mountOiBottomBars({chart,actions,host,L:{HistogramSeries:'histogram'},writeSeries:()=>{}});assert.equal(next.input.checked,false);
 }finally{for(const [k,v] of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
