import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const boundsCode=source.slice(source.indexOf('function paneBounds(index){'),source.indexOf('\nfunction positionFixedPaneReadouts()'));
const drawCode=source.slice(source.indexOf('function drawH1H4Strip(){'),source.indexOf('\nfunction positionForecastReadout()'));

for(const [name,chartTop,paneTop,paneHeight,border] of [
 ['normal',120,645,180,0],['full chart',40,588,197,0],['resized pane',20,391,160,1]
])test('H1 strip uses actual SPY pane top: '+name,()=>{
 const calls=[],context=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 const element={getBoundingClientRect:()=>({top:paneTop,height:paneHeight})};
 const host={clientWidth:390,clientHeight:900,clientTop:border,contains:el=>el===element,getBoundingClientRect:()=>({top:chartTop})};
 const canvas={dataset:{},getContext:()=>context,setAttribute(){}};
 const nodes={chart:host,'h1-h4-age-strip':canvas,interval:{value:'15m'},symbol:{value:'SPYUSDT'},'candle-h1-box-color':{checked:true}};
 const sandbox={$:id=>nodes[id],chart:{panes:()=>[{}, {getHTMLElement:()=>element}],priceScale:(id,index)=>{assert.equal(index,1);return {width:()=>58};},timeScale:()=>({options:()=>({barSpacing:6}),timeToCoordinate:()=>20})},window:{devicePixelRatio:2},h1CandleMap:new Map([[0,{direction:1}]]),h1H4CandleMap:new Map([[0,{blockStart:0}]]),rows:{SPYUSDT:[{t:0}]},h1StripCell:()=>({x:10,width:12}),h1BoxCandlePalette:()=>({body:'#00ff00'}),isChartLive:()=>false};
 vm.createContext(sandbox);vm.runInContext(boundsCode+'\n'+drawCode,sandbox);sandbox.drawH1H4Strip();
 const expected=paneTop-chartTop-border;
 assert.equal(Number(canvas.dataset.stripTop),expected);
 assert.equal(canvas.dataset.visibleBars,'1');assert.equal(canvas.dataset.colorSource,'H1');
 assert(calls.some(c=>c[0]==='rect'&&c[2]===expected&&c[4]===10));
 assert(calls.some(c=>c[0]==='fillRect'&&c[2]===expected&&c[4]===10));
 assert(calls.findIndex(c=>c[0]==='clip')<calls.findIndex(c=>c[0]==='fillRect'));
 assert.equal(calls.at(-1)[0],'restore');
});

test('pane bounds wait for an attached pane instead of guessing from chart height',()=>{
 const sandbox={$:()=>({contains:()=>false}),chart:{panes:()=>[{getHTMLElement:()=>null}]}};
 vm.createContext(sandbox);vm.runInContext(boundsCode,sandbox);assert.equal(sandbox.paneBounds(0),null);assert.equal(sandbox.paneBounds(1),null);
});
