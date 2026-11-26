import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountGex} from './gex-ui.mjs';
test('load, file import, drafts, Save setup and reload preserve GEX data',async()=>{
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
 let primitive,redraws=0,symbol='SPYUSDT',layer;
 const refTime=Date.parse('2026-11-26T15:45:00Z'),bars=[{t:refTime-900000,c:722}];
 const mount=()=>layer=mountGex({chart:{timeScale:()=>({timeToCoordinate:()=>100})},price:{attachPrimitive:p=>{primitive=p;p.attached({requestUpdate:()=>redraws++});},priceToCoordinate:v=>v},context:()=>({symbol,anchor:1000000,bars,step:900000,now:refTime+1})});
 try{
  mount();const raw='S:12|L:7000,ZG,ZERO GAMMA|P:6990,-2,-1;7010,4,1';
  nodes.get('gex-data').value=raw;nodes.get('gex-load').onclick();
  assert.equal(nodes.get('gex-spectrum-toggle').checked,true);assert.equal(nodes.get('gex-basis').value,'12');assert.match(nodes.get('gex-status').textContent,/2 mức/);assert.match(nodes.get('gex-status').textContent,/Đã lưu tự động/);assert.ok(JSON.parse(storage.get('netflow:gex:v1')).savedAt>0);
  nodes.get('gex-data').value='bad';nodes.get('gex-load').onclick();assert.match(nodes.get('gex-status').textContent,/giữ nguyên/);
  nodes.get('gex-spectrum-toggle').checked=false;nodes.get('gex-spectrum-toggle').onchange();assert.equal(JSON.parse(storage.get('netflow:gex:v1')).text,raw);
  mount();assert.equal(nodes.get('gex-data').value,'bad');assert.equal(nodes.get('gex-spectrum-toggle').checked,false);assert.match(nodes.get('gex-status').textContent,/Đã khôi phục bản tự lưu/);
  assert.equal(JSON.parse(storage.get('netflow-rth-lite:chart-setup:v1')).gex.text,raw);
  nodes.get('gex-data').value=raw;layer.saveSetup();storage.delete('netflow:gex:v1');mount();assert.equal(nodes.get('gex-data').value,raw);
  nodes.get('gex-reference-time').value='2026-11-26T22:45';nodes.get('gex-chart-reference').onclick();assert.equal(nodes.get('gex-target-reference').value,'722');
  nodes.get('gex-map-mode').value='PAIR_RATIO';nodes.get('gex-source-reference').value='7600';nodes.get('gex-apply-calibration').onclick();
  assert.equal(JSON.parse(storage.get('netflow:gex:v1')).mapping.ratio,722/7600);
  nodes.get('gex-source-reference').value='';nodes.get('gex-apply-calibration').onclick();assert.match(nodes.get('gex-status').textContent,/Giữ hiệu chỉnh/);assert.equal(JSON.parse(storage.get('netflow:gex:v1')).mapping.source,7600);
  mount();assert.equal(nodes.get('gex-map-mode').value,'PAIR_RATIO');assert.equal(nodes.get('gex-source-reference').value,'7600');
  nodes.get('gex-panel-toggle').checked=true;nodes.get('gex-panel-toggle').onchange();assert.equal(nodes.get('gex-spectrum-toggle').checked,true);
  const fileData='S:2|L:7200,ZG,ZERO GAMMA|P:7190,-4,-1;7210,6,1';
  await nodes.get('gex-file').onchange({target:{files:[{size:fileData.length,text:async()=>fileData}]}});
  assert.equal(JSON.parse(storage.get('netflow:gex:v1')).text,fileData);assert.equal(JSON.parse(storage.get('netflow-rth-lite:chart-setup:v1')).gex.text,fileData);
  nodes.get('gex-data').value=raw;nodes.get('gex-data').oninput();await new Promise(resolve=>setTimeout(resolve,350));
  mount();assert.equal(nodes.get('gex-data').value,raw);assert.match(nodes.get('gex-status').textContent,/Có bản nhập chưa áp dụng/);
  const snapshot=layer.saveSetup();assert.equal(snapshot.text,raw);assert.equal(snapshot.mapping.source,7600);assert.equal(JSON.parse(storage.get('netflow-rth-lite:chart-setup:v1')).gex.text,raw);
  symbol='QQQUSDT';assert.doesNotThrow(()=>primitive.paint({}));
  nodes.get('gex-clear').onclick();assert.equal(JSON.parse(storage.get('netflow:gex:v1')).text,'');assert.ok(redraws>0);
  globalThis.localStorage={getItem:()=>null,setItem(){throw Error('quota');}};nodes.get('gex-data').value=raw;assert.doesNotThrow(()=>nodes.get('gex-load').onclick());assert.match(nodes.get('gex-status').textContent,/CHƯA LƯU/);
 }finally{globalThis.document=originalDocument;globalThis.localStorage=originalStorage;}
});


