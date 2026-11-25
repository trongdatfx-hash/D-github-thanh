import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterTakerNf} from '../cluster-taker-nf.mjs';
const step=60000,bars=Array.from({length:6},(_,i)=>({t:i*step,end:(i+1)*step-1}));
const flows=new Map(bars.map((b,i)=>[b.t,{net:[100,60,-90,-120,40,-50][i]}]));
const spy=new Map(bars.map((b,i)=>[b.t,{adjusted:i<4?1:-1}]));
test('signed sum within body-color clusters; reversal resets and colors follow cumulative NF',()=>{
 const snapshot=JSON.stringify([...flows]);
 const result=clusterTakerNf(bars,flows,spy,step,360000);
 assert.deepEqual(result.map(x=>x.value),[100,160,70,-50,40,-10]);
 assert.deepEqual(result.map(x=>x.color),['#08e8a9','#08e8a9','#08e8a9','#ff4163','#08e8a9','#ff4163']);
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
test('current candle included and recomputation never double counts; zero flow is valid',()=>{
 assert.deepEqual(clusterTakerNf(bars,flows,spy,step,300000).map(x=>x.value),[100,160,70,-50,40,-10]);
 assert.deepEqual(clusterTakerNf(bars,flows,spy,step,300000),clusterTakerNf(bars,flows,spy,step,300000));
 const balanced=new Map(flows);balanced.set(step,{net:-100});assert.equal(clusterTakerNf(bars,balanced,spy,step,360000)[1].color,'#68778a');
 const zero=new Map(flows);zero.set(step,{net:0});assert.equal(clusterTakerNf(bars,zero,spy,step,360000)[1].value,100);
 assert.deepEqual(clusterTakerNf(bars,flows,spy,0,360000),[]);
});

test('live revisions replace rather than add and reclassify a color flip; future bars stay blank',()=>{
 const now=310000,changing=new Map(flows);
 changing.set(300000,{net:-5});
 assert.equal(clusterTakerNf(bars,changing,spy,step,now).at(-1).value,35);
 changing.set(300000,{net:-20});
 const updated=clusterTakerNf(bars,changing,spy,step,now);
 assert.equal(updated.at(-1).value,20);
 assert.equal(updated.at(-1).color,'#08e8a9');
 const flip=new Map(spy);flip.set(300000,{adjusted:1});
 assert.equal(clusterTakerNf(bars,changing,flip,step,now).at(-1).value,-20);
 assert.equal(clusterTakerNf(bars,changing,spy,step,299000).at(-1).value,undefined);
 assert.deepEqual(clusterTakerNf(bars,changing,spy,step,360000),updated);
});
