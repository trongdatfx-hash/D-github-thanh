import test from 'node:test';
import assert from 'node:assert/strict';
import {chartFresh} from '../chart-live.mjs';

test('LIVE needs a recent Binance response and a fresh tail for both symbols',()=>{
 const now=1793166187158,receivedAt=now-1000;
 const bar={t:Math.floor(now/900000)*900000,end:Math.floor(now/900000)*900000+900000-1};
 const data={interval:'15m',SPYUSDT:[bar],QQQUSDT:[bar]};
 assert.equal(chartFresh(data,now,receivedAt,now),true);
 assert.equal(chartFresh({...data,historical:true},now,receivedAt,now),false);
 assert.equal(chartFresh({...data,partial:true},now,receivedAt,now),false);
 assert.equal(chartFresh(data,now,receivedAt,now+15000),false);
 assert.equal(chartFresh({...data,QQQUSDT:[{t:bar.t-900000,end:bar.end-900000}]},now,receivedAt,now),false);
});
