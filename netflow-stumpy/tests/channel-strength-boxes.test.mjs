import test from 'node:test';import assert from 'node:assert/strict';
import {channelStrengthBoxes} from '../channel-strength-boxes.mjs';
const step=900000,start=Date.parse('2026-10-20T12:00:00Z');
const rows=Array.from({length:60},(_,i)=>({t:start+i*step,end:start+(i+1)*step-1,o:100+i*.1,h:101+i*.1,l:99+i*.1,c:100+i*.1,q:1000,buy:500,session:'RTH'}));
const channel={direction:1,confirmed:true,volumeQualified:true,displayQualified:true,startTime:rows[16].t,confirmationTime:rows[24].t,insideEndTime:rows[30].t,provisional:false};
test('a confirmed channel creates exactly one DVP-classified box without a Strength threshold',()=>{
 assert.equal(channelStrengthBoxes(rows).boxes.length,0);
 const result=channelStrengthBoxes(rows,{channels:[channel]}),b=result.latest;
 assert.equal(result.boxes.length,1);assert.equal(b.start,rows[8].t);assert.equal(b.originTime,channel.startTime);assert.equal(b.backBars,8);assert.equal(b.right,channel.insideEndTime);assert.equal(b.n,23);assert.equal(b.issuedAt,channel.confirmationTime+step);assert.equal(b.maxStrength,null);
 assert.equal(b.top,rows[30].h);assert.equal(b.bottom,rows[8].l);assert.equal(b.type,'COMPRESSED');assert.match(b.label,/NÉN/);assert.equal(result.snapshots.size,7);
});
test('unconfirmed and future channels cannot create a box; open candles are excluded',()=>{
 assert.equal(channelStrengthBoxes(rows,{channels:[{...channel,confirmed:false}]}).boxes.length,0);
 assert.equal(channelStrengthBoxes(rows,{channels:[channel],now:channel.confirmationTime+step-1}).boxes.length,0);
 assert.equal(channelStrengthBoxes(rows,{channels:[channel],now:rows[30].end}).boxes.length,0);
});
test('every displayed channel receives a box, including channels before the last seven',()=>{
 const channels=Array.from({length:12},(_,i)=>({...channel,startTime:rows[16+i].t,confirmationTime:rows[24+i].t,insideEndTime:rows[30+i].t}));
 const result=channelStrengthBoxes(rows,{channels});assert.equal(result.boxes.length,12);assert.equal(result.boxes[0].originTime,channels[0].startTime);
});
test('the box freezes at the channel end and future prices cannot widen it',()=>{
 const first=channelStrengthBoxes(rows,{channels:[channel]}).latest;
 const changed=rows.map((r,i)=>i>30?{...r,h:10000,c:9000}:r);
 assert.deepEqual(channelStrengthBoxes(changed,{channels:[channel]}).latest,first);
 assert.equal(first.live,false);assert.equal(first.open,false);assert.equal(first.right,rows[30].t);
});
test('Composite filtering checks the channel confirmation, annotation preserves geometry',()=>{
 const compositeRows=new Map(rows.map(r=>[r.t,{adjusted:.8}]));compositeRows.set(channel.confirmationTime,{adjusted:-.8});
 assert.equal(channelStrengthBoxes(rows,{channels:[channel],compositeRows,compositeMode:'filter'}).boxes.length,0);
 const annotated=channelStrengthBoxes(rows,{channels:[channel],compositeRows}).latest;
 assert.equal(annotated.originTime,channel.startTime);assert.equal(annotated.top,rows[30].h);
 compositeRows.set(channel.confirmationTime,{adjusted:.3});assert.equal(channelStrengthBoxes(rows,{channels:[channel],compositeRows,compositeMode:'filter'}).boxes.length,1);
});

test('backtracking changes geometry without moving the actual signal time',()=>{
 const a=channelStrengthBoxes(rows,{channels:[channel],back:0}).latest,b=channelStrengthBoxes(rows,{channels:[channel],back:8}).latest;
 assert.equal(a.start,channel.startTime);assert.equal(b.start,a.start-8*step);assert.equal(a.issuedAt,b.issuedAt);assert.equal(b.encoding.appearance.signalAt,b.issuedAt);assert.notEqual(b.encoding.appearance.signalAt,b.start);
 const gapped=rows.filter((_,i)=>i!==14),limited=channelStrengthBoxes(gapped,{channels:[channel],back:8}).latest;assert.equal(limited.backBars,1);
});
test('an encoded early candidate uses only current closed data and matures under the same ID',()=>{
 const early={...channel,startTime:rows[16].t,confirmationTime:rows[17].t,insideEndTime:rows[19].t,provisional:true,early:true,adaptiveR2:.95,slopeAtr:.3},compositeRows=new Map(rows.map(r=>[r.t,{adjusted:.8}])),volumeRows=new Map(rows.map(r=>[r.t,{adjusted:.8}])),options={earlyChannels:[early],compositeRows,volumeRows,now:rows[19].end+1};
 const a=channelStrengthBoxes(rows,options).latest;assert(a);assert.equal(a.stage,'EARLY');assert.equal(a.channelBars,4);assert.match(a.label,/SỚM 4\/8/);assert.equal(a.issuedAt,rows[19].end+1);assert.equal(a.encoding.forecast.remainingMinBars,4);assert.equal(a.encoding.forecast.probability,null);assert.equal(a.encoding.scoreIsProbability,false);assert(a.encoding.features.every(Number.isFinite));
 const grown=channelStrengthBoxes(rows,{...options,earlyChannels:[{...early,insideEndTime:rows[20].t}],now:rows[20].end+1}).latest;assert.equal(grown.issuedAt,a.issuedAt);assert.equal(grown.encoding.appearance.ageAtEncodingBars,1);
 const delayedComposite=new Map(compositeRows),delayedVolume=new Map(volumeRows);for(let i=16;i<=19;i++){delayedComposite.set(rows[i].t,{adjusted:-.8});delayedVolume.set(rows[i].t,{adjusted:-.8});}
 const delayed=channelStrengthBoxes(rows,{...options,earlyChannels:[{...early,insideEndTime:rows[20].t}],compositeRows:delayedComposite,volumeRows:delayedVolume,now:rows[20].end+1}).latest;assert.equal(delayed.issuedAt,rows[20].end+1);
 const altered=rows.map((r,i)=>i>19?{...r,c:500,h:501}:r);assert.deepEqual(channelStrengthBoxes(altered,options).latest,a);
 assert.equal(channelStrengthBoxes(rows,{...options,showEarly:false}).boxes.length,0);
 assert.equal(channelStrengthBoxes(rows,{...options,now:rows[18].end+1}).boxes.length,0);
 const mature={...early,early:false,insideEndTime:rows[23].t},b=channelStrengthBoxes(rows,{channels:[mature],earlyChannels:[early],compositeRows,volumeRows,now:rows[23].end+1}).latest;assert.equal(b.id,a.id);assert.equal(b.stage,'CONFIRMED');assert.equal(b.encoding.forecast,null);
});

test('confirmed causal boxes expose causal snapshots for each eligible closed bar',()=>{
 const result=channelStrengthBoxes(rows,{channels:[channel]});
 assert(result.snapshots.has(rows[24].t));assert(result.snapshots.has(rows[30].t));
 const first=result.snapshots.get(rows[24].t),last=result.snapshots.get(rows[30].t);
 assert.equal(first.asOf,rows[24].t);assert.equal(first.right,rows[24].t);assert.equal(first.source,'causal-channel');
 assert(first.n<last.n);assert(first.top<=last.top);assert(first.bottom>=last.bottom);
});
