import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {h1ScoreWithoutOi,m15OiEndpointWeight,smoothH1OiNet,smoothH1OiStrength} from '../h1-oi-score-smooth.mjs';

test('OI smoothing uses only the non-OI portion of a locked H1 score',()=>{
  assert.equal(h1ScoreWithoutOi({status:'LOCKED',rawScore:5,parts:{oi:1}}),4);
  assert.equal(h1ScoreWithoutOi({status:'PREVIEW',rawScore:5,parts:{oi:1}}),null);
  assert.equal(h1ScoreWithoutOi({status:'LOCKED',score:-4,parts:{oi:-1}}),-3);
});

test('M15 endpoint matrix weights unanimous, active OI more than mixed or quiet OI',()=>{
  const unanimous=m15OiEndpointWeight([1000,999,998,997,996]);
  const mixed=m15OiEndpointWeight([1000,999,1000,999,1000]);
  const quiet=m15OiEndpointWeight([1000,999.95,999.9,999.85,999.8]);
  assert.equal(unanimous.direction,-1);assert.ok(unanimous.weight>.9);
  assert.ok(mixed.weight<.01);assert.ok(quiet.weight<unanimous.weight);
});

test('maximum H1 smoothing reinforces an existing OI sign when price and taker agree',()=>{
  const oi=1_000_000,rawNet=500;
  const reinforced=smoothH1OiNet(rawNet,oi,5,1,1);
  assert.ok(reinforced>rawNet&&reinforced<12_000);
  assert.equal(smoothH1OiNet(rawNet,oi,1,1,1),rawNet);
  assert.equal(smoothH1OiNet(rawNet,oi,-5,1,1),rawNet);
  assert.equal(smoothH1OiNet(100,oi,5,1,1),100);
  assert.equal(smoothH1OiNet(rawNet,oi,5,1,0),rawNet);
  assert.ok(smoothH1OiNet(-rawNet,oi,5,1,1)<-rawNet);
});

test('maximum strength smoothing preserves the OI sign and needs matching H1 flow',()=>{
  const reinforced=smoothH1OiStrength(.05,5,1,1);
  assert.ok(reinforced>.15&&reinforced<.60);
  assert.ok(smoothH1OiStrength(-.05,5,1,1)<-.15);
  assert.equal(smoothH1OiStrength(.05,-5,1,1),.05);
  assert.equal(smoothH1OiStrength(.01,5,1,1),.01);
  assert.equal(smoothH1OiStrength(.05,5,1,0),.05);
  assert.equal(smoothH1OiStrength(0,5,1,1),0);
});

test('matrix uses the H1 OI smoother only when its toggle is enabled',()=>{
  const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
  const start=source.indexOf('const H1_POSITION_LABELS='),end=source.indexOf('\nfunction h1GroupPositionDetails',start);
  const context={Math,Number,Array,Object,h1ScoreWithoutOi,m15OiEndpointWeight,smoothH1OiNet,smoothH1OiStrength};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const step=900000,hour=4*step,levels=Array.from({length:13},(_,i)=>1000+i*.5);
  const bars=Array.from({length:12},(_,i)=>({t:i*step,end:(i+1)*step-1,o:100,c:101,buy:75,q:100}));
  const oi=levels.map((sumOpenInterest,i)=>({timestamp:i*step,sumOpenInterest}));
  const strength=bars.map(bar=>({time:bar.t/1000,value:.05}));
  const scores=[0,hour,2*hour].map(blockStart=>({blockStart,status:'LOCKED',score:5,rawScore:5,parts:{oi:0}}));
  const colors=new Map([0,hour,2*hour].map(blockStart=>[blockStart,{blockStart,preview:false,direction:1}]));
  const matrix={options:{size:3},groups:[{count:3,from:0,to:2*hour}]};
  const raw=context.h1GroupPositions(matrix,bars,oi,strength,3*hour,scores,colors,false,false)[0];
  const smooth=context.h1GroupPositions(matrix,bars,oi,strength,3*hour,scores,colors,false,true)[0];
  assert.equal(raw.reason,'OI trung tính');
  assert.equal(smooth.label,'Nghi mở Long 3/3');
  assert.ok(smooth.strengthRaw<.15&&smooth.strengthUsed>.15);
  assert.ok(smooth.oiPctUsed>smooth.oiPctRaw);
});
