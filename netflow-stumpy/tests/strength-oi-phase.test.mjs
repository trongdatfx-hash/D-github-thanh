import test from 'node:test';
import assert from 'node:assert/strict';
import {strengthOiPhase,oiPhasePrimitive} from '../strength-oi-phase.mjs';
import {strengthOi8} from '../strength-oi8.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const STEP=900000, START=Date.UTC(2026,10,16);
function fixture(n=100) {
  const bars=Array.from({length:n},(_,i)=>({t:START+i*STEP,o:100,c:101,sourceComplete:true}));
  let value=10000;
  const samples=Array.from({length:n+1},(_,i)=>{
    if(i)value*=1+(i>70?-.001:.001);
    return {timestamp:START+i*STEP,sumOpenInterest:value};
  });
  const body=bars.map((bar,i)=>({t:bar.t,adjusted:i<70?.4:-.3}));
  return {bars,samples,body,now:START+n*STEP};
}
test('flip resets before first impulse; partial phase appears immediately with independent OI sign',()=>{
  const f=fixture(),p=strengthOiPhase(f.bars,f.samples,f.body,f.now).points;
  assert.equal(p[70].count,1);assert.equal(p[70].phaseBars,1);assert.equal(p[70].phaseSign,-1);
  assert.notEqual(p[70].phaseId,p[69].phaseId);assert.ok(p[70].value<0);
  assert.equal(p[72].count,3);assert.equal(p[80].count,8);
  const rising=fixture();rising.samples=f.samples.map((s,i)=>({...s,sumOpenInterest:10000*1.001**i}));
  assert.ok(strengthOiPhase(rising.bars,rising.samples,rising.body,rising.now).points[70].value>0);
});
test('zero holds phase; missing body breaks it',()=>{
  const f=fixture();f.body[71].adjusted=0;f.body[72].adjusted=NaN;
  const p=strengthOiPhase(f.bars,f.samples,f.body,f.now).points;
  assert.equal(p[71].phaseId,p[70].phaseId);assert.equal(p[71].count,2);
  assert.equal(p[72].value,undefined);assert.equal(p[73].count,1);
  assert.notEqual(p[73].phaseId,p[71].phaseId);
});
test('pending live sign never commits a phase or changes closed values',()=>{
  const f=fixture();f.now=START+69*STEP+STEP/2;f.body[69].adjusted=-.2;
  const a=strengthOiPhase(f.bars,f.samples,f.body,f.now);
  assert.deepEqual(a.pending,{time:f.bars[69].t/1000,sign:-1});assert.equal(a.points[69].value,undefined);
  f.body[69].adjusted=.2;
  const b=strengthOiPhase(f.bars,f.samples,f.body,f.now);
  assert.equal(b.pending,null);assert.deepEqual(a.points,b.points);
});
test('normalization is shared across phase histories',()=>{
  const f=fixture();const alternating=f.body.map((r,i)=>({...r,adjusted:i%2?-.3:.3}));
  const a=strengthOiPhase(f.bars,f.samples,f.body,f.now).points;
  const b=strengthOiPhase(f.bars,f.samples,alternating,f.now).points;
  // Both reset at 70 and see the same single impulse and independent reference sigma.
  assert.equal(a[70].count,1);assert.equal(b[70].count,1);assert.equal(a[70].value,b[70].value);
});
test('missing OI and incomplete source require fresh contiguous warmup',()=>{
  for(const kind of ['oi','source','gap']){
    const f=fixture(150);
    if(kind==='oi')f.samples=f.samples.filter((_,i)=>i!==75);
    if(kind==='source')f.bars[75].sourceComplete=false;
    if(kind==='gap'){f.bars.splice(75,1);f.body.splice(75,1);}
    const p=strengthOiPhase(f.bars,f.samples,f.body,f.now).points;
    assert.equal(p[75].value,undefined);assert.equal(p[80].value,undefined);
    assert.ok(Number.isFinite(p.at(-1).value));
  }
});
test('future changes cannot affect past values; repeated evaluation is deterministic',()=>{
  const f=fixture(),a=strengthOiPhase(f.bars,f.samples,f.body,f.now);
  assert.deepEqual(a,strengthOiPhase(f.bars,f.samples,f.body,f.now));
  f.samples.at(-1).sumOpenInterest*=2;f.body.at(-1).adjusted=1;
  const b=strengthOiPhase(f.bars,f.samples,f.body,f.now);
  assert.deepEqual(a.points.slice(0,-1),b.points.slice(0,-1));
  assert.ok(b.points.filter(p=>p.value!==undefined).every(p=>Math.abs(p.value)<=1));
});
test('continuous function remains unchanged by phase calculation',()=>{
  const f=fixture(),before=strengthOi8(f.bars,f.samples,f.now);
  strengthOiPhase(f.bars,f.samples,f.body,f.now);
  assert.deepEqual(strengthOi8(f.bars,f.samples,f.now),before);
});
test('renderer never bridges phases or missing OI and draws pending anchor dashed',()=>{
  let primitive;const lines=[],dashes=[];let cursor;
  const ctx={beginPath(){},rect(){},clip(){},moveTo(x,y){cursor=[x,y];},lineTo(x,y){lines.push([cursor,[x,y]]);},stroke(){},arc(){},fill(){},setLineDash(v){dashes.push(v);}};
  const chart={timeScale:()=>({timeToCoordinate:t=>t})},series={priceToCoordinate:v=>50-v*20,attachPrimitive:p=>{primitive=p;}};
  const layer=oiPhasePrimitive(chart,series);
  layer.setData({points:[{time:1,value:.2,phaseId:1,phaseBars:1},{time:2,value:.3,phaseId:1,phaseBars:2},{time:3,value:-.2,phaseId:2,phaseBars:1},{time:4},{time:5,value:-.3,phaseId:2,phaseBars:3}],pending:{time:6,sign:1}},true);
  primitive.paint({context:ctx,mediaSize:{width:100,height:100}});
  assert.equal(lines.length,2);assert.deepEqual(lines[0],[[1,46],[2,44]]);assert.ok(dashes.some(v=>v.length===2));
});
test('actual app switches display while keeping pivot input continuous and clears hidden phase',()=>{
  const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('  const oi8On=Boolean('),source.indexOf('  for(const [type,lines] of Object.entries(oi8PivotLines))'));
  const f=fixture(),controls={'oi8-phase-reset-toggle':{checked:true},'oi8-pivot-toggle':{checked:true},symbol:{value:'SPYUSDT'},chart:{dataset:{}},'oi8-phase-status':{}};
  let enabled=true,display,pivotInput,visible;
  const ctx=vm.createContext({Boolean,Number,Map,$:id=>controls[id],strengthOi8Enabled:()=>enabled,step:STEP,oiStamp:'15m',cache:{SPYUSDT:f.bars,interval:'15m',serverTime:f.now},oiAppliedSamples:f.samples,bodyVolumeRows:f.body,strengthOi8,strengthOiPhase,series:{strengthOi8:{}},seriesContext:'test',p:f.bars,
    writeSeries:(_name,_series,points)=>{display=points;},setOptions(){},oiPhaseLayer:{setData(_state,on){visible=on;}},oi8PivotLevels:(_bars,points)=>{pivotInput=points;return [];}});
  vm.runInContext('{'+code+'}',ctx);
  assert.equal(display[70].value,strengthOiPhase(f.bars,f.samples,f.body,f.now).points[70].value);
  assert.deepEqual(pivotInput,strengthOi8(f.bars,f.samples,f.now));assert.equal(visible,true);
  controls['oi8-phase-reset-toggle'].checked=false;vm.runInContext('{'+code+'}',ctx);
  assert.equal(display[70].value,pivotInput[70].value);assert.equal(visible,false);
  enabled=false;controls['oi8-phase-reset-toggle'].checked=true;vm.runInContext('{'+code+'}',ctx);
  assert.equal(display.length,0);assert.equal(visible,false);
  assert.ok(source.match(/const SETUP_CONTROL_IDS=([^;]+);/)[1].includes("'oi8-phase-reset-toggle'"));
  assert.ok(source.indexOf("oiPhaseToggle.id='oi8-phase-reset-toggle'")<source.indexOf('  restoreSavedSetup();syncChartFrameButtons();'));
});
