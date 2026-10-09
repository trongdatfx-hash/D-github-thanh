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
  const x={t:1,net:10,nf:20,q:50},y={t:1,net:5,nf:10,q:50},aligned=flowAlignment([x],[y])[0],same=flowAlignment([x],[x])[0];
  assert.equal(aligned.state,'THUẬN MUA');assert.equal(aligned.detailState,'THUẬN MUA');assert.equal(aligned.commonNf,15);assert.equal(aligned.relative,5);assert.equal(same.opposition,0);assert.equal(same.agreement,.4);
  const opposite=flowAlignment([{...x,net:-10,nf:-20}],[y])[0];assert.equal(opposite.state,'NGHỊCH · SPY bán / QQQ mua');assert.equal(opposite.detailState,'NGHỊCH · SPY bán / QQQ mua');assert(Math.abs(opposite.opposition-Math.sqrt(200)/50)<1e-12);assert.equal(opposite.intensity,.2);
  const leader=flowAlignment([x],[{...y,net:0,nf:0}])[0];assert.equal(leader.detailState,'SPY DẪN MUA');assert.equal(leader.opposition,0);
  assert.equal(flowAlignment([x],[{...y,net:-5,nf:-10}])[0].score,.45);assert.equal(flowAlignment([x],[{...y,t:2}]).length,0);
});
test('relative flow smoothing and volume confidence are prefix-causal',()=>{
  const s=Array.from({length:40},(_,i)=>({t:i,net:i%3?10:-8,nf:i%3?20:-16,q:50+i}));
  const q=Array.from({length:40},(_,i)=>({t:i,net:i%4?-5:7,nf:i%4?-10:14,q:70+i*2}));
  const full=flowAlignment(s,q,{step:1});assert.deepEqual(flowAlignment(s.slice(0,25),q.slice(0,25),{step:1}),full.slice(0,25));
  const changed=s.map((x,i)=>i>=25?{...x,nf:99,net:x.q*.99}:x);assert.deepEqual(flowAlignment(changed,q,{step:1}).slice(0,25),full.slice(0,25));
  const gap=flowAlignment([s[0],{...s[1],t:2}],[q[0],{...q[1],t:2}],{step:1});assert.equal(gap[1].smoothSpyNf,s[1].nf);assert.equal(gap[1].smoothQqqNf,q[1].nf);
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
