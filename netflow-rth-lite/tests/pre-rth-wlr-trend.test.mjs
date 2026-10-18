import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionAt} from '../engine.mjs';
import {isUsMarketTradingDay} from '../market-calendar.mjs';
import {classifyStrengthRegression,formatPreRthWlrTrend,kaplanMeier,preRthWlrTrend,survivalAt} from '../pre-rth-wlr-trend.mjs';

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
  assert.equal(state.groups.length,4);assert.equal(new Set(state.groups.map(group=>group.key)).size,4);assert(state.groups.some(group=>group.key===state.cohortKey));assert(state.groups.every(group=>Number.isInteger(group.n)&&Number.isInteger(group.censoredN)&&(group.n===0||Number.isInteger(group.rawMedianBars))&&['support','mixed','opposed'].every(key=>Number.isInteger(group.contexts[key].n))));
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

test('the complete causal channel lifecycle supplies trend age and elapsed bars',()=>{
  const input=fixture(),baseline=preRthWlrTrend({...input,minCohort:3}),currentDay=input.priceRows.at(-1).day,currentRows=input.priceRows.filter(row=>row.day===currentDay),channelTrends=[{direction:1,confirmationTime:currentRows[0].t,insideEndTime:currentRows.at(-2).t,endTime:currentRows.at(-1).t}],filtered=preRthWlrTrend({...input,channelTrends,requireChannel:true,minCohort:3});
  assert.equal(filtered.active,true);assert(filtered.elapsedBars>baseline.elapsedBars);assert.equal(filtered.currentBars,currentRows.length-1);assert(filtered.elapsedBars>=filtered.currentBars);assert(filtered.channelAlignment<1);assert.equal(filtered.volumeAlignment,1);
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
  assert.equal(state.label,'WAIT');assert.equal(state.active,false);assert.match(state.reason,/Không có trend/);assert.equal(state.groups.length,4);assert(state.groups.every(group=>group.continuation===null));
});
