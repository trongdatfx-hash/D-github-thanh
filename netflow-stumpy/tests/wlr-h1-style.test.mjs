import test from 'node:test';
import assert from 'node:assert/strict';
import {wlrH1Styles,WLR_H1_PALETTE as C} from '../wlr-h1-style.mjs';
const H=3600000,M=900000;
const rec=(start=0,score=3,boxDirection=1)=>({blockStart:start,blockEnd:start+H-1,asOf:start+H,lockedAt:start+H,closedBars:4,status:'LOCKED',missing:[],score,boxDirection});
const rows=times=>times.map(t=>({t,mid:100}));
const styles=(times,records,now=4*H)=>wlrH1Styles(rows(times),records,{now});
test('a final H1 score never colors earlier M15 points',()=>{
  const out=styles([0,M,2*M,3*M,H,H+M],[rec()]);
  assert.ok(out.slice(0,4).every(x=>!x.ready&&x.width===2));
  assert.equal(out[4].score,3);assert.equal(out[4].width,5);assert.equal(out[4].color,C.positive);
});
test('symmetric magnitudes map directly to 2..7 px without EWMA delay',()=>{
  for(const dir of [-1,1])for(let score=0;score<=5;score++){
    const x=styles([H],[rec(0,dir*score,dir)])[0];assert.equal(x.width,2+score);assert.equal(x.boxDirection,dir);
  }
  const out=styles([H,2*H],[rec(0,5,1),rec(H,-5,-1)]);
  assert.equal(out[1].width,7);assert.equal(out[1].color,C.negative);
});
test('opposed score is amber and thin; neutral box remains gray',()=>{
  const conflict=styles([H],[rec(0,-5,1)])[0];assert.equal(conflict.color,C.conflict);assert.equal(conflict.width,2);assert.equal(conflict.direction,0);
  const flat=styles([H],[rec(0,5,0)])[0];assert.equal(flat.color,C.neutral);assert.equal(flat.width,2);
});
test('missing inputs and stale scores never become neutral zero or stay strong',()=>{
  const partial={...rec(H,-4,-1),status:'PARTIAL',lockedAt:null,missing:['OI_P62']};
  const out=styles([H,2*H,3*H],[rec(0,5,1),partial]);
  assert.equal(out[0].width,7);assert.equal(out[1].reason,'incomplete_h1');assert.equal(out[1].score,null);assert.equal(out[1].width,2);assert.equal(out[2].reason,'stale_h1');
});
test('3/4 preview affects only the forming tail using the prior locked color',()=>{
  const preview={...rec(H,-3,-1),status:'PREVIEW',closedBars:3,asOf:H+3*M,lockedAt:null};
  const now=H+3*M+1000,out=styles([H,H+M,H+2*M,H+3*M],[rec(0,2,1),preview],now);
  assert.ok(out.slice(0,3).every(x=>!x.preview&&x.score===2));
  assert.equal(out[3].preview,true);assert.equal(out[3].boxDirection,1);assert.equal(out[3].tone,'conflict');assert.equal(out[3].width,2);assert.ok(out[3].color.includes('.55'));
});
test('preview caps width, ignores incomplete / early / expired / malformed records',()=>{
  const preview={...rec(H,5,-1),status:'PREVIEW',closedBars:3,asOf:H+3*M,lockedAt:null};
  const now=H+3*M+1000;
  assert.equal(styles([H+3*M],[rec(),preview],now)[0].width,3);
  for(const bad of [{...preview,missing:['OI_P62']},{...preview,closedBars:2},{...preview,asOf:H+2*M}])assert.equal(styles([H+3*M],[rec(),bad],now)[0].preview,false);
  assert.equal(styles([H+2*M],[rec(),preview],H+2*M+1000)[0].preview,false);
  assert.equal(styles([2*H],[rec(),preview],2*H)[0].ready,false);
});
test('future records do not affect an earlier prefix; WLR prices are untouched',()=>{
  const input=rows([H,H+M,2*H]),original=structuredClone(input);
  const before=wlrH1Styles(input,[rec()],{now:4*H});
  const after=wlrH1Styles(input,[rec(),rec(H,-5,-1)],{now:4*H});
  assert.deepEqual(before.slice(0,2),after.slice(0,2));assert.deepEqual(input,original);
  assert.equal(wlrH1Styles([{t:H,mid:null}],[rec()],{now:4*H})[0].reason,'missing_wlr');
});
test('invalid timestamps / interval and malformed locks are rejected or left missing',()=>{
  assert.throws(()=>wlrH1Styles(rows([H,H]),[],{now:4*H}));
  assert.throws(()=>wlrH1Styles([],[],{step:H,now:4*H}));
  for(const bad of [{...rec(),lockedAt:H-1},{...rec(),score:8},{...rec(),asOf:H+1},{...rec(),closedBars:3}])assert.equal(styles([H],[bad])[0].ready,false);
});
test('box alignment colors exactly the four M15 that created each locked score',()=>{
  const times=Array.from({length:12},(_,i)=>i*M);
  const out=wlrH1Styles(rows(times),[rec(0,-3,1),rec(H,-5,-1)],{now:3*H,alignment:'box'});
  assert.ok(out.slice(0,4).every(x=>x.blockStart===0&&x.color===C.conflict&&x.width===2&&x.historical&&x.knownAt===H));
  assert.ok(out.slice(4,8).every(x=>x.blockStart===H&&x.color===C.negative&&x.width===7&&x.knownAt===2*H));
  assert.ok(out.slice(8).every(x=>!x.ready));
});
test('box-aligned history is unavailable before the H1 closes',()=>{
  const out=wlrH1Styles(rows([0,M,2*M,3*M]),[rec()],{now:H-1,alignment:'box'});
  assert.ok(out.every(x=>!x.ready&&!x.historical&&x.knownAt===null));
});
test('box mode never borrows a previous score for missing, partial or gapped boxes',()=>{
  const partial={...rec(H,-4,-1),status:'PARTIAL',lockedAt:null,missing:['OI_P62']};
  const out=wlrH1Styles(rows([0,H,2*H,3*H]),[rec(0,5,1),partial,rec(3*H,-2,-1)],{now:5*H,alignment:'box'});
  assert.equal(out[0].width,7);assert.equal(out[1].ready,false);assert.equal(out[2].ready,false);assert.equal(out[3].score,-2);
});
test('box mode uses that box color rather than a previous / cached ledger color',()=>{
  const states=new Map([0,M,2*M,3*M].map(t=>[t,{t,blockStart:0,blockEnd:H-1,preview:false,direction:-1}]));
  const out=wlrH1Styles(rows([0,M,2*M,3*M]),[rec(0,-4,1)],{now:2*H,alignment:'box',boxStates:states});
  assert.ok(out.every(x=>x.boxDirection===-1&&x.color===C.negative&&x.width===6));
  const missing=wlrH1Styles(rows([0]),[rec()],{now:2*H,alignment:'box',boxStates:new Map()})[0];
  assert.equal(missing.reason,'missing_h1_color');assert.equal(missing.ready,false);
});
test('own-box preview uses current provisional color only after three closes',()=>{
  const preview={...rec(H,-3,1),status:'PREVIEW',closedBars:3,asOf:H+3*M,lockedAt:null};
  const times=[H,H+M,H+2*M,H+3*M],states=new Map(times.map(t=>[t,{t,blockStart:H,blockEnd:2*H-1,preview:true,direction:-1}]));
  const out=wlrH1Styles(rows(times),[rec(0,5,1),preview],{now:H+3*M+1000,alignment:'box',boxStates:states});
  assert.ok(out.slice(0,3).every(x=>!x.ready));assert.equal(out[3].preview,true);assert.equal(out[3].boxDirection,-1);assert.equal(out[3].tone,'confirmed');assert.equal(out[3].width,3);assert.equal(out[3].historical,false);
  const early=wlrH1Styles(rows([H+2*M]),[preview],{now:H+2*M+1000,alignment:'box',boxStates:states})[0];assert.equal(early.ready,false);
});

