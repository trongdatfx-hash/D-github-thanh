import test from 'node:test';
import assert from 'node:assert/strict';
import {pivotZones,randomWalkBridge,PIVOT_ZONE_VERSION} from '../pivot-zones.mjs';

const STEP=900_000,BASE=1_700_000_000_000;
function sample(length=180){
  const price=[],composite=[],volume=[];
  for(let i=0;i<length;i++){
    const t=BASE+i*STEP,c=100+3*Math.sin(i*Math.PI/6)+.006*i,o=c-.14*Math.cos(i),h=Math.max(o,c)+.24,l=Math.min(o,c)-.24;
    price.push({t,o,h,l,c});composite.push({t,adjusted:.65*Math.sin(i*Math.PI/6+.2)});volume.push({t,adjusted:.55*Math.sin(i*Math.PI/6+.5)});
  }
  return {price,composite,volume};
}
test('bridge hoán vị xác định, giữ trong đoạn hai pivot',()=>{
  const {price}=sample();const a=randomWalkBridge(price,15,35),b=randomWalkBridge(price,15,35);
  assert.deepEqual(a,b);assert(a.q75>0);assert(a.percentile>=0&&a.percentile<=1);
  assert.deepEqual(a,randomWalkBridge([...price,...sample(20).price],15,35));
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
    assert(zone.n>=0);assert(zone.effectiveN>=0);
  }
});
test('không báo sẵn sàng nếu thiếu lịch sử',()=>{
  assert.equal(pivotZones(sample(25),STEP).reason,'history');
});
