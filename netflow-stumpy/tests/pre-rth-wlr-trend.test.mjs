import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionAt} from '../engine.mjs';
import {isUsMarketTradingDay} from '../market-calendar.mjs';
import {trendSessionAt,trendSessionRows} from '../trend-session.mjs';
import {europeOpen} from '../wlr-aba-core.mjs';
import {stamp} from '../rth-structure.mjs';

test('age window follows London DST and US RTH close, excluding weekends and US holidays',()=>{
 for(const [day,utc] of [['2026-07-20','07:00'],['2026-12-07','08:00'],['2026-03-16','08:00'],['2026-10-26','08:00']]){
  const open=Date.parse(day+'T'+utc+':00Z');
  assert.equal(trendSessionAt(open-1).active,false);assert.equal(trendSessionAt(open).active,true);
  assert.equal(trendSessionAt(stamp(day,960)-1).active,true);assert.equal(trendSessionAt(stamp(day,960)).active,false);
 }
 for(const day of ['2026-10-24','2026-10-25','2026-01-01','2026-04-03','2026-07-03','2026-11-26','2026-12-25']){
  assert.equal(trendSessionAt(europeOpen(day)).active,false,day);
  assert.equal(trendSessionRows([{t:europeOpen(day)}]).length,0,day);
 }
 assert.equal(trendSessionAt(stamp('2026-11-27',780)-1).active,true);
 assert.equal(trendSessionAt(stamp('2026-11-27',780)).active,false);
});

test('European candles enter the live age and EURO cohort; POST cannot extend age',()=>{
 const day='2026-10-20',start=europeOpen(day),priceRows=Array.from({length:4},(_,i)=>{
  const t=start+i*900000,c=100+i;return {t,end:t+899999,o:c-.1,h:c+.2,l:c-.2,c,...sessionAt(t)};
 }),strengthRows=priceRows.map(r=>({t:r.t,adjusted:.8})),channel={direction:1,startTime:start,confirmationTime:start+900000,insideEndTime:priceRows.at(-1).t,endTime:priceRows.at(-1).t,provisional:true,volumeQualified:true};
 const args={priceRows,strengthRows,volumeRows:strengthRows,channelTrends:[channel],requireChannel:true,now:priceRows.at(-1).end+1};
 const state=preRthWlrTrend(args);assert.equal(state.active,true);assert.equal(state.currentBars,4);assert.equal(state.cohortKey,'1|EURO');
 assert.equal(trendReadoutState(state,{now:args.now-900000,lastTime:priceRows[2].t}),state);
 const closed=preRthWlrTrend({...args,now:stamp(day,960)});assert.equal(closed.active,false);
 assert.equal(closed.groups.find(g=>g.key==='1|EURO').censoredN,1);
 assert.equal(trendReadoutState(state,{now:stamp(day,960),lastTime:stamp(day,945)}).active,false);
});
import {classifyStrengthRegression,formatPreRthWlrTrend,kaplanMeier,preRthWlrTrend,survivalAt,trendAgeStatistics,trendReadoutState} from '../pre-rth-wlr-trend.mjs';

test('Kaplan–Meier keeps session-end trends as right-censored observations',()=>{
  const curve=kaplanMeier([
    {duration:2,censored:false},
    {duration:4,censored:true},
    {duration:4,censored:false},
    {duration:6,censored:false}
  ]);
  assert.deepEqual(curve.map(({time,atRisk,events,censored})=>({time,atRisk,events,censored})),[
    {time:2,atRisk:4,events:1,censored:0},
    {time:4,atRisk:3,events:1,censored:1},
    {time:6,atRisk:1,events:1,censored:0}
  ]);
  assert.equal(survivalAt(curve,2),.75);
  assert.equal(survivalAt(curve,5),.5);
  assert.equal(survivalAt(curve,5)/survivalAt(curve,2),2/3);
});

