import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GEX_STORAGE_KEY,readGexState,writeGexState} from './gex-storage.mjs';
import {CHART_SETUP_KEY,readChartSetup} from './chart-setup-state.mjs';
const raw='S:12|L:7000,ZG,ZERO GAMMA|P:6990,-2,-1;7010,4,1';
const snapshot=(extra={})=>({text:raw,draft:raw,mapping:{mode:'BASIS',basis:12,scale:10},enabled:true,loadedAt:100,...extra});
function memory(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}
test('auto-save embeds complete GEX in setup and preserves existing TK V2 and controls',()=>{
 const s=memory(),old={version:1,controls:{symbol:'SPYUSDT','gex-spectrum-toggle':false},tkV2:{roundTripBps:4},timeRange:{from:1,to:2}};
 s.setItem(CHART_SETUP_KEY,JSON.stringify(old));const result=writeGexState(s,snapshot());assert.ok(result.local&&result.setup);
 const setup=readChartSetup(s);assert.equal(setup.gex.text,raw);assert.deepEqual(setup.tkV2,old.tkV2);assert.deepEqual(setup.timeRange,old.timeRange);assert.equal(setup.controls['gex-spectrum-toggle'],true);assert.equal(setup.gex.mapping.basis,12);
});
test('restores from setup when standalone storage is missing or corrupt',()=>{
 const s=memory();writeGexState(s,snapshot());s.values.delete(GEX_STORAGE_KEY);assert.equal(readGexState(s).text,raw);
 s.setItem(GEX_STORAGE_KEY,'broken');assert.equal(readGexState(s).text,raw);
});
test('newest snapshot wins and newer clear does not resurrect older saved data',()=>{
 const s=memory();s.setItem(GEX_STORAGE_KEY,JSON.stringify({...snapshot(),savedAt:100}));s.setItem(CHART_SETUP_KEY,JSON.stringify({version:1,controls:{},gex:{...snapshot({enabled:false}),savedAt:200}}));assert.equal(readGexState(s).enabled,false);
 s.setItem(GEX_STORAGE_KEY,JSON.stringify({...snapshot({text:'',draft:''}),savedAt:300}));assert.equal(readGexState(s).text,'');
});
test('legacy raw snapshots migrate and invalid applied data does not hide a valid backup',()=>{
 const s=memory();s.setItem(GEX_STORAGE_KEY,JSON.stringify({text:raw,basis:12,scale:'10',enabled:true,loadedAt:1}));assert.equal(readGexState(s).text,raw);
 writeGexState(s,snapshot());s.setItem(GEX_STORAGE_KEY,JSON.stringify({...snapshot({text:'broken'}),savedAt:1e20}));assert.equal(readGexState(s).text,raw);
});
test('reports partial or denied writes without falsely confirming both copies',()=>{
 const s=memory(),partial={getItem:s.getItem,setItem(k,v){if(k===CHART_SETUP_KEY)throw Error('quota');s.setItem(k,v);}};
 const result=writeGexState(partial,snapshot());assert.equal(result.local,true);assert.equal(result.setup,false);
 const denied={getItem:()=>null,setItem(){throw Error('denied');}},none=writeGexState(denied,snapshot());assert.equal(none.local,false);assert.equal(none.setup,false);
 const silent={getItem:()=>null,setItem(){}},noWrite=writeGexState(silent,snapshot());assert.equal(noWrite.local,false);assert.equal(noWrite.setup,false);
});
test('actual chart Save setup writes raw GEX and calibration, not just checkbox',()=>{
 const app=readFileSync(new URL('./app.mjs',import.meta.url),'utf8'),start=app.indexOf('function saveChartSetup(){'),end=app.indexOf('function resetStudies(){',start),s=memory(),button={};
 const gex={...snapshot(),version:2,savedAt:1};
 const sandbox={gexLayer:{saveSetup:()=>gex},daoV2Stats:null,SETUP_CONTROL_IDS:['symbol'],SETUP_STORAGE_KEY:CHART_SETUP_KEY,localStorage:s,readChartSetup:()=>readChartSetup(s),chart:{timeScale:()=>({getVisibleRange:()=>({from:10,to:20})})},$:id=>id==='chart-save'?button:{type:'select-one',value:'SPYUSDT'},clearTimeout(){},setTimeout:()=>1,saveSetupTimer:null};
 vm.runInNewContext(app.slice(start,end)+';saveChartSetup();',sandbox);
 const setup=readChartSetup(s);assert.equal(setup.gex.text,raw);assert.equal(setup.gex.mapping.basis,12);assert.equal(setup.controls.symbol,'SPYUSDT');assert.equal(button.textContent,'✓ Đã lưu');
});
