import test from 'node:test';import assert from 'node:assert/strict';
import {encodeStrengthBox,BOX_ENCODING_FEATURES} from '../strength-box-encoding.mjs';
import {stamp} from '../rth-structure.mjs';
const step=900000;
function sample(day,minute=570){
 const t=stamp(day,minute),rows=Array.from({length:4},(_,i)=>({t:t-(4-i)*step,c:100+i}));
 const box={issuedAt:t,right:t-step,originTime:rows[0].t,start:rows[0].t-8*step,direction:1,stage:'EARLY',type:'COMPRESSED',backBars:8,width:2,atr:1,efficiency:.7};
 return {box,args:{rows,channel:{adaptiveR2:.8,slopeAtr:.2},composite:.5,volume:.6,step}};
}
test('appearance uses the signal close and New York clock consistently through DST',()=>{
 const summer=sample('2026-07-20'),winter=sample('2026-12-07');
 const a=encodeStrengthBox(summer.box,summer.args),b=encodeStrengthBox(winter.box,winter.args);
 for(const r of [a,b]){assert.equal(r.appearance.minuteNY,570);assert.equal(r.appearance.session,'PRE');assert.equal(r.appearance.barsFromSessionOpen,22);assert.equal(r.features.length,BOX_ENCODING_FEATURES.length);assert(r.features.every(Number.isFinite));assert.match(r.code,/PRE-0930$/);assert.equal(r.forecast.probability,null);}
 assert.equal(a.features[10],b.features[10]);assert.equal(a.features[11],b.features[11]);assert.equal(a.appearance.signalAt,summer.box.issuedAt);assert.notEqual(a.appearance.signalAt,summer.box.start);
});
test('elapsed wall time and observed candle spacing are encoded separately',()=>{
 const {box,args}=sample('2026-10-20',585),a=encodeStrengthBox(box,{...args,previousAppearance:box.issuedAt-8*step});
 assert.equal(a.appearance.session,'RTH');assert.equal(a.appearance.barsFromSessionOpen,1);assert.equal(a.appearance.minutesSincePrevious,120);assert.equal(a.appearance.barsSincePrevious,4);
 const b=encodeStrengthBox({...box,start:box.start-12*step},args);assert.equal(b.appearance.signalAt,a.appearance.signalAt);assert.equal(b.appearance.minuteNY,a.appearance.minuteNY);assert.equal(b.missing.previousAppearance,true);
});
