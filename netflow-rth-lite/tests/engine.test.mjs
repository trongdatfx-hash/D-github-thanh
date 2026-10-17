import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {STEPS,parseKlines,composite,flowAlignment,relativeFlowColor,strengthAgreementCandleSignal,strengthPhaseLineWidth,strengthPhaseLineStyle,calculateStrength,directionalVolumeDelta,volumeDeltaStrengthColor,volumeDeltaStrengthValue,symmetricPriceRange,calculateVolumeStrength,analyze,regression,weightedPriceBands,continuousCvdSpectrum,projectNetFlowToPrice,dayBoundaryTimes,sessionAt,validateSymbol,modelStatus} from '../engine.mjs';
import {load} from '../data.mjs';
import {isUsMarketHoliday,isUsMarketTradingDay} from '../market-calendar.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const now=read('../../netflow-ml/tests/fixtures/time.json').serverTime;
const spy=read('../../netflow-ml/tests/fixtures/SPYUSDT.json'),qqq=read('../../netflow-ml/tests/fixtures/QQQUSDT.json');
const a=parseKlines(spy,now,STEPS['15m']),b=parseKlines(qqq,now,STEPS['15m']);
const liveA=parseKlines(spy,now,STEPS['15m'],{includeOpen:true}),liveB=parseKlines(qqq,now,STEPS['15m'],{includeOpen:true});
test('real Binance fixtures use quote fields, exclude unclosed bars',()=>{
  assert(a.length>900);assert(a.every(x=>x.end<now));const k=spy.find(x=>+x[0]===a[0].t);
  assert.equal(a[0].q,+k[7]);assert.equal(a[0].buy,+k[10]);assert.equal(a[0].sell,+k[7]- +k[10]);assert.equal(a[0].net,2* +k[10]- +k[7]);assert.equal(a[0].nf,100*a[0].net/a[0].q);
  assert.equal(liveA.length,a.length+1);assert(liveA.at(-1).end>=now);
});
test('composite sums quote volumes at intersection only',()=>{
  const c=composite(a,b.slice(1)),x=c[0],aa=a.find(y=>y.t===x.t),bb=b.find(y=>y.t===x.t);
  assert.equal(x.q,aa.q+bb.q);assert.equal(x.net,aa.net+bb.net);assert(Math.abs(x.nf-(aa.nf*aa.q+bb.nf*bb.q)/(aa.q+bb.q))<1e-10);assert.equal(c.some(x=>x.t===b[0].t),false);assert.equal(x.o,undefined);
});
test('SPY/QQQ alignment distinguishes agreement and divergence',()=>{
  const x={t:1,net:10,nf:20,q:50},y={t:1,net:5,nf:10,q:50},aligned=flowAlignment([x],[y])[0],same=flowAlignment([x],[x])[0];
  assert.equal(aligned.state,'THUẬN MUA');assert.equal(aligned.detailState,'THUẬN MUA');assert.equal(aligned.commonNf,15);assert.equal(aligned.relative,5);assert.equal(same.opposition,0);assert.equal(same.agreement,.4);
  const opposite=flowAlignment([{...x,net:-10,nf:-20}],[y])[0];assert.equal(opposite.state,'NGHỊCH · SPY bán / QQQ mua');assert.equal(opposite.detailState,'NGHỊCH · SPY bán / QQQ mua');assert(Math.abs(opposite.opposition-Math.sqrt(200)/50)<1e-12);assert.equal(opposite.intensity,.2);
  const leader=flowAlignment([x],[{...y,net:0,nf:0}])[0];assert.equal(leader.detailState,'SPY DẪN MUA');assert.equal(leader.opposition,0);
  assert.equal(flowAlignment([x],[{...y,net:-5,nf:-10}])[0].score,.45);assert.equal(flowAlignment([x],[{...y,t:2}]).length,0);
});
test('relative NF color follows same-candle taker signs without GEO impact',()=>{
  const row={spyNf:20,qqqNf:10,spyNet:10,qqqNet:5};
  assert.match(relativeFlowColor(row),/^rgba\(26,224,163,/);
  assert.match(relativeFlowColor({...row,spyNet:-10,qqqNet:-5}),/^rgba\(255,77,112,/);
  assert.match(relativeFlowColor({...row,qqqNet:-5}),/^rgba\(245,166,35,/);
  assert.equal(relativeFlowColor({...row,qqqNet:0}),'rgba(112,126,145,.30)');
  assert.equal(relativeFlowColor(null),'rgba(112,126,145,.30)');
});
test('SPY volume delta histogram exposes four delta × Strength colors',()=>{
  assert.match(volumeDeltaStrengthColor(1,.4),/^rgba\(26,224,163,/);
  assert.match(volumeDeltaStrengthColor(-1,.4),/^rgba\(20,86,255,/);
  assert.match(volumeDeltaStrengthColor(1,-.4),/^rgba\(255,168,184,/);
  assert.match(volumeDeltaStrengthColor(-1,-.4),/^rgba\(255,77,112,/);
  assert.match(volumeDeltaStrengthColor(1,0),/^rgba\(26,224,163,/);
  assert.match(volumeDeltaStrengthColor(-1,null),/^rgba\(255,77,112,/);
  assert.equal(volumeDeltaStrengthColor(0,null),'rgba(0,0,0,0)');
});
test('SPY volume delta is centered at zero and balanced inside the Strength range',()=>{
  assert.equal(volumeDeltaStrengthValue(0),0);
  assert.equal(volumeDeltaStrengthValue(1),.5);
  assert.equal(volumeDeltaStrengthValue(-1),-.5);
  assert.equal(volumeDeltaStrengthValue(1.5),.75);
  assert.equal(volumeDeltaStrengthValue(2),1);
  assert.equal(volumeDeltaStrengthValue(-2),-1);
  assert.equal(volumeDeltaStrengthValue(10),1);
  assert.equal(volumeDeltaStrengthValue(-10),-1);
  assert.equal(volumeDeltaStrengthValue(null),0);
});
test('overlay price ranges keep zero at the same center coordinate',()=>{
  assert.deepEqual(symmetricPriceRange({minValue:-20,maxValue:35}),{minValue:-35,maxValue:35});
  assert.deepEqual(symmetricPriceRange({minValue:.2,maxValue:.7}),{minValue:-1,maxValue:1});
  assert.deepEqual(symmetricPriceRange({minValue:-2,maxValue:1},{floor:.5}),{minValue:-2,maxValue:2});
  assert.throws(()=>symmetricPriceRange({minValue:0,maxValue:1},{floor:0}),/không hợp lệ/);
});
test('candle color follows Composite × SPY Volume Strength agreement',()=>{
  const up=strengthAgreementCandleSignal({adjusted:.8},{adjusted:.35}),down=strengthAgreementCandleSignal({adjusted:-.6},{adjusted:-.4});
  assert.equal(up.direction,1);assert.equal(up.agreement,.35);assert.equal(up.colorRegime,'ĐỒNG THUẬN TĂNG');
  assert.equal(down.direction,-1);assert.equal(down.agreement,.4);assert.equal(down.colorRegime,'ĐỒNG THUẬN GIẢM');
  for(const neutral of [strengthAgreementCandleSignal({adjusted:.8},{adjusted:-.35}),strengthAgreementCandleSignal({adjusted:.8},{adjusted:0}),strengthAgreementCandleSignal({adjusted:.8},null)]){assert.equal(neutral.direction,0);assert.equal(neutral.agreement,0);assert.equal(neutral.colorRegime,'TRUNG TÍNH');}
});
test('WLR phase width follows Composite and SPY Volume Strength signs',()=>{
  assert.equal(strengthPhaseLineWidth({adjusted:.4},{adjusted:.1}),6);assert.equal(strengthPhaseLineWidth({adjusted:-.4},{adjusted:-.1}),6);
  assert.equal(strengthPhaseLineWidth({adjusted:.4},{adjusted:-.1}),1);assert.equal(strengthPhaseLineWidth({adjusted:0},{adjusted:.1}),2);assert.equal(strengthPhaseLineWidth(null,{adjusted:.1}),2);
  assert.throws(()=>strengthPhaseLineWidth({adjusted:1},{adjusted:1},{thin:0}),/không hợp lệ/);
});
test('WLR thick phase uses the resonance direction color only',()=>{
  assert.deepEqual(strengthPhaseLineStyle({adjusted:.4},{adjusted:.1}),{width:6,direction:1,color:'#1ae0a3'});
  assert.deepEqual(strengthPhaseLineStyle({adjusted:-.4},{adjusted:-.1}),{width:6,direction:-1,color:'#ff4d70'});
  assert.deepEqual(strengthPhaseLineStyle({adjusted:.4},{adjusted:-.1}),{width:1,direction:0,color:'#f6c85f'});
  assert.deepEqual(strengthPhaseLineStyle(null,{adjusted:.1}),{width:2,direction:0,color:'#f6c85f'});
});
test('relative flow smoothing and volume confidence are prefix-causal',()=>{
  const s=Array.from({length:40},(_,i)=>({t:i,net:i%3?10:-8,nf:i%3?20:-16,q:50+i}));
  const q=Array.from({length:40},(_,i)=>({t:i,net:i%4?-5:7,nf:i%4?-10:14,q:70+i*2}));
  const full=flowAlignment(s,q,{step:1});assert.deepEqual(flowAlignment(s.slice(0,25),q.slice(0,25),{step:1}),full.slice(0,25));
  const changed=s.map((x,i)=>i>=25?{...x,nf:99,net:x.q*.99}:x);assert.deepEqual(flowAlignment(changed,q,{step:1}).slice(0,25),full.slice(0,25));
  const gap=flowAlignment([s[0],{...s[1],t:2}],[q[0],{...q[1],t:2}],{step:1});assert.equal(gap[1].smoothSpyNf,s[1].nf);assert.equal(gap[1].smoothQqqNf,q[1].nf);
});
test('session calibration and regression are prefix-causal',()=>{
  const full=analyze(a,STEPS['15m']);assert(full.some(x=>x.adjusted!==null));
  for(const n of [200,600,900])assert.deepEqual(analyze(a.slice(0,n),STEPS['15m']),full.slice(0,n));
  const mutated=a.map((x,i)=>i>=900?{...x,net:x.q}:x);assert.deepEqual(analyze(mutated,STEPS['15m']).slice(0,900),full.slice(0,900));
  const altered=a.map((x,i)=>i===850?{...x,net:x.q}:x),f=analyze(altered,STEPS['15m']);assert.equal(f[850].mid,full[850].mid);assert.equal(f[850].upper,full[850].upper);
});
test('DVP smoothing stays continuous across market gaps, with regression and zero-volume',()=>{
  const strength=calculateStrength(a,STEPS['15m']);assert.equal(strength.findIndex(Number.isFinite),506);assert(strength.filter(Number.isFinite).every(x=>x>=-1&&x<=1));
  for(const n of [200,600,900])assert.deepEqual(calculateStrength(a.slice(0,n),STEPS['15m']),strength.slice(0,n));
  const r=regression(Array.from({length:50},(_,i)=>3+2*i));assert.equal(r.mid,103);assert.equal(r.sigma,0);
  const sample=Array.from({length:12},(_,i)=>({t:i*STEPS['15m'],q:100,net:i%3===0?-40:20})),withGap=sample.map((x,i)=>i<6?x:{...x,t:x.t+12*STEPS['15m']});
  assert.deepEqual(calculateStrength(withGap,STEPS['15m'],{normLen:2,strLen:2,lookback:2}),calculateStrength(sample,STEPS['15m'],{normLen:2,strLen:2,lookback:2}));
  const continuous=analyze([{t:0,session:'RTH'},{t:STEPS['15m'],session:'RTH'},{t:4*STEPS['15m'],session:'RTH'}],STEPS['15m'],{minSamples:1,strength:[.1,.2,.3]});assert.equal(continuous[2].adjusted,.3);assert.equal(continuous[2].rthSamples,2);
  const k=[...spy[0]];k[7]='0';k[10]='0';assert.equal(parseKlines([k],now,STEPS['15m'])[0].nf,null);k[10]='1';assert.throws(()=>parseKlines([k],now,STEPS['15m']));
});
test('price WLR uses linear weights, prior bars only and resets on gaps',()=>{
  const bars=Array.from({length:70},(_,i)=>({t:i*STEPS['15m'],c:100+2*i})),full=weightedPriceBands(bars,STEPS['15m']);
  assert.equal(full[49].mid,null);assert(Math.abs(full[50].mid-200)<1e-10);assert(full[50].sigma<1e-10);
  assert.deepEqual(weightedPriceBands(bars.slice(0,60),STEPS['15m']),full.slice(0,60));
  const future=bars.map((x,i)=>i>=60?{...x,c:9999}:x);assert.deepEqual(weightedPriceBands(future,STEPS['15m']).slice(0,60),full.slice(0,60));
  const gap=[...bars.slice(0,55),{t:bars[55].t+STEPS['15m'],c:bars[55].c}];assert.equal(weightedPriceBands(gap,STEPS['15m']).at(-1).mid,null);
});
test('continuous CVD spectrum accumulates quote delta by mirrored price bins',()=>{
  const bars=[{c:100.1,net:10},{c:100.2,net:5},{c:100.6,net:-20},{c:101.1,net:30}];
  const raw=continuousCvdSpectrum(bars,{binStep:.5,range:2,smooth:1});assert.deepEqual(raw.bins,[{price:100,value:15},{price:100.5,value:-20},{price:101,value:30}]);assert.equal(raw.maxAbs,30);
  const smoothed=continuousCvdSpectrum(bars,{binStep:.5,range:2,smooth:2});assert(Math.abs(smoothed.bins[1].value+25/3)<1e-12);assert(Math.abs(smoothed.bins[2].value-155/9)<1e-12);
  assert.deepEqual(continuousCvdSpectrum([]).bins,[]);assert.throws(()=>continuousCvdSpectrum(bars,{binStep:0}));
});
test('composite NetFlow projects only onto matching SPY price timestamps',()=>{
  const price=[{t:1,c:100,net:1},{t:2,c:101,net:2},{t:3,c:102,net:3}],flow=[{t:1,net:10},{t:3,net:-20},{t:4,net:99}];
  assert.deepEqual(projectNetFlowToPrice(price,flow),[{t:1,c:100,net:10},{t:3,c:102,net:-20}]);
  assert.throws(()=>projectNetFlowToPrice(null,flow),/không hợp lệ/);
});
test('day boundaries select the first candle of each new New York day',()=>{
  assert.deepEqual(dayBoundaryTimes([{t:1,day:'2026-10-12'},{t:2,day:'2026-10-12'},{t:3,day:'2026-10-13'},{t:4,day:'2026-10-13'},{t:5,day:'2026-10-14'}]),[3,5]);
  assert.throws(()=>dayBoundaryTimes([{t:1}]),/không hợp lệ/);
});
test('NY DST, RTH edges and weekend',()=>{
  assert.equal(sessionAt(Date.parse('2026-10-07T13:30:00Z')).session,'RTH');assert.equal(sessionAt(Date.parse('2026-10-07T20:00:00Z')).session,'POST');assert.equal(sessionAt(Date.parse('2026-01-07T14:30:00Z')).session,'RTH');assert.equal(sessionAt(Date.parse('2026-10-10T14:30:00Z')).session,'WEEKEND');assert.equal(modelStatus.trained,false);
});
test('NYSE calendar excludes weekends and scheduled full-day holidays',()=>{
  for(const day of ['2026-01-01','2026-01-19','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25'])assert.equal(isUsMarketHoliday(day),true,day);
  assert.equal(isUsMarketTradingDay('2026-10-10'),false);assert.equal(isUsMarketTradingDay('2026-10-11'),false);assert.equal(isUsMarketTradingDay('2026-10-12'),true);
});
test('validation and parallel pagination include the live bar, then fetch only the tail',async()=>{
  const symbols=read('../symbol-validation.json');for(const s of ['SPYUSDT','QQQUSDT'])assert.equal(validateSymbol({symbols},s).status,'TRADING');assert.throws(()=>validateSymbol({symbols:[]},'SPYUSDT'));
  let requests=0;const get=async path=>{
    if(path.endsWith('exchangeInfo'))return {symbols};if(path.endsWith('/time'))return {serverTime:now};requests++;
    const u=new URL(path,'https://example.test'),rows=u.searchParams.get('symbol')==='SPYUSDT'?spy:qqq;
    return rows.filter(x=>+x[0]>=+u.searchParams.get('startTime')&&+x[0]<=+u.searchParams.get('endTime')).slice(0,+u.searchParams.get('limit'));
  };
  const result=await load('15m',14,{get});assert.deepEqual(result.SPYUSDT,liveA);assert.deepEqual(result.QQQUSDT,liveB);assert(requests>=4);assert.equal(result.incremental,false);
  requests=0;const updated=await load('15m',14,{get,previous:result});assert.deepEqual(updated.SPYUSDT,liveA);assert.deepEqual(updated.QQQUSDT,liveB);assert.equal(updated.incremental,true);assert.equal(requests,2);
});
test('refresh finalizes the previously open candle at rollover before keeping history',async()=>{
  const step=STEPS['15m'],symbols=read('../symbol-validation.json'),original=spy.at(-1),start=+original[0];
  let serverTime=start+1000,finalized=false;
  const get=async path=>{
    if(path.endsWith('exchangeInfo'))return {symbols};if(path.endsWith('/time'))return {serverTime};
    const u=new URL(path,'https://example.test'),old=[...original],next=[...original];
    if(finalized){old[7]=String(+old[7]+100);old[10]=String(+old[10]+80);}
    next[0]=start+step;next[6]=start+2*step-1;
    return (finalized?[old,next]:[old]).filter(k=>+k[0]>=+u.searchParams.get('startTime')&&+k[0]<=+u.searchParams.get('endTime'));
  };
  const before=await load('15m',7,{get});finalized=true;serverTime=start+step+1000;
  const after=await load('15m',7,{get,previous:before});
  for(const symbol of ['SPYUSDT','QQQUSDT']){
    assert.equal(after[symbol].length,2);assert.equal(after[symbol][0].q,before[symbol][0].q+100);
    assert.equal(after[symbol][0].buy,before[symbol][0].buy+80);assert.equal(after[symbol][1].t,start+step);
    assert.equal(before[symbol][0].q,+original[7]);
  }
});


test('SPY original-volume Strength is causal, directional and bounded',()=>{
  const step=STEPS['15m'],bars=Array.from({length:40},(_,i)=>({t:i*step,o:100+i*.1,c:100+i*.1+(i<30?.2:-.2),v:100+i,session:'RTH',day:'2026-10-15'}));
  const a=calculateVolumeStrength(bars,step,{normLen:3,strLen:3,halfLife:1,lookback:5});
  assert.equal(a.length,bars.length);assert(a.filter(Number.isFinite).every(x=>x>=-1&&x<=1));assert(a[20]>0);assert(a.at(-1)<0);
  const changed=bars.map((b,i)=>i===bars.length-1?{...b,v:999999,c:b.o-1}:b),b=calculateVolumeStrength(changed,step,{normLen:3,strLen:3,halfLife:1,lookback:5});
  assert.deepEqual(a.slice(0,-1),b.slice(0,-1));assert.notEqual(a.at(-1),b.at(-1));
});
test('SPY V candle delta is signed body volume normalized by causal SMA volume',()=>{
  const step=STEPS['15m'],bars=[{t:0,o:1,c:2,v:10},{t:step,o:2,c:1,v:20},{t:2*step,o:1,c:1,v:30},{t:4*step,o:1,c:2,v:40}],delta=directionalVolumeDelta(bars,step,{normLen:2});
  assert.deepEqual(delta.map(x=>x.direction),[1,-1,0,1]);assert.deepEqual(delta.map(x=>x.value),[1,-20/15,0,1]);assert.equal(delta[3].mean,40);
  assert.throws(()=>directionalVolumeDelta(bars,step,{normLen:0}),/không hợp lệ/);
});
