import test from 'node:test';
import assert from 'node:assert/strict';
import {reversalZone,REVERSAL_WINDOW,REVERSAL_HORIZON} from '../reversal-zone.mjs';

const step=300000,base=Date.parse('2026-08-01T00:00:00Z');
function patterned(cycles=35){
  const price=[],signal=[];let close=100,index=0;
  const add=(move,strength,wick=.08)=>{const o=close,c=close+move,h=Math.max(o,c)+wick,l=Math.min(o,c)-wick,t=base+index++*step;close=c;price.push({t,end:t+step-1,o,h,l,c,day:'2026-08-03',session:'RTH'});signal.push({t,adjusted:strength});};
  for(let cycle=0;cycle<cycles;cycle++){
    for(let i=0;i<12;i++)add(.04,.22+(i%3)*.01);
    for(let i=0;i<6;i++)add(.32+.05*i,.32+.09*i,.06+.02*i);
    for(let i=0;i<3;i++)add(-.55,-.45-.08*i,.12);
  }
  for(let i=0;i<12;i++)add(.04,.22+(i%3)*.01);
  for(let i=0;i<6;i++)add(.32+.05*i,.32+.09*i,.06+.02*i);
  return {SPYUSDT:price,QQQUSDT:price.map(x=>({...x,o:x.o*2,h:x.h*2,l:x.l*2,c:x.c*2})),COMPOSITE:signal};
}

test('REV6 finds a statistically separated resistance zone from similar six-candle shapes',()=>{
  const rows=patterned(),zone=reversalZone(rows,'SPYUSDT','COMPOSITE',step);
  assert.equal(REVERSAL_WINDOW,6);assert.equal(REVERSAL_HORIZON,2);assert(zone.ready);assert.equal(zone.direction,1);
  assert(zone.n>=24);assert(zone.eventCount>=6);assert(zone.rate-zone.baselineRate>=.08);assert(zone.lower>zone.baselineRate);
  assert(zone.low<=zone.level&&zone.level<=zone.high);assert(zone.low>rows.SPYUSDT.at(-1).c);assert.equal(zone.end-zone.start,2*step);
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
});
test('REV6 rejects weekend and NYSE-holiday candles from current and reference clusters',()=>{
  for(const day of ['2026-10-10','2026-12-25']){
    const rows=patterned();for(const bar of rows.SPYUSDT.slice(-6))bar.day=day;
    assert.equal(reversalZone(rows,'SPYUSDT','COMPOSITE',step).ready,false);
    assert.equal(reversalZone(rows,'SPYUSDT','COMPOSITE',step).reason,'window');
  }
});
