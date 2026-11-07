import test from 'node:test';
import assert from 'node:assert/strict';
import {buildH1ScoreLine,h1ScoreLineReading} from '../h1-score-line.mjs';
const H=3600000,M=900000;
const box=(i,score,extra={})=>({blockStart:i*H,blockEnd:(i+1)*H-1,lockedAt:(i+1)*H,asOf:(i+1)*H,status:'LOCKED',closedBars:4,missing:[],score,...extra});
test('points are placed at H1 close, positive above zero, normalized by five',()=>{
  const r=buildH1ScoreLine([box(0,5),box(1,3)],{now:2*H});assert.deepEqual(r.points,[{time:H/1000,value:1},{time:2*H/1000,value:.7}]);assert.equal(r.timeline[1].smoothed,3.5);
});
test('strong direction change uses .9 alpha instead of .75',()=>{
  const r=buildH1ScoreLine([box(0,5),box(1,-2),box(2,2)],{now:3*H});assert.equal(r.timeline[1].alpha,.9);assert(r.timeline[1].smoothed<0);assert.equal(r.timeline[2].alpha,.9);assert(r.timeline[2].smoothed>0);
});
test('preview uses exactly three closed M15 at its actual asOf; cannot enter official line',()=>{
  const preview=box(1,-3,{status:'PREVIEW',closedBars:3,lockedAt:null,asOf:H+3*M});
  const r=buildH1ScoreLine([box(0,2),preview],{now:H+3*M});assert.equal(r.points.length,1);assert.equal(r.preview.length,2);assert.equal(r.preview.at(-1).time,(H+3*M)/1000);assert.equal(r.previewMeta.preview,true);assert.equal(h1ScoreLineReading(r,H+2*M).preview,false);assert.equal(h1ScoreLineReading(r,H+3*M).preview,true);
});
test('preview never changes smoothing state and is replaced cleanly at fourth close',()=>{
  const p=box(1,-4,{status:'PREVIEW',closedBars:3,lockedAt:null,asOf:H+3*M});
  const before=buildH1ScoreLine([box(0,4),p],{now:H+3*M});
  const after=buildH1ScoreLine([box(0,4),p,box(1,2)],{now:2*H});assert.deepEqual(before.points,after.points.slice(0,1));assert.equal(after.preview.length,0);assert.equal(after.timeline[1].smoothed,2.5);
});
test('missing components and absent H1 break the line and reset smoother',()=>{
  const a=buildH1ScoreLine([box(0,5),box(1,3,{status:'PARTIAL',missing:['OI']}),box(2,-3)],{now:3*H});assert.equal(a.points[1].value,undefined);assert.equal(a.timeline[2].smoothed,-3);assert.equal(h1ScoreLineReading(a,2*H).score,null);
  const b=buildH1ScoreLine([box(0,5),box(2,-3)],{now:3*H});assert.deepEqual(b.points[1],{time:2*H/1000});assert.equal(b.timeline.at(-1).smoothed,-3);
});
test('future H1 and fourth forming candle data cannot rewrite prior closed points',()=>{
  const a=buildH1ScoreLine([box(0,3),box(1,5)],{now:H+2*M}),b=buildH1ScoreLine([box(0,3),box(1,-5),box(2,5)],{now:H+2*M});assert.deepEqual(a,b);assert.equal(a.points.length,1);assert.equal(a.preview.length,0);
});
test('preview does not connect across missing H1 and incomplete preview stays hidden',()=>{
  const p=box(2,4,{status:'PREVIEW',closedBars:3,lockedAt:null,asOf:2*H+3*M});
  const a=buildH1ScoreLine([box(0,2),p],{now:2*H+3*M});assert.equal(a.preview.length,1);
  const b=buildH1ScoreLine([box(0,2),{...p,missing:['OI']}],{now:2*H+3*M});assert.equal(b.preview.length,0);
});
