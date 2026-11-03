import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeeklyDailyPackets,weeklyTrendForecast} from '../weekly-trend-map.mjs';

const STEP=900000,DAY=86400000,base=Date.UTC(2025,0,6,5); // 00:00 New York
function rows(weeks=9){const out=[];let day=0,t=base;while(day<weeks*5){const wd=new Date(t).getUTCDay();if(wd>0&&wd<6){const direction=1;for(let i=0;i<64;i++){const x=t+i*STEP,o=100+day*.08+direction*i*.01,c=o+direction*.03;out.push({t:x,end:x+STEP-1,o,h:Math.max(o,c)+.04,l:Math.min(o,c)-.04,c,q:100,buy:65,net:30});}day++;}t+=DAY;}return out;}
function states(price){return price.map((x,i)=>({t:x.t,active:true,direction:1,currentBars:i%64+1,continuation:.7,reliable:true}));}
test('daily packets lock sixteen H1 blocks for a complete day',()=>{const p=rows(2),d=buildWeeklyDailyPackets({priceRows:p,trendStates:states(p)});assert.equal(d.length,10);assert.ok(d.every(x=>x.complete&&x.blocks===16));});
test('weekly forecast uses only earlier resolved weeks',()=>{const p=rows(9),f=weeklyTrendForecast({priceRows:p,trendStates:states(p),now:p.at(-1).end+1,k:20});assert.equal(f.ready,true);assert.ok(f.ranked.every(x=>x.key<f.week));assert.ok(Number.isFinite(f.neff));assert.equal(f.cells.length,5);});
test('holiday-shortened week keeps weekday cells aligned',()=>{const all=rows(9),days=[...new Set(all.map(x=>new Date(x.t).toISOString().slice(0,10)))],monday=days.at(-5),p=all.filter(x=>new Date(x.t).toISOString().slice(0,10)!==monday),f=weeklyTrendForecast({priceRows:p,trendStates:states(p),now:p.at(-1).end+1,k:20});assert.equal(f.cells[0].name,'Mon');assert.equal(f.cells[0].packet,null);assert.equal(f.cells[1].packet.weekday,'Tue');assert.equal(f.cells[4].packet.weekday,'Fri');});

test('day preview starts at NY midnight, including DST season',()=>{
 for(const start of ['2026-01-06T05:00:00Z','2026-07-06T04:00:00Z']){
  const t=Date.parse(start),p=Array.from({length:8},(_,i)=>({t:t+i*STEP,end:t+(i+1)*STEP-1,o:100,h:102,l:99,c:101}));
  const first=buildWeeklyDailyPackets({priceRows:p,now:t+30*60000});assert.equal(first.length,1);assert.equal(first[0].blocks,0);assert.equal(first[0].direction,0);
  const one=buildWeeklyDailyPackets({priceRows:p,now:t+3600000});assert.equal(one[0].blocks,1);assert.equal(one[0].o,100);assert.equal(one[0].progress,1/16);
  const two=buildWeeklyDailyPackets({priceRows:p,now:t+2*3600000});assert.equal(two[0].blocks,2);
  assert.equal(buildWeeklyDailyPackets({priceRows:p.slice(1),now:t+2*3600000}).length,0);
 }
});
test('missing M15 stops day age at last complete contiguous H1',()=>{
 const p=rows(1).slice(0,12).filter((_,i)=>i!==5),packet=buildWeeklyDailyPackets({priceRows:p})[0];assert.equal(packet.blocks,1);assert(packet.preview);
});

test('new day shows WAIT zero without carrying previous day age into preview',()=>{
 const p=rows(1).slice(0,65),now=base+86400000+30*60000,f=weeklyTrendForecast({priceRows:p,now});
 assert.equal(f.cells[1].packet.blocks,0);assert.equal(f.cells[1].packet.direction,0);assert(f.cells[1].packet.preview);assert.equal(f.current.days.length,1);
});
