import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionAt} from '../engine.mjs';
import {causalTrendChannels} from '../causal-trend-channel.mjs';

function breakoutRows(){
  const start=Date.UTC(2026,7,10,8),rows=[];
  for(let i=0;i<34;i++){
    const t=start+i*900000,base=i<20?100+i*.12+(i%2?.08:-.08):i===20?98.8:i===21?98.1:98.1-(i-21)*.32,meta=sessionAt(t);
    rows.push({t,end:t+899999,o:base+.08,h:base+.22,l:base-.2,c:base,net:i<20?200:-1200-i*10,...meta});
  }
  return rows;
}

test('Kênh trend causal starts on an SPY V-aligned breakout and confirms on the next candle',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,maxHistory:5}),trend=state.trends[0];
  assert(trend,JSON.stringify(state));assert.equal(trend.direction,-1);assert.equal(trend.breakoutTime,rows[20].t);assert.equal(trend.startTime,rows[16].t);assert.equal(trend.originBars,4);assert.equal(trend.confirmationTime,rows[21].t);assert(trend.startVolumeStrength<0);assert(trend.endTime>=trend.confirmationTime);assert(trend.upperStart>trend.lowerStart);assert(trend.upperEnd>trend.lowerEnd);
  const extendedRows=[...rows,{...rows.at(-1),t:rows.at(-1).t+900000,end:rows.at(-1).end+900000,o:97,h:110,l:96,c:109}],extendedVolume=[...volumeRows,{t:rows.at(-1).t+900000,adjusted:1}],extended=causalTrendChannels(extendedRows,{volumeRows:extendedVolume,maxHistory:5}).trends[0];
  assert.equal(extended.startTime,trend.startTime);assert.equal(extended.confirmationTime,trend.confirmationTime);
});

test('Kênh trend causal does not emit an unconfirmed last-candle breakout',()=>{
  const rows=breakoutRows().slice(0,21),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,maxHistory:5});assert.equal(state.trends.length,0);
});

test('Kênh trend causal waits until SPY V sign agrees with breakout direction',()=>{
  const rows=breakoutRows(),volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index>=22?-.7:.7})),state=causalTrendChannels(rows,{volumeRows,maxHistory:5}),trend=state.trends[0];
  assert(trend,JSON.stringify(state));assert.equal(trend.breakoutTime,rows[20].t);assert.equal(trend.startTime,rows[22].t);assert.equal(trend.confirmationTime,rows[22].t);assert.equal(trend.startVolumeStrength,-.7);
});

test('Flow-Leg defaults require eight candles and expose the reference setup',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),short=causalTrendChannels(rows.slice(0,22),{volumeRows:volumeRows.slice(0,22)}),trend=causalTrendChannels(rows,{volumeRows}).trends[0];
  assert.equal(short.trends.length,0);assert(trend);assert.equal(trend.flowDeadband,.15);assert.equal(trend.minLegBars,8);assert.equal(trend.minDisplayR2,.2);assert(trend.lineWidth>=2&&trend.lineWidth<=5);assert(Number.isFinite(trend.netDeltaTotal));
});

test('confirmed short Flow-Legs stay in survival episodes even when hidden from the chart',()=>{
  const rows=breakoutRows().slice(0,23),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,maxHistory:5});
  assert.equal(state.trends.length,0);assert.equal(state.episodes.length,1);assert(state.episodes[0].bars<8);assert.equal(state.episodes[0].displayQualified,false);assert.equal(state.totalEpisodes,1);
});

test('Kênh trend causal defaults to a wider two-sigma envelope',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),wide=causalTrendChannels(rows,{volumeRows,maxHistory:5}).trends[0],oldWidth=causalTrendChannels(rows,{volumeRows,channelSigma:1.25,maxHistory:5}).trends[0];
  assert(wide&&oldWidth);assert((wide.upperStart-wide.lowerStart)>(oldWidth.upperStart-oldWidth.lowerStart));
});

