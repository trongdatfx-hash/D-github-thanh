import test from 'node:test';
import assert from 'node:assert/strict';
import {h1OiLabel,OiPercentColor} from '../h1-oi-label.mjs';
const live=(delta=1)=>({ready:true,delta,pct:delta*.23,t:1,partial:false,stale:false});
test('OI shows arrow and signed percent; missing is never fabricated as zero',()=>{
 const a=h1OiLabel(live());assert.equal(a.arrow,'↑');assert.equal(a.value,'+0.23%');assert.equal(a.text.includes('OI'),false);
 assert.equal(h1OiLabel(live(-1)).text,'↓ -0.23%');assert.equal(h1OiLabel(live(0)).text,'↔ 0.00%');assert.equal(h1OiLabel(null).text,'—');assert.equal(h1OiLabel(null,true).text,'—');assert.equal(h1OiLabel(live(),true).text,'↑ +0.23%');assert.ok(h1OiLabel({...live(),partial:true,stale:true}).text.endsWith('* · CŨ'));
});
test('color waits for three distinct samples and nine seconds, then holds for fifteen seconds',()=>{
 const gate=new OiPercentColor(),at=(d,now,sampleTime=now)=>gate.update(live(d),{now,sampleTime});
 assert.equal(at(1,0),'wait');assert.equal(at(1,4000),'wait');assert.equal(at(1,9000),'up');
 assert.equal(at(-1,10000),'up');assert.equal(at(-1,14000),'up');assert.equal(at(-1,20000),'up');assert.equal(at(-1,24000),'down');
 assert.equal(h1OiLabel(live(-1)).value,'-0.23%');
});
test('repeated samples do not advance confirmation; stale/error/new candle reset color',()=>{
 const gate=new OiPercentColor();for(const now of [0,4000,9000,12000])assert.equal(gate.update(live(),{now,sampleTime:1}),'wait');
 gate.update(live(),{now:13000,sampleTime:2});assert.equal(gate.update(live(),{now:14000,sampleTime:3}),'up');
 assert.equal(gate.update({...live(),stale:true},{now:15000,sampleTime:3}),'wait');
 assert.equal(gate.update(live(),{now:16000,sampleTime:4,error:true}),'wait');
 assert.equal(gate.update({...live(),t:2},{now:17000,sampleTime:5}),'wait');
});
