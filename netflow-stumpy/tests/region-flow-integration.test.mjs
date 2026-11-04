import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {regionFlow,regionFlowLabel,drawRegionFlow,regionFlowDescription} from '../region-flow.mjs';
import {pivotFlowLayout,pivotFlowZeroCoordinate} from '../pivot-flow-layout.mjs';

for(const folder of ['netflow-ml'])test(folder+': ứng dụng vẽ, tắt và giữ OI thiếu đúng nguồn',()=>{
 const app=fs.readFileSync(new URL('../../'+folder+'/app.mjs',import.meta.url),'utf8');
 const code=app.slice(app.indexOf('function pivotFlowRealtime('),app.indexOf('\nfunction positionForecastReadout()'));
 const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const canvas={dataset:{},getContext:()=>ctx,setAttribute(){}};
 const elements={chart:{clientWidth:390,clientHeight:600,dataset:{},closest:()=>({after:node=>elements[node.id]=node})},'pivot-flow-overlay':canvas,'pivot-zones':{checked:true},symbol:{value:'SPYUSDT'},interval:{value:'15m'},'market-symbol':{value:'XAUUSDT'},'oi-delta-percentile':{value:'.62'}};
 const sandbox={regionFlow,drawRegionFlow,regionFlowDescription,pivotFlowLayout,pivotFlowZeroCoordinate,basePivotFlowRealtime:()=>({live:true}),$:id=>elements[id],document:{createElement:()=>({})},STEPS:{'15m':900000},oiWidths:new Map(),oiLayer:{getOiByTime:()=>new Map()},pivotZoneState:{support:null,resistance:null},pivotFlowState:null,chart:{panes:()=>[{getHeight:()=>300}],priceScale:()=>({width:()=>58}),timeScale:()=>({options:()=>({barSpacing:6})})},price:{priceToCoordinate:x=>x},isChartLive:()=>false,lastSuccess:new Date(),fmt:x=>String(x),window:{devicePixelRatio:1},Date,Number,Math,Map};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 const prices=[{t:0,end:899999,o:100,h:101,l:99,c:100,q:100,net:40},{t:900000,end:1799999,o:100,h:101,l:99,c:100,q:100,net:40}];
 sandbox.pivotFlowState=sandbox.pivotFlowRealtime(null,prices,prices,2700000);
 sandbox.drawPivotFlowOverlay();assert.equal(canvas.dataset.status,'visible');assert.equal(canvas.dataset.oiState,'missing');assert.equal(canvas.dataset.live,'false');
 assert.match(elements['region-flow-readout'].textContent,/OI THIẾU/);assert.equal(elements['region-flow-readout'].hidden,false);
 elements['pivot-zones'].checked=false;sandbox.drawPivotFlowOverlay();assert.equal(canvas.dataset.status,'hidden');assert.equal(elements['region-flow-readout'].hidden,true);assert.equal(elements.chart.dataset.regionFlow,undefined);
});

test('DVP bỏ nhãn lực vùng và giữ trạng thái CVD cũ',()=>{
 const app=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(!html.includes('id="pivot-flow-overlay"'));assert(!app.includes('region-flow-badge'));assert(!app.includes('regionFlow('));assert(!app.includes('region-flow.mjs'));
 const code=app.slice(app.indexOf('function updateSpectrumBadge('),app.indexOf('\nfunction inspectSpectrum('));
 const badge={dataset:{},replaceChildren(...children){this.children=children;}},elements={'oi-price-group-badge':badge,'oi-spectrum-toggle':{checked:true},symbol:{value:'SPYUSDT'}};
 const sandbox={$:id=>elements[id],document:{createElement:()=>({})},spectrumComparison:{stale:true,binStep:.5,day:'2026-11-04'},spectrumPriceGroup:()=>({low:99.75,high:101.25,cvd:-500,netOi:-20,ready:true,state:'sell-oi-decrease',levels:3,opened:0,closed:20,grossOi:20}),confirmSpectrumGroup:()=>({state:'WAIT',count:0}),rows:{SPYUSDT:[]},oiBarState:{points:new Map()},fmt:String,fmtK:String,signed:String,isChartLive:()=>false,requestAnimationFrame:()=>{},positionForecastReadout:()=>{}};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);sandbox.updateSpectrumBadge(100);
 const text=badge.children.map(x=>x.textContent).join(' · ');
 assert.equal(badge.children.length,3);assert(!text.includes('VÙNG'));assert.match(text,/BÁN CĐ · OI ↓/);assert.match(text,/OI CŨ/);assert(!text.includes('XEM TRƯỚC'));
 elements['oi-spectrum-toggle'].checked=false;sandbox.updateSpectrumBadge(100);assert.equal(badge.hidden,true);
});
