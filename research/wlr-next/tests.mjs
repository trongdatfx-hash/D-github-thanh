import test from 'node:test';import assert from 'node:assert/strict';
import {segmentWlr} from '../../netflow-stumpy/wlr-aba-core.mjs';
import {stamp,STEP} from '../../netflow-stumpy/rth-structure.mjs';
import {nextQuery,nextLabel,nextPool,predictNext} from './core.mjs';
const day='2026-06-02',pre=stamp(day,240),end=stamp(day,1200);
const row=(t,color,mid=100)=>({t,color,mid,c:mid,high:mid+1,low:mid-1,x:[Math.log(mid),.2,.3,0],pv:[Math.log(mid),.2,.1,.8,0,.1,0,0,.2,.3]});
function frame(colors=[1,1,0,0,-1,-1,0]){
 const rows=Array.from({length:16},(_,i)=>row(pre-(16-i)*STEP,1));
 for(let j=0;j<64;j++)rows.push(row(pre+j*STEP,colors[Math.min(j,colors.length-1)],100+j/10));
 return segmentWlr(rows);
}
test('No AB query at PRE0; A must be known and inside same frame',()=>{
 const f=frame();assert.equal(nextQuery(f.rows,f.segments,16),null);
 const q=nextQuery(f.rows,f.segments,18);assert.equal(q.previousColor,1);assert.equal(q.color,0);assert.equal(q.knownBars,1);assert.equal(q.currentWlr,100.2);
});
test('AB-to-C is a scored next segment; not rejected as a broken ABA',()=>{
 const f=frame(),q=nextQuery(f.rows,f.segments,18),l=nextLabel(f.rows,f.segments,q,end);
 assert.equal(l.role,'THIRD_C');assert.equal(l.color,-1);assert.equal(l.status,'COMPLETE_NEXT');assert.ok(l.target.median>q.currentWlr);
});
test('AB-to-A uses the immediate next A median and same frozen B WLR',()=>{
 const f=frame([1,1,0,0,1,1,-1]),q=nextQuery(f.rows,f.segments,18),l=nextLabel(f.rows,f.segments,q,end);
 assert.equal(l.role,'RETURN_A');assert.equal(l.target.median,100.45);assert.equal(q.currentWlr,100.2);
});
test('Open next segment confirms color without inventing its final median',()=>{
 const f=frame([1,1,0,0,-1]),q=nextQuery(f.rows,f.segments,18),l=nextLabel(f.rows,f.segments,q,end);
 assert.equal(l.status,'NEXT_OPEN_AT_POST_END');assert.equal(l.role,'THIRD_C');assert.equal(l.target,null);
 const p=nextLabel(f.rows,f.segments,q,pre+7*STEP);assert.equal(p.status,'RIGHT_CENSORED');assert.equal(p.role,'THIRD_C');assert.equal(p.transition,null);
});
test('No-next at POST and missing future are distinct and have no color',()=>{
 const f=frame([1,1,0]),q=nextQuery(f.rows,f.segments,18),l=nextLabel(f.rows,f.segments,q,end);
 assert.equal(l.status,'NO_NEXT_BY_POST_END');assert.equal(l.role,null);assert.equal(l.transition,0);
 assert.equal(nextLabel(f.rows.filter((r,i)=>i!==25),f.segments,q,end).status,'MISSING_FUTURE');
});
test('Query prefix features do not change when unseen B future is modified',()=>{
 const a=frame([1,1,0,0,-1,-1,0]),b=frame([1,1,0,0,0,0,0,1]);
 assert.deepEqual(nextQuery(a.rows,a.segments,18),nextQuery(b.rows,b.segments,18));
});
test('Candidate gate enforces mature history before input, exact pair, phase, other day',()=>{
 const q={day:'2026-07-01',inputStart:100,color:0,previousColor:1,phase:'RTH'},c={...q,day:'2026-06-01',label:{transition:1,matureAt:90}};
 const bad=[{...c,label:{transition:1,matureAt:101}},{...c,color:1},{...c,previousColor:-1},{...c,phase:'PRE'},{...c,day:q.day},{...c,label:{transition:null,matureAt:90}}];
 assert.deepEqual(nextPool([c,...bad],q),[c]);
});
test('Forecast includes both colors in WLR distribution; min12 unique days; probabilities coherent',()=>{
 const q={currentWlr:100,atr:2,color:0,previousColor:1,thirdColor:-1,clockMinute:600};
 const pool=Array.from({length:20},(_,i)=>({day:'d'+i,i,clockMinute:600,label:{role:i<13?'RETURN_A':'THIRD_C',transition:1,target:{deltaAtr:i<13?1:-2}}}));
 const p=predictNext(q,pool);assert.equal(p.price.p50,102);assert.equal(p.price.p10,96);assert.equal(p.price.p90,102);assert.equal(p.price.n,20);assert.equal(p.pReturn,14/22);assert.equal(p.price.pAbove,14/22);assert.equal(p.price.pAbove+p.price.pBelow,1);assert.equal(p.price.anchorPercentile,.35);assert.equal(p.byRole.THIRD_C.ready,false);
 const dup=Array.from({length:20},()=>pool[0]);assert.equal(predictNext(q,dup).price.ready,false);assert.equal(predictNext(q,dup).readyColor,false);
});
test('Every literal B color is allowed, with exactly A or C for its next change',()=>{
 for(const a of [-1,0,1])for(const b of [-1,0,1])if(a!==b){const c=[-1,0,1].find(v=>v!==a&&v!==b),f=frame([a,a,b,b,c,c,b]),q=nextQuery(f.rows,f.segments,18);assert.equal(q.thirdColor,c);assert.equal(nextLabel(f.rows,f.segments,q,end).role,'THIRD_C');}
});
