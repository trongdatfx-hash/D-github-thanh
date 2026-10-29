import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeeklyDailyPackets,weeklyTrendForecast} from '../weekly-trend-map.mjs';

const STEP=900000,DAY=86400000,base=Date.UTC(2025,0,6,9); // 04:00 New York
function rows(weeks=9){const out=[];let day=0,t=base;while(day<weeks*5){const wd=new Date(t).getUTCDay();if(wd>0&&wd<6){const direction=1;for(let i=0;i<48;i++){const x=t+i*STEP,o=100+day*.08+direction*i*.01,c=o+direction*.03;out.push({t:x,end:x+STEP-1,o,h:Math.max(o,c)+.04,l:Math.min(o,c)-.04,c,q:100,buy:65,net:30});}day++;}t+=DAY;}return out;}
function states(price){return price.map((x,i)=>({t:x.t,active:true,direction:1,currentBars:i%48+1,continuation:.7,reliable:true}));}
test('daily packets lock twelve H1 blocks for a complete day',()=>{const p=rows(2),d=buildWeeklyDailyPackets({priceRows:p,trendStates:states(p)});assert.equal(d.length,10);assert.ok(d.every(x=>x.complete&&x.blocks===12));});
test('weekly forecast uses only earlier resolved weeks',()=>{const p=rows(9),f=weeklyTrendForecast({priceRows:p,trendStates:states(p),now:p.at(-1).end+1,k:20});assert.equal(f.ready,true);assert.ok(f.ranked.every(x=>x.key<f.week));assert.ok(Number.isFinite(f.neff));assert.equal(f.cells.length,5);});
