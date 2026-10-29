import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailyMaps,similarDayForecast,weightedQuantile,pcaProjection,buildAdditiveMacroMap,additiveMacroForecast,macroPcaProjection,walkForwardMacroAudit} from '../day-map-core.mjs';

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
  const days=buildDailyMaps({priceRows:rows(5)});assert.equal(days.length,5);assert.equal(days[0].path.length,48);assert.equal(days[0].h1Blocks.length,12);assert.ok(days[0].next);
  assert.equal(days[0].h1Blocks[0].strengthening,0);
});
test('daily map rejects duplicate or non-contiguous M15 bars',()=>{
  const broken=rows(2);broken[10]={...broken[9]};assert.equal(buildDailyMaps({priceRows:broken}).length,1);
});
test('forecast is past-only and emits envelopes',()=>{
  const days=buildDailyMaps({priceRows:rows(30)}),f=similarDayForecast(days,25,{k:12,minSamples:8});
  assert.equal(f.ready,true);assert.equal(f.ranked.length,12);assert.equal(f.nextEnvelope.length,48);assert.ok(f.ranked.every(x=>x.day.day<days[25].day));
});
test('PCA map marks only selected day current',()=>{
  const days=buildDailyMaps({priceRows:rows(10)}),p=pcaProjection(days,8);assert.equal(p.length,9);assert.equal(p.filter(x=>x.current).length,1);
});

function h1Days(count=20){
  return Array.from({length:count},(_,dayIndex)=>{const day=`2026-02-${String(dayIndex+1).padStart(2,'0')}`,basePrice=100+dayIndex*.05;return {day,preOpen:basePrice,feature:Array(21).fill(0),h1Blocks:Array.from({length:12},(_,i)=>{const direction=Math.floor(i/2)%2? -1:1,o=basePrice+i*.01,c=o+direction*.12;return {t:dayIndex*DAY+i*4*STEP,end:dayIndex*DAY+(i*4+4)*STEP-1,day,minute:240+i*60,o,h:Math.max(o,c)+.08,l:Math.min(o,c)-.08,c,direction,quality:.8,score:80,feature:[direction,.8,.7,.6,.6,1,1,direction*.12,.28,0,0]};})};});
}
test('H1 ledger adds only locked same-direction packets',()=>{
  const map=buildAdditiveMacroMap(h1Days(3));assert.equal(map.states.length,36);assert.equal(map.states[0].ageH1,1);assert.equal(map.states[1].ageH1,2);assert.equal(map.states[2].direction,-1);assert.equal(map.states[2].ageH1,1);assert.equal(map.states[1].ageBars,8);
});
test('H1 macro forecast uses only resolved earlier episodes',()=>{
  const days=h1Days(20),f=additiveMacroForecast(days,19,{k:12,minSamples:3});assert.equal(f.ready,true);assert.equal(f.ranked.length,12);assert.ok(f.ranked.every(x=>x.episode.endIndex<f.current.index));assert.ok(f.ranked.every(x=>Number.isFinite(x.distance)&&x.distance<100));assert.equal(f.age.h1.current,2);assert.equal(macroPcaProjection(days,19).filter(x=>x.current).length,1);
});
test('walk-forward audit scores only past-trained forecasts',()=>{
  const audit=walkForwardMacroAudit(h1Days(30),{k:12,minSamples:3,minEffective:3,minIndex:3});assert.equal(audit.ready,true);assert.ok(audit.n>0);assert.ok(audit.brier>=0&&audit.brier<=1);assert.ok(audit.ageCoverage>=0&&audit.ageCoverage<=1);assert.ok(audit.boxCoverage>=0&&audit.boxCoverage<=1);assert.ok(audit.boxPadding80>=0);assert.ok(audit.brierSkill===null||Number.isFinite(audit.brierSkill));
});

