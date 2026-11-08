import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {compositeNfSmooth} from '../composite-nf-smooth.mjs';
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8'),M=900000;
function fixture(){
 const bars=n=>Array.from({length:560},(_,i)=>({t:i*M,q:100,buy:50+n/2}));
 const controls={'nf-smooth-toggle':{checked:true},'nf-smooth-window':{value:'4'},symbol:{value:'SPYUSDT'},interval:{value:'15m'},chart:{dataset:{}},'nf-smooth-readout':{style:{}}};
 const writes=[];const ctx={Map,Number,Date,Math,compositeNfSmooth,cache:{SPYUSDT:bars(-10),QQQUSDT:bars(30),serverTime:560*M},series:{nfSmooth:{}},seriesContext:'test',nfSmoothRows:[],nfSmoothMap:new Map(),inspectedTime:null,$:id=>controls[id],signed:x=>(x>0?'+':'')+x.toFixed(2),paneBounds:()=>({top:100}),writeSeries:(...args)=>writes.push(args)};
 vm.createContext(ctx);vm.runInContext(source.match(/const nfSmoothEnabled=[^\n]+/)[0],ctx);
 const start=source.indexOf('  const nfOn=nfSmoothEnabled()'),end=source.indexOf("  writeSeries('confirmedDelta'",start),code=source.slice(start,end);
 const readStart=source.indexOf('function updateNfSmoothReadout('),readEnd=source.indexOf('\nfunction showTooltip',readStart);vm.runInContext(source.slice(readStart,readEnd),ctx);
 return {controls,ctx,writes,run:()=>vm.runInContext('{'+code+'}',ctx)};
}
test('actual chart wiring uses true NF and isolated 4/8 series with a zero-centered scale',()=>{
 const f=fixture();f.run();const out=f.writes.at(-1);assert.equal(out[0],'nfSmooth');assert.ok(out[2].at(-1).value>0);assert.equal(f.controls.chart.dataset.nfSmoothSource,'SPY+QQQ_TAKER_QUOTE');
 f.controls['nf-smooth-window'].value='8';f.run();assert.ok(f.writes.at(-1)[3].endsWith('c-nf-8'));assert.equal(f.ctx.nfSmoothRows.at(-1).strLen,8);
 const setup=source.slice(source.indexOf('series.nfSmooth=chart.addSeries'),source.indexOf("  const nfReadout="));assert.ok(setup.includes('minValue:-1,maxValue:1'));assert.ok(setup.includes("},1)"));
});
test('disabling or switching away clears the new series without changing original data',()=>{
 const f=fixture(),snapshot=structuredClone(f.ctx.cache);f.run();f.controls['nf-smooth-toggle'].checked=false;f.run();assert.equal(f.writes.at(-1)[2].length,0);assert.equal(f.controls.chart.dataset.nfSmoothMode,'off');
 f.controls['nf-smooth-toggle'].checked=true;f.controls.interval.value='1h';f.run();assert.equal(f.writes.at(-1)[2].length,0);assert.deepEqual(f.ctx.cache,snapshot);assert.ok(f.writes.every(x=>x[0]==='nfSmooth'));
});
test('readout distinguishes closed strength, missing pair and the forming candle',()=>{
 const f=fixture();f.ctx.cache.serverTime=559*M+1000;f.run();f.ctx.updateNfSmoothReadout(null);assert.ok(f.controls['nf-smooth-readout'].textContent.includes('+'));assert.equal(f.controls['nf-smooth-readout'].style.top,'146px');
 f.ctx.updateNfSmoothReadout(559*M);assert.ok(f.controls['nf-smooth-readout'].textContent.includes('chờ đóng'));
 f.ctx.cache.QQQUSDT=f.ctx.cache.QQQUSDT.filter(x=>x.t!==558*M);f.run();f.ctx.updateNfSmoothReadout(null);assert.ok(f.controls['nf-smooth-readout'].textContent.includes('chờ nền'));
 f.controls['nf-smooth-toggle'].checked=false;f.ctx.updateNfSmoothReadout(null);assert.equal(f.controls['nf-smooth-readout'].style.display,'none');
});
test('new controls are restored and saved with chart setup, before first render',()=>{
 const ids=source.match(/const SETUP_CONTROL_IDS=([^;]+);/)[1];assert.ok(ids.includes("'nf-smooth-toggle'"));assert.ok(ids.includes("'nf-smooth-window'"));
 assert.ok(source.indexOf("nfInput.id='nf-smooth-toggle'")<source.indexOf('  restoreSavedSetup();syncChartFrameButtons();'));
 assert.ok(source.includes("$('confirmed-delta-toggle').onchange=toggle"));assert.ok(source.includes("writeSeries('COMPOSITE',series.COMPOSITE,flowData(rows.COMPOSITE??[],'COMPOSITE')"));
});
