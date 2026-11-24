import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOrderBook} from '../orderbook-ui.mjs';

test('shared sequenced depth reaches the readout; toggle persists, symbol resets and pagehide closes both feeds',async()=>{
  const registry=new Map(),listeners=new Map(),saved=new Map();let time=100000;
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.handlers={};this.hidden=false;this.offsetHeight=40;}
    set id(id){this._id=id;registry.set(id,this);}get id(){return this._id;}
    set innerHTML(value){this.html=value;if(value.includes('orderbook-panel')){const p=new Element('div');p.className='orderbook-panel';this.append(p);for(const id of ['orderbook-step','orderbook-width','orderbook-values']){const n=new Element('input');n.id=id;p.append(n);}}}
    append(...nodes){for(const n of nodes){this.children.push(n);if(n&&typeof n==='object')n.parent=this;}}
    after(...nodes){this.parent?.append(...nodes);}
    querySelector(s){if(s.startsWith('#'))return registry.get(s.slice(1))??null;if(s==='.orderbook-panel')return this.children.find(n=>n.className==='orderbook-panel');return null;}
    setAttribute(name,value){this[name]=value;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    getBoundingClientRect(){return {top:0,left:0,width:390,height:500};}
    getClientRects(){return [this.getBoundingClientRect()];}
    contains(n){return this===n||this.children.some(c=>c?.contains?.(n));}
  }
  class Socket {
    static all=[];
    constructor(url){this.url=url;Socket.all.push(this);}
    close(){this.closed=true;}
    frame(e){this.onmessage?.({data:JSON.stringify(e)});}
  }
  const originals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch,WebSocket:globalThis.WebSocket,requestAnimationFrame:globalThis.requestAnimationFrame};
  const realNow=Date.now;Date.now=()=>time;
  const document=globalThis.document={hidden:false,createElement:t=>new Element(t),addEventListener:(name,fn)=>listeners.set(name,fn)};
  globalThis.window={addEventListener:(name,fn)=>listeners.set(name,fn)};
  globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
  globalThis.WebSocket=Socket;globalThis.requestAnimationFrame=fn=>{fn();return 0;};
  globalThis.fetch=async()=>({ok:true,json:async()=>({E:time,lastUpdateId:100,bids:[['99','20'],['98','10']],asks:[['101','5'],['102','5']]})});
  const host=new Element('div'),actions=new Element('div'),full=new Element('button');full.id='fullscreen';actions.append(full);
  const symbolControl=new Element('select');symbolControl.value='SPYUSDT';
  const price={attachPrimitive:p=>p.attached({requestUpdate(){}})},chart={panes:()=>[{getHeight:()=>500}]};let layer;
  try{
    layer=mountOrderBook({chart,price,host,actions,symbolControl});
    const depth=Socket.all.find(s=>s.url.includes('@depth')),tape=Socket.all.find(s=>s.url.includes('@aggTrade'));
    assert.match(depth.url,/\/public\/ws\/spyusdt@depth@100ms$/);assert.match(tape.url,/\/market\/ws\/spyusdt@aggTrade$/);
    await depth.onopen();tape.onopen();let id=100;
    for(let t=0;t<100;t++){
      depth.frame({e:'depthUpdate',s:'SPYUSDT',E:time,U:id,u:id+1,pu:id++,b:[['99',String(20+t%5)]],a:[]});
      tape.frame({e:'aggTrade',s:'SPYUSDT',E:time,a:t,p:'100',q:'2',m:false});time+=200;layer.momentum.render();
    }
    assert.equal(layer.momentum.node.dataset.quality,'live');
    assert.match(layer.momentum.node.children[0].textContent,/OB SPYUSDT/);
    assert.match(layer.momentum.node.children[1].textContent,/5s .*15s .*60s chờ/);
    assert.equal(layer.momentum.node.hidden,false);
    const toggle=registry.get('orderbook-momentum-toggle');toggle.checked=false;toggle.handlers.change();
    assert.equal(layer.momentum.node.hidden,true);assert.equal(JSON.parse(saved.get('dvp:orderbook:v1')).momentum,false);
    toggle.checked=true;toggle.handlers.change();symbolControl.value='QQQUSDT';symbolControl.handlers.change();
    assert.equal(layer.momentum.model.symbol,'QQQUSDT');assert.notEqual(layer.momentum.model.read().quality,'live');
    document.hidden=true;listeners.get('visibilitychange')();assert.equal(layer.momentum.node.hidden,true);assert.ok(Socket.all.every(s=>s.closed));
    document.hidden=false;listeners.get('visibilitychange')();assert.equal(layer.momentum.node.hidden,false);
    listeners.get('pagehide')();assert.ok(Socket.all.every(s=>s.closed));
  }finally{
    layer?.feed.stop();layer?.momentum.stop();Date.now=realNow;
    for(const [name,value] of Object.entries(originals)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
  }
});
