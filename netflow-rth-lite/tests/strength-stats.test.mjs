import test from 'node:test';
import assert from 'node:assert/strict';
import {strengthState,strengthStatistics,trendStrength6,MIN_SAMPLES,TREND_WINDOW,TREND_MIN_HISTORY} from '../strength-stats.mjs';
const step=300000,base=Date.parse('2026-10-05T14:00:00Z');
function fixture(n=100){
  const bars=Array.from({length:n},(_,i)=>({t:base+i*step,end:base+(i+1)*step-1,day:'2026-10-05',session:'RTH',c:100+i,q:100,buy:75,sell:25,net:50,nf:50,adjusted:.8}));
  return {SPYUSDT:bars,QQQUSDT:bars.map(b=>({...b,c:b.c*2})),COMPOSITE:bars.map(b=>({...b,q:200,buy:150,sell:50,net:100})),alignment:bars.map(b=>({t:b.t,smoothSpyNf:50,smoothQqqNf:50,detailState:'THUẬN MUA'}))};
}
const sample=rows=>Object.fromEntries(['SPYUSDT','QQQUSDT','COMPOSITE'].map(k=>[k,rows[k][0]]));
function trendFixture(n=120,block=6){
  const rows=fixture(n);
  for(let i=0;i<n;i++){
    const direction=Math.floor(i/block)%2?-1:1,magnitude=.28+.1*(i%block);
    for(const key of ['SPYUSDT','QQQUSDT','COMPOSITE']){
      const q=rows[key][i].q,buy=q*(direction>0?.76:.24);
      rows[key][i]={...rows[key][i],adjusted:direction*magnitude,buy,sell:q-buy,net:2*buy-q,nf:100*(2*buy-q)/q};
    }
    rows.alignment[i]={...rows.alignment[i],smoothSpyNf:direction*52,smoothQqqNf:direction*44,detailState:direction>0?'THUẬN MUA':'THUẬN BÁN'};
  }
  return rows;
}
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
test('TREND6 scores the trailing cluster and ranks it only against completed sign-change clusters',()=>{
  const rows=trendFixture(120),trend=trendStrength6(rows,'COMPOSITE',step,{minHistory:2}),last=trend.get(rows.COMPOSITE.at(-1).t);
  assert.equal(TREND_WINDOW,6);assert.equal(TREND_MIN_HISTORY,30);assert(last);assert(last.ready);assert(last.n>=2);assert.match(last.label,/^[↑↓] /);
  assert(last.score>=0&&last.score<=100);assert(last.percentile>=0&&last.percentile<=100);
  assert.equal(last.raw,Math.round(Object.values(last.components).reduce((a,b)=>a+b,0)));
  const recent=rows.COMPOSITE.slice(-6),buyTotal=recent.reduce((sum,x)=>sum+x.buy,0),sellTotal=recent.reduce((sum,x)=>sum+x.sell,0);
  assert.equal(last.buyTotal,buyTotal);assert.equal(last.sellTotal,sellTotal);assert.equal(last.netTotal,buyTotal-sellTotal);
  assert(last.components.consensus<=25);assert(last.components.taker<=20);assert(last.raw<=100);
  assert(last.components.persistence>0);assert(last.components.taker>0);assert(last.components.pair>0);assert(last.components.consensus>0);
});
test('TREND6 has no future leakage and rejects a broken six-candle window',()=>{
  const rows=trendFixture(90),full=trendStrength6(rows,'COMPOSITE',step,{minHistory:2});
  const prefix=Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value.slice(0,60)]));
  assert.deepEqual([...trendStrength6(prefix,'COMPOSITE',step,{minHistory:2})],[...full].slice(0,60));
  const changed=trendFixture(90);for(const key of ['SPYUSDT','QQQUSDT','COMPOSITE'])changed[key][89]={...changed[key][89],t:changed[key][89].t+step};
  changed.alignment[89]={...changed.alignment[89],t:changed.alignment[89].t+step};
  const broken=trendStrength6(changed,'COMPOSITE',step,{minHistory:2});assert.equal(broken.get(changed.COMPOSITE[89].t),null);
});
test('a sign-change cluster enters TREND6 history only after all six bars finish before the current window',()=>{
  const rows=trendFixture(24),trend=trendStrength6(rows,'COMPOSITE',step,{minHistory:1});
  assert.equal(trend.get(rows.COMPOSITE[11].t).n,0);
  const at17=trend.get(rows.COMPOSITE[17].t);assert.equal(at17.n,1);assert.equal(at17.scope,'all-signs');assert(at17.ready);
  const at23=trend.get(rows.COMPOSITE[23].t);assert.equal(at23.n,1);assert.equal(at23.scope,'same-sign');
});