function tradingDays(count){
  const days=[];for(let date=new Date(Date.UTC(2026,7,3));days.length<count;date.setUTCDate(date.getUTCDate()+1)){const weekday=date.getUTCDay();if(weekday!==0&&weekday!==6)days.push(new Date(date));}return days;
}
function fixture(dayCount=32){
  const priceRows=[],strengthRows=[],volumeRows=[],days=tradingDays(dayCount);
  for(const [dayIndex,date] of days.entries()){
    const current=dayIndex===days.length-1,bars=current?16:28,base=100+dayIndex*.2;
    for(let i=0;i<bars;i++){
      const t=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),8,0)+i*900000,up=current||i<16,rise=current?.7:.32,step=up?i*rise:16*.32-(i-16)*.5,c=base+step,meta=sessionAt(t);
      priceRows.push({t,end:t+899999,o:c-.15,h:c+.25,l:c-.3,c,...meta});
      strengthRows.push({t,adjusted:up?.82:-.82});volumeRows.push({t,adjusted:up?.76:-.76});
    }
  }
  const last=days.at(-1),now=Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),last.getUTCDate(),12,15);
  return {priceRows,strengthRows,volumeRows,now};
}

test('PRE→RTH WLR finds the active strongest price trend and formats only the compact label',()=>{
  const input=fixture(),state=preRthWlrTrend({...input,minCohort:3});
  assert.equal(state.active,true,JSON.stringify(state));assert.equal(state.direction,1);assert(state.currentBars>=2);assert(Number.isFinite(state.expectedBars));assert(state.reliable?Number.isFinite(state.remainingBars)&&Number.isFinite(state.continuation):state.remainingBars===null&&state.continuation===null);assert(Number.isInteger(state.censoredN));
  assert(['new','developing','durable','extended'].includes(state.ageGroup.key));assert.match(state.ageGroup.label,/MỚI|PHÁT TRIỂN|BỀN|KÉO DÀI/);assert.match(state.reason,/Nhóm/);
  assert.equal(state.groups.length,6);assert.equal(new Set(state.groups.map(group=>group.key)).size,6);assert(state.groups.some(group=>group.key===state.cohortKey));assert(state.groups.every(group=>Number.isInteger(group.n)&&Number.isInteger(group.censoredN)&&(group.n===0||Number.isInteger(group.rawMedianBars))&&['support','mixed','opposed'].every(key=>Number.isInteger(group.contexts[key].n))));
  assert.match(formatPreRthWlrTrend(state),/^(↑ UP|WAIT) · \d+\/(\d+|—) NẾN · TUỔI P(\d+|—) · CÒN ~(\d+|—) NẾN · TREND CÒN (\d+|—)%$/);
});

test('Composite only changes a small score component and cannot filter an otherwise identical trend',()=>{
  const input=fixture(),support=preRthWlrTrend({...input,minCohort:3}),opposed=preRthWlrTrend({...input,strengthRows:input.strengthRows.map(row=>({...row,adjusted:-1})),minCohort:3});
  assert.equal(opposed.active,true);assert.equal(opposed.currentBars,support.currentBars);assert(Math.abs(opposed.trendScore-support.trendScore)<=5);assert.equal(opposed.compositeScore,0);
});

test('SPY Volume Strength sign is a hard WLR-slope filter for trend candles',()=>{
  const input=fixture(),support=preRthWlrTrend({...input,minCohort:3}),opposed=preRthWlrTrend({...input,volumeRows:input.volumeRows.map(row=>({...row,adjusted:-1})),minCohort:3});
  assert.equal(support.active,true);assert.equal(support.currentBars,support.elapsedBars);assert.equal(support.volumeAlignment,1);assert.equal(opposed.active,false);assert.equal(opposed.currentBars,0);
});

test('one SPY V sign mismatch stays inside the episode but is not counted in trend age',()=>{
  const input=fixture(),baseline=preRthWlrTrend({...input,minCohort:3}),volumeRows=input.volumeRows.map((row,index)=>index===input.volumeRows.length-1?{...row,adjusted:-1}:row),filtered=preRthWlrTrend({...input,volumeRows,minCohort:3});
  assert.equal(filtered.active,true);assert.equal(filtered.elapsedBars,baseline.elapsedBars);assert.equal(filtered.currentBars,baseline.currentBars-1);assert(filtered.volumeAlignment<1);
});

