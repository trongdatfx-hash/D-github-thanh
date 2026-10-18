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

test('Kênh trend causal confirms after the breakout and freezes its historical start',()=>{
  const rows=breakoutRows(),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5}),trend=state.trends[0];
  assert(trend,JSON.stringify(state));assert.equal(trend.direction,-1);assert.equal(trend.breakoutTime,rows[20].t);assert.equal(trend.startTime,rows[21].t);assert.equal(trend.confirmationTime,rows[21].t);assert(trend.startVolumeStrength<0);assert(trend.endTime>=trend.confirmationTime);assert(trend.upperStart>trend.lowerStart);assert(trend.upperEnd>trend.lowerEnd);
  const extendedRows=[...rows,{...rows.at(-1),t:rows.at(-1).t+900000,end:rows.at(-1).end+900000,o:97,h:110,l:96,c:109}],extendedVolume=[...volumeRows,{t:rows.at(-1).t+900000,adjusted:1}],extended=causalTrendChannels(extendedRows,{volumeRows:extendedVolume,minPriorR2:.2,maxHistory:5}).trends[0];
  assert.equal(extended.startTime,trend.startTime);assert.equal(extended.confirmationTime,trend.confirmationTime);
});

test('Kênh trend causal does not emit an unconfirmed last-candle breakout',()=>{
  const rows=breakoutRows().slice(0,21),volumeRows=rows.map(row=>({t:row.t,adjusted:-.7})),state=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5});assert.equal(state.trends.length,0);
});

test('Kênh trend causal waits until SPY V sign agrees with breakout direction',()=>{
  const rows=breakoutRows(),volumeRows=rows.map((row,index)=>({t:row.t,adjusted:index===22?-.7:.7})),state=causalTrendChannels(rows,{volumeRows,minPriorR2:.2,maxHistory:5}),trend=state.trends[0];
  assert(trend,JSON.stringify(state));assert.equal(trend.breakoutTime,rows[20].t);assert.equal(trend.startTime,rows[22].t);assert.equal(trend.startVolumeStrength,-.7);
});
