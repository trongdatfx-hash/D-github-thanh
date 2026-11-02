import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTrendSource,computeStudies} from '../studies-core.mjs';
import {aggregateHourlyRows} from '../h1-h4-strip.mjs';
import {h1CandleColorStates,buildWeeklyDailyPackets} from '../weekly-trend-map.mjs';
import {load} from '../data.mjs';
import {DATA_SYMBOL,sessionAt} from '../engine.mjs';
const Q=900000,H=4*Q,T=Date.parse('2026-10-30T08:00:00Z');
const bar=(t,step=Q)=>({t,end:t+step-1,o:2700,h:2705,l:2699,c:2704,v:10,q:27000,buy:17000,net:7000,sell:10000,...sessionAt(t)});
test('M15 colors share an H1 state and preview locks only at the close',()=>{
 const rows=Array.from({length:4},(_,i)=>bar(T+i*Q));
 assert(h1CandleColorStates({priceRows:rows,now:T+H-1}).every(s=>s.preview));
 assert(h1CandleColorStates({priceRows:rows,now:T+H}).every(s=>!s.preview&&s.direction===1));
});
test('H4 uses complete hourly source data and rejects a missing middle hour',()=>{
 const rows=Array.from({length:16},(_,i)=>bar(T+i*Q)),hours=aggregateHourlyRows(rows,T+4*H);
 assert.equal(hours.length,4);assert.equal(h1CandleColorStates({priceRows:hours,sourceStep:H,boxHours:4,now:T+4*H}).length,4);
 assert.equal(h1CandleColorStates({priceRows:hours.filter((_,i)=>i!==1),sourceStep:H,boxHours:4,now:T+4*H}).length,0);
});
test('day preview counts only complete H1 and quality is distinct from a probability',()=>{
 const rows=Array.from({length:7},(_,i)=>bar(T+i*Q));
 const [day]=buildWeeklyDailyPackets({priceRows:rows});assert.equal(day.blocks,1);assert(day.preview);assert.equal(day.lastTime,T+3*Q);assert.equal(day.direction,1);
});
test('integrated XAU studies publish box colors and day preview before other studies',()=>{
 const now=T+2*H+Q/2,prices=Array.from({length:9},(_,i)=>bar(T+i*Q)),raw={SPYUSDT:prices,QQQUSDT:prices};
 const trend=analyzeTrendSource(raw,now),rows={...trend.rows,SPYUSDT:prices,QQQUSDT:prices};let partial;
 const result=computeStudies({rows,volumeRows:trend.volume,symbol:'SPYUSDT',interval:'15m',options:{minScore:55,maxLines:8},now,trend,onH1Ready:(h1,h4,day)=>{partial={h1,h4,day};}});
 assert(partial.h1.length>0);assert(partial.h1.some(s=>s.preview));assert.equal(partial.day.blocks,2);assert.deepEqual(result.h1CandleColors,partial.h1);
});
test('market adapter requests XAU only and never doubles its flow',async()=>{
 assert.equal(DATA_SYMBOL,'XAUUSDT');const calls=[];
 const get=async path=>{calls.push(path);if(path.includes('exchangeInfo'))return {symbols:[{symbol:'XAUUSDT',status:'TRADING',quoteAsset:'USDT',contractType:'PERPETUAL'}]};if(path.endsWith('/time'))return {serverTime:T+H};const p=new URL('https://test'+path).searchParams;return [[T,2700,2705,2699,2704,10,T+Q-1,27000,0,0,17000]];};
 const data=await load('15m',7,{get,storage:null});assert(data.SPYUSDT.length);assert.deepEqual(data.SPYUSDT,data.QQQUSDT);assert(calls.filter(p=>p.includes('klines')).every(p=>p.includes('symbol=XAUUSDT')));
});
test('H1 chart receives H4 colors even without an M15 history archive',()=>{
 const prices=Array.from({length:8},(_,i)=>bar(T+i*H,H)),now=T+8*H;
 const result=computeStudies({rows:{SPYUSDT:prices,QQQUSDT:prices,COMPOSITE:[]},volumeRows:[],symbol:'SPYUSDT',interval:'1h',options:{minScore:55,maxLines:8},now});
 assert.equal(result.h1CandleColors.length,8);assert(result.h1CandleColors.every(s=>!s.preview));assert.deepEqual(result.h1H4CandleColors,result.h1CandleColors);
});