test('the observed channel exit closes the age label immediately without a second weak-bar grace',()=>{
  const input=fixture(),currentDay=input.priceRows.at(-1).day,currentRows=input.priceRows.filter(row=>row.day===currentDay),channelTrends=[{direction:1,confirmationTime:currentRows[0].t,insideEndTime:currentRows.at(-2).t,endTime:currentRows.at(-1).t,exitTime:currentRows.at(-1).t,provisional:false}],filtered=preRthWlrTrend({...input,channelTrends,requireChannel:true,minCohort:3});
  assert.equal(filtered.active,false);assert.equal(filtered.label,'WAIT');assert.equal(filtered.currentBars,0);
});

test('per-candle SPY V sign noise does not remove candles from a qualified channel trend',()=>{
  const input=fixture(),currentDay=input.priceRows.at(-1).day,currentRows=input.priceRows.filter(row=>row.day===currentDay),channelTrends=[{direction:1,confirmationTime:currentRows[0].t,insideEndTime:currentRows.at(-1).t,endTime:currentRows.at(-1).t,volumeQualified:true}],baseline=preRthWlrTrend({...input,channelTrends,requireChannel:true,minCohort:3}),volumeRows=input.volumeRows.map((row,index)=>index===input.volumeRows.length-1?{...row,adjusted:-1}:row),noisy=preRthWlrTrend({...input,volumeRows,channelTrends,requireChannel:true,minCohort:3});
  assert.equal(noisy.active,true);assert.equal(noisy.currentBars,baseline.currentBars);assert.equal(noisy.channelAlignment,1);assert(noisy.volumeAlignment<1);
});

test('trend grouping uses the full drawn Flow-Leg candle count after confirmation',()=>{
  const input=fixture(),currentDay=input.priceRows.at(-1).day,currentRows=input.priceRows.filter(row=>row.day===currentDay),channelTrends=[{direction:1,startTime:currentRows[1].t,confirmationTime:currentRows[5].t,insideEndTime:currentRows.at(-1).t,endTime:currentRows.at(-1).t,bars:15,provisional:true,volumeQualified:true}],state=preRthWlrTrend({...input,channelTrends,requireChannel:true,minCohort:3});
  assert.equal(state.active,true);assert.equal(state.currentBars,15);assert.equal(state.ageGroup.key,'extended');assert.equal(state.ageGroup.label,'KÉO DÀI ≥13');
});

test('historical cohort N counts causal Flow-Legs without reapplying the WLR score gate',()=>{
  const input=fixture(),byDay=new Map();for(const row of input.priceRows){if(!byDay.has(row.day))byDay.set(row.day,[]);byDay.get(row.day).push(row);}
  const days=[...byDay.values()],channelTrends=days.map((rows,index)=>({direction:1,startTime:rows[0].t,confirmationTime:rows[5].t,insideEndTime:rows[15].t,endTime:rows[15].t,bars:16,provisional:index===days.length-1,volumeQualified:true})),state=preRthWlrTrend({...input,channelTrends,requireChannel:true,minCohort:3}),group=state.groups.find(item=>item.direction===1&&item.startSession==='PRE');
  assert.equal(group.n,days.filter(rows=>isUsMarketTradingDay(rows[0].day)).length-1);assert.equal(['support','mixed','opposed'].reduce((sum,key)=>sum+group.contexts[key].n,0),group.n);assert(group.contexts.support.n>0);assert(Number.isFinite(group.ridge.r2));
});

test('signed Ridge impacts classify context while OOS and partial R² stay diagnostic',()=>{
  const quality={r2:.12,partialComposite:.08,partialVolume:.06};
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:.2,impactVolume:.1}),'support');
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:-.2,impactVolume:-.1}),'opposed');
  assert.equal(classifyStrengthRegression(-1,{...quality,impactComposite:-.2,impactVolume:-.1}),'support');
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:.2,impactVolume:-.1}),'mixed');
  assert.equal(classifyStrengthRegression(1,{...quality,partialVolume:.03,impactComposite:.2,impactVolume:.1}),'support');
  assert.equal(classifyStrengthRegression(1,{...quality,r2:-.01,impactComposite:.2,impactVolume:.1}),'support');
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:null,impactVolume:.1}),'mixed');
});

