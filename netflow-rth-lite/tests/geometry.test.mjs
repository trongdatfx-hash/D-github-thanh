import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STEPS,parseKlines,composite,analyze} from '../engine.mjs';
import {causalAtr,confirmedPricePivots,analyzeGeometry,classifyBreakoutRetest,recentCausalLineStates,backtestGeometry} from '../geometry.mjs';

function synthetic(length=240){
  const step=STEPS['15m'],price=[],spy=[],qqq=[],flow=[],volume=[];
  for(let index=0;index<length;index++){
    const wave=Math.sin(index*Math.PI/10),c=100-.025*index+2.2*wave,t=index*step,end=t+step-1;
    price.push({t,end,o:c-.08,h:c+.32,l:c-.32,c,q:100,buy:50,net:0,nf:0,day:'2026-10-14',session:'RTH'});
    spy.push({t,adjusted:-.72+.0045*index+.3*wave});
    qqq.push({t,adjusted:-.62+.0035*index+.24*wave});
    flow.push({t,nf:-18+.14*index+9*wave});
    volume.push({t,adjusted:-.55+.004*index+.2*wave});
  }
  return {price,spy,qqq,flow,volume};
}

test('ATR and pivot confirmation are prefix-causal with an explicit two-bar delay',()=>{
  const data=synthetic(),options={left:2,right:2,minProminenceAtr:.03},fullAtr=causalAtr(data.price),full=confirmedPricePivots(data.price,options);
  assert(full.length>12);assert(full.every(pivot=>pivot.confirmedIndex===pivot.index+2&&pivot.confirmedAt===data.price[pivot.index+2].t));
  for(const length of [60,120,180,220]){
    assert.deepEqual(causalAtr(data.price.slice(0,length)),fullAtr.slice(0,length));
    assert.deepEqual(confirmedPricePivots(data.price.slice(0,length),options),full.filter(pivot=>pivot.confirmedIndex<length));
  }
  const changed=data.price.map((bar,index)=>index>=180?{...bar,h:bar.h+50,l:bar.l-50,c:bar.c+20}:bar);
  assert.deepEqual(confirmedPricePivots(changed.slice(0,180),options),full.filter(pivot=>pivot.confirmedIndex<180));
});

test('divergences are emitted only at confirmation time and remain unchanged by future bars',()=>{
  const data=synthetic(),options={left:2,right:2,minProminenceAtr:.03,minScore:0,maxLines:6},full=analyzeGeometry(data,options);
  assert(full.events.some(event=>event.direction==='bullish'));assert(full.events.some(event=>Number.isFinite(event.volumeDelta)));assert(full.lines.length>0);
  for(const length of [100,160,220]){
    const prefix=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,value.slice(0,length)])),partial=analyzeGeometry(prefix,options);
    assert.deepEqual(partial.events,full.events.filter(event=>event.atIndex<length));
    assert(partial.events.every(event=>event.atIndex===event.secondPivot.confirmedIndex&&event.atIndex>event.pivotIndex));
  }
});

test('walk-forward backtest enters on the confirmed bar, never on the earlier pivot bar',()=>{
  const data=synthetic(),geometry=analyzeGeometry(data,{left:2,right:2,minProminenceAtr:.03,minScore:0,maxLines:6}),result=backtestGeometry(data.price,geometry.events,{horizon:4,minMoveAtr:0});
  assert(result.n>0);assert(result.samples.every(sample=>sample.entryIndex===geometry.events.find(event=>event.at===sample.at).atIndex));
  assert(result.samples.every(sample=>sample.exitIndex===sample.entryIndex+4));
  assert(result.samples.every(sample=>sample.entryIndex>geometry.events.find(event=>event.at===sample.at).pivotIndex));
});

test('real M15 fixtures produce bounded scored geometry and a completed causal backtest',()=>{
  const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8').replace(/^\uFEFF/,'')),now=read('../../netflow-ml/tests/fixtures/time.json').serverTime;
  const spyRaw=parseKlines(read('../../netflow-ml/tests/fixtures/SPYUSDT.json'),now,STEPS['15m']),qqqRaw=parseKlines(read('../../netflow-ml/tests/fixtures/QQQUSDT.json'),now,STEPS['15m']);
  const spy=analyze(spyRaw,STEPS['15m']),qqq=analyze(qqqRaw,STEPS['15m']),flow=analyze(composite(spyRaw,qqqRaw),STEPS['15m']);
  const geometry=analyzeGeometry({price:spy,spy,qqq,flow},{minScore:55,maxLines:4}),backtest=backtestGeometry(spy,geometry.events,{horizon:4,minMoveAtr:.35});
  assert(geometry.pivots.length>20);assert(geometry.lines.length<=4);assert(geometry.lines.every(line=>line.score>=55&&line.anchors.length>=2&&line.anchors.length<=3&&line.touches>=2));
  assert(geometry.events.every(event=>event.atIndex>event.pivotIndex));assert(backtest.samples.every(sample=>sample.exitIndex<spy.length));
});

test('breakout and retest classification uses only a previously known line and two closed bars',()=>{
  const bars=Array.from({length:20},(_,index)=>({t:index*900000,o:101,h:101.5,l:99.8,c:101})),line={kind:'support',score:80,knownAt:bars[10].t,startIndex:0,startValue:100,slope:0};
  const held=classifyBreakoutRetest(bars,[line]);assert.equal(held.key,'hold_support');assert.equal(held.direction,1);
  const broken=bars.map(x=>({...x}));Object.assign(broken[18],{o:99,h:99.2,l:97.8,c:98});Object.assign(broken[19],{o:98,h:98.7,l:97.7,c:98.1});
  assert.equal(classifyBreakoutRetest(broken,[line],{strengthDirection:-1,flowDirection:-1,volumeDirection:-1}).key,'true_break');
  assert.equal(classifyBreakoutRetest(broken,[line],{strengthDirection:-1,flowDirection:-1,volumeDirection:1}),null);
  const reclaimed=broken.map(x=>({...x}));Object.assign(reclaimed[19],{o:98,h:101.4,l:97.8,c:101});
  const falseBreak=classifyBreakoutRetest(reclaimed,[line],{strengthDirection:1,flowDirection:1});assert.equal(falseBreak.key,'false_break');assert.equal(falseBreak.direction,1);
});

test('four latest line-state points are prefix-causal',()=>{
  const data=synthetic(200),options={left:2,right:2,minProminenceAtr:.03,minScore:0,maxLines:4},points=recentCausalLineStates(data,options,4),extended=synthetic(201);extended.price[200]={...extended.price[200],h:180,l:40,c:160};
  const extendedPoints=recentCausalLineStates(extended,options,5);
  assert.equal(points.length,4);assert.deepEqual(points.map(point=>point.at),data.price.slice(-4).map(bar=>bar.t));assert.deepEqual(extendedPoints.slice(0,4),points);assert(points.every(point=>['waiting','hold_support','hold_resistance','true_break','false_break'].includes(point.key)&&Number.isFinite(point.lineValue)));
});
