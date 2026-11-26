import test from 'node:test';
import assert from 'node:assert/strict';
import {gexMapping,projectGexStrike,closedGexReference,gexReferenceTime,gexReferenceInput} from './gex-calibration.mjs';
test('synchronized ratio maps anchor exactly and preserves percentage distances',()=>{
 const m=gexMapping({mode:'PAIR_RATIO',source:7600,target:722,scale:10,referenceTime:1});
 assert.equal(projectGexStrike(7600,m),722);assert.equal(projectGexStrike(7676,m),729.22);assert.notEqual(m.ratio,.1);
});
test('shift maps the anchor but preserves chosen strike spacing',()=>{
 const m=gexMapping({mode:'PAIR_SHIFT',source:7600,target:722,scale:10,referenceTime:1});
 assert.equal(projectGexStrike(7600,m),722);assert.equal(projectGexStrike(7605,m),722.5);
 assert.equal(projectGexStrike(7600,gexMapping({mode:'BASIS',basis:380,scale:10})),722);
});
test('incomplete calibration never falls back to zero or an inferred price',()=>{
 for(const config of [{mode:'BASIS',basis:''},{mode:'PAIR_RATIO',source:7600,target:722},{mode:'PAIR_RATIO',source:'',target:722,referenceTime:1},{mode:'PAIR_SHIFT',source:7600,target:0,referenceTime:1},{mode:'bad',basis:0},{mode:'BASIS',scale:0,basis:1}])assert.throws(()=>gexMapping(config));
});
test('reference close matches exact shared timestamp, excludes live and nearby bars',()=>{
 const bars=[{t:0,c:720},{t:900000,c:722},{t:1800000,c:724}],step=900000,now=2000000;
 assert.deepEqual(closedGexReference(bars,{step,now}),{price:722,time:1800000});
 assert.deepEqual(closedGexReference(bars,{step,now,time:900000}),{price:720,time:900000});
 for(const time of [900001,1799999,2700000])assert.equal(closedGexReference(bars,{step,now,time}),null);
});
test('reference time is explicitly Vietnam time regardless of device timezone',()=>{
 const time=Date.parse('2026-11-26T15:45:00Z');assert.equal(gexReferenceInput(time),'2026-11-26T22:45');assert.equal(gexReferenceTime('2026-11-26T22:45'),time);assert.ok(Number.isNaN(gexReferenceTime('')));
});
