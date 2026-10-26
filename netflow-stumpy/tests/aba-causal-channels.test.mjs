import test from 'node:test';import assert from 'node:assert/strict';
import {causalChannelAba} from '../aba-causal-channels.mjs';
const start=Date.parse('2026-10-20T12:00:00Z'),step=900000;
const bands=Array.from({length:60},(_,i)=>({t:start+i*step,upper:110}));
const c=(i,d)=>({startTime:start+i*step,confirmationTime:start+(i+2)*step,insideEndTime:start+(i+7)*step,direction:d,confirmed:true,volumeQualified:true,displayQualified:true,provisional:false});
const run=(channels,now=start+60*step)=>causalChannelAba({channels,bands,now});
test('A1 is exactly a drawn causal channel; next opposite is B and return is A2',()=>{
 const channels=[c(0,1),c(10,-1),c(20,1)],r=run(channels);
 assert.deepEqual(r.assignments.map(x=>x.phase),['A1','B','A2']);
 for(let i=0;i<3;i++){assert.equal(r.assignments[i].start,channels[i].startTime);assert.equal(r.assignments[i].end,channels[i].insideEndTime);assert.equal(r.assignments[i].confirmationTime,channels[i].confirmationTime);}
 assert.equal(r.phases.has(start+8*step),false);
 assert.deepEqual(r.events.map(x=>x.kind),['origin','confirmed','origin','confirmed','origin','confirmed']);
});
test('no independent price/flow detector and no unconfirmed or hidden channels',()=>{
 assert.equal(run([]).phases.size,0);
 for(const change of [{confirmed:false},{displayQualified:false},{volumeQualified:false},{confirmationTime:NaN}])assert.equal(run([{...c(0,1),...change}]).phases.size,0);
 assert.equal(run([c(0,1)],start+2*step).channelCount,0);
 assert.equal(run([c(0,1)],start+3*step).channelCount,1);
});
test('origin is retrospective geometry; issuance is the confirmation close',()=>{
 const r=run([c(0,-1)]);assert.equal(r.events[0].t,start);assert.equal(r.events[0].issuedAt,start+3*step);
 assert.equal(r.events[1].t,start+2*step);assert.equal(r.phases.get(start),'A1');
});
test('same direction channel restarts A1 and a new day resets sequence',()=>{
 assert.deepEqual(run([c(0,1),c(10,1)]).assignments.map(x=>x.phase),['A1','A1']);
 const next={...c(0,-1),startTime:start+86400000,confirmationTime:start+86400000+2*step,insideEndTime:start+86400000+7*step};
 assert.deepEqual(run([c(0,1),next],start+2*86400000).assignments.map(x=>x.phase),['A1','A1']);
});
