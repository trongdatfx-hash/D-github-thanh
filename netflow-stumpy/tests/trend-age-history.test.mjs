import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalTrendAgeStates,preRthWlrTrend} from '../pre-rth-wlr-trend.mjs';
import {sessionAt} from '../engine.mjs';
import {trendSessionAt} from '../trend-session.mjs';
import {causalTrendChannels} from '../causal-trend-channel.mjs';
const step=900000;
function fixture(){
 const priceRows=[],volumeRows=[],strengthRows=[],channelTrends=[];
 for(let date=Date.parse('2026-08-03T08:00:00Z'),days=0;days<22;date+=86400000){
  if(!trendSessionAt(date).active)continue;
  const direction=days%2?1:-1,n=days===21?12:16,base=100+days;
  for(let i=0;i<n+1;i++){const t=date+i*step,c=base+direction*i*.3;priceRows.push({t,end:t+step-1,o:c-.1,h:c+.2,l:c-.2,c,...sessionAt(t)});volumeRows.push({t,adjusted:direction*.8});strengthRows.push({t,adjusted:direction*.8});}
  channelTrends.push({direction,startTime:date,confirmationTime:date+2*step,insideEndTime:date+(n-1)*step,endTime:date+n*step,exitTime:date+n*step,provisional:false,volumeQualified:true});
  days++;
 }
 return {priceRows,volumeRows,strengthRows,channelTrends,now:priceRows.at(-1).end+1,minCohort:12};
}
test('historical per-close labels match prefix age estimator and remain available offline',()=>{
 const args=fixture(),states=historicalTrendAgeStates(args),byTime=new Map(states.map(x=>[x.t,x]));
 assert(states.some(x=>x.label==='UP'));assert(states.some(x=>x.label==='DOWN'));
 for(const row of args.priceRows.filter((_,i)=>i%7===0)){
  const expected=preRthWlrTrend({...args,requireChannel:true,now:row.end+1}),actual=byTime.get(row.t);
  assert.equal(actual.label,expected.label,String(row.t));
  assert.equal(actual.currentBars,expected.currentBars,String(row.t));
  assert.equal(actual.continuation,expected.continuation,String(row.t));
 }
 assert(states.some(x=>x.label!=='WAIT'&&x.t<args.priceRows.at(-1).t-86400000));
});
test('no retroactive colors before confirmation, no colors at exit, warmup stays WAIT',()=>{
 const args=fixture(),states=new Map(historicalTrendAgeStates(args).map(x=>[x.t,x]));
 for(const c of args.channelTrends){
  assert.equal(states.get(c.startTime).label,'WAIT');
  assert.equal(states.get(c.confirmationTime-step).active,false);
  assert.equal(states.get(c.exitTime).label,'WAIT');
 }
 assert(historicalTrendAgeStates(args).slice(0,17).every(x=>x.label==='WAIT'));
});
test('future days, final duration, strengths and price cannot change earlier colors',()=>{
 const args=fixture(),cut=args.priceRows.at(-50).end+1;
 const past=historicalTrendAgeStates({...args,now:cut});
 const changed={...args,priceRows:args.priceRows.map(x=>x.t>=cut?{...x,c:x.c*2}:x),strengthRows:args.strengthRows.map(x=>x.t>=cut?{...x,adjusted:-99}:x),volumeRows:args.volumeRows.map(x=>x.t>=cut?{...x,adjusted:99}:x)};
 assert.deepEqual(historicalTrendAgeStates(changed).filter(x=>x.t<cut),past);
});
test('render range filter does not discard earlier training days; open candle is excluded',()=>{
 const args=fixture(),all=historicalTrendAgeStates(args),fromTime=args.priceRows.at(-20).t;
 assert.deepEqual(historicalTrendAgeStates({...args,fromTime}),all.filter(x=>x.t>=fromTime));
 const now=args.priceRows.at(-2).end+1,open=args.priceRows.at(-1).t;
 assert(!historicalTrendAgeStates({...args,now}).some(x=>x.t===open));
});
test('real channel construction is prefix invariant for historical candle state',()=>{
 const args=fixture(),channels=rows=>causalTrendChannels(rows.map(x=>({...x,...trendSessionAt(x.t),session:'PRE'})),{volumeRows:args.volumeRows,maxHistory:Infinity}).episodes;
 const full=historicalTrendAgeStates({...args,channelTrends:channels(args.priceRows)});
 for(const cut of [args.priceRows.at(-40).end+1,args.priceRows.at(-20).end+1]){
  const prefix=historicalTrendAgeStates({...args,now:cut,channelTrends:channels(args.priceRows.filter(x=>x.end<cut))});
  assert.deepEqual(full.filter(x=>x.t<cut),prefix);
 }
});
