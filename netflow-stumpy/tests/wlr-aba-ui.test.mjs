import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWlrAba} from '../wlr-aba-ui.mjs';
import {SPEC} from '../wlr-aba-core.mjs';
test('panel updates source age, WAIT, evidence and snapshot failure together without reloading',()=>{
 const saved=new Map(),names=['document','window','Worker','ResizeObserver','sessionStorage','requestAnimationFrame','setInterval'];
 for(const n of names)saved.set(n,globalThis[n]);
 const elements=new Map(),intervals=[];
 class Element{
  constructor(){this.dataset={};this.style={};this.children=[];this.clientWidth=1000;this.clientHeight=500;}
  set innerHTML(html){for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],new Element());}
  setAttribute(){}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  querySelector(id){return elements.get(id.slice(1));}
  addEventListener(){}
  closest(){return {after(){}};}
 }
 let worker;
 class WorkerMock{
  constructor(){worker=this;this.sent=[];}
  postMessage(message){this.sent.push(message);}
  terminate(){}
  receive(data){this.onmessage({data});}
 }
 try{
  globalThis.document={createElement:()=>new Element(),addEventListener(){}};
  globalThis.window={addEventListener(){}};
  globalThis.Worker=WorkerMock;globalThis.ResizeObserver=class{observe(){}};
  globalThis.sessionStorage={getItem:()=>null,setItem(){}};
  globalThis.requestAnimationFrame=()=>1;
  globalThis.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};
  const report=JSON.parse(fs.readFileSync(new URL('../data/wlr-aba/report.json',import.meta.url),'utf8'));
  report.activePolicyVersion=2;delete report.v3;
  report.sourceAsOf=Date.parse('2026-10-22T00:00:00Z');report.decision='NOT_ESTABLISHED';report.selectionReady=true;report.selectedTrial='CYCLE8';
  report.collection={source:'daily-archive',status:'delayed',checkedAt:report.sourceAsOf+23.62*3600000,lastTimeBySymbol:{SPYUSDT:report.sourceAsOf-900000,QQQUSDT:report.sourceAsOf-900000}};
  report.v2.status='WAIT_GATE_VALIDATION';report.v2.gate=null;report.v2.forward={...report.v2.forward,queries:0,filtered:{...report.v2.forward.filtered,n:0,days:0}};
  report.v2.test.filtered={...report.v2.test.filtered,n:0,accuracy:null,baselineAccuracy:null};
  let c={symbol:'SPYUSDT',interval:'15m',features:[],expectedTime:0,live:false,now:report.sourceAsOf+24*3600000};
  const layer=createWlrAba({chart:{timeScale:()=>({subscribeVisibleLogicalRangeChange(){}})},wlr:{},host:new Element(),actions:new Element(),getContext:()=>c,paneBounds:()=>null,getCvdBounds:()=>null});
  assert.equal(worker.sent[0].type,'refresh');
  worker.receive({type:'snapshot',report});
  assert.match(elements.get('aba-collection-health').textContent,/DELAYED.*24.00 giờ/);
  assert.match(elements.get('aba-decision-health').textContent,/NOT_ESTABLISHED/);
  assert.match(elements.get('aba-forward-health').textContent,/0 queries/);
  const tableText=elements.get('aba-direction-table').children.flatMap(row=>row.children.map(cell=>cell.textContent)).join(' ');
  assert.doesNotMatch(tableText,/\\+0\\.00 điểm %/);
  assert.equal(elements.get('aba-direction-status').dataset.state,'WAIT_GATE_VALIDATION');
  assert.match(elements.get('aba-direction-status').textContent,/WAIT_GATE_VALIDATION/);
  c.now+=3600000;layer.update();assert.match(elements.get('aba-collection-health').textContent,/25.00 giờ/);
  worker.receive({type:'snapshot-error',error:'không tải được snapshot'});
  assert.equal(elements.get('aba-collection-health').dataset.state,'UNKNOWN');
  assert.equal(elements.get('aba-decision-health').dataset.state,'WAIT');
  assert.match(elements.get('aba-publication-health').textContent,/không tải được snapshot/);
  // A new verified snapshot is accepted without closing/reopening the page.
  const refreshed={...report,snapshotId:'new',collection:{source:'rest',status:'live',checkedAt:c.now,lastTimeBySymbol:{SPYUSDT:c.now-900000,QQQUSDT:c.now-900000}}};
  worker.receive({type:'snapshot',report:refreshed});
  assert.match(elements.get('aba-collection-health').textContent,/LIVE.*0.00 giờ/);
  assert.equal(elements.get('aba-decision-health').dataset.state,'NOT_ESTABLISHED');
  assert.match(elements.get('aba-signal-health').textContent,/WAIT/);
  const v3={...structuredClone(report.v2),version:3,status:'READY',spec:{...report.v2.spec,version:3,gateStart:'2026-08-21',testStart:'2026-10-02',historicalEnd:'2026-10-23',forwardStart:'2026-10-26'},gate:{band:'any',gap:0},freeze:{status:'FROZEN',createdAt:c.now,id:'a'.repeat(64)},policyId:'a'.repeat(64),forwardOpen:Date.parse('2026-10-26T08:00:00Z')};
  v3.gateValidation={trials:[{config:v3.gate,score:{n:60,days:20},coverage:.5,valid:true}]};
  v3.forward={...v3.forward,phase:'NOT_STARTED'};
  worker.receive({type:'snapshot',report:{...refreshed,activePolicyVersion:3,v3}});
  assert.equal(elements.get('aba-title').textContent,'WLR A–B–A V3');
  assert.match(elements.get('aba-policy-health').textContent,/V3: READY/);
  assert.match(elements.get('aba-signal-health').textContent,/WAIT/);
  assert.match(elements.get('aba-v3-freeze').textContent,/đã khóa/);
  assert.match(elements.get('aba-forward-health').textContent,/CHƯA BẮT ĐẦU/);
  const comparison=elements.get('aba-policy-comparison').children.flatMap(row=>row.children.map(cell=>cell.textContent)).join(' ');
  assert.match(comparison,/V2/);assert.match(comparison,/V3/);assert.match(comparison,/60 \/ 20/);
  intervals.find(x=>x.ms===60000).fn();assert.equal(worker.sent.at(-1).type,'refresh');
 }finally{for(const [n,v]of saved){if(v===undefined)delete globalThis[n];else globalThis[n]=v;}}
});
