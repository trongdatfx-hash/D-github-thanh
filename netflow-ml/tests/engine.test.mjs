import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STEP,sessionAt,parseKlines,validateSymbol,analyze,mlStatus} from '../engine.mjs';
import {calculateStrength,normCDF} from '../dvp.mjs';
import {load} from '../data.mjs';
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const now=json('./fixtures/time.json').serverTime;
const contracts=json('../symbol-validation.json');
const fixture=s=>parseKlines(json(`./fixtures/${s}.json`),now);
test('symbol validation checks actual Binance contract type/status',()=>{
  for(const symbol of ['SPYUSDT','QQQUSDT'])assert.equal(validateSymbol({symbols:contracts},symbol).status,'TRADING');
  assert.throws(()=>validateSymbol({symbols:contracts},'SPYUSDT.P'));
  assert.throws(()=>validateSymbol({symbols:contracts.map(s=>({...s,status:'BREAK'}))},'SPYUSDT'));
});
test('ET boundaries, weekends and both DST seasons',()=>{
  for(const [t,s] of [['2026-07-06T07:45Z','NIGHT'],['2026-07-06T08:00Z','PRE'],['2026-07-06T13:30Z','RTH'],['2026-07-06T20:00Z','POST'],['2026-07-07T00:00Z','NIGHT'],['2026-01-05T14:30Z','RTH'],['2026-07-04T15:00Z','WEEKEND']])assert.equal(sessionAt(Date.parse(t)),s);
});
test('reject malformed volumes, deduplicate, exclude open candles',()=>{
  const k=[0,'10','12','9','11','100',STEP-1,'0',1,'60','0'];
  assert.equal(parseKlines([k,k,[STEP,...k.slice(1,6),2*STEP-1,...k.slice(7)]],STEP).length,1);
  assert.equal(parseKlines([k],STEP)[0].net,20);
  assert.throws(()=>parseKlines([[...k.slice(0,9),'101','0']],STEP));
});
test('DVP is the scalar Pine recurrence including pre-SMA fallback',()=>{
  const bars=fixture('SPYUSDT'),actual=calculateStrength(bars),norm=[],rs=[],expected=[];
  let ew=null;
  for(let i=0;i<bars.length;i++){
    const v=bars.slice(Math.max(0,i-19),i+1).reduce((s,b)=>s+b.v,0)/20;
    norm.push(i>=19&&v>0?bars[i].net/v:bars[i].net);
    if(i<7){expected.push(null);rs.push(null);continue;}
    const r=norm.slice(i-7,i+1).reduce((a,x)=>a+x,0);ew=ew===null?r:ew+(1-2**(-.5))*(r-ew);rs.push(ew);
    if(i<506){expected.push(null);continue;}
    const sigma=rs.slice(i-499,i+1).reduce((a,x)=>a+Math.abs(x),0)/500*Math.sqrt(Math.PI/2);
    expected.push(sigma>0?2*normCDF(ew/sigma)-1:null);
  }
  assert.equal(actual.findIndex(x=>x!==null),506);
  actual.forEach((x,i)=>x===null?assert.equal(expected[i],null):assert.ok(Math.abs(x-expected[i])<1e-12));
});
test('future modifications cannot change existing Strength/calibration/bands',()=>{
  const bars=fixture('QQQUSDT'),prefix=bars.slice(0,850),a=analyze(prefix,calculateStrength(prefix));
  const modified=bars.map((b,i)=>i>=850?{...b,net:-b.net*10,v:b.v*10}:b);
  assert.deepEqual(a,analyze(modified,calculateStrength(modified)).slice(0,850));
});
test('current sample cannot calibrate itself and RTH stays unchanged',()=>{
  const bars=Array.from({length:8},(_,i)=>({t:i*STEP,v:1,net:1,session:i<4?'RTH':'PRE'}));
  const result=analyze(bars,[1,2,3,4,10,20,30,40],{minSamples:2,window:10});
  assert.equal(result[1].adjusted,null);assert.equal(result[2].adjusted,3);
  assert.equal(result[5].adjusted,null);assert.equal(result[6].sourceSamples,2);
  assert.ok(Math.abs(result[6].adjusted-5.854101966249685)<1e-12);
  assert.equal(result[6].upper,2*Math.sqrt(1.25));
});
test('24h requires 96 contiguous closed bars and gaps reset state',()=>{
  const bars=fixture('SPYUSDT'),rows=analyze(bars,calculateStrength(bars));
  assert.equal(rows[94].volume24,null);
  assert.ok(Math.abs(rows[95].volume24-bars.slice(0,96).reduce((s,b)=>s+b.v,0))<1e-8);
  const gap=[...bars.slice(0,600),...bars.slice(601)],out=analyze(gap,calculateStrength(gap));
  assert.equal(out[600].volume24,null);assert.equal(out[600].raw,null);assert.equal(out[600].rthSamples,0);
});
test('both real Binance fixtures yield finite bounded Strength; ML remains untrained',()=>{
  for(const symbol of ['SPYUSDT','QQQUSDT']){const bars=fixture(symbol),s=calculateStrength(bars),rows=analyze(bars,s);assert.ok(s.filter(x=>x!==null).length>100);assert.ok(s.every(x=>x===null || (Number.isFinite(x)&&Math.abs(x)<=1)));assert.equal(mlStatus(rows).trained,false);}
});
test('paginated REST advances safely and excludes the current candle',async()=>{
  const k=json('./fixtures/SPYUSDT.json');let calls=0;
  const result=await load('SPYUSDT',30,{get:async path=>{if(path.includes('exchangeInfo'))return {symbols:contracts};if(path.includes('/time'))return {serverTime:Number(k.at(-1)[0])+3*STEP};calls++;return calls===1?k:[];}});
  assert.equal(calls,2);assert.ok(result.bars.every(b=>b.end<result.serverTime));
});
