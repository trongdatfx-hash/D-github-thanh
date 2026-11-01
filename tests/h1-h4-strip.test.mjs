import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateHourlyRows,h1StripCell} from '../netflow-stumpy/h1-h4-strip.mjs';
import {h1CandleColorStates} from '../netflow-stumpy/weekly-trend-map.mjs';
const H=3600000,Q=900000,T=Date.parse('2026-10-30T08:00:00Z');
const row=(t,step=Q)=>({t,end:t+step-1,o:100,h:103,l:99,c:102});
const quarter=(n=4)=>Array.from({length:n},(_,i)=>row(T+i*Q));
test('full hour has canonical bounds and needs its actual close',()=>{
  const a=aggregateHourlyRows(quarter(),T+3*Q+1);
  assert.equal(a.length,1);assert.equal(a[0].t,T);assert.equal(a[0].end,T+H-1);
  assert.equal(a[0].end<T+3*Q+1,false);
});
for(const missing of [0,1,2,3])test('historical hour rejects missing M15 '+missing,()=>{
  assert.deepEqual(aggregateHourlyRows(quarter().filter((_,i)=>i!==missing),T+H+1),[]);
});
test('current hour accepts a contiguous prefix but does not mark it complete',()=>{
  const [a]=aggregateHourlyRows(quarter(2),T+2*Q);
  assert.equal(a.sourceComplete,false);assert.equal(a.end,T+H-1);
  assert.deepEqual(aggregateHourlyRows([row(T),row(T+2*Q)],T+3*Q),[]);
});
test('timestamps sorted and duplicate updates replace prior values',()=>{
  const a=aggregateHourlyRows([...quarter().reverse(),{...row(T),c:104}],T+H);
  assert.equal(a.length,1);assert.equal(a[0].o,100);
});
test('M15 strip spans the actual four candle centers',()=>{
  assert.deepEqual(h1StripCell(T,quarter().map(r=>r.t),t=>(t*1000-T)/Q*10,10),{x:-5,width:39.3});
});
test('strip does not stretch across a session gap',()=>{
  const times=[T,T+24*H];
  assert.deepEqual(h1StripCell(T,times,t=>t*1000===T?0:100,10),{x:-5,width:9.3});
  assert.equal(h1StripCell(T+H,times,()=>null,10),null);
});
test('visible partial hour does not require opening candle on chart',()=>{
  assert.deepEqual(h1StripCell(T,[T+2*Q,T+3*Q],t=>(t*1000-T)/Q*10,10),{x:15,width:19.3});
});
const hourRows=(start,n=4)=>Array.from({length:n},(_,i)=>row(start+i*H,H));
test('NY H4 assigns one identical group to four H1 keys',()=>{
  const states=h1CandleColorStates({priceRows:hourRows(T),sourceStep:H,boxHours:4,now:T+4*H});
  assert.deepEqual(states.map(s=>s.t),hourRows(T).map(r=>r.t));
  assert.ok(states.every(s=>!s.preview&&s.blockStart===T&&s.direction===1));
});
test('H4 preview becomes locked exactly at close',()=>{
  const p=hourRows(T);
  assert.ok(h1CandleColorStates({priceRows:p,sourceStep:H,boxHours:4,now:T+4*H-1}).every(s=>s.preview));
  assert.ok(h1CandleColorStates({priceRows:p,sourceStep:H,boxHours:4,now:T+4*H}).every(s=>!s.preview));
});
test('incomplete underlying M15 cannot lock H4',()=>{
  const p=hourRows(T);p[3].sourceComplete=false;
  assert.deepEqual(h1CandleColorStates({priceRows:p,sourceStep:H,boxHours:4,now:T+4*H}),[]);
});
test('missing middle H1 rejects H4 rather than coloring its prefix',()=>{
  assert.deepEqual(h1CandleColorStates({priceRows:hourRows(T).filter((_,i)=>i!==1),sourceStep:H,boxHours:4,now:T+3*H}),[]);
});
for(const [date,n] of [['2026-11-01T04:00:00Z',5],['2026-03-08T05:00:00Z',3]]){
 test('DST transition cannot silently lock a normal four-hour block '+date,()=>{
   const start=Date.parse(date);
   assert.deepEqual(h1CandleColorStates({priceRows:hourRows(start,n),sourceStep:H,boxHours:4,now:start+6*H}),[]);
 });
}
test('duplicate H1 cannot produce a locked block',()=>{
 const p=hourRows(T);
 assert.deepEqual(h1CandleColorStates({priceRows:[...p,p[1]],sourceStep:H,boxHours:4,now:T+4*H}),[]);
});

test('renderer integrates actual M15 cell bounds and labels delayed preview',async()=>{
  const {readFile}=await import('node:fs/promises');
  const app=await readFile(new URL('../netflow-stumpy/app.mjs',import.meta.url),'utf8');
  const body=app.slice(app.indexOf('function drawH1H4Strip(){'),app.indexOf('function drawPivotFlowOverlay()',app.indexOf('function drawH1H4Strip(){')));
  const fills=[],labels=[],ctx={setTransform(){},clearRect(){},fillRect(...v){fills.push(v);},strokeRect(){}};
  const canvas={width:0,height:0,dataset:{},getContext:()=>ctx,setAttribute:(key,value)=>labels.push(value)};
  const elements={'h1-h4-age-strip':canvas,chart:{clientWidth:500,clientHeight:300},interval:{value:'15m'},symbol:{value:'SPYUSDT'},'candle-h1-box-color':{checked:true}};
  const scale={options:()=>({barSpacing:10}),timeToCoordinate:t=>(t*1000-T)/Q*10+100};
  const draw=new Function('$','window','chart','paneBounds','h1H4CandleMap','rows','h1StripCell','h1BoxCandlePalette','isChartLive',body+';drawH1H4Strip();');
  draw(id=>elements[id],{devicePixelRatio:1},{timeScale:()=>scale,panes:()=>[{getHeight:()=>150},{getHeight:()=>150}],priceScale:()=>({width:()=>50})},()=>({top:150}),new Map([[T,{preview:true,direction:1}]]),{SPYUSDT:quarter()},h1StripCell,()=>({body:'green'}),()=>false);
  assert.deepEqual(fills[1],[95,151,39.3,10]);
  assert.equal(canvas.dataset.previewBars,'1');
  assert.match(labels.at(-1),/XEM TRƯỚC.*DELAYED/);
});
