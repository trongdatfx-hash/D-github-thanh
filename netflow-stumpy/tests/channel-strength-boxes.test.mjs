import test from 'node:test';import assert from 'node:assert/strict';
import {channelStrengthBoxes} from '../channel-strength-boxes.mjs';
const step=900000,start=Date.parse('2026-10-20T12:00:00Z');
const rows=Array.from({length:60},(_,i)=>({t:start+i*step,end:start+(i+1)*step-1,o:100+i*.1,h:101+i*.1,l:99+i*.1,c:100+i*.1,q:1000,buy:500,session:'RTH'}));
const channel={direction:1,confirmed:true,volumeQualified:true,displayQualified:true,startTime:rows[16].t,confirmationTime:rows[24].t,insideEndTime:rows[30].t,provisional:false};
test('a confirmed channel creates exactly one DVP-classified box without a Strength threshold',()=>{
 assert.equal(channelStrengthBoxes(rows).boxes.length,0);
 const result=channelStrengthBoxes(rows,{channels:[channel]}),b=result.latest;
 assert.equal(result.boxes.length,1);assert.equal(b.start,channel.startTime);assert.equal(b.right,channel.insideEndTime);assert.equal(b.n,15);assert.equal(b.issuedAt,channel.confirmationTime+step);assert.equal(b.maxStrength,null);
 assert.equal(b.top,rows[30].h);assert.equal(b.bottom,rows[16].l);assert.equal(b.type,'COMPRESSED');assert.match(b.label,/NÉN/);assert.equal(result.snapshots.size,0);
});
test('unconfirmed and future channels cannot create a box; open candles are excluded',()=>{
 assert.equal(channelStrengthBoxes(rows,{channels:[{...channel,confirmed:false}]}).boxes.length,0);
 assert.equal(channelStrengthBoxes(rows,{channels:[channel],now:channel.confirmationTime+step-1}).boxes.length,0);
 assert.equal(channelStrengthBoxes(rows,{channels:[channel],now:rows[30].end}).boxes.length,0);
});
test('every displayed channel receives a box, including channels before the last seven',()=>{
 const channels=Array.from({length:12},(_,i)=>({...channel,startTime:rows[16+i].t,confirmationTime:rows[24+i].t,insideEndTime:rows[30+i].t}));
 const result=channelStrengthBoxes(rows,{channels});assert.equal(result.boxes.length,12);assert.equal(result.boxes[0].start,channels[0].startTime);
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
 assert.equal(annotated.start,channel.startTime);assert.equal(annotated.top,rows[30].h);
 compositeRows.set(channel.confirmationTime,{adjusted:.3});assert.equal(channelStrengthBoxes(rows,{channels:[channel],compositeRows,compositeMode:'filter'}).boxes.length,1);
});
