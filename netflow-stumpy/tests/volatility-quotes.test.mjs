import test from 'node:test';
import assert from 'node:assert/strict';
import {sp500AlertState,volatilityQuoteState} from '../volatility-quotes.mjs';
const now=Date.parse('2026-11-03T18:00:00Z'),quote={price:20,asOf:now-15*60000,changePct:-1.5,sessionChangePct:.75,fetchStatus:'ok'};
test('valid delayed quote retains source timestamp and both change bases',()=>{const s=volatilityQuoteState(quote,now);assert.equal(s.status,'DELAYED · ~15 phút');assert.equal(s.lagMinutes,15);assert.equal(s.asOf,quote.asOf);assert.equal(s.changePct,-1.5);assert.equal(s.sessionChangePct,.75);});
test('elapsed time and failed updates mark retained values stale',()=>{for(const s of [volatilityQuoteState(quote,now+21*60000),volatilityQuoteState({...quote,fetchStatus:'error'},now),volatilityQuoteState(quote,now,true)]){assert.equal(s.status,'DỮ LIỆU CŨ');assert.equal(s.asOf,quote.asOf);assert.equal(s.price,20);}});
test('missing, invalid and future quotes cannot look current',()=>{for(const q of [null,{}, {...quote,price:NaN},{...quote,price:-1},{...quote,asOf:now+120000}])assert.equal(volatilityQuoteState(q,now).status,'WAIT');});

test('SP500 warning uses current-session move from the session open, never previous close',()=>{
 assert.equal(sp500AlertState({...quote,changePct:9,sessionChangePct:1.31},now).volatile,true);
 assert.equal(sp500AlertState({...quote,changePct:9,sessionChangePct:-1.31},now).volatile,true);
 assert.equal(sp500AlertState({...quote,changePct:9,sessionChangePct:1.3},now).volatile,false);
 assert.equal(sp500AlertState({...quote,changePct:9,sessionChangePct:null},now).volatile,false);
 assert.equal(sp500AlertState({...quote,changePct:9,sessionChangePct:2,fetchStatus:'error'},now).volatile,true);
});
