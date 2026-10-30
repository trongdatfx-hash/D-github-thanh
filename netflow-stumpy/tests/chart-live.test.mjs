import test from 'node:test';
import assert from 'node:assert/strict';
import {chartFresh,liveTrendAgeState} from '../chart-live.mjs';

test('LIVE needs one recent complete response and the same fresh tail for both symbols',()=>{
 const step=900000,now=Date.parse('2026-10-28T05:00:05Z'),receivedAt=now-1000,boundary=Math.floor(now/step)*step;
 const current={t:boundary,end:boundary+step-1},previous={t:boundary-step,end:boundary-1};
 const data={interval:'15m',SPYUSDT:[current],QQQUSDT:[current]};
 assert.equal(chartFresh(data,now,receivedAt,now),true);
 assert.equal(chartFresh({...data,historical:true},now,receivedAt,now),false);
 assert.equal(chartFresh({...data,partial:true},now,receivedAt,now),false);
 assert.equal(chartFresh(data,now,receivedAt,now+15000),false);
 assert.equal(chartFresh({...data,SPYUSDT:undefined},now,receivedAt,now),false);
 assert.equal(chartFresh({...data,QQQUSDT:[]},now,receivedAt,now),false);
 assert.equal(chartFresh({...data,QQQUSDT:[previous]},now,receivedAt,now),false);
 assert.equal(chartFresh({...data,QQQUSDT:[{...current,end:current.end-1}]},now,receivedAt,now),false);
});

test('DELAYED suppresses only provisional trend-age state',()=>{
 const provisional={label:'UP',provisional:true},closed={label:'DOWN',provisional:false};
 assert.equal(liveTrendAgeState(provisional,false),null);
 assert.equal(liveTrendAgeState(provisional,true),provisional);
 assert.equal(liveTrendAgeState(closed,false),closed);
 assert.equal(liveTrendAgeState(undefined,false),null);
});
