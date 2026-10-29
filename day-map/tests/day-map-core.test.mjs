import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailyMaps,similarDayForecast,weightedQuantile,pcaProjection} from '../day-map-core.mjs';

const DAY=86400000,STEP=900000,base=Date.UTC(2026,0,5,9); // 04:00 New York in January
function rows(days=30){
  const out=[];let made=0,cursor=base;
  while(made<days){const weekday=new Date(cursor).getUTCDay();if(weekday!==0&&weekday!==6){for(let i=0;i<48;i++){
    const t=cursor+i*STEP,o=100+made*.1+i*.01,c=o+(made%3-1)*.02,h=Math.max(o,c)+.05,l=Math.min(o,c)-.05;
    out.push({t,end:t+STEP-1,o,h,l,c});
  }made++;}cursor+=DAY;}
  return out;
}
test('weighted quantile follows weights',()=>assert.equal(weightedQuantile([1,2,9],[1,8,1],.5),2));
test('daily map keeps complete PRE to RTH sessions',()=>{
  const days=buildDailyMaps({priceRows:rows(5)});assert.equal(days.length,5);assert.equal(days[0].path.length,48);assert.ok(days[0].next);
});
test('forecast is past-only and emits envelopes',()=>{
  const days=buildDailyMaps({priceRows:rows(30)}),f=similarDayForecast(days,25,{k:12,minSamples:8});
  assert.equal(f.ready,true);assert.equal(f.ranked.length,12);assert.equal(f.nextEnvelope.length,48);assert.ok(f.ranked.every(x=>x.day.day<days[25].day));
});
test('PCA map marks only selected day current',()=>{
  const days=buildDailyMaps({priceRows:rows(10)}),p=pcaProjection(days,8);assert.equal(p.length,9);assert.equal(p.filter(x=>x.current).length,1);
});
