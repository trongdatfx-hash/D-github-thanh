import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,calculateVolumeStrength,STEPS,sessionAt} from '../netflow-stumpy/engine.mjs';

const app=fs.readFileSync(new URL('../netflow-stumpy/app.mjs',import.meta.url),'utf8');
const start=app.indexOf('  const bodyVolumeBars=');
const end=app.indexOf('  daoV2Layer?.setData',start);
assert.ok(start>0&&end>start);
// Execute the actual render integration, with H1 access forbidden. This catches
// accidental reintroduction of the adaptive path or H1-gated trade statistics.
const render=new Function('cache','STEPS','analyze','calculateVolumeStrength','$','h1CandleMap','daoV2Cache','daoV2Stats',app.slice(start,end)+'\nreturn {bodyVolumeRows,daoV2State};');
let price=700;
const bars=Array.from({length:1000},(_,i)=>{
 const t=Date.UTC(2026,10,2)+i*900000,o=price,c=o+Math.sin(i*.13)*.5;
 price=c;return {t,end:t+899999,o,c,h:Math.max(o,c)+.2,l:Math.min(o,c)-.2,v:100,...sessionAt(t)};
});
function run(source=bars){
 let args,context;
 const cache={SPYUSDT:source,serverTime:source.at(-1).t+900000};
 const $=id=>id==='symbol'?{value:'SPYUSDT'}:id==='interval'?{value:'15m'}:{checked:true};
 const h1=new Proxy(new Map(),{get(){throw Error('Fixed body source accessed H1');}});
 const result=render(cache,STEPS,analyze,calculateVolumeStrength,$,h1,{get(...a){args=a;return {points:[]};}},{isOpen:()=>true,setContext(c){context=c;}});
 return {...result,args,context};
}
test('body render uses fixed EWMA without reading H1 or waiting for it',()=>{
 const result=run();
 assert.equal(result.context.waitingH1,false);
 assert.match(result.context.source,/EWMA c? �?nh/);
 assert.equal(result.args[1].size,0);
 assert.equal(result.args[2].adaptive,false);
 const body=bars.map(b=>({...b,v:Math.abs(b.c-b.o)}));
 assert.deepEqual(result.bodyVolumeRows,analyze(body,STEPS['15m'],{strength:calculateVolumeStrength(body,STEPS['15m'],{halfLife:2})}));
 assert.ok(result.bodyVolumeRows.some(r=>Number.isFinite(r.adjusted)));
});
test('later candles cannot rewrite earlier fixed body readings',()=>{
 const prefix=run(bars.slice(0,800)).bodyVolumeRows;
 const full=run().bodyVolumeRows;
 assert.deepEqual(full.slice(0,800),prefix);
});

