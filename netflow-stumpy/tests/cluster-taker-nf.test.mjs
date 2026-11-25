import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterTakerNf} from '../cluster-taker-nf.mjs';
const step=60000,bars=Array.from({length:6},(_,i)=>({t:i*step,end:(i+1)*step-1}));
const flows=new Map(bars.map((b,i)=>[b.t,{net:[100,60,-90,-120,40,-50][i]}]));
const spy=new Map(bars.map((b,i)=>[b.t,{adjusted:i<4?1:-1}]));
test('signed sum within body-color clusters; reversal resets and colors follow SPY V',()=>{
 const snapshot=JSON.stringify([...flows]);
 const result=clusterTakerNf(bars,flows,spy,step,360000);
 assert.deepEqual(result.map(x=>x.value),[100,160,70,-50,40,-10]);
 assert.deepEqual(result.map(x=>x.color),Array(4).fill('#08e8a9').concat(['#ff4163','#ff4163']));
 assert.deepEqual(result.map(x=>x.time),[0,60,120,180,240,300]);
 assert.equal(JSON.stringify([...flows]),snapshot);
});
test('missing NF or neutral SPY V breaks accumulation; no bridging gaps',()=>{
 const missing=new Map(flows);missing.delete(step);
 assert.deepEqual(clusterTakerNf(bars,missing,spy,step,360000).map(x=>x.value),[100,undefined,-90,-210,40,-10]);
 const neutral=new Map(spy);neutral.set(step,{adjusted:0});
 assert.deepEqual(clusterTakerNf(bars,flows,neutral,step,360000).map(x=>x.value),[100,undefined,-90,-210,40,-10]);
 assert.deepEqual(clusterTakerNf([bars[0],bars[2]],flows,spy,step,360000).map(x=>x.value),[100,-90]);
});
test('current candle excluded and recomputation never double counts; zero flow is valid',()=>{
 assert.deepEqual(clusterTakerNf(bars,flows,spy,step,300000).map(x=>x.value),[100,160,70,-50,40,undefined]);
 assert.deepEqual(clusterTakerNf(bars,flows,spy,step,300000),clusterTakerNf(bars,flows,spy,step,300000));
 const zero=new Map(flows);zero.set(step,{net:0});assert.equal(clusterTakerNf(bars,zero,spy,step,360000)[1].value,100);
 assert.deepEqual(clusterTakerNf(bars,flows,spy,0,360000),[]);
});
