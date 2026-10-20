import test from 'node:test';
import assert from 'node:assert/strict';
import {strengthState,strengthStatistics,MIN_SAMPLES} from '../strength-stats.mjs';
const step=300000,base=Date.parse('2026-10-05T14:00:00Z');
function fixture(n=100){
  const bars=Array.from({length:n},(_,i)=>({t:base+i*step,end:base+(i+1)*step-1,day:'2026-10-05',session:'RTH',o:99.5+i,h:100.5+i,l:99+i,c:100+i,q:100,buy:75,sell:25,net:50,nf:50,adjusted:.8}));
  return {SPYUSDT:bars,QQQUSDT:bars.map(b=>({...b,c:b.c*2})),COMPOSITE:bars.map(b=>({...b,q:200,buy:150,sell:50,net:100})),alignment:bars.map(b=>({t:b.t,smoothSpyNf:50,smoothQqqNf:50,detailState:'THUẬN MUA'}))};
}
const sample=rows=>Object.fromEntries(['SPYUSDT','QQQUSDT','COMPOSITE'].map(k=>[k,rows[k][0]]));
test('score explains taker/pair/strength support for both signs and rejects missing data',()=>{
  const rows=fixture(),up=strengthState(sample(rows),rows.alignment[0],'COMPOSITE');
  assert.equal(up.taker,37.5);assert.equal(up.pair,22.5);assert.equal(up.strength,16);assert.equal(up.score,76);
  for(const key of ['SPYUSDT','QQQUSDT','COMPOSITE'])rows[key][0]={...rows[key][0],adjusted:-.8,buy:rows[key][0].q*.25,sell:rows[key][0].q*.75,nf:-50};
  const down=strengthState(sample(rows),{smoothSpyNf:-50,smoothQqqNf:-50},'COMPOSITE');assert.equal(down.score,76);assert.deepEqual(down.signs,[-1,-1,-1]);
  assert.equal(strengthState(sample(rows),{smoothSpyNf:50,smoothQqqNf:50},'COMPOSITE').score,61);
  assert.equal(strengthState({...sample(rows),QQQUSDT:undefined},rows.alignment[0],'COMPOSITE'),null);
});
test('outcomes mature before selected candle; same cohort uses disjoint windows',()=>{
  const rows=fixture(),stats=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1});
  assert.equal(stats.get(rows.SPYUSDT[3].t).stats[3].n,0);
  const first=stats.get(rows.SPYUSDT[4].t).stats[3];assert.equal(first.n,1);assert.equal(first.rate,100);assert(Math.abs(first.mean-3)<1e-10);
  assert.equal(stats.get(rows.SPYUSDT[7].t).stats[3].n,1);assert.equal(stats.get(rows.SPYUSDT[8].t).stats[3].n,2);
  assert.equal(stats.get(rows.SPYUSDT[99].t).stats[3].n,24);
});
test('trade metrics subtract round-trip cost and report robust path excursions',()=>{
  const rows=fixture(),stats=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1,tradeCost:.1});
  const result=stats.get(rows.SPYUSDT[4].t).stats[3];
  assert.equal(result.winRate,100);assert(Math.abs(result.expectancy-2.9)<1e-10);assert.equal(result.profitFactor,Infinity);
  assert(Math.abs(result.medianMfe-3.5)<1e-10);assert.equal(result.medianMae,0);assert.equal(result.excursionN,1);
});
test('net wins and profit factor respond to the selected cost assumption',()=>{
  const rows=fixture(),result=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1,tradeCost:4}).get(rows.SPYUSDT[4].t).stats[3];
  assert.equal(result.winRate,0);assert(Math.abs(result.expectancy+1)<1e-10);assert.equal(result.profitFactor,0);
  assert.throws(()=>strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{tradeCost:5.01}),/không hợp lệ/);
});
test('prefix and current/future mutations cannot leak into past statistics',()=>{
  const rows=fixture(),full=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step),prefix=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.slice(0,70)]));
  assert.deepEqual([...strengthStatistics(prefix,'SPYUSDT','COMPOSITE',step)],[...full].slice(0,70));
  const changed={...rows,SPYUSDT:rows.SPYUSDT.map((b,i)=>i<70?b:{...b,c:99999,q:1e6,buy:1e6,adjusted:-1})};
  const after=strengthStatistics(changed,'SPYUSDT','COMPOSITE',step);
  assert.deepEqual([...after].slice(0,70),[...full].slice(0,70));
  assert.deepEqual(after.get(rows.SPYUSDT[70].t).stats[3].baseline,full.get(rows.SPYUSDT[70].t).stats[3].baseline);
});
test('no labels across missing bars, sessions or days; low count hides rates',()=>{
  for(const change of [{t:base+4*step},{session:'POST'},{day:'2026-10-06'}]){
    const rows=fixture(4);rows.SPYUSDT[2]={...rows.SPYUSDT[2],...change};
    assert.equal(strengthStatistics(rows,'SPYUSDT','COMPOSITE',step).get(rows.SPYUSDT[3].t).stats[1].n,1);
  }
  const rows=fixture(12),s=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step).get(rows.SPYUSDT.at(-1).t).stats[3];
  assert(s.n<MIN_SAMPLES);assert.equal(s.rate,null);assert.equal(s.mean,null);assert.equal(s.scope,'group');
});
test('strict state fallback is explicit, neutral groups and flats are not wins',()=>{
  const rows=fixture(100);rows.SPYUSDT=rows.SPYUSDT.map(b=>({...b,c:100}));
  const s=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step).get(rows.SPYUSDT.at(-1).t).stats[3];assert.equal(s.scope,'detail');assert.equal(s.flat,s.n);assert.equal(s.rate,0);
  rows.COMPOSITE.at(-1).adjusted=.99;
  const fallback=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step).get(rows.SPYUSDT.at(-1).t).stats[3];assert.equal(fallback.scope,'group');assert.equal(fallback.n,s.n);assert.equal(fallback.exactN,0);
  rows.COMPOSITE.at(-1).adjusted=0;
  const zero=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step).get(rows.SPYUSDT.at(-1).t);assert.equal(zero.state.score,null);assert.equal(zero.stats[3].n,0);
});
test('historical outcome uses selected price symbol and the selected Strength sign',()=>{
  const rows=fixture(30);
  for(const key of ['SPYUSDT','QQQUSDT','COMPOSITE'])rows[key]=rows[key].map(b=>({...b,adjusted:-.8}));
  rows.QQQUSDT=rows.QQQUSDT.map((b,i)=>({...b,c:200-i}));
  const spy=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1}).get(rows.SPYUSDT.at(-1).t).stats[3];
  const qqq=strengthStatistics(rows,'QQQUSDT','COMPOSITE',step,{minSamples:1}).get(rows.SPYUSDT.at(-1).t).stats[3];
  assert.equal(spy.rate,0);assert(spy.mean<0);assert.equal(qqq.rate,100);assert(qqq.mean>0);
});
test('remembered outcomes extend cohorts without leaking into overlapping loaded history',()=>{
  const rows=fixture(),plain=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1});
  const state=plain.get(rows.SPYUSDT.at(-1).t).state,old={h:3,entryTime:base-10*step,exitTime:base-7*step,availableAt:base-7*step+step-1,groupKey:state.groupKey,detailKey:state.detailKey,baselineKey:state.baselineKey,value:1};
  const remembered=strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1,memory:[old]});
  assert.equal(remembered.get(rows.SPYUSDT.at(-1).t).stats[3].n,plain.get(rows.SPYUSDT.at(-1).t).stats[3].n+1);assert.equal(remembered.rememberedSamples,1);
  const overlap={...old,entryTime:base,exitTime:base+3*step,availableAt:base+4*step-1};
  assert.equal(strengthStatistics(rows,'SPYUSDT','COMPOSITE',step,{minSamples:1,memory:[overlap]}).rememberedSamples,0);
});
