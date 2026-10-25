import test from 'node:test';
import assert from 'node:assert/strict';
import {abaBandPhases,abaBandLineData,ABA_BAND_COLORS} from '../wlr-aba-band-colors.mjs';
const start=Date.parse('2026-10-20T09:00:00Z'),features=[-1,-1,0,0,-1,-1].map((color,i)=>({t:start+i*900000,mid:100+i,color}));
const state={enabled:true,live:true,verified:true,synced:true,version:3,preview:{emit:true},lastTime:features.at(-1).t,track:{day:'2026-10-20',originStart:start,q:{color:-1},prediction:{ready:true,memberReady:true,pMembership:.7}}};
test('qualified research colors phase A green, B red, next A green independent of WLR direction',()=>{
 const result=abaBandPhases(features,state);assert.equal(result.status,'QUALIFIED_RESEARCH');assert.deepEqual([...result.phases.values()],['A','A','B','B','A','A']);
 const bands=features.map(x=>({...x,upper:x.mid+2,lower:x.mid-2}));
 for(const field of ['upper','lower']){const data=abaBandLineData(bands,field,result.phases);assert.deepEqual(data.map(x=>x.value),bands.map(x=>x[field]));assert.deepEqual(data.map(x=>x.color),['A','A','B','B','A','A'].map(x=>ABA_BAND_COLORS[x]));}
});
test('missing, stale, disabled, unsynced or blocked quality stays neutral',()=>{
 for(const change of [{enabled:false},{live:false},{verified:false},{synced:false},{version:2},{preview:{emit:false}},{track:{...state.track,prediction:{ready:false}}},{track:{...state.track,prediction:{ready:true,memberReady:false,pMembership:.8}}},{track:{...state.track,prediction:{ready:true,memberReady:true,pMembership:.49}}}]){
  const result=abaBandPhases(features,{...state,...change});assert.equal(result.phases.size,0,JSON.stringify(change));
 }
 assert.equal(abaBandPhases(features).phases.size,0);
});
test('broken pattern, gaps and missing origins do not imply an A B A',()=>{
 const broken=features.map((x,i)=>i>=4?{...x,color:1}:x);
 assert.equal(abaBandPhases(broken,state).status,'PATTERN_BROKEN');
 assert.equal(abaBandPhases(features,{...state,track:{...state.track,originStart:start-900000}}).phases.size,0);
 const gap=features.map((x,i)=>i>=2?{...x,t:x.t+900000}:x);assert.equal(abaBandPhases(gap,state).phases.size,0);
});
test('does not color open/future bars or unrelated history, leaves missing band gaps intact',()=>{
 const result=abaBandPhases(features,{...state,lastTime:features[3].t});assert.equal(result.phases.size,4);
 const data=abaBandLineData([{t:start-900000,upper:99},{t:start,upper:101},{t:start+900000}], 'upper',result.phases);
 assert.equal(data[0].color,ABA_BAND_COLORS.neutral);assert.equal(data[1].color,ABA_BAND_COLORS.A);assert.deepEqual(data[2],{time:(start+900000)/1000});
});
