import test from 'node:test';
import assert from 'node:assert/strict';
import {colorTradeStatistics,COLOR_TRADE_LEVELS,COLOR_TRADE_MEMORY_H} from '../color-trade-stats.mjs';

const step=15*60*1000,base=Date.parse('2026-10-05T08:00:00Z');
function fixture(day='2026-10-05'){
  const bars=Array.from({length:49},(_,i)=>{
    const direction=Math.floor(i/4)%2?-1:1,session=i<22?'PRE':i<48?'RTH':'POST';
    const previous=i?100+Array.from({length:i},(_,j)=>(Math.floor(j/4)%2?-1:1)*.2).reduce((a,b)=>a+b,0):100,c=previous+direction*.2;
    return {t:base+i*step,end:base+(i+1)*step-1,day,session,o:previous,h:Math.max(previous,c)+.05,l:Math.min(previous,c)-.05,c,adjusted:direction};
  });
  return {SPYUSDT:bars,QQQUSDT:bars.map(x=>({...x,c:x.c*2,o:x.o*2,h:x.h*2,l:x.l*2})),COMPOSITE:bars.map(x=>({...x}))};
}
const trend=rows=>new Map(rows.SPYUSDT.map(x=>[x.t,{stableScore:80,score:80}]));

test('PRE→RTH color trades enter at close, reverse on color change and close at RTH end',()=>{
  const rows=fixture(),stats=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,trend(rows),{minSamples:1,tradeCost:.1});
  const latest=stats.get(rows.SPYUSDT.at(-1).t).stats;
  assert.equal(COLOR_TRADE_LEVELS.length,4);assert(stats.samples.length>8);assert(stats.samples.some(x=>x.exitReason==='color-change'));assert(stats.samples.some(x=>x.exitReason==='rth-close'));
  assert.equal(latest.all.n,stats.samples.length);assert.equal(latest['75'].n,latest.all.n);assert.equal(latest.all.winRate,100);assert(latest.all.expectancy>0);assert(latest.all.averageBars>=3);assert(latest.all.medianMfe>latest.all.medianMae);
  assert(stats.samples.every(x=>x.h===COLOR_TRADE_MEMORY_H&&['PRE','RTH'].includes(x.entrySession)&&x.holdBars>=1));
});

test('trade outcome is unavailable on the color-change candle and appears only on the next bar',()=>{
  const rows=fixture(),stats=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,trend(rows),{minSamples:1});
  const first=stats.samples[0],atExit=stats.get(first.exitTime).stats.all,after=stats.get(first.exitTime+step).stats.all;
  assert.equal(atExit.n,0);assert.equal(after.n,1);
});

test('TREND6 tiers filter entry score and transaction cost changes net performance',()=>{
  const rows=fixture(),scores=new Map(rows.SPYUSDT.map((x,i)=>[x.t,{stableScore:i<24?50:70}]));
  const cheap=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,scores,{minSamples:1,tradeCost:0}).get(rows.SPYUSDT.at(-1).t).stats;
  const costly=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,scores,{minSamples:1,tradeCost:1}).get(rows.SPYUSDT.at(-1).t).stats;
  assert(cheap['45'].n===cheap.all.n);assert(cheap['60'].n>0&&cheap['60'].n<cheap.all.n);assert.equal(cheap['75'].n,0);assert(costly.all.expectancy<cheap.all.expectancy);
});

test('weekend, holiday and broken PRE→RTH paths do not create trades',()=>{
  for(const day of ['2026-10-10','2026-12-25']){const rows=fixture(day),stats=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,trend(rows),{minSamples:1});assert.equal(stats.samples.length,0);}
  const rows=fixture();for(const key of ['SPYUSDT','QQQUSDT','COMPOSITE'])rows[key][3]={...rows[key][3],t:rows[key][3].t+step};
  const stats=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,trend(rows),{minSamples:1});assert(stats.samples.every(x=>x.entryTime!==rows.SPYUSDT[0].t));
});

test('remembered color trades extend the causal history outside the loaded window',()=>{
  const rows=fixture(),plain=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,trend(rows),{minSamples:1}),sample={...plain.samples[0],entryTime:base-10*step,exitTime:base-7*step,availableAt:base-7*step-1};
  const remembered=colorTradeStatistics(rows,'SPYUSDT','COMPOSITE',step,trend(rows),{minSamples:1,memory:[sample]}),latest=rows.SPYUSDT.at(-1).t;
  assert.equal(remembered.get(latest).stats.all.n,plain.get(latest).stats.all.n+1);assert.equal(remembered.rememberedSamples,1);
});
