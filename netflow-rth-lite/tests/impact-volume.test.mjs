import test from 'node:test';
import assert from 'node:assert/strict';
import {SpreadImpactDetector,aggregateImpactHistogram,aggregateRelativeImpact,geometryBarIndexAt,geometryZoneAt,pruneImpactEvents,IMPACT_RETENTION_MS} from '../impact-volume.mjs';

test('geometry filter only accepts an already-known important line nearby',()=>{
  const line={kind:'support',score:72,knownAt:1000,startIndex:5,startValue:100,slope:1};
  assert.equal(geometryZoneAt(103.1,2000,[line],{barIndex:8,atr:1,toleranceAtr:.2})?.kind,'support');
  assert.equal(geometryZoneAt(103.1,900,[line],{barIndex:8,atr:1,toleranceAtr:.2}),null);
  assert.equal(geometryZoneAt(104,2000,[line],{barIndex:8,atr:1,toleranceAtr:.2}),null);
  assert.equal(geometryZoneAt(103.1,2000,[{...line,score:50}],{barIndex:8,atr:1,toleranceAtr:.2}),null);
});

test('geometry projection advances by observed bars, not wall-clock gaps',()=>{
  const bars=[{t:1000,end:1999},{t:10_000,end:10_999}];
  assert.equal(geometryBarIndexAt(10_500,bars,0),1);
  assert.equal(geometryBarIndexAt(20_000,bars,1),2);
});

test('detector records taker buy only after the ask jumps by a full prior spread',()=>{
  const impacts=[],detector=new SpreadImpactDetector({zoneResolver:()=>({kind:'resistance'}),onImpact:event=>impacts.push(event)});
  detector.onBook({T:1000,b:'99.9',a:'100.0'});
  detector.onTrade({T:1001,p:'100.0',q:'2',m:false});
  detector.onBook({T:1010,b:'99.9',a:'100.05'});assert.equal(impacts.length,0);
  detector.onBook({T:1020,b:'100.0',a:'100.1'});assert.equal(impacts.length,1);
  assert.equal(impacts[0].side,1);assert.equal(impacts[0].quote,200);assert(Math.abs(impacts[0].jumpSpreads-1)<1e-9);
});

test('detector prefers normal-order quantity when Binance supplies nq',()=>{
  const impacts=[],detector=new SpreadImpactDetector({zoneResolver:()=>({kind:'support'}),onImpact:event=>impacts.push(event)});
  detector.onBook({T:1000,b:'99.9',a:'100'});detector.onTrade({T:1001,p:'100',q:'2',nq:'1.25',m:false});detector.onBook({T:1010,b:'100',a:'100.1'});
  assert.equal(impacts[0].quote,125);
});

test('detector rejects non-zone trades and histogram keeps signed two-day buckets',()=>{
  const impacts=[],detector=new SpreadImpactDetector({zoneResolver:()=>null,onImpact:event=>impacts.push(event)});
  detector.onBook({T:1000,b:'100',a:'100.1'});detector.onTrade({T:1001,p:'100.1',q:'1',m:false});detector.onBook({T:1010,b:'100.1',a:'100.2'});assert.equal(impacts.length,0);
  const now=IMPACT_RETENTION_MS+2000,events=[{time:1000,side:1,quote:1},{time:2000,side:1,quote:20},{time:2500,side:-1,quote:7}];
  assert.equal(pruneImpactEvents(events,now).length,2);
  const result=aggregateImpactHistogram(events,1000,{now});assert.equal(result.buy[0].value,20);assert.equal(result.sell[0].value,-7);
});

test('relative impact maps SPY buy or QQQ sell to green direction and the inverse to red',()=>{
  const now=10_000,common={jumpSpreads:1,zoneScore:80,distanceAtr:.05},events=[
    {...common,time:1000,symbol:'SPYUSDT',side:1,quote:100},
    {...common,time:1100,symbol:'QQQUSDT',side:-1,quote:60},
    {...common,time:2000,symbol:'SPYUSDT',side:-1,quote:90},
    {...common,time:2100,symbol:'QQQUSDT',side:1,quote:50},
    {...common,time:3000,symbol:'SPYUSDT',side:1,quote:100},
    {...common,time:3100,symbol:'QQQUSDT',side:1,quote:95}
  ];
  const result=aggregateRelativeImpact(events,1000,{now});assert.equal(result[0].direction,1);assert.equal(result[1].direction,-1);assert.equal(result[2].direction,0);
});
