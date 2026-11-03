import test from 'node:test';
import assert from 'node:assert/strict';
import {oiCandleBars,oiCandleDirection} from '../oi-candle-bars.mjs';
const step=900000,t=Date.parse('2026-11-03T15:00:00Z'),now=t+step+1;
const up={t,end:t+step-1,o:10,h:12,l:9,c:11},down={...up,o:11,c:10};
function run(row=up,{v=1,nf=20,delta=5,oi=true,clock=now,options={}}={}){
  return oiCandleBars([row],[{t,value:v}],[{t,net:nf}],oi?new Map([[t-step,{oi:100}],[t,{oi:100+delta}]]):new Map(),step,clock,options);
}
test('plots magnitude at exact candle time for both signs',()=>{
  const a=run(),b=run(down,{v:-2,nf:-3,delta:-5});
  assert.equal(a.data[0].time,t/1000);assert.equal(a.data[0].value,5);assert.equal(b.data[0].value,5);
  assert.notEqual(a.data[0].color,b.data[0].color);assert.equal(b.points.get(t).delta,-5);
});
test('rejects every disagreement, zero and missing input',()=>{
  for(const opts of [{v:-1},{nf:-1},{delta:-1},{v:0},{nf:0},{delta:0},{v:NaN},{nf:null},{oi:false}])assert.equal(run(up,opts).data[0].value,undefined);
});
test('excludes open candles, yesterday and missing midnight baseline',()=>{
  assert.equal(run(up,{clock:t+step-1}).eligible,0);
  assert.equal(run(up,{clock:Date.parse('2026-11-04T05:01:00Z')}).eligible,0);
  const missing=oiCandleBars([up],[{t,value:1}],[{t,net:1}],new Map([[t,{oi:100}]]),step,now);
  assert.equal(missing.eligible,0);
});
test('pin rejection corrects direction without changing source histogram',()=>{
  const pin={...up,o:10,c:10.1,l:9.9,h:12};
  assert.equal(oiCandleDirection(pin),-1);assert.equal(run(pin).matched,0);
  assert.equal(run(pin,{options:{filterPin:false}}).matched,1);
  assert.equal(oiCandleDirection({...pin,o:10.1,c:10,h:10.2,l:8}),1);
  assert.equal(oiCandleDirection({...up,c:10}),0);
});
test('future rows cannot alter earlier bars',()=>{
  const before=run();
  const after=oiCandleBars([up,{...down,t:t+step,end:t+2*step-1}],[{t,value:1}],[{t,net:20}],new Map([[t-step,{oi:100}],[t,{oi:105}]]),step,now);
  assert.deepEqual(after.data[0],before.data[0]);assert.equal(after.data[1].value,undefined);
});
