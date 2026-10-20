import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRaw} from '../analogs-features.mjs';
import {parseKlines,analyze,calculateVolumeStrength,composite,STEPS} from '../engine.mjs';

const step=STEPS['15m'],start=Date.parse('2026-10-13T08:00:00Z'),count=800,now=start+count*step;
function make(symbol){
 return Array.from({length:count},(_,i)=>{
  const spy=symbol==='SPYUSDT',c=(spy?600:400)+.015*i+Math.sin(i/(spy?7:11)),o=c-.15*Math.cos(i/5),v=(spy?1000:3500)+(spy?200:700)*Math.sin(i/13),q=v*c,buy=q*(.5+.25*Math.sin(i/(spy?9:6)));
  return [start+i*step,o,Math.max(o,c)+.3,Math.min(o,c)-.3,c,v,start+(i+1)*step-1,q,100,buy/v,buy];
 });
}
const raw=Object.fromEntries(['SPYUSDT','QQQUSDT'].map(symbol=>[symbol,parseKlines(make(symbol),now,step)]));
test('SPY price remains SPY; explicit strengths are SPY V and Composite SPY+QQQ at the same timestamp',()=>{
 const result=prepareRaw(raw,{now}),volume=analyze(raw.SPYUSDT,step,{strength:calculateVolumeStrength(raw.SPYUSDT,step)}),c=analyze(composite(raw.SPYUSDT,raw.QQQUSDT),step),spyMap=new Map(raw.SPYUSDT.map(r=>[r.t,r])),vMap=new Map(volume.map(r=>[r.t,r.adjusted])),cMap=new Map(c.map(r=>[r.t,r.adjusted])),finite=v=>Number.isFinite(v)?v:null;
 let complete=0,different=0;
 for(const r of result.SPYUSDT){
  assert.equal(r.pv.length,10);assert.equal(r.c,spyMap.get(r.t).c);assert.equal(r.pv[0],Math.log(spyMap.get(r.t).c));
  assert.equal(r.pv[8],finite(vMap.get(r.t)));assert.equal(r.pv[9],finite(cMap.get(r.t)));
  assert.equal(r.pv[8],r.x[2]);assert.equal(r.pv[9],r.x[1]);
  if(r.pv.every(Number.isFinite)){complete++;if(Math.abs(r.pv[8]-r.pv[9])>1e-6)different++;}
 }
 assert.ok(complete>300);assert.ok(different>100,'SPY V and Composite must remain independent input fields');
 for(let i=0;i<count;i++)assert.equal(result.QQQUSDT[i].pv[8],result.SPYUSDT[i].pv[8],'QQQ reference must still source SPY V from SPY');
});
test('both explicit Strength channels and chart-state features are invariant to future truncation',()=>{
 const cut=400,short=Object.fromEntries(Object.entries(raw).map(([s,rows])=>[s,rows.slice(0,cut)])),past=prepareRaw(short,{now:short.SPYUSDT.at(-1).end+1}),full=prepareRaw(raw,{now});
 for(const s of ['SPYUSDT','QQQUSDT'])assert.deepEqual(full[s].slice(0,cut).map(r=>r.pv),past[s].map(r=>r.pv));
});