test('one adverse two-sigma close is absorbed and refitted into the active leg',()=>{
  const rows=breakoutRows(),last=rows.at(-1),t=last.t+900000,meta=sessionAt(t),shock={t,end:t+899999,o:last.c,h:last.c+20,l:last.c-1,c:last.c+18,...meta},extended=[...rows,shock],volumeRows=extended.map(row=>({t:row.t,adjusted:-.7})),trend=causalTrendChannels(extended,{volumeRows,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.exitTime,null);assert.equal(trend.insideEndTime,shock.t);assert.equal(trend.bars,extended.length-16);assert.equal(trend.adverseExitBars,2);
});

test('two consecutive adverse closes end a causal trend channel',()=>{
  const rows=breakoutRows(),last=rows.at(-1),t1=last.t+900000,meta1=sessionAt(t1),first={t:t1,end:t1+899999,o:last.c,h:last.c+20,l:last.c-1,c:last.c+18,...meta1},t2=t1+900000,meta2=sessionAt(t2),second={t:t2,end:t2+899999,o:first.c,h:first.c+30,l:first.c-1,c:first.c+28,...meta2},extended=[...rows,first,second],volumeRows=extended.map(row=>({t:row.t,adjusted:-.7})),trend=causalTrendChannels(extended,{volumeRows,minDisplayR2:0,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.exitTime,second.t);assert.equal(trend.exitReason,'adverse-price-exit');assert.equal(trend.insideEndTime,first.t);assert.equal(trend.bars,rows.length-16+1);
});

test('a downtrend accepts a close below minus two sigma and refits the leg',()=>{
  const rows=breakoutRows(),last=rows.at(-1),t=last.t+900000,meta=sessionAt(t),expansion={t,end:t+899999,o:last.c,h:last.c+.2,l:last.c-20,c:last.c-18,net:-5000,...meta},extended=[...rows,expansion],volumeRows=extended.map(row=>({t:row.t,adjusted:-.7})),trend=causalTrendChannels(extended,{volumeRows,maxHistory:12}).trends[0];
  assert(trend);assert.equal(trend.exitTime,null);assert.equal(trend.insideEndTime,expansion.t);assert.equal(trend.bars,extended.length-16);assert(trend.points.at(-1).favorableExpansion);assert.equal(trend.renderPoints.length,trend.bars);
});

test('display rails are one straight final OLS channel',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),trend=causalTrendChannels(rows,{volumeRows}).trends[0],slopes=trend.renderPoints.slice(1).map((point,index)=>point.center-trend.renderPoints[index].center);
  assert(trend);assert(slopes.every(value=>Math.abs(value-slopes[0])<1e-10));assert(trend.renderPoints.every(point=>Math.abs((point.upper-point.center)-(point.center-point.lower))<1e-10));
});

test('R² and two-sigma distribution refit causally as accepted M15 candles arrive',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),full=causalTrendChannels(rows,{volumeRows,maxHistory:5}).trends[0],prefixRows=rows.slice(0,30),prefix=causalTrendChannels(prefixRows,{volumeRows:volumeRows.slice(0,30),maxHistory:5}).trends[0];
  assert(full&&prefix);assert.equal(full.points.length,full.bars);assert(new Set(full.points.map(point=>point.r2.toFixed(6))).size>3);assert(Number.isFinite(full.adaptiveR2));assert.deepEqual(full.points.filter(point=>point.time<=prefixRows.at(-1).t),prefix.points);
});

test('SPY V dead-band holds an active leg through small zero-line noise',()=>{
  const rows=breakoutRows(),volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index<22?-.7:index<30?(index%2?.06:-.08):-.45})),trend=causalTrendChannels(rows,{volumeRows,flowDeadband:.12,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.startTime,rows[16].t);assert.equal(trend.exitReason,null);assert.equal(trend.bars,rows.length-16);assert.equal(trend.flowDeadband,.12);
});

test('one short opposite SPY V pulse stays inside the active leg',()=>{
  const rows=breakoutRows(),pulseIndex=29,volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index===pulseIndex?.45:-.7})),trend=causalTrendChannels(rows,{volumeRows,flowDeadband:.12,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.exitTime,null);assert.equal(trend.bars,rows.length-16);assert.equal(trend.flowFlipBars,2);
});

test('SPY V closes a confirmed leg after two consecutive opposite dead-band candles',()=>{
  const rows=breakoutRows(),flipIndex=29,volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index<flipIndex?-.7:index===flipIndex?.05:.45})),trend=causalTrendChannels(rows,{volumeRows,flowDeadband:.12,maxHistory:5}).trends[0];
  assert(trend);assert.equal(trend.exitTime,rows[flipIndex+2].t);assert.equal(trend.exitReason,'flow-flip');assert.equal(trend.insideEndTime,rows[flipIndex+1].t);assert.equal(trend.bars,flipIndex-16+2);
});
