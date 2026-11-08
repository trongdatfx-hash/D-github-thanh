import test from 'node:test';import assert from 'node:assert/strict';
import {baseH1Score,matrixTrendStatus as status,matrixTrendText} from '../matrix-trend-status.mjs';
const H=3600000,M=900000;
const rec=(i,p={})=>({blockStart:i*H,blockEnd:(i+1)*H-1,asOf:(i+1)*H,closedBars:4,status:'PARTIAL',score:5,bonus:{randomWalkAlignment:1},missing:['OI_P62'],parts:{position:1,slope:1,randomWalk:1,deltaNF:1,oi:null,...p}});
const records=()=>Array.from({length:6},(_,i)=>rec(i));
const bars=(n=24)=>Array.from({length:n},(_,i)=>({t:i*M,end:(i+1)*M-1,h:101,l:99,c:100}));
const run=(r=records(),p=bars(),now=6*H)=>status(r,{now,priceRows:p});
test('base is rebuilt from exactly four original components without OI or bonus',()=>{
 const a=rec(0),b={...a,score:-5,bonus:{randomWalkAlignment:-1},status:'LOCKED',missing:[],parts:{...a.parts,oi:-1}};
 assert.equal(baseH1Score(a,H).score,4);assert.equal(baseH1Score(b,H).score,4);assert.equal(baseH1Score(a,H-1),null);
 assert.equal(baseH1Score({...a,closedBars:3,status:'PREVIEW'},H),null);
 assert.equal(baseH1Score(rec(0,{randomWalk:null}),H),null);
});
test('missing OI does not block supported trend; OI changes only the optional note',()=>{
 const a=run(),b=run(records().map(r=>({...r,parts:{...r.parts,oi:-1}})));
 assert.equal(a.phase,'SUPPORTED');assert.equal(a.score,4);assert.equal(a.oiText,'OI thiếu');assert.equal(b.oiText,'OI xung đột');assert.equal(a.phase,b.phase);assert.equal(a.direction,b.direction);assert.equal(a.score,b.score);assert.equal(a.probability,null);assert.equal(a.remainingH1,null);
});
test('weaker scores or loss of flow support warn before position/slope reverse',()=>{
 const r=records();r[4]=rec(4,{randomWalk:0});r[5]=rec(5,{randomWalk:-1});const a=run(r);assert.equal(a.phase,'WEAKENING');assert.equal(a.fallingBoxes,2);assert.ok(matrixTrendText(a).includes('giảm lực 2 hộp'));
 const b=records();b[4]=rec(4,{deltaNF:0});b[5]=rec(5,{deltaNF:0});assert.equal(run(b).phase,'WEAKENING');
});
test('opposing flow and mixed price structure have distinct states',()=>{
 const a=records();a[4]=rec(4,{deltaNF:-1});a[5]=rec(5,{deltaNF:-1});assert.equal(run(a).phase,'CONFLICT');
 const b=records();b[4]=rec(4,{position:-1,slope:-1});b[5]=rec(5,{position:0,slope:0});assert.equal(run(b).phase,'TRANSITION');
});
test('missing components, H1 gaps and previews cannot be filled with older good scores',()=>{
 const a=records();a[5]=rec(5,{slope:null});assert.equal(run(a).phase,'WAIT');
 assert.equal(run(records().filter((_,i)=>i!==4)).phase,'WAIT');
 assert.equal(run(records().slice(0,2)).phase,'WAIT');
 const before=run();assert.deepEqual(run([...records(),{...rec(6),status:'PREVIEW',closedBars:3}]),before);
});
test('future data never changes current status and stale data is explicit',()=>{
 const a=run();assert.deepEqual(run([...records(),rec(7,{deltaNF:-1})],[...bars(),...bars(12).map(b=>({...b,t:b.t+6*H,end:b.end+6*H}))]),a);
 assert.equal(run(records(),bars(),9*H).stale,true);assert.ok(matrixTrendText(run(records(),bars(),9*H)).startsWith('DỮ LIỆU CŨ'));
});
test('price-only confirmation needs two closed M15 beyond the fixed preceding group',()=>{
 const p=bars(),r=records().map(x=>({...x,parts:{...x.parts,deltaNF:-1,oi:null}}));p[22]={...p[22],c:102,h:103};p[23]={...p[23],c:102,h:103};
 assert.equal(run(r,p).phase,'BREAKOUT');assert.equal(run(r,p).confirmation.zone.knownAt,3*H);assert.equal(run(r,p).confirmation.direction,1);
 const one=bars();one[23]={...one[23],c:102,h:103};assert.notEqual(run(r,one).phase,'BREAKOUT');
 p[23]={...p[23],c:100};assert.notEqual(run(r,p).phase,'BREAKOUT');
 const edge=bars();edge[22].c=101;edge[23].c=101;assert.notEqual(run(r,edge).phase,'BREAKOUT');
});
test('new labels never invent duration or probabilities',()=>{
 for(const s of [run(),run([],[]),run(records(),bars(),9*H)]){const text=matrixTrendText(s);assert.ok(!text.includes('%'));assert.ok(!text.includes('CÒN'));assert.equal(s.forecastStatus,'CHUA_DU_MAU');}
});
