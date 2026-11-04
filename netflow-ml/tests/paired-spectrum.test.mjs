import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSpectrumComparison,spectrumLaneLayout,drawPairedSpectrum,spectrumPriceGroup,confirmSpectrumGroup} from '../paired-spectrum.mjs';
const step=900000,midnight=Date.parse('2026-11-04T05:00:00Z'),now=midnight+4*step;
const priceRows=Array.from({length:5},(_,i)=>({t:midnight+(i-1)*step,end:midnight+i*step-1,c:100+i*.5}));
const flowBars=priceRows.map((r,i)=>({...r,net:i===0?99999:i%2?-10:20}));
const times=priceRows.slice(1).map(r=>r.t),bins=priceRows.slice(1).map((r,i)=>({price:r.c,opened:100+i*10,closed:95})),oiProfile={ready:true,day:'2026-11-04',times,bins};
test('daily comparison excludes prior-day flow and uses exact OI timestamps',()=>{
  const result=buildSpectrumComparison(priceRows,flowBars,oiProfile,now);
  assert.equal(result.pairedReady,true);assert.equal(result.count,4);assert.equal(result.oiCount,4);
  assert.equal(result.rows.reduce((sum,r)=>sum+r.cvd,0),20);
  assert.equal(result.rows[0].grossOi,195);assert.equal(result.rows[0].netOi,5);
  assert.equal(result.rows.filter(r=>r.rank).length,3);
});
test('missing or stale coverage never fabricates an OI comparison',()=>{
  const result=buildSpectrumComparison(priceRows,flowBars.slice(0,-1),oiProfile,now);
  assert.equal(result.pairedReady,false);assert.equal(result.maxOiGross,0);
  assert.equal(buildSpectrumComparison(priceRows,flowBars,{...oiProfile,day:'2026-11-03'},now).pairedReady,false);
  const partial=buildSpectrumComparison(priceRows,flowBars,{...oiProfile,times:times.slice(1),bins:bins.slice(1)},now);
  assert.equal(partial.count,3);assert.equal(partial.oiCount,3);
});
test('lanes stay adjacent and inside mobile and desktop plot bounds',()=>{
  for(const width of [240,360,900]){const layout=spectrumLaneLayout(width,10000);assert(layout.right<=width);assert(layout.left>=0);assert(layout.xOi>layout.xCvd+layout.halfCvd);}
});
test('CVD and both OI components paint at the same exact price coordinate',()=>{
  const strokes=[];let first;
  const context={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},fillText(){},moveTo(x,y){first=[x,y];},lineTo(x,y){this.end=[x,y];},stroke(){strokes.push({first,end:this.end,color:this.strokeStyle});}};
  const row={price:100,cvd:-20,opened:100,closed:95,grossOi:195,netOi:5,rank:1};
  drawPairedSpectrum({context,mediaSize:{width:900,height:300},anchor:500,priceToY:()=>100,history:{bins:[],maxAbs:0},comparison:{rows:[row],pairedReady:true,maxCvd:20,maxOiGross:195}});
  for(const color of ['#f28a61','#23e0a4','#ff627d']){const stroke=strokes.find(s=>s.color===color);assert(stroke);assert.equal(stroke.first[1],100);assert.equal(stroke.end[1],100);}
});
test('fixed groups aggregate three price levels without drifting inside the same region',()=>{
  const comparison={binStep:.5,count:10,pairedReady:true,rows:[{price:100.5,cvd:10,opened:30,closed:4},{price:101,cvd:20,opened:20,closed:6},{price:101.5,cvd:-5,opened:10,closed:2},{price:102,cvd:999,opened:999,closed:0}]};
  const a=spectrumPriceGroup(comparison,100.5),b=spectrumPriceGroup(comparison,101.6);
  assert.equal(a.low,100.25);assert.equal(a.high,101.75);assert.equal(a.cvd,25);assert.equal(a.netOi,48);assert.equal(a.state,'buy-oi-increase');assert.deepEqual(a,b);
  assert.equal(spectrumPriceGroup({...comparison,pairedReady:false},101).state,'WAIT');
  assert.equal(spectrumPriceGroup(comparison,120).state,'WAIT');
});
test('region confirmation counts each qualified candle once and weights its absolute OI',()=>{
  const group={ready:true,cvd:10,netOi:5,low:100.25,high:101.75};
  const comparison={times:[1,2,3],binStep:.5},rows=[{t:1,c:100.5},{t:2,c:101},{t:3,c:101.5},{t:4,c:101}];
  const points=new Map([[1,{matched:true,kind:'up-oi-increase',delta:30}],[2,{matched:true,kind:'up-oi-increase',delta:30}],[3,{matched:true,kind:'down-oi-increase',delta:40}],[4,{matched:true,kind:'up-oi-increase',delta:9999}]]);
  assert.deepEqual(confirmSpectrumGroup(group,comparison,rows,points),{state:'confirmed',count:3,support:2,share:.6});
  points.get(2).matched=false;assert.equal(confirmSpectrumGroup(group,comparison,rows,points).state,'mixed');
  points.get(1).kind='down-oi-increase';assert.equal(confirmSpectrumGroup(group,comparison,rows,points).state,'conflict');
  assert.equal(confirmSpectrumGroup({...group,ready:false},comparison,rows,points).state,'WAIT');
});
