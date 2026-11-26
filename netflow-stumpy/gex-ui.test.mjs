import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountGex} from './gex-ui.mjs';
test('load, toggle, bad import, reload and clear preserve applied state',()=>{
 const nodes=new Map();
 class Element{
  constructor(){this.style={};this.value='';this.checked=false;this.textContent='';}
  set innerHTML(html){for(const match of html.matchAll(/id="([^"]+)"/g)){const e=new Element();nodes.set(match[1],e);}}
  querySelector(selector){if(selector.startsWith('#'))return nodes.get(selector.slice(1));if(selector==='input')return nodes.get('gex-spectrum-toggle');return new Element();}
  append(){} after(){} closest(){return new Element();}
  addEventListener(name,fn){this['on'+name]=fn;}
 }
 nodes.set('cvd-spectrum-toggle',new Element());
 const originalDocument=globalThis.document,originalStorage=globalThis.localStorage;
 const storage=new Map();globalThis.document={createElement:()=>new Element(),getElementById:id=>nodes.get(id),querySelector:()=>new Element()};
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 let primitive,redraws=0,symbol='SPYUSDT';
 const refTime=Date.parse('2026-11-26T15:45:00Z'),bars=[{t:refTime-900000,c:722}];
 const mount=()=>mountGex({chart:{timeScale:()=>({timeToCoordinate:()=>100})},price:{attachPrimitive:p=>{primitive=p;p.attached({requestUpdate:()=>redraws++});},priceToCoordinate:v=>v},context:()=>({symbol,anchor:1000000,bars,step:900000,now:refTime+1})});
 try{
  mount();const raw='S:12|L:7000,ZG,ZERO GAMMA|P:6990,-2,-1;7010,4,1';
  nodes.get('gex-data').value=raw;nodes.get('gex-load').onclick();
  assert.equal(nodes.get('gex-spectrum-toggle').checked,true);assert.equal(nodes.get('gex-basis').value,'12');assert.match(nodes.get('gex-status').textContent,/2 mức/);
  nodes.get('gex-data').value='bad';nodes.get('gex-load').onclick();assert.match(nodes.get('gex-status').textContent,/giữ nguyên/);
  nodes.get('gex-spectrum-toggle').checked=false;nodes.get('gex-spectrum-toggle').onchange();assert.equal(JSON.parse(storage.get('netflow:gex:v1')).text,raw);
  mount();assert.equal(nodes.get('gex-data').value,raw);assert.equal(nodes.get('gex-spectrum-toggle').checked,false);
  nodes.get('gex-reference-time').value='2026-11-26T22:45';nodes.get('gex-chart-reference').onclick();assert.equal(nodes.get('gex-target-reference').value,'722');
  nodes.get('gex-map-mode').value='PAIR_RATIO';nodes.get('gex-source-reference').value='7600';nodes.get('gex-apply-calibration').onclick();
  assert.equal(JSON.parse(storage.get('netflow:gex:v1')).mapping.ratio,722/7600);
  nodes.get('gex-source-reference').value='';nodes.get('gex-apply-calibration').onclick();assert.match(nodes.get('gex-status').textContent,/Giữ hiệu chỉnh/);assert.equal(JSON.parse(storage.get('netflow:gex:v1')).mapping.source,7600);
  mount();assert.equal(nodes.get('gex-map-mode').value,'PAIR_RATIO');assert.equal(nodes.get('gex-source-reference').value,'7600');
  nodes.get('gex-panel-toggle').checked=true;nodes.get('gex-panel-toggle').onchange();assert.equal(nodes.get('gex-spectrum-toggle').checked,true);
  symbol='QQQUSDT';assert.doesNotThrow(()=>primitive.paint({}));
  nodes.get('gex-clear').onclick();assert.equal(JSON.parse(storage.get('netflow:gex:v1')).text,'');assert.ok(redraws>0);
 }finally{globalThis.document=originalDocument;globalThis.localStorage=originalStorage;}
});

