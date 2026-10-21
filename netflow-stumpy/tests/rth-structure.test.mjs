import test from 'node:test';
import assert from 'node:assert/strict';
import {ny,stamp,nextTradingDay,closeMinute,postEnd,caseAt,candidatesFor,selectCases,rankCases,shapeDescriptor,STEP} from '../rth-structure.mjs';
const start=Date.parse('2026-09-01T00:00:00Z'),end=Date.parse('2026-10-23T00:00:00Z');
const rows=Array.from({length:(end-start)/STEP},(_,i)=>{const t=start+i*STEP,c=600+.002*i+Math.sin(i/7);return {t,open:c-.1,high:c+.3,low:c-.3,c,pv:[Math.log(c),.4,.3,.7,1,.5,0,0,Math.sin(i/8),Math.cos(i/9)]};});
const at=(day,minute)=>rows.findIndex(r=>r.t===stamp(day,minute)-STEP),query=(day,minute,m=16,h=8)=>caseAt(rows,at(day,minute),m,h);
test('PRE targets upcoming RTH, RTH targets only unseen bars, POST targets next trading day',()=>{
 const pre=query('2026-10-20',540);assert.equal(pre.phase,'PRE');assert.equal(pre.targetStart,stamp('2026-10-20',570));assert.equal(pre.targetEnd,stamp('2026-10-20',690));
 const during=query('2026-10-20',600);assert.equal(during.phase,'RTH');assert.equal(during.targetStart,during.inputEnd);assert.ok(during.targetStart>during.queryTime);
 const post=query('2026-10-20',990);assert.equal(post.phase,'POST');assert.equal(post.targetDay,'2026-10-21');assert.equal(post.targetStart,stamp('2026-10-21',570));
 assert.equal(query('2026-10-20',960).targetDay,'2026-10-21');assert.equal(query('2026-10-20',570).targetStart,stamp('2026-10-20',570));
});
test('sample windows exclude NIGHT and cannot cross an overnight gap; late RTH needs >=4 unseen bars',()=>{
 assert.equal(query('2026-10-20',180),null);assert.equal(query('2026-10-20',360,16),null);assert.ok(query('2026-10-20',360,8));
 assert.equal(query('2026-10-20',930),null);assert.equal(query('2026-10-20',900,16,26).h,4);
});
test('NYSE DST, full holidays and early close boundaries',()=>{
 assert.equal(new Date(stamp('2026-03-06',570)).toISOString(),'2026-03-06T14:30:00.000Z');
 assert.equal(new Date(stamp('2026-03-09',570)).toISOString(),'2026-03-09T13:30:00.000Z');
 assert.equal(nextTradingDay('2026-07-02'),'2026-07-06');assert.equal(nextTradingDay('2026-01-16'),'2026-01-20');
 assert.equal(closeMinute('2026-11-27'),780);assert.equal(postEnd('2026-11-27'),1020);assert.equal(closeMinute('2026-07-02'),960);
});
test('geometry outcome families are explicit and anchored to the RTH segment open',()=>{
 const make=values=>values.map(c=>({open:100,c,high:c+.1,low:c-.1}));
 assert.equal(shapeDescriptor(make([100.4,100.8,101.2,101.6]),1).label,'UP_TREND');
 assert.equal(shapeDescriptor(make([99.6,99.2,98.8,98.4]),1).label,'DOWN_TREND');
 assert.equal(shapeDescriptor(make([100.1,99.9,100.05,100]),1).label,'RANGE');
 assert.equal(shapeDescriptor(make([100.8,101.3,100.4,99.9]),1).label,'UP_THEN_DOWN');
 assert.equal(shapeDescriptor(make([99.2,98.7,99.6,100.1]),1).label,'DOWN_THEN_UP');
});
test('same phase/NY clock only; all analog outcomes mature before query input; future outcomes cannot affect ranking',()=>{
 const q=query('2026-10-20',540),history=[];
 for(let i=15;i<rows.length;i++){if(ny(rows[i].t).minute!==525)continue;const c=caseAt(rows,i,16,8);if(c)history.push(c);}
 const candidates=candidatesFor(history,q),ranked=rankCases(rows,q,candidates),picked=selectCases(ranked,candidates);
 assert.ok(picked.length>=12);assert.equal(new Set(picked.map(c=>c.targetDay)).size,picked.length);
 assert.ok(picked.every(c=>c.phase===q.phase&&c.clockMinute===q.clockMinute&&c.targetEnd<=q.inputStart));
 const changed=rows.map(r=>r.t>=q.inputEnd?{...r,c:r.c*1.2,high:r.high*1.2,low:r.low*1.2}:r);
 assert.deepEqual(rankCases(changed,q,candidates),ranked);
 const truncated=rows.filter(r=>r.t<q.inputEnd),cq=caseAt(truncated,q.i,16,8);assert.equal(cq.outcome,null);assert.equal(cq.targetStart,q.targetStart);assert.equal(cq.inputStart,q.inputStart);
});
