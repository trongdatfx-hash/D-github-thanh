import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pivotZones,pivotFlowBetween,pivotFlowRealtime,randomWalkBridge,wlrPivotPhase,PIVOT_ZONE_VERSION} from '../pivot-zones.mjs';
import {STEPS,parseKlines,composite as combine,analyze,calculateVolumeStrength} from '../engine.mjs';

const STEP=900_000,BASE=1_700_000_000_000;
function sample(length=180){
  const price=[],composite=[],volume=[];
  for(let i=0;i<length;i++){
    const t=BASE+i*STEP,c=100+3*Math.sin(i*Math.PI/6)+.006*i,o=c-.14*Math.cos(i),h=Math.max(o,c)+.24,l=Math.min(o,c)-.24;
    price.push({t,o,h,l,c});composite.push({t,adjusted:.65*Math.sin(i*Math.PI/6+.2),net:50*Math.sin(i*Math.PI/6+.2),q:100});volume.push({t,adjusted:.55*Math.sin(i*Math.PI/6+.5)});
  }
  return {price,composite,volume};
}
test('bridge hoán vị xác định, giữ trong đoạn hai pivot',()=>{
  const {price}=sample();const a=randomWalkBridge(price,15,35),b=randomWalkBridge(price,15,35);
  assert.deepEqual(a,b);assert(a.q75>0);assert(a.percentile>=0&&a.percentile<=1);
  assert.deepEqual(a,randomWalkBridge([...price,...sample(20).price],15,35));
});
test('cohort Pivot Zones dùng đúng màu và độ dày WLR Composite × Volume',()=>{
  assert.deepEqual(wlrPivotPhase(.4,.2),{key:'thick_up',label:'Dày xanh',width:6,color:'#1ae0a3',direction:1});
  assert.deepEqual(wlrPivotPhase(-.4,-.2),{key:'thick_down',label:'Dày đỏ',width:6,color:'#ff4d70',direction:-1});
  assert.deepEqual(wlrPivotPhase(.4,-.2),{key:'thin',label:'Vàng mỏng',width:1,color:'#f6c85f',direction:0});
  assert.deepEqual(wlrPivotPhase(0,.2),{key:'neutral',label:'Vàng trung tính',width:2,color:'#f6c85f',direction:0});
});
test('REV6 Pivot Zones dùng dữ liệu tới thời điểm đang xét',()=>{
  const input=sample(),at=150,prefix=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,value.slice(0,at)]));
  const result=pivotZones(prefix,STEP),again=pivotZones(prefix,STEP);
  assert.deepEqual(result,again);assert.equal(result.version,PIVOT_ZONE_VERSION);
  assert(result.ready,'dữ liệu dao động có pivot xác nhận phải tạo được vùng');
  const changed=sample();for(let i=at;i<changed.price.length;i++){changed.price[i].c+=40;changed.price[i].h+=40;changed.price[i].l+=40;}
  assert.deepEqual(pivotZones(Object.fromEntries(Object.entries(changed).map(([key,value])=>[key,value.slice(0,at)])),STEP),result);
  for(const zone of [result.support,result.resistance].filter(Boolean)){
    assert(zone.confirmedAt<=prefix.price.at(-1).t);assert(zone.low<=zone.level&&zone.level<=zone.high);
    assert(['thick_up','thick_down','thin','neutral'].includes(zone.phase.key));assert([1,2,6].includes(zone.phase.width));
    assert(zone.n>=0);assert(zone.phaseCohortN>=zone.n);assert(zone.effectiveN>=0);
    if(zone.statistical){assert.equal(zone.quantiles.length,3);assert.equal(zone.quantilePrices.length,3);}
  }
});
test('không báo sẵn sàng nếu thiếu lịch sử',()=>{
  assert.equal(pivotZones(sample(25),STEP).reason,'history');
});
test('histogram NF chỉ cộng dữ liệu giữa hai pivot xác nhận',()=>{
  const input=sample(),flow=pivotFlowBetween(input.price,input.composite);
  assert(flow&&flow.bins.length>=4&&flow.bins.length<=10);
  assert(flow.confirmedAt>flow.secondPivotTime);
  assert(Math.abs(flow.totalNet-flow.bins.reduce((sum,bin)=>sum+bin.net,0))<1e-9);
  assert(Math.abs(flow.pct-100*flow.totalNet/flow.totalQuote)<1e-9);
  const changed=sample();for(const row of changed.composite)if(row.t>flow.secondPivotTime){row.net=1e9;row.q=1e9;}
  assert.deepEqual(pivotFlowBetween(changed.price,changed.composite),flow);
  const thin=sample();thin.composite=thin.composite.filter((_,index)=>index%2===0);
  assert.equal(pivotFlowBetween(thin.price,thin.composite),null);
});
test('histogram và phần trăm C NF cùng cập nhật theo nến live',()=>{
  const input=sample(),anchor=pivotFlowBetween(input.price,input.composite),serverTime=input.price.at(-1).t+STEP/2;
  assert(anchor);
  for(const bar of input.price)bar.end=bar.t+STEP-1;
  const zoneBefore=pivotZones({price:input.price.slice(0,-1),composite:input.composite.slice(0,-1),volume:input.volume.slice(0,-1)},STEP);
  const first=pivotFlowRealtime(anchor,input.price,input.composite,serverTime);
  assert(first?.live);assert.equal(first.latestTime,input.price.at(-1).t);
  assert.equal(first.bins.length,5);assert.deepEqual(first.bins.map(bin=>bin.t),input.price.slice(-5).map(bar=>bar.t));
  assert.equal(first.liveBinIndex,first.bins.length-1);
  const changed=structuredClone(input);changed.composite.at(-1).net+=70;changed.composite.at(-1).q+=100;
  const updated=pivotFlowRealtime(anchor,changed.price,changed.composite,serverTime);
  assert.equal(updated.totalNet-first.totalNet,70);
  assert.equal(updated.totalQuote-first.totalQuote,100);
  assert.notEqual(updated.pct,first.pct);
  assert.equal(updated.pctHalfLife,32);
  assert.notEqual(updated.bins.at(-1).pct,first.bins.at(-1).pct);
  assert.deepEqual(pivotZones({price:changed.price.slice(0,-1),composite:changed.composite.slice(0,-1),volume:changed.volume.slice(0,-1)},STEP),zoneBefore);
  assert.equal(pivotFlowRealtime(anchor,changed.price,changed.composite,serverTime+STEP).live,false);
  const incomplete=structuredClone(input);incomplete.composite.pop();
  assert.equal(pivotFlowRealtime(anchor,incomplete.price,incomplete.composite,serverTime).live,false);
});
test('C NF dùng 96 nến gần nhất khi chưa có cặp pivot và phần trăm EWMA vẫn chạy live',()=>{
  const input=sample(120),serverTime=input.price.at(-1).t+STEP/2;
  for(const bar of input.price)bar.end=bar.t+STEP-1;
  const flow=pivotFlowRealtime(null,input.price,input.composite,serverTime);
  assert.equal(flow.mode,'rolling');assert.equal(flow.live,true);assert.equal(flow.coverage,1);assert.equal(flow.bins.length,5);
  const changed=structuredClone(input);changed.composite.at(-1).net+=25;
  const changedFlow=pivotFlowRealtime(null,changed.price,changed.composite,serverTime);
  assert.equal(changedFlow.totalNet-flow.totalNet,25);
  assert.notEqual(changedFlow.pct,flow.pct);
  assert.equal(changedFlow.pctHalfLife,32);
  assert.equal(pivotFlowRealtime(null,input.price,input.composite,serverTime-STEP*2).latestTime,input.price.at(-3).t);
});
test('fixture Binance M15 tạo đủ hai vùng và nhịp NF để hiển thị',()=>{
  const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8').replace(/^\uFEFF/,''));
  const now=read('../../netflow-ml/tests/fixtures/time.json').serverTime,step=STEPS['15m'];
  const spy=parseKlines(read('../../netflow-ml/tests/fixtures/SPYUSDT.json'),now,step),qqq=parseKlines(read('../../netflow-ml/tests/fixtures/QQQUSDT.json'),now,step);
  const result=pivotZones({price:analyze(spy,step),composite:analyze(combine(spy,qqq),step),volume:analyze(spy,step,{strength:calculateVolumeStrength(spy,step)})},step);
  assert(result.support&&result.resistance&&result.flow);
  assert(result.resistance.low>result.support.high);
  assert(result.flow.coverage>=.8);
});
