import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {STEPS,parseKlines,analyze,composite,calculateStrength,calculateVolumeStrength,COMPOSITE_STRENGTH_VERSION,requireCompositeStrengthVersion,strengthPhaseLineStyle} from '../engine.mjs';
import {calculateCommonTakerVolumeStrength} from '../common-volume.mjs';
import {prepareRaw} from '../analogs-features.mjs';
import {analyzeTrendSource} from '../studies-core.mjs';
const step=STEPS['15m'];
function sample(n=800){return Object.fromEntries(['SPYUSDT','QQQUSDT'].map((s,k)=>[s,Array.from({length:n},(_,i)=>{const q=(k?700:130)*((i%13)+1),net=q*Math.sin(i/(k?5:7))*.8,t=i*step;return {t,end:t+step-1,o:100,c:100+Math.sin(i/6),h:102,l:98,v:20,q,net,buy:(q+net)/2,sell:(q-net)/2,nf:100*net/q,session:'RTH',day:'2026-10-20'};})]));}
test('all Composite raw and adjusted strengths equal D common on every timestamp',()=>{
 const r=sample(),c=analyze(composite(r.SPYUSDT,r.QQQUSDT,step),step),d=calculateCommonTakerVolumeStrength(r.SPYUSDT,r.QQQUSDT,step).rows;
 assert.deepEqual(c.map(x=>[x.t,x.raw,x.adjusted]),d.map(x=>[x.t,x.raw,x.adjusted]));assert(c.some(x=>Number.isFinite(x.adjusted)));
 for(const x of composite(r.SPYUSDT,r.QQQUSDT)){const a=r.SPYUSDT[x.t/step],b=r.QQQUSDT[x.t/step];assert.equal(x.q,a.q+b.q);assert.equal(x.net,a.net+b.net);assert.equal(x.buy,a.buy+b.buy);assert.equal(x.sell,a.sell+b.sell);assert.equal(x.strengthVersion,COMPOSITE_STRENGTH_VERSION);}
});
test('composite gaps, missing QQQ and future mutation keep the shared causal prefix',()=>{
 const r=sample(),q=r.QQQUSDT.filter((_,i)=>i!==650),c=composite(r.SPYUSDT,q,step),d=calculateCommonTakerVolumeStrength(r.SPYUSDT,q,step).rows;
 assert.deepEqual(analyze(c,step).map(x=>x.raw),d.map(x=>x.raw));assert.equal(analyze(c,step).find(x=>x.t===651*step).raw,null);
 const a=analyze(composite(r.SPYUSDT.slice(0,600),r.QQQUSDT.slice(0,600)),step),b=analyze(composite(r.SPYUSDT,r.QQQUSDT.map((x,i)=>i>=600?{...x,net:-x.net}:x)),step);
 assert.deepEqual(a,b.slice(0,600));
});
test('per-symbol Strength and original-volume SPY V are independent of composite metadata',()=>{
 const r=sample(),a=calculateStrength(r.SPYUSDT,step),v=calculateVolumeStrength(r.SPYUSDT,step);
 composite(r.SPYUSDT,r.QQQUSDT,step);assert.deepEqual(calculateStrength(r.SPYUSDT,step),a);assert.deepEqual(calculateVolumeStrength(r.SPYUSDT,step),v);
 const bad=composite(r.SPYUSDT,r.QQQUSDT);bad[700]={...bad[700],strengthVersion:'old'};assert.throws(()=>calculateStrength(bad,step),/schema/);
});
test('historical features, studies worker input and WLR phase consume canonical composite',()=>{
 const r=sample(),now=800*step,c=calculateCommonTakerVolumeStrength(r.SPYUSDT,r.QQQUSDT,step).rows;
 const f=prepareRaw(r,{now}),trend=analyzeTrendSource(r,now),volume=analyze(r.SPYUSDT,step,{strength:calculateVolumeStrength(r.SPYUSDT,step)});
 for(let i=0;i<c.length;i++){assert.equal(f.SPYUSDT[i].x[1],c[i].adjusted);assert.equal(f.SPYUSDT[i].strengthVersion,COMPOSITE_STRENGTH_VERSION);assert.equal(trend.rows.COMPOSITE[i].adjusted,c[i].adjusted);assert.deepEqual(strengthPhaseLineStyle(trend.rows.COMPOSITE[i],volume[i]),strengthPhaseLineStyle(c[i],volume[i]));}
});
test('real Binance M15 fixtures retain exact D common parity',()=>{
 const read=n=>JSON.parse(fs.readFileSync(new URL('../../netflow-ml/tests/fixtures/'+n+'.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')),now=read('time').serverTime;
 const a=parseKlines(read('SPYUSDT'),now,step),b=parseKlines(read('QQQUSDT'),now,step),c=analyze(composite(a,b),step),d=calculateCommonTakerVolumeStrength(a,b,step).rows;
 assert.deepEqual(c.map(x=>x.adjusted),d.map(x=>x.adjusted));assert(c.filter(x=>Number.isFinite(x.adjusted)).length>100);
});
test('old or mixed feature artifacts are rejected instead of relabeled as D common',()=>{
 assert.throws(()=>requireCompositeStrengthVersion({strengthVersion:'old'}),/version/);
});

test('M5 M30 H1 infer the kline step and preserve the D common gap reset',()=>{
 for(const tf of ['5m','30m','1h']){
  const dt=STEPS[tf],r=sample(),convert=x=>x.map((b,i)=>({...b,t:(i+(i>=650?1:0))*dt,end:(i+(i>=650?1:0)+1)*dt-1})),a=convert(r.SPYUSDT),b=convert(r.QQQUSDT);
  assert.deepEqual(analyze(composite(a,b),dt).map(x=>x.raw),calculateCommonTakerVolumeStrength(a,b,dt).rows.map(x=>x.raw));
 }
});
