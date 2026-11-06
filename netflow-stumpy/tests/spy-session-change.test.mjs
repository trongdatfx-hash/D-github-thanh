import test from 'node:test';
import assert from 'node:assert/strict';
import {spyUsdtSessionChange} from '../spy-session-change.mjs';

const step=900000;
const row=(t,o,c,session='RTH')=>({t,o,c,session});

test('uses current SPYUSDT session open and current candle price',()=>{
 const state=spyUsdtSessionChange([row(0,100,100.2),row(step,100.2,101.31)],{step});
 assert.equal(state.open,100);
 assert.equal(state.current,101.31);
 assert.equal(state.volatile,true);
 assert.ok(Math.abs(state.changePct-1.31)<1e-9);
});

test('threshold is strict and works in both directions',()=>{
 assert.equal(spyUsdtSessionChange([row(0,100,101.3)],{step}).volatile,false);
 assert.equal(spyUsdtSessionChange([row(0,100,98.69)],{step}).volatile,true);
});

test('keeps one contiguous NIGHT session across midnight',()=>{
 const state=spyUsdtSessionChange([row(0,100,100.1,'NIGHT'),row(step,100.1,100.4,'NIGHT')],{step});
 assert.equal(state.open,100);
 assert.equal(state.startTime,0);
});

test('a data gap starts a new session segment',()=>{
 const state=spyUsdtSessionChange([row(0,100,100.1),row(step*3,102,103)],{step});
 assert.equal(state.open,102);
});

test('weekend and invalid inputs do not produce a label',()=>{
 assert.equal(spyUsdtSessionChange([row(0,100,101,'WEEKEND')],{step}),null);
 assert.equal(spyUsdtSessionChange([],{step}),null);
});