test('PRE→RTH WLR is prefix-causal and ignores open/future bars',()=>{
  const input=fixture(),baseline=preRthWlrTrend({...input,minCohort:3}),futureTime=input.now+900000,futureMeta=sessionAt(futureTime),mutated={...input,priceRows:[...input.priceRows,{t:futureTime,end:futureTime+899999,o:10,h:1000,l:1,c:999,...futureMeta}],strengthRows:[...input.strengthRows,{t:futureTime,adjusted:-1}],volumeRows:[...input.volumeRows,{t:futureTime,adjusted:-1}]};
  assert.deepEqual(preRthWlrTrend({...mutated,minCohort:3}),baseline);
});

test('PRE→RTH WLR returns WAIT outside the live PRE/RTH trading window',()=>{
  const input=fixture(),saturday=Date.UTC(2026,9,17,16),state=preRthWlrTrend({...input,now:saturday,minCohort:3});
  assert.equal(state.label,'WAIT');assert.equal(state.active,false);assert.match(state.reason,/Không có trend/);assert.equal(state.groups.length,6);assert(state.groups.some(group=>Number.isFinite(group.continuation)&&group.baseline&&group.evaluationBars===1));
});

test('accepted-bar survival matches exact discrete probabilities and conditional medians',()=>{
  const durations=[2,3,4,5,6,7,7,8,9,11,13,17,22,28,60,80,90,100,110,120],episodes=durations.map((duration,i)=>({duration,censored:false,day:'d'+i}));
  for(let age=1;age<=80;age++)for(let horizon=1;horizon<=4;horizon++){
    const alive=durations.filter(d=>d>=age),s=trendAgeStatistics(episodes,age,horizon);
    if(alive.length<5){assert.equal(s.ready,false);assert.equal(s.continuation,null);continue;}
    assert.equal(s.ready,true);assert.ok(Math.abs(s.continuation-alive.filter(d=>d>=age+horizon).length/alive.length)<1e-12);
    assert.equal(s.remainingBars,[...alive].sort((a,b)=>a-b)[Math.ceil(alive.length/2)-1]-age);
    assert.equal(s.agePercentile,Math.round(100*durations.filter(d=>d<=age).length/durations.length));
  }
  const half=trendAgeStatistics([...Array(6).fill({duration:7,censored:false}),...Array(6).fill({duration:11,censored:false})],7);
  assert.equal(half.continuation,.5);assert.equal(half.remainingBars,0);assert.equal(half.atRiskN,12);
  assert.equal(trendAgeStatistics(Array(12).fill({duration:100,censored:false}),60).remainingBars,40);
});
test('right censoring without horizon followup waits instead of showing a spurious 100%',()=>{
  const unknown=trendAgeStatistics(Array(12).fill({duration:7,censored:true}),7);assert.equal(unknown.ready,false);assert.equal(unknown.continuation,null);assert.equal(unknown.horizonSupported,false);assert.equal(unknown.resolvedHorizonN,0);
  const observed=trendAgeStatistics(Array(12).fill({duration:20,censored:true}),7);assert.equal(observed.continuation,1);assert.equal(observed.remainingBars,null);assert.equal(observed.resolvedHorizonN,12);
  const insufficient=trendAgeStatistics(Array(4).fill({duration:20,censored:false}),7);assert.equal(insufficient.continuation,null);assert.equal(insufficient.remainingBars,null);
});
test('future channel confirmation/end/length cannot leak into the closed age label',()=>{
  const input=fixture(),day=input.priceRows.at(-1).day,rs=input.priceRows.filter(r=>r.day===day),channel={direction:1,startTime:rs[0].t,confirmationTime:rs[5].t,insideEndTime:rs.at(-1).t,endTime:rs.at(-1).t,bars:999,provisional:true,volumeQualified:true},base={...input,channelTrends:[channel],requireChannel:true,minCohort:3};
  assert.equal(preRthWlrTrend({...base,now:rs[3].end+1}).active,false);
  const clipped=preRthWlrTrend({...base,now:rs[6].end+1});assert.equal(clipped.active,true);assert.equal(clipped.currentBars,7);
  const ended={...channel,exitTime:rs[12].t,insideEndTime:rs[11].t,endTime:rs[12].t,provisional:false,bars:12};
  assert.equal(preRthWlrTrend({...base,channelTrends:[ended],now:rs[6].end+1}).active,true);
  assert.equal(preRthWlrTrend({...base,channelTrends:[ended],now:rs[12].end+1}).active,false);
});
test('missing or stale M15 candles cannot keep an old channel active or inflate its age',()=>{
  const input=fixture(),day=input.priceRows.at(-1).day,rs=input.priceRows.filter(r=>r.day===day),channel={direction:1,startTime:rs[0].t,confirmationTime:rs[3].t,insideEndTime:rs.at(-1).t,endTime:rs.at(-1).t,bars:16,provisional:true,volumeQualified:true};
  const base={...input,channelTrends:[channel],requireChannel:true,minCohort:3};assert.equal(preRthWlrTrend(base).active,true);
  assert.equal(preRthWlrTrend({...base,priceRows:input.priceRows.filter(r=>r.t!==rs[8].t)}).active,false);
  const stale=preRthWlrTrend({...base,now:rs.at(-1).end+1+915001});assert.equal(stale.active,false);assert.equal(stale.groups.reduce((n,g)=>n+g.n,0),0);
  const open=preRthWlrTrend({...base,priceRows:input.priceRows.map(r=>r.t===rs.at(-1).t?{...r,end:undefined}:r),now:rs.at(-1).t+1000});assert.equal(open.currentBars,15);
});
test('fallback broadens past a cohort with insufficient living observations',()=>{
  const priceRows=[],strengthRows=[],channelTrends=[],days=tradingDays(28).filter(date=>isUsMarketTradingDay(date.toISOString().slice(0,10)));
  for(const [j,date] of days.entries()){
    const current=j===days.length-1,direction=j<13||current?1:-1,duration=current?7:j<13?3:12,start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),8),count=current?7:15;
    for(let i=0;i<count;i++){const t=start+i*900000,c=100+direction*i;priceRows.push({t,end:t+899999,o:c-.1*direction,h:c+.2,l:c-.2,c,...sessionAt(t)});strengthRows.push({t,adjusted:.8*direction});}
    channelTrends.push({direction,startTime:start,confirmationTime:start+900000,insideEndTime:start+(duration-1)*900000,endTime:start+(current?duration-1:duration)*900000,exitTime:current?null:start+duration*900000,bars:duration,provisional:current,volumeQualified:true});
  }
  const state=preRthWlrTrend({priceRows,strengthRows,volumeRows:strengthRows,channelTrends,requireChannel:true,now:priceRows.at(-1).end+1});assert.equal(state.active,true);assert.equal(state.cohort,'all');assert.equal(state.reliable,true);assert.ok(state.atRiskN>=5);
});

test('readout retains the compact age label and masks stale/off-session percentages without changing the estimate',()=>{
  const now=Date.parse('2026-10-20T14:00:00Z'),state={active:true,label:'UP',currentBars:7,expectedBars:12,remainingBars:7,agePercentile:16,continuation:.75,horizon:3};
  assert.equal(formatPreRthWlrTrend(state),'↑ UP · 7/12 NẾN · TUỔI P16 · CÒN ~7 NẾN · TREND CÒN 75%');
  assert.equal(trendReadoutState(state,{now,live:true,lastTime:now-900000}),state);
  for(const options of [{now,live:false,lastTime:now-900000},{now,live:true,lastTime:now-2700000},{now:Date.parse('2026-10-20T20:00:00Z'),live:true,lastTime:now-900000}]){const masked=trendReadoutState(state,options);assert.equal(masked.label,'WAIT');assert.equal(masked.continuation,null);assert.equal(masked.active,false);}
  assert.equal(state.label,'UP');assert.equal(state.continuation,.75);
});
