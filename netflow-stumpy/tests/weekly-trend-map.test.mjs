import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeeklyDailyPackets,weeklyTrendForecast} from '../weekly-trend-map.mjs';

const STEP=900000,DAY=86400000,base=Date.UTC(2025,0,6,5); // 00:00 New York
function rows(weeks=9){const out=[];let day=0,t=base;while(day<weeks*5){const wd=new Date(t).getUTCDay();if(wd>0&&wd<6){const direction=1;for(let i=0;i<96;i++){const x=t+i*STEP,o=100+day*.08+direction*i*.01,c=o+direction*.03;out.push({t:x,end:x+STEP-1,o,h:Math.max(o,c)+.04,l:Math.min(o,c)-.04,c,q:100,buy:65,net:30});}day++;}t+=DAY;}return out;}
function states(price){return price.map((x,i)=>({t:x.t,active:true,direction:1,currentBars:i%96+1,continuation:.7,reliable:true}));}
test('daily packets lock twenty-four H1 blocks for a complete day',()=>{const p=rows(2),d=buildWeeklyDailyPackets({priceRows:p,trendStates:states(p)});assert.equal(d.length,10);assert.ok(d.every(x=>x.complete&&x.blocks===24));});
test('weekly forecast uses only earlier resolved weeks',()=>{const p=rows(9),f=weeklyTrendForecast({priceRows:p,trendStates:states(p),now:p.at(-1).end+1,k:20});assert.equal(f.ready,true);assert.ok(f.ranked.every(x=>x.key<f.week));assert.ok(Number.isFinite(f.neff));assert.equal(f.cells.length,7);});
test('holiday-shortened week keeps weekday cells aligned',()=>{const all=rows(9),days=[...new Set(all.map(x=>new Date(x.t).toLocaleDateString('en-CA',{timeZone:'America/New_York'})))],monday=days.at(-5),p=all.filter(x=>new Date(x.t).toLocaleDateString('en-CA',{timeZone:'America/New_York'})!==monday),f=weeklyTrendForecast({priceRows:p,trendStates:states(p),now:p.at(-1).end+1,k:20});assert.equal(f.cells[0].name,'Mon');assert.equal(f.cells[0].packet,null);assert.equal(f.cells[1].packet.weekday,'Tue');assert.equal(f.cells[4].packet.weekday,'Fri');});

test('day preview starts at NY midnight, including DST season',()=>{
 for(const start of ['2026-01-06T05:00:00Z','2026-07-06T04:00:00Z']){
  const t=Date.parse(start),p=Array.from({length:8},(_,i)=>({t:t+i*STEP,end:t+(i+1)*STEP-1,o:100,h:102,l:99,c:101}));
  const first=buildWeeklyDailyPackets({priceRows:p,now:t+30*60000});assert.equal(first.length,1);assert.equal(first[0].blocks,0);assert.equal(first[0].direction,0);
  const one=buildWeeklyDailyPackets({priceRows:p,now:t+3600000});assert.equal(one[0].blocks,1);assert.equal(one[0].o,100);assert.equal(one[0].progress,1/24);
  const two=buildWeeklyDailyPackets({priceRows:p,now:t+2*3600000});assert.equal(two[0].blocks,2);
  assert.equal(buildWeeklyDailyPackets({priceRows:p.slice(1),now:t+2*3600000}).length,0);
 }
});
test('missing M15 stops day age at last complete contiguous H1',()=>{
 const p=rows(1).slice(0,12).filter((_,i)=>i!==5),packet=buildWeeklyDailyPackets({priceRows:p})[0];assert.equal(packet.blocks,1);assert(packet.preview);
});

test('new day shows WAIT zero without carrying previous day age into preview',()=>{
 const p=rows(1).slice(0,97),now=base+86400000+30*60000,f=weeklyTrendForecast({priceRows:p,now});
 assert.equal(f.cells[1].packet.blocks,0);assert.equal(f.cells[1].packet.direction,0);assert(f.cells[1].packet.preview);assert.equal(f.current.days.length,1);
});

function continuousDay(start,hours){const t=Date.parse(start);return Array.from({length:hours*4},(_,i)=>({t:t+i*STEP,end:t+(i+1)*STEP-1,o:100,h:102,l:99,c:101}));}
test('preview keeps counting after RTH and locks only at the next midnight',()=>{
 const p=continuousDay('2026-11-03T05:00:00Z',24),t=p[0].t;
 for(const hours of [16,17,20,23]){const [d]=buildWeeklyDailyPackets({priceRows:p,now:t+hours*3600000});assert.equal(d.blocks,hours);assert(d.preview);assert(!d.complete);}
 const [d]=buildWeeklyDailyPackets({priceRows:p,now:t+24*3600000});assert.equal(d.blocks,24);assert(d.complete);assert(!d.preview);
});
test('Saturday and Sunday have their own preview packets and weekly cells',()=>{
 const sat=continuousDay('2026-11-07T05:00:00Z',24),sun=continuousDay('2026-11-08T05:00:00Z',24),p=[...sat,...sun],now=sun[0].t+3*3600000;
 const d=buildWeeklyDailyPackets({priceRows:p,now});assert.equal(d[0].weekday,'Sat');assert.equal(d[0].blocks,24);assert(d[0].complete);assert.equal(d[1].weekday,'Sun');assert.equal(d[1].blocks,3);assert(d[1].preview);
 const f=weeklyTrendForecast({priceRows:p,now});assert.equal(f.cells[5].packet.weekday,'Sat');assert.equal(f.cells[6].packet.blocks,3);
});
test('DST transition Sundays count actual complete hours without a gap or duplicate age',()=>{
 for(const [start,hours] of [['2026-03-08T05:00:00Z',23],['2026-11-01T04:00:00Z',25]]){
  const p=continuousDay(start,hours),[d]=buildWeeklyDailyPackets({priceRows:p,now:p.at(-1).end+1});assert.equal(d.blocks,hours);assert(d.complete);assert.equal(d.progress,1);assert.equal(d.weekday,'Sun');
 }
});
