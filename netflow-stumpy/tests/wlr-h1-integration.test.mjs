import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {wlrH1Styles} from '../wlr-h1-style.mjs';
import {wlrColorSegments} from '../wlr-color-segments.mjs';
const source=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
function appFunction(name){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const H=3600000,M=900000;
function fixture({width=true,color=true,symbol='SPYUSDT',interval='15m'}={}){
  const data=[{t:0,mid:123.45},{t:M,mid:124},{t:2*M,mid:null}];
  const record={blockStart:0,blockEnd:H-1,asOf:H,lockedAt:H,score:4,boxDirection:1,status:'LOCKED',closedBars:4,missing:[]};
  const styles=new Map(wlrH1Styles(data,[record],{now:H+2*M+1000,alignment:'box'}).map(x=>[x.t,x]));
  const controls={symbol:{value:symbol},interval:{value:interval},'phase-width':{checked:width},'wlr-soft-colors':{checked:color},chart:{dataset:{}}};
  const ctx={Map,Number,Boolean,STEPS:{'15m':M,'1h':H},cache:{serverTime:H+2*M+1000},$:id=>controls[id],rows:{SPYUSDT:[]},wlrH1StyleMap:styles,wlrThicknessMap:new Map(),wlrColorMap:new Map(),WLR_SLOPE_DEFAULTS:{minWidth:2,maxWidth:10},usesH1WlrStyle:()=>symbol==='SPYUSDT'&&interval==='15m',strengthPhaseLineStyle:()=>({width:8}),wlrSoftColors:()=>{throw Error('Old slope/strength model must not run for H1 mode');},wlrDisplayColors:rows=>rows.map(r=>({t:r.t,color:'#legacy',direction:1}))};
  vm.createContext(ctx);vm.runInContext(appFunction('priceLineData'),ctx);
  return {data,ctx,controls,run:()=>ctx.priceLineData(data,new Map(),new Map(),new Map(data.map(r=>[r.t,{width:9}])))};
}
test('chart uses H1 color and thickness while preserving WLR prices and gaps',()=>{
  const f=fixture(),out=f.run();assert.equal(out[0].value,123.45);assert.equal(out[0].width,6);assert.equal(out[0].phaseColor,'#1ae0a3');assert.equal(out[2].value,undefined);
  assert.equal(f.controls.chart.dataset.wlrColorModel,'h1-box-score');assert.equal(f.controls.chart.dataset.wlrThicknessMax,'7');assert.equal(f.ctx.wlrColorMap.get(0).score,4);assert.equal(f.controls.chart.dataset.wlrH1Alignment,'same-box-history');
});
test('width and color toggles remain independent',()=>{
  const fixed=fixture({width:false}),fixedOut=fixed.run();assert.equal(fixedOut[0].width,3);assert.equal(fixedOut[0].phaseColor,'#1ae0a3');
  const legacy=fixture({color:false}),legacyOut=legacy.run();assert.equal(legacyOut[0].width,6);assert.equal(legacyOut[0].phaseColor,'#legacy');assert.equal(legacy.controls.chart.dataset.wlrThicknessModel,'h1-box-score');
});
test('other symbols retain their original thickness / color path',()=>{
  const f=fixture({symbol:'QQQUSDT'}),out=f.run();assert.equal(out[0].width,9);assert.equal(out[0].phaseColor,'#legacy');assert.equal(f.controls.chart.dataset.wlrColorModel,'composite-volume');
});
test('WLR obtains shared scores regardless of separate score-line and candle toggles',()=>{
  assert.ok(source.includes('const h1ScoreRecords=h1Wlr?(h1ScoreLayer?.getLineScores()??[]):[];'));
  assert.ok(source.includes('buildH1ScoreLine(h1ScoreRecords,'));
  assert.equal((source.match(/h1ScoreLayer\?\.getLineScores\(\)/g)||[]).length,1);
  assert.ok(source.includes("forScoreLine||$('candle-h1-box-color')?.checked"));
  assert.ok(source.includes("alignment:'box',boxStates:h1CandleMap"));
});
test('actual WLR renderer keeps width changes inside their own half-candle cells',()=>{
  const begin=source.indexOf('class VariableWidthLineRenderer{'),end=source.indexOf('\nclass VariableWidthLineSeries',begin);
  const ctx={Number,Math,wlrColorSegments};vm.createContext(ctx);vm.runInContext(source.slice(begin,end)+'\nglobalThis.Renderer=VariableWidthLineRenderer;',ctx);
  const renderer=new ctx.Renderer(),strokes=[];
  const context={save(){},restore(){},beginPath(){},moveTo(x,y){this.from={x,y};},lineTo(x,y){this.to={x,y};},stroke(){strokes.push({from:this.from,to:this.to,width:this.lineWidth,color:this.strokeStyle});}};
  renderer.update({barSpacing:10,visibleRange:{from:0,to:2},bars:[{x:0,originalData:{value:10,width:2,phaseColor:'green'}},{x:10,originalData:{value:20,width:7,phaseColor:'red'}}]},{color:'gray'});
  renderer.draw({useBitmapCoordinateSpace:cb=>cb({context,horizontalPixelRatio:1,verticalPixelRatio:1})},x=>x);
  assert.deepEqual(strokes.map(x=>x.width),[2,7]);assert.equal(strokes[0].to.x,5);assert.equal(strokes[1].from.x,5);assert.deepEqual(strokes.map(x=>x.color),['green','red']);
});

