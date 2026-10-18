import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionAt} from '../engine.mjs';
import {causalTrendChannels} from '../causal-trend-channel.mjs';

function breakoutRows(){
  const start=Date.UTC(2026,7,10,8),rows=[];
  for(let i=0;i<34;i++){
    const t=start+i*900000,base=i<20?100+i*.12+(i%2?.08:-.08):i===20?98.8:i===21?98.1:98.1-(i-21)*.32,meta=sessionAt(t);
    rows.push({t,end:t+899999,o:base+.08,h:base+.22,l:base-.2,c:base,...meta});
  }
  return rows;
}

test('Kênh trend causal starts on an SPY V-aligned breakout and confirms on the next candle',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5}),trend=state.trends[0];
  assert(trend,JSON.stringify(state));assert.equal(trend.direction,-1);assert.equal(trend.breakoutTime,rows[20].t);assert.equal(trend.startTime,rows[20].t);assert.equal(trend.confirmationTime,rows[21].t);assert(trend.startVolumeStrength<0);assert(trend.endTime>=trend.confirmationTime);assert(trend.upperStart>trend.lowerStart);assert(trend.upperEnd>trend.lowerEnd);
  const extendedRows=[...rows,{...rows.at(-1),t:rows.at(-1).t+900000,end:rows.at(-1).end+900000,o:97,h:110,l:96,c:109}],extendedVolume=[...volumeRows,{t:rows.at(-1).t+900000,adjusted:1}],extended=causalTrendChannels(extendedRows,{volumeRows:extendedVolume,minPriorR2:.2,maxHistory:5}).trends[0];
  assert.equal(extended.startTime,trend.startTime);assert.equal(extended.confirmationTime,trend.confirmationTime);
});

test('Kênh trend causal does not emit an unconfirmed last-candle breakout',()=>{
  const rows=breakoutRows().slice(0,21),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5});assert.equal(state.trends.length,0);
});

test('Kênh trend causal waits until SPY V sign agrees with breakout direction',()=>{
  const rows=breakoutRows(),volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index===22?-.7:.7})),state=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5}),trend=state.trends[0];
  assert(trend,JSON.stringify(state));assert.equal(trend.breakoutTime,rows[20].t);assert.equal(trend.startTime,rows[22].t);assert.equal(trend.confirmationTime,rows[22].t);assert.equal(trend.startVolumeStrength,-.7);
});

test('Kênh trend causal defaults to a wider two-sigma envelope',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),wide=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5}).trends[0],oldWidth=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,channelSigma:1.25,maxHistory:5}).trends[0];
  assert(wide&&oldWidth);assert((wide.upperStart-wide.lowerStart)>(oldWidth.upperStart-oldWidth.lowerStart));
});

test('Kênh trend causal stops on the first M15 close outside two sigma',()=>{
  const rows=breakoutRows(),last=rows.at(-1),t=last.t+900000,meta=sessionAt(t),exit={t,end:t+899999,o:last.c,h:last.c+20,l:last.c-1,c:last.c+18,...meta},extended=[...rows,exit],volumeRows=extended.map(row=>({t:row.t,adjusted:-.7})),trend=causalTrendChannels(extended,{volumeRows,minPriorR2:.2,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.exitTime,exit.t);assert.equal(trend.endTime,exit.t);assert.equal(trend.insideEndTime,last.t);assert.equal(trend.bars,rows.length-20);
});

test('R² and two-sigma distribution refit causally as accepted M15 candles arrive',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),full=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5}).trends[0],prefixRows=rows.slice(0,30),prefix=causalTrendChannels(prefixRows,{volumeRows:volumeRows.slice(0,30),minPriorR2:.2,maxHistory:5}).trends[0];
  assert(full&&prefix);assert.equal(full.points.length,full.bars);assert(new Set(full.points.map(point=>point.r2.toFixed(6))).size>3);assert(Number.isFinite(full.adaptiveR2));assert.deepEqual(full.points.filter(point=>point.time<=prefixRows.at(-1).t),prefix.points);
});

test('SPY V dead-band holds an active leg through small zero-line noise',()=>{
  const rows=breakoutRows(),volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index<22?-.7:index<30?(index%2?.06:-.08):-.45})),trend=causalTrendChannels(rows,{volumeRows,minPriorR2:.99,flowDeadband:.12,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.startTime,rows[20].t);assert.equal(trend.exitReason,null);assert.equal(trend.bars,rows.length-20);assert.equal(trend.flowDeadband,.12);
});

test('SPY V closes a confirmed leg only after crossing the opposite dead-band',()=>{
  const rows=breakoutRows(),flipIndex=29,volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index<flipIndex?-.7:index===flipIndex?.05:.45})),trend=causalTrendChannels(rows,{volumeRows,flowDeadband:.12,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.exitTime,rows[flipIndex+1].t);assert.equal(trend.exitReason,'flow-flip');assert.equal(trend.insideEndTime,rows[flipIndex].t);assert.equal(trend.bars,flipIndex-20+1);
});
