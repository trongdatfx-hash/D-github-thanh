import test from 'node:test';
import assert from 'node:assert/strict';
import {pivotMatrixStyle} from '../pivot-matrix-style.mjs';
const H=3600000,S=900000;
function sample(kind='support',pressure=false){
 const expected=kind==='support'?1:-1,d=pressure?-expected:expected,zone={kind,low:99,high:101,level:100,confirmedAt:0};
 const columns=Array.from({length:3},(_,i)=>({t:i*H,values:{position:d,slope:d,deltaNF:d,oi:d}}));
 const bars=Array.from({length:12},(_,i)=>{const raw=pressure?102-i*.17:100+i*.08,c=expected>0?raw:200-raw;return {t:i*S,o:c,h:c+.3,l:c-.3,c};});
 return {zone,matrix:{columns},bars,now:3*H};
}
test('support and resistance strengthen symmetrically with local touch and reaction',()=>{
 for(const kind of ['support','resistance']){const f=sample(kind),r=pivotMatrixStyle(f.zone,f.matrix,f.bars,f.now);assert.equal(r.state,'reinforced');assert.equal(r.width,4);assert.equal(r.dashed,false);f.matrix.columns[0].values.deltaNF=0;assert.equal(pivotMatrixStyle(f.zone,f.matrix,f.bars,f.now).width,3);}
});
test('opposing local flow and advancing price draw a dashed pressure line',()=>{
 for(const kind of ['support','resistance']){const f=sample(kind,true),r=pivotMatrixStyle(f.zone,f.matrix,f.bars,f.now);assert.equal(r.state,'pressure');assert.equal(r.width,2);assert.equal(r.dashed,true);}
});
test('missing OI, untouched regions, gaps and old H1 cannot strengthen or pressure a zone',()=>{
 const f=sample();f.matrix.columns[0].values.oi=null;assert.equal(pivotMatrixStyle(f.zone,f.matrix,f.bars,f.now).state,'unconfirmed');
 const g=sample();for(const b of g.bars){b.h+=10;b.l+=10;b.c+=10;b.o+=10;}assert.equal(pivotMatrixStyle(g.zone,g.matrix,g.bars,g.now).width,1);
 const h=sample();h.matrix.columns[1].t+=S;assert.equal(pivotMatrixStyle(h.zone,h.matrix,h.bars,h.now).state,'unconfirmed');
 const i=sample();assert.equal(pivotMatrixStyle(i.zone,i.matrix,i.bars,i.now+2*H).state,'unconfirmed');
});
test('future prices and future matrix columns do not alter assessment; pre-confirmation cells are excluded',()=>{
 const f=sample(),a=pivotMatrixStyle(f.zone,f.matrix,f.bars,f.now);
 f.matrix.columns.push({t:3*H,values:{position:-1,slope:-1,deltaNF:-1,oi:-1}});f.bars.push({t:3*H,o:1,h:999,l:0,c:1});
 assert.deepEqual(pivotMatrixStyle(f.zone,f.matrix,f.bars,f.now),a);
 assert.equal(pivotMatrixStyle({...f.zone,confirmedAt:2*H},f.matrix,f.bars,f.now).state,'unconfirmed');
});
