import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reversalZone,REVERSAL_VERSION,REVERSAL_WINDOW,REVERSAL_HORIZON,REVERSAL_NEIGHBORS,REVERSAL_MIN_MATCHES,REVERSAL_MIN_EFFECTIVE} from '../reversal-zone.mjs';
import {parseKlines,composite,analyze} from '../engine.mjs';

const step=300000,base=Date.parse('2026-08-01T00:00:00Z');
function patterned(cycles=35){
  const price=[],signal=[];let close=100,index=0;
  const add=(move,strength,wick=.08)=>{const o=close,c=close+move,h=Math.max(o,c)+wick,l=Math.min(o,c)-wick,t=base+index++*step,q=1000,nf=Math.max(-80,Math.min(80,move*100)),net=q*nf/100,buy=(q+net)/2,sell=q-buy;close=c;price.push({t,end:t+step-1,o,h,l,c,q,nf,net,buy,sell,day:'2026-08-03',session:'RTH'});signal.push({t,adjusted:strength});};
  for(let cycle=0;cycle<cycles;cycle++){
    for(let i=0;i<12;i++)add(.04,.22+(i%3)*.01);
    for(let i=0;i<6;i++)add(.32+.05*i,.32+.09*i,.06+.02*i);
    for(let i=0;i<3;i++)add(-.55,-.45-.08*i,.12);
  }
  for(let i=0;i<12;i++)add(.04,.22+(i%3)*.01);
  for(let i=0;i<6;i++)add(.32+.05*i,.32+.09*i,.06+.02*i);
  return {SPYUSDT:price,QQQUSDT:price.map(x=>({...x,o:x.o*2,h:x.h*2,l:x.l*2,c:x.c*2})),COMPOSITE:signal};
}
function mirrored(rows){
  const reflect=bar=>({...bar,o:500-bar.o,h:500-bar.l,l:500-bar.h,c:500-bar.c,nf:-bar.nf,net:-bar.net,buy:bar.sell,sell:bar.buy});
  return {SPYUSDT:rows.SPYUSDT.map(reflect),QQQUSDT:rows.QQQUSDT.map(reflect),COMPOSITE:rows.COMPOSITE.map(x=>({...x,adjusted:-x.adjusted}))};
}

test('REV6 finds statistically separated support and resistance zones from similar six-candle shapes',()=>{
  const rows=patterned(),zone=reversalZone(rows,'SPYUSDT','COMPOSITE',step);
  assert.equal(REVERSAL_VERSION,'REV6 V2');assert.equal(REVERSAL_WINDOW,6);assert.equal(REVERSAL_HORIZON,2);assert(zone.ready,JSON.stringify(zone));assert.equal(zone.direction,1);
  assert(zone.n>=24);assert(zone.eventCount>=6);assert(zone.rate-zone.baselineRate>=.08);assert(zone.lower>zone.baselineRate);
  assert(zone.n<=REVERSAL_NEIGHBORS);assert(zone.effectiveN>=REVERSAL_MIN_EFFECTIVE);assert(zone.effectiveN<=zone.n);assert(zone.bandwidth>=.15);assert(zone.similarity>0&&zone.similarity<=1);
  assert(zone.low<=zone.level&&zone.level<=zone.high);assert(zone.low>rows.SPYUSDT.at(-1).c);assert.equal(zone.end-zone.start,2*step);
  assert(zone.supportLow<=zone.supportLevel&&zone.supportLevel<=zone.supportHigh);assert(zone.supportHigh<=rows.SPYUSDT.at(-1).c);
  assert(zone.resistanceLow<=zone.resistanceLevel&&zone.resistanceLevel<=zone.resistanceHigh);assert(zone.resistanceLow>=rows.SPYUSDT.at(-1).c);
});
test('REV6 also draws both price sides when incoming Strength is negative',()=>{
  const rows=mirrored(patterned()),zone=reversalZone(rows,'SPYUSDT','COMPOSITE',step),close=rows.SPYUSDT.at(-1).c;
  assert(zone.ready,JSON.stringify(zone));assert.equal(zone.direction,-1);assert(zone.low<=zone.level&&zone.level<=zone.high);assert(zone.high<=close);
  assert(zone.supportHigh<=close);assert(zone.resistanceLow>=close);
});
test('REV6 withholds the line when history is thin or the current six-candle window is broken',()=>{
  const thin=patterned(3),insufficient=reversalZone(thin,'SPYUSDT','COMPOSITE',step);assert.equal(insufficient.ready,false);assert(['matches','events','confidence'].includes(insufficient.reason));
  const rows=patterned();for(const key of ['SPYUSDT','COMPOSITE'])rows[key].at(-1).t+=step;
  const broken=reversalZone(rows,'SPYUSDT','COMPOSITE',step);assert.equal(broken.ready,false);assert.equal(broken.reason,'window');
});
test('REV6 validates its configuration and price/source roles',()=>{
  const rows=patterned(3);
  assert.throws(()=>reversalZone(rows,'COMPOSITE','SPYUSDT',step),/không hợp lệ/);
  assert.throws(()=>reversalZone(rows,'SPYUSDT','COMPOSITE',0),/không hợp lệ/);
  assert.throws(()=>reversalZone(rows,'SPYUSDT','COMPOSITE',step,{shrinkage:2}),/không hợp lệ/);
});
test('REV6 rejects weekend and NYSE-holiday candles from current and reference clusters',()=>{
  for(const day of ['2026-10-10','2026-12-25']){
    const rows=patterned();for(const bar of rows.SPYUSDT.slice(-6))bar.day=day;
    assert.equal(reversalZone(rows,'SPYUSDT','COMPOSITE',step).ready,false);
    assert.equal(reversalZone(rows,'SPYUSDT','COMPOSITE',step).reason,'window');
  }
});
test('REV6 V2 accepts the recorded Binance quote-flow fixture without fallback data',()=>{
  const read=name=>JSON.parse(readFileSync(new URL(`../../netflow-ml/tests/fixtures/${name}`,import.meta.url),'utf8'));
  const now=read('time.json').serverTime,spy=parseKlines(read('SPYUSDT.json'),now,900000,{includeOpen:true}),qqq=parseKlines(read('QQQUSDT.json'),now,900000,{includeOpen:true}),both=composite(spy,qqq);
  const rows={SPYUSDT:analyze(spy,900000),QQQUSDT:analyze(qqq,900000),COMPOSITE:analyze(both,900000)},zone=reversalZone(rows,'SPYUSDT','COMPOSITE',900000);
  assert.equal(zone.version,REVERSAL_VERSION);assert(zone.n>=REVERSAL_MIN_MATCHES);assert(Number.isFinite(zone.rate));assert(Number.isFinite(zone.effectiveN));assert(Number.isFinite(zone.bandwidth));
});
