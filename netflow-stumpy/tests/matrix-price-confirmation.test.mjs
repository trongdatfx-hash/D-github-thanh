import test from 'node:test';
import assert from 'node:assert/strict';
import {buildH1Matrix} from '../h1-matrix-state.mjs';
const H=3600000,M=900000;
const records=n=>Array.from({length:n},(_,i)=>({blockStart:i*H,status:'LOCKED',closedBars:4,parts:{position:-1,slope:-1,deltaNF:-1,oi:-1,randomWalk:-1},missing:[]}));
const bars=n=>Array.from({length:n*4},(_,i)=>({t:i*M,end:(i+1)*M-1,o:95,c:95,h:i<12?100:96,l:i<12?90:94}));
function setClose(a,index,value){a[index]={...a[index],c:value,h:Math.max(a[index].h,value),l:Math.min(a[index].l,value)};}
const latest=(r,p,now=6*H)=>buildH1Matrix(r,{}, {priceRows:p,now}).groups.at(-1);
test('two closed M15 below fixed previous-group low confirm downward price',()=>{
  const p=bars(6);setClose(p,22,89);setClose(p,23,88);const g=latest(records(6),p);
  assert(g.priceConfirmation.confirmed);assert.equal(g.priceConfirmation.direction,-1);assert.match(g.text,/Giảm · xn 2 M15/);assert.deepEqual(g.priceConfirmation.zone,{low:90,high:100,from:0,to:3*H,knownAt:3*H,firstBox:1,lastBox:3});
});
test('one break, wick only, equality and opposite-side closes cannot confirm',()=>{
  const r=records(6),a=bars(6);setClose(a,23,89);assert.equal(latest(r,a).priceConfirmation.count,1);
  const b=bars(6);b[22].l=85;b[23].l=84;assert.equal(latest(r,b).priceConfirmation.confirmed,false);
  const c=bars(6);setClose(c,22,90);setClose(c,23,90);assert.equal(latest(r,c).priceConfirmation.confirmed,false);
  const d=bars(6);setClose(d,22,101);setClose(d,23,89);assert.equal(latest(r,d).priceConfirmation.confirmed,false);
});
test('forming or incomplete second candle and gaps cannot satisfy two closes',()=>{
  const p=bars(6);setClose(p,22,89);setClose(p,23,88);const r=records(6);
  assert.equal(latest(r,p,6*H-1).priceConfirmation.confirmed,false);
  assert.equal(latest(r,p.filter(b=>b.t!==22*M)).priceConfirmation.confirmed,false);
  assert.equal(latest(r,p.map((b,i)=>i===23?{...b,sourceComplete:false}:b)).priceConfirmation.confirmed,false);
});
test('price confirmation is independent of missing or opposing flow/OI evidence',()=>{
  const r=records(6);for(const a of r.slice(3)){a.parts.oi=null;a.parts.deltaNF=1;a.status='PARTIAL';}
  const p=bars(6);setClose(p,22,89);setClose(p,23,88);const g=latest(r,p);
  assert(g.priceConfirmation.confirmed);assert.equal(g.forceState,'MISSING');assert.match(g.text,/C Taker ×/);assert.equal(g.text.includes('OI'),false);
});
test('confirmed upward price may oppose the WLR bias and remains labelled by price',()=>{
  const p=bars(6);setClose(p,22,101);setClose(p,23,102);const g=latest(records(6),p);assert.equal(g.priceConfirmation.direction,1);assert.match(g.text,/Tăng · xn 2 M15/);assert.match(g.text,/C Taker ×/);
});
test('latest closed M15 tail updates confirmation without waiting for a new H1',()=>{
  const p=bars(7);setClose(p,24,89);setClose(p,25,88);const g=latest(records(6),p,6*H+2*M);assert(g.priceConfirmation.confirmed);assert.equal(g.priceConfirmation.asOf,6*H+2*M);
});
test('re-entry into the zone cancels current confirmation',()=>{
  const p=bars(7);setClose(p,24,89);setClose(p,25,88);setClose(p,26,95);
  const g=latest(records(6),p,6*H+3*M);assert.equal(g.priceConfirmation.confirmed,false);assert.match(g.text,/chờ phá/);
});
test('future candles and later groups cannot rewrite older group confirmation',()=>{
  const p=bars(9);setClose(p,22,89);setClose(p,23,88);setClose(p,34,101);setClose(p,35,102);
  const before=buildH1Matrix(records(9),{}, {priceRows:p,now:9*H}).groups[0];
  const q=p.map((b,i)=>i>=24?{...b,c:500,h:1000,l:0}:b),after=buildH1Matrix(records(9),{}, {priceRows:q,now:9*H}).groups[0];
  assert.deepEqual(after,before);assert.equal(before.priceConfirmation.asOf,6*H);
  assert.deepEqual(latest(records(6),p,6*H),latest(records(6),q,6*H));
});
test('missing reference candles leave zone unknown; break candles never move its edges',()=>{
  const p=bars(6);setClose(p,22,89);setClose(p,23,88);p[23].l=-100;p[23].h=1000;
  assert.deepEqual(latest(records(6),p).priceConfirmation.zone.low,90);assert.equal(latest(records(6),p).priceConfirmation.zone.high,100);
  const missing=latest(records(6),p.filter(b=>b.t!==5*M));assert.equal(missing.priceConfirmation.zone,null);assert.equal(missing.priceConfirmation.confirmed,false);
});
