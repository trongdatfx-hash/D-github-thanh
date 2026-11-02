import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../data.mjs';
const T=Date.now()-3600000,Q=900000,t=Math.floor(T/Q)*Q;
function api(symbol,price){const calls=[];return {calls,get:async path=>{calls.push(path);assert(path.includes('symbol='+symbol));return [[t,price,price+.001,price-.001,price,10,t+Q-1,100,0,0,60]];}};}
function storage(){const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};}
test('EUR requests only EUR and is never seeded by previous XAU bars',async()=>{
 const s=storage(),x=api('XAUUSDT',2700),e=api('EURUSDT',1.085);
 const gold=await load('15m',7,{get:x.get,storage:s});
 const eur=await load('15m',7,{get:e.get,storage:s,previous:gold,marketSymbol:'EURUSDT'});
 assert.equal(eur.marketSymbol,'EURUSDT');assert.equal(eur.incremental,false);assert.equal(eur.SPYUSDT[0].c,1.085);assert.deepEqual(eur.SPYUSDT,eur.QQQUSDT);assert(e.calls.length>0);
});
test('stored history is separated by market when switching back',async()=>{
 const s=storage();await load('15m',7,{get:api('XAUUSDT',2700).get,storage:s});await load('15m',7,{get:api('EURUSDT',1.085).get,storage:s,marketSymbol:'EURUSDT'});
 const gold=await load('15m',7,{get:api('XAUUSDT',2700).get,storage:s});assert(gold.restored);assert.equal(gold.SPYUSDT[0].c,2700);
});
test('unsupported market cannot silently substitute another instrument',async()=>{
 await assert.rejects(load('15m',7,{marketSymbol:'WRONG',get:()=>assert.fail('unexpected request'),storage:null}),/không được hỗ trợ/);
});
