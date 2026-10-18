import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionAt} from '../engine.mjs';
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
  assert.equal(state.active,true,JSON.stringify(state));assert.equal(state.direction,1);assert(state.currentBars>=2);assert(Number.isFinite(state.expectedBars));assert(Number.isFinite(state.remainingBars));assert(Number.isFinite(state.continuation));assert(Number.isInteger(state.censoredN));
  assert.equal(state.groups.length,4);assert.equal(new Set(state.groups.map(group=>group.key)).size,4);assert(state.groups.some(group=>group.key===state.cohortKey));assert(state.groups.every(group=>Number.isInteger(group.n)&&Number.isInteger(group.censoredN)&&['support','mixed','opposed'].every(key=>Number.isInteger(group.contexts[key].n))));
  assert.match(formatPreRthWlrTrend(state),/^(↑ UP|WAIT) · \d+\/\d+ NẾN · TUỔI P\d+ · CÒN ~\d+ NẾN · TREND CÒN \d+%$/);
});

test('Strength is a soft context and cannot remove an otherwise identical price trend',()=>{
  const input=fixture(),support=preRthWlrTrend({...input,minCohort:3}),opposed=preRthWlrTrend({...input,strengthRows:input.strengthRows.map(row=>({...row,adjusted:-1})),volumeRows:input.volumeRows.map(row=>({...row,adjusted:-1})),minCohort:3});
  assert.equal(opposed.active,true);assert.equal(opposed.currentBars,support.currentBars);assert.equal(opposed.trendScore,support.trendScore);assert.equal(opposed.strengthContext,'mixed');
});

test('signed Ridge impacts need positive OOS and both partial R² before voting',()=>{
  const quality={r2:.12,partialComposite:.08,partialVolume:.06};
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:.2,impactVolume:.1}),'support');
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:-.2,impactVolume:-.1}),'opposed');
  assert.equal(classifyStrengthRegression(-1,{...quality,impactComposite:-.2,impactVolume:-.1}),'support');
  assert.equal(classifyStrengthRegression(1,{...quality,impactComposite:.2,impactVolume:-.1}),'mixed');
  assert.equal(classifyStrengthRegression(1,{...quality,partialVolume:.03,impactComposite:.2,impactVolume:.1}),'mixed');
  assert.equal(classifyStrengthRegression(1,{...quality,r2:-.01,impactComposite:.2,impactVolume:.1}),'mixed');
});

test('PRE→RTH WLR is prefix-causal and ignores open/future bars',()=>{
  const input=fixture(),baseline=preRthWlrTrend({...input,minCohort:3}),futureTime=input.now+900000,futureMeta=sessionAt(futureTime),mutated={...input,priceRows:[...input.priceRows,{t:futureTime,end:futureTime+899999,o:10,h:1000,l:1,c:999,...futureMeta}],strengthRows:[...input.strengthRows,{t:futureTime,adjusted:-1}],volumeRows:[...input.volumeRows,{t:futureTime,adjusted:-1}]};
  assert.deepEqual(preRthWlrTrend({...mutated,minCohort:3}),baseline);
});

test('PRE→RTH WLR returns WAIT outside the live PRE/RTH trading window',()=>{
  const input=fixture(),saturday=Date.UTC(2026,9,17,16),state=preRthWlrTrend({...input,now:saturday,minCohort:3});
  assert.equal(state.label,'WAIT');assert.equal(state.active,false);assert.match(state.reason,/Không có trend/);assert.equal(state.groups.length,4);assert(state.groups.every(group=>group.continuation===null));
});
