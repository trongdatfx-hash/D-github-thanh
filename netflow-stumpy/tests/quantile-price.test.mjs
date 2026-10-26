import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {quantileFeature,quantileDataset,forecastQuantiles,QR_FEATURES,QR_VERSION} from '../quantile-price-core.mjs';
import {strengthBoxes} from '../strength-box-core.mjs';
const step=900000,start=Date.parse('2026-10-20T05:00:00Z');
const rows=Array.from({length:60},(_,i)=>({t:start+i*step,end:start+(i+1)*step-1,o:100+i*.05,c:100+i*.05,h:100.5+i*.05,l:99.5+i*.05,q:1000,buy:600}));
const t=rows[30].t,box={asOf:t,issuedAt:t+step,live:true,open:true,top:104,bottom:99,width:5,maxStrength:.97,direction:1,n:9,efficiency:.8,id:t,type:'COMPRESSED'};
const feature=quantileFeature(rows.slice(11,31),new Map(rows.map(r=>[r.t,r])),box);
const coefficients=[-.5,0,.5].map(v=>QR_FEATURES.map((_,i)=>i?0:v));
const sourceModels={3:{coefficients,trainEnd:t-step,trainN:300,trainDays:30},6:{coefficients,trainEnd:t-step,trainN:300,trainDays:30}};
const report={version:QR_VERSION,features:QR_FEATURES,models:sourceModels,sources:{strength:{models:sourceModels},causalChannel:{models:sourceModels}}};
test('prediction is anchored to the contemporaneous box midpoint, not last close',()=>{
 assert(feature);assert.equal(feature.anchor,101.5);assert.equal(feature.x.length,QR_FEATURES.length);assert(feature.x.every(Number.isFinite));
 const r=forecastQuantiles(feature,report,3);assert.equal(r.status,'RESEARCH');assert.equal(r.p50,feature.anchor);assert.equal(r.target,t+3*step);assert(r.p10<=r.p50&&r.p50<=r.p90);
});
test('final future box, missing box and unclosed context cannot be substituted',()=>{
 const s=rows.slice(11,31),q=new Map(rows.map(r=>[r.t,r]));
 assert.equal(quantileFeature(s,q,null),null);assert.equal(quantileFeature(s,q,{...box,asOf:t+step}),null);assert.equal(quantileFeature(s,q,{...box,issuedAt:t+2*step}),null);
 assert.equal(quantileFeature(s,q,{...box,live:false,open:false}),null);
});
test('mismatched version, future-trained and stale snapshots fail closed',()=>{
 assert.equal(forecastQuantiles(feature,{...report,version:'old'},3).status,'WAIT_MODEL');
 assert.equal(forecastQuantiles(feature,{...report,models:{3:{...report.models[3],trainEnd:feature.issuedAt}}},3).status,'WAIT_TRAINING_CUTOFF');
 assert.equal(forecastQuantiles(feature,{...report,models:{3:{...report.models[3],trainEnd:t-11*86400000}}},3).status,'WAIT_MODEL_STALE');
 const late={...feature,t:Date.parse('2026-10-20T23:30:00Z'),day:'2026-10-20'};assert.equal(forecastQuantiles(late,report,6).status,'WAIT_SESSION_END');
});
test('quantile rearrangement is deterministic and numerical corruption is rejected',()=>{
 const m={...report,models:{3:{...report.models[3],coefficients:[coefficients[2],coefficients[0],coefficients[1]]}}};const r=forecastQuantiles(feature,m,3);assert.equal(r.reordered,true);assert(r.p10<=r.p50&&r.p50<=r.p90);
 assert.equal(forecastQuantiles(feature,{...report,models:{3:{...report.models[3],coefficients:[[NaN],[],[]]}}},3).status,'WAIT_MODEL');
});
test('stored walk-forward targets mature strictly before each test forecast',()=>{
 const r=JSON.parse(fs.readFileSync(new URL('../data/quantile-price/report.json',import.meta.url),'utf8'));assert.equal(r.version,QR_VERSION);
 for(const h of [3,6]){const m=r.models[h];assert(m.coefficients.every(b=>b.length===QR_FEATURES.length));for(const row of m.replay)assert(row.trainEnd<row.t+step);assert.equal(m.validation.n,m.replay.length);}
});

test('causal-channel boxes select their dedicated coefficient branch',()=>{
 const causalFeature={...feature,source:'causalChannel'};
 assert.equal(forecastQuantiles(causalFeature,report,3,'causalChannel').status,'RESEARCH');
 const missing={...report,sources:{strength:report.sources.strength}};
 assert.equal(forecastQuantiles(causalFeature,missing,3,'causalChannel').status,'WAIT_MODEL');
});
