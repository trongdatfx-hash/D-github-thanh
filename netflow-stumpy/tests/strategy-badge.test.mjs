import test from 'node:test';import assert from 'node:assert/strict';import {assessTradeStrategy,strategyProbabilityText} from '../strategy-badge.mjs';
function input(){return {live:true,symbol:'SPYUSDT',interval:'15m',aba:{enabled:true,live:true,verified:true,synced:true,version:3,preview:{emit:true},usage:{emit:false,reason:'WAIT_FORWARD_START'},track:{prediction:{ready:true,memberReady:true,pMembership:.72},direction:{ready:true,pAbove:.7,pBelow:.3}}},trend:{active:true,reliable:true,horizonSupported:true,direction:1,continuation:.68,horizon:3}};}
test('aligned predictions give a research pullback scenario without bypassing the usage gate',()=>{
 const r=assessTradeStrategy(input());assert.equal(r.scenario,'pullback');assert.equal(r.status,'NGHIÊN CỨU · WAIT');assert(r.reason.includes('26/10'));assert.equal(r.abaUp,.7);assert.equal(r.continuation,.68);assert(!('winRate' in r));
});
test('opposing direction and weak survival avoid trend chasing',()=>{
 const x=input();x.trend.direction=-1;assert.equal(assessTradeStrategy(x).scenario,'conflict');x.trend.direction=1;x.trend.continuation=.3;x.aba.track.direction={ready:true,pAbove:.5,pBelow:.5};assert.equal(assessTradeStrategy(x).scenario,'weak');
});
test('stale, disabled, unverified and mismatched data cannot produce a scenario',()=>{
 for(const k of ['enabled','live','verified','synced']){const x=input();x.aba[k]=false;const r=assessTradeStrategy(x);assert.equal(r.scenario,null);assert.equal(r.abaUp,null);}
 assert.equal(assessTradeStrategy({...input(),live:false}).continuation,null);assert.equal(assessTradeStrategy({...input(),interval:'5m'}).scenario,null);
});
test('missing or unsupported trend probability stays missing rather than zero or a fabricated win probability',()=>{
 const x=input();x.trend.horizonSupported=false;const r=assessTradeStrategy(x);assert.equal(r.continuation,null);assert.equal(r.scenario,null);assert.equal(r.abaUp,.7);assert(strategyProbabilityText(r).trend.includes('—'));
});
test('separate percentages retain their different meanings and invalid probabilities are hidden',()=>{
 const r=assessTradeStrategy(input()),t=strategyProbabilityText(r);assert(t.aba.includes('70%'));assert(t.aba.includes('72%'));assert(t.trend.includes('68%'));const x=input();x.aba.track.direction.pAbove=70;assert.equal(assessTradeStrategy(x).abaUp,null);
});
test('bearish alignment is symmetric and neutral probabilities remain observation only',()=>{
 const x=input();x.aba.track.direction={ready:true,pAbove:.25,pBelow:.75};x.trend.direction=-1;assert.equal(assessTradeStrategy(x).tone,'down');x.aba.track.direction={ready:true,pAbove:.5,pBelow:.5};assert.equal(assessTradeStrategy(x).scenario,'observe');
});

test('low membership probability waits even when the conditional direction is strong',()=>{const x=input();x.aba.track.prediction.pMembership=.3;assert.equal(assessTradeStrategy(x).scenario,'observe');});
