import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {STEPS,parseKlines,composite,flowAlignment,calculateStrength,analyze,regression,weightedPriceBands,sessionAt,validateSymbol,modelStatus} from '../engine.mjs';
import {load} from '../data.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const now=read('../../netflow-ml/tests/fixtures/time.json').serverTime;
const spy=read('../../netflow-ml/tests/fixtures/SPYUSDT.json'),qqq=read('../../netflow-ml/tests/fixtures/QQQUSDT.json');
const a=parseKlines(spy,now,STEPS['15m']),b=parseKlines(qqq,now,STEPS['15m']);
test('real Binance fixtures use quote fields, exclude unclosed bars',()=>{
  assert(a.length>900);assert(a.every(x=>x.end<now));const k=spy.find(x=>+x[0]===a[0].t);
  assert.equal(a[0].q,+k[7]);assert.equal(a[0].buy,+k[10]);assert.equal(a[0].sell,+k[7]- +k[10]);assert.equal(a[0].net,2* +k[10]- +k[7]);assert.equal(a[0].nf,100*a[0].net/a[0].q);
});
test('composite sums quote volumes at intersection only',()=>{
  const c=composite(a,b.slice(1)),x=c[0],aa=a.find(y=>y.t===x.t),bb=b.find(y=>y.t===x.t);
  assert.equal(x.q,aa.q+bb.q);assert.equal(x.net,aa.net+bb.net);assert(Math.abs(x.nf-(aa.nf*aa.q+bb.nf*bb.q)/(aa.q+bb.q))<1e-10);assert.equal(c.some(x=>x.t===b[0].t),false);assert.equal(x.o,undefined);
});
test('SPY/QQQ alignment distinguishes agreement and divergence',()=>{
  const x={t:1,net:10,nf:20},y={t:1,net:5,nf:10},same=flowAlignment([x],[x])[0];assert.equal(flowAlignment([x],[y])[0].state,'THUẬN MUA');assert.equal(same.phaseCoefficient,0);
  const opposite=flowAlignment([{...x,net:-10,nf:-20}],[y])[0];assert.equal(opposite.state,'NGHỊCH · SPY bán / QQQ mua');assert.equal(opposite.phase,1);assert.equal(opposite.phaseCoefficient,.2);
  assert.equal(flowAlignment([x],[{...y,net:-5}])[0].score,.45);assert.equal(flowAlignment([x],[{...y,t:2}]).length,0);
});
test('session calibration and regression are prefix-causal',()=>{
  const full=analyze(a,STEPS['15m']);assert(full.some(x=>x.adjusted!==null));
  for(const n of [200,600,900])assert.deepEqual(analyze(a.slice(0,n),STEPS['15m']),full.slice(0,n));
  const mutated=a.map((x,i)=>i>=900?{...x,net:x.q}:x);assert.deepEqual(analyze(mutated,STEPS['15m']).slice(0,900),full.slice(0,900));
  const altered=a.map((x,i)=>i===850?{...x,net:x.q}:x),f=analyze(altered,STEPS['15m']);assert.equal(f[850].mid,full[850].mid);assert.equal(f[850].upper,full[850].upper);
});
test('DVP smoothing chain, regression fit, gaps and zero-volume',()=>{
  const strength=calculateStrength(a,STEPS['15m']);assert.equal(strength.findIndex(Number.isFinite),506);assert(strength.filter(Number.isFinite).every(x=>x>=-1&&x<=1));
  for(const n of [200,600,900])assert.deepEqual(calculateStrength(a.slice(0,n),STEPS['15m']),strength.slice(0,n));
  const r=regression(Array.from({length:50},(_,i)=>3+2*i));assert.equal(r.mid,103);assert.equal(r.sigma,0);
  const gap=analyze([a[0],a[10]],STEPS['15m']);assert.equal(gap[1].raw,null);assert.equal(gap[1].rthSamples,0);
  const k=[...spy[0]];k[7]='0';k[10]='0';assert.equal(parseKlines([k],now,STEPS['15m'])[0].nf,null);k[10]='1';assert.throws(()=>parseKlines([k],now,STEPS['15m']));
});
test('price WLR uses linear weights, prior bars only and resets on gaps',()=>{
  const bars=Array.from({length:70},(_,i)=>({t:i*STEPS['15m'],c:100+2*i})),full=weightedPriceBands(bars,STEPS['15m']);
  assert.equal(full[49].mid,null);assert(Math.abs(full[50].mid-200)<1e-10);assert(full[50].sigma<1e-10);
  assert.deepEqual(weightedPriceBands(bars.slice(0,60),STEPS['15m']),full.slice(0,60));
  const future=bars.map((x,i)=>i>=60?{...x,c:9999}:x);assert.deepEqual(weightedPriceBands(future,STEPS['15m']).slice(0,60),full.slice(0,60));
  const gap=[...bars.slice(0,55),{t:bars[55].t+STEPS['15m'],c:bars[55].c}];assert.equal(weightedPriceBands(gap,STEPS['15m']).at(-1).mid,null);
  const curved=bars.map((x,i)=>({...x,c:x.c+(i===45?20:0)})),factors=curved.map((x,i)=>({t:x.t,coefficient:i===45?1:0}));
  const plain=weightedPriceBands(curved,STEPS['15m'])[50],weighted=weightedPriceBands(curved,STEPS['15m'],{factors,factorBoost:2})[50],strong=weightedPriceBands(curved,STEPS['15m'],{factors,factorBoost:30})[50];assert.notEqual(weighted.mid,plain.mid);assert(weighted.mid>plain.mid);assert(Math.abs(strong.mid-plain.mid)>Math.abs(weighted.mid-plain.mid));
});
test('NY DST, RTH edges and weekend',()=>{
  assert.equal(sessionAt(Date.parse('2026-10-07T13:30:00Z')).session,'RTH');assert.equal(sessionAt(Date.parse('2026-10-07T20:00:00Z')).session,'POST');assert.equal(sessionAt(Date.parse('2026-01-07T14:30:00Z')).session,'RTH');assert.equal(sessionAt(Date.parse('2026-10-10T14:30:00Z')).session,'WEEKEND');assert.equal(modelStatus.trained,false);
});
test('validation and paired pagination use closed server-time bars',async()=>{
  const symbols=read('../symbol-validation.json');for(const s of ['SPYUSDT','QQQUSDT'])assert.equal(validateSymbol({symbols},s).status,'TRADING');assert.throws(()=>validateSymbol({symbols:[]},'SPYUSDT'));
  let requests=0;const result=await load('15m',14,{get:async path=>{
    if(path.endsWith('exchangeInfo'))return {symbols};if(path.endsWith('/time'))return {serverTime:now};requests++;
    const u=new URL(path,'https://example.test'),rows=u.searchParams.get('symbol')==='SPYUSDT'?spy:qqq;
    return rows.filter(x=>+x[0]>=+u.searchParams.get('startTime')).slice(0,1000);
  }});assert.deepEqual(result.SPYUSDT,a);assert.deepEqual(result.QQQUSDT,b);assert(requests>=2);
});
