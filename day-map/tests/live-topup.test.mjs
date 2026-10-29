import test from 'node:test';
import assert from 'node:assert/strict';
import {STEP,closedContiguousKlines,closedWsKline,collectionFor,topUpLive,trimToCommonEnd} from '../live-topup.mjs';

const raw=(t,close='101')=>[t,'100','102','99',close,'10',t+STEP-1,'1000',0,0,'600'];
const row=k=>{const [t,o,h,l,c,v,end,q,buy]=k.map(Number);return {t,o,h,l,c,v,end,q,buy};};

test('REST top-up accepts only the closed contiguous prefix',()=>{
  const start=Date.UTC(2026,9,29,0),now=start+4*STEP;
  const out=closedContiguousKlines([raw(start+STEP),raw(start+2*STEP),raw(start+3*STEP)],{afterT:start,now});
  assert.deepEqual(out.map(x=>x[0]),[start+STEP,start+2*STEP,start+3*STEP]);
  assert.equal(closedContiguousKlines([raw(start+2*STEP)],{afterT:start,now}).length,0);
  assert.equal(closedContiguousKlines([raw(start+4*STEP)],{afterT:start+3*STEP,now}).length,0);
});

test('two symbols are trimmed to the same close',()=>{
  const a=[[0],[STEP],[2*STEP]],b=[[0],[STEP]];const [x,y]=trimToCommonEnd(a,b);
  assert.equal(x.at(-1)[0],STEP);assert.equal(y.at(-1)[0],STEP);
});

test('top-up keeps paired closed bars and marks browser collection live',async()=>{
  const start=Date.UTC(2026,9,29,0),now=start+3*STEP;
  const base={manifest:{interval:'15m',lastTime:start,collection:{status:'delayed'}},SPYUSDT:[row(raw(start))],QQQUSDT:[row(raw(start))]};
  const fetchImpl=async url=>({ok:true,json:async()=>url.includes('SPYUSDT')?[raw(start+STEP),raw(start+2*STEP)]:[raw(start+STEP),raw(start+2*STEP)]});
  const result=await topUpLive(base,row,{now,fetchImpl});
  assert.equal(result.manifest.topUp.status,'ok');assert.equal(result.manifest.topUp.added,2);assert.equal(result.manifest.collection.status,'live');assert.equal(result.SPYUSDT.length,3);assert.equal(result.QQQUSDT.at(-1).t,start+2*STEP);
});

test('websocket parser ignores open candles and accepts a closed one',()=>{
  const t=Date.UTC(2026,9,29,0),k={s:'SPYUSDT',i:'15m',x:false,t,T:t+STEP-1,o:'100',h:'102',l:'99',c:'101',v:'10',q:'1000',V:'600'};
  assert.equal(closedWsKline({data:{k}}),null);k.x=true;assert.equal(closedWsKline({data:{k}}).row[0],t);
  assert.equal(collectionFor({lastBySymbol:{a:t,b:t},checkedAt:t+STEP+1000,source:'browser-ws'}).status,'live');
});
