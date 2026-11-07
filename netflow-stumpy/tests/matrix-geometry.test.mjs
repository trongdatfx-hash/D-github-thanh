import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {geometryMatrixAt,matrixLineEvidence,breakoutPressure,replayMatrixGeometry,geometryScoreRecords,analyzeMatrixGeometry} from '../matrix-geometry.mjs';
import {causalAtr} from '../geometry.mjs';
import {STEPS,parseKlines,composite,analyze} from '../engine.mjs';
import {computeStudies,analyzeTrendSource} from '../studies-core.mjs';
const T=Date.UTC(2026,10,5),M=900000,H=3600000;
function source(n=64,breakAt=60){
  const price=Array.from({length:n},(_,i)=>{const c=i>=breakAt?101.6:99+i*.025;return {t:T+i*M,end:T+(i+1)*M-1,o:c-.06,h:c+.3,l:c-.3,c,v:100};});
  return {price,flow:price.map(b=>({t:b.t,nf:1,net:10,adjusted:1})),volume:price.map(b=>({t:b.t,adjusted:1})),spy:[],qqq:[],h1CandleColors:[]};
}
function records(n=30,oi=1){return Array.from({length:n},(_,i)=>({blockStart:T+i*H,blockEnd:T+(i+1)*H-1,asOf:T+(i+1)*H,closedBars:4,status:'LOCKED',parts:{position:1,slope:1,deltaNF:1,oi,randomWalk:1},bonus:{randomWalkAlignment:1},score:5}));}
function rail(kind,value,part){const end=part.price.length-1;return {kind,score:90,startIndex:0,startTime:part.price[0].t,startValue:value,endIndex:end,endTime:part.price[end].t,endValue:value,slope:0,slopeAtr:0,knownAt:part.price[12].t,touches:3,anchors:[{index:0,t:part.price[0].t,value,confirmedAt:part.price[2].t},{index:12,t:part.price[12].t,value,confirmedAt:part.price[14].t}]};}
function builder(part,options,index){
  const classic=rail('resistance',index>=60?110:100.8,part),low=rail('support',98,part),high=rail('resistance',103,part);
  return {referenceLines:[classic],patterns:[{id:'w',type:'wedge',rails:[{...low,source:'pattern',slope:.01,endValue:98+.01*index},{...high,source:'pattern',slope:-.01,endValue:103-.01*index}]}]};
}
test('matrix uses only locked 4/4 H1 available by timestamp; stale groups cannot confirm',()=>{
  const r=records(),asOf=T+12*H;
  const m=geometryMatrixAt([...r,{...r[11],status:'PREVIEW',closedBars:3,parts:{position:-1,slope:-1,deltaNF:-1,oi:-1}}],asOf);
  assert.equal(m.latestEnd,asOf-1);assert(m.columns.every(c=>c.t<asOf));assert.equal(matrixLineEvidence(m,1).confirmed,false); // No actual price gate supplied.
  const stale=geometryMatrixAt(r.slice(0,8),asOf);assert.equal(matrixLineEvidence(stale,1).confirmed,false);
});
test('total score and RW alignment bonus are not counted as extra votes',()=>{
  const a=records(),b=a.map(r=>({...r,score:-5,bonus:{randomWalkAlignment:-1}}));
  assert.deepEqual(matrixLineEvidence(geometryMatrixAt(a,T+12*H),1),matrixLineEvidence(geometryMatrixAt(b,T+12*H),1));
});
test('breakout pressure requires price to approach from inside; no post-break arming',()=>{
  const s=source(60),line=rail('resistance',100.8,s),p=breakoutPressure(line,s.price,causalAtr(s.price));assert(p.ready);
  const broken=source(62);assert.equal(breakoutPressure(line,broken.price,causalAtr(broken.price)).ready,false);
});
test('armed line retains anchors and slope after candidates refit on breakout bars',()=>{
  const before=replayMatrixGeometry(source(60),records(),{maxLines:4},builder),after=replayMatrixGeometry(source(62),records(),{maxLines:4},builder);
  const a=before.lines.find(l=>l.setupState==='ARMED'&&l.kind==='resistance'),b=after.lines.find(l=>l.source!=='pattern'&&l.armedAt);
  assert(a&&b);assert.equal(a.startValue,100.8);assert.equal(b.startValue,a.startValue);assert.equal(b.slope,a.slope);assert.deepEqual(b.anchors,a.anchors);
  assert(after.points.some(p=>p.key==='true_break'));assert(after.points.every(p=>p.armedAt<=p.at));
});
test('missing OI does not block two closed M15 price confirmation',()=>{
  const result=replayMatrixGeometry(source(62),records(30,null),{maxLines:4},builder);
  assert(result.points.some(p=>p.key==='true_break'));assert(result.lines.some(l=>l.setupLabel==='Phá ↑ · xn'));assert(result.points.every(p=>p.confirmationRule==='TWO_M15_PRICE_ONLY'));
});
test('opposing taker and volume directions do not block two closed price breaks',()=>{
  const s=source(62);s.flow=s.flow.map(r=>({...r,nf:-1,adjusted:-1}));
  s.volume=s.volume.map(r=>({...r,adjusted:-1}));const r=replayMatrixGeometry(s,records(),{maxLines:4},builder);assert(r.points.some(p=>p.key==='true_break'&&p.flowAligned===false));assert(r.lines.some(l=>l.setupLabel==='Phá ↑ · xn'));
});
test('no taker/OI data can confirm after two closes, but never after one close',()=>{
  const r=records(30,null).map(x=>({...x,parts:{...x.parts,deltaNF:null}}));
  const one=source(61);one.flow=[];one.volume=[];assert.equal(replayMatrixGeometry(one,r,{maxLines:4},builder).points.length,0);
  const two=source(62);two.flow=[];two.volume=[];assert(replayMatrixGeometry(two,r,{maxLines:4},builder).points.some(p=>p.key==='true_break'));
});
test('50/50 budget keeps wedge pairs atomic and never reallocates unused slots',()=>{
  for(const maxLines of [4,8,12]){const r=replayMatrixGeometry(source(60),records(),{maxLines},builder);assert(r.lines.filter(l=>l.source!=='pattern').length<=maxLines/2);assert(r.patterns.length*2<=maxLines/2);assert(r.patterns.every(p=>p.rails.length===2));assert(r.lines.length<=maxLines);}
});
test('prefix replay is unchanged by future matrix records or future candle mutation',()=>{
  const before=source(62),future=records(100).map((r,i)=>i>=16?{...r,parts:{position:-1,slope:-1,deltaNF:-1,oi:-1}}:r);
  const a=replayMatrixGeometry(before,records(),{maxLines:4},builder),b=replayMatrixGeometry(before,future,{maxLines:4},builder);
  assert.deepEqual(a.points,b.points);assert.deepEqual(a.lines,b.lines);
  const all=source(90),prefix={...all,price:all.price.slice(0,62)};assert.deepEqual(replayMatrixGeometry(prefix,records(),{maxLines:4},builder).points,a.points);
});
test('real fixture runs bounded matrix replay with missing OI and excludes preview scores',()=>{
  const read=n=>JSON.parse(fs.readFileSync(new URL('../../netflow-ml/tests/fixtures/'+n,import.meta.url),'utf8').replace(/^\uFEFF/,''));
  const now=read('time.json').serverTime,raw=parseKlines(read('SPYUSDT.json'),now,STEPS['15m']),q=parseKlines(read('QQQUSDT.json'),now,STEPS['15m']);
  const price=analyze(raw,STEPS['15m']).filter(b=>b.end<now),flow=analyze(composite(raw,q),STEPS['15m']);
  const states=price.map((b,i)=>({t:b.t,blockStart:Math.floor(b.t/H)*H,blockEnd:Math.floor(b.t/H)*H+H-1,direction:Math.floor(i/12)%2?1:-1,preview:false}));
  const input={price,flow,spy:price,qqq:[],volume:[],h1CandleColors:states,oiByTime:new Map()};
  const score=geometryScoreRecords({...input,now});assert(score.every(r=>r.closedBars===4&&r.status!=='PREVIEW'));
  const result=analyzeMatrixGeometry(input,{maxLines:4,minScore:55,matrixOptions:{window:9,size:3,groups:2}});
  assert.equal(result.matrixVersion,'matrix-lines-v1');assert(result.lines.length<=4);assert(result.replayBars<=600);assert(result.points.every(p=>p.armedAt<=p.at&&p.confirmationRule==='TWO_M15_PRICE_ONLY'));
});
test('live resume keeps frozen anchors when the 800-bar window slides',()=>{
  const shifted=n=>{const s=source(n,Infinity);s.price=s.price.map((b,i)=>{const c=Math.max(98,99+(i-800)*.025);return {...b,o:c-.06,h:c+.3,l:c-.3,c};});return s;};
  const a=replayMatrixGeometry(shifted(860),records(300),{maxLines:4},part=>({referenceLines:[rail('resistance',100.8,part)],patterns:[]}));
  // Supply a different proposed line after resume: it must not replace the armed one.
  const b=replayMatrixGeometry(shifted(862),records(300),{maxLines:4,replayState:a.replayState},part=>({referenceLines:[rail('resistance',110,part)],patterns:[]}));
  const x=a.lines.find(l=>l.source!=='pattern'&&l.armedAt),y=b.lines.find(l=>l.source!=='pattern'&&l.armedAt);
  assert(x&&y);assert.equal(x.armedAt,y.armedAt);assert.equal(x.slope,y.slope);assert.equal(x.startValue,y.startValue);assert.deepEqual(x.anchors.map(p=>[p.t,p.value]),y.anchors.map(p=>[p.t,p.value]));assert.equal(b.replayBars,2);
});
test('studies worker core supports matrix mode and restores classic selection when disabled',()=>{
  const read=n=>JSON.parse(fs.readFileSync(new URL('../../netflow-ml/tests/fixtures/'+n,import.meta.url),'utf8').replace(/^\uFEFF/,''));
  const now=read('time.json').serverTime,raw={SPYUSDT:parseKlines(read('SPYUSDT.json'),now,STEPS['15m']),QQQUSDT:parseKlines(read('QQQUSDT.json'),now,STEPS['15m'])};
  const trend=analyzeTrendSource(raw,now),input={rows:trend.rows,volumeRows:trend.volume,symbol:'SPYUSDT',interval:'15m',now,trend,options:{minScore:55,maxLines:4,matrixGeometry:true,matrixOptions:{window:9,size:3,groups:2}},geometryOi:new Map()};
  const result=computeStudies(input);assert.equal(result.geometry.matrixVersion,'matrix-lines-v1');assert.deepEqual(result.points,result.geometry.points);assert(result.geometry.lines.length<=4);
  const restored=computeStudies({...input,options:{...input.options,matrixGeometry:false}});assert.equal(restored.geometry.matrixVersion,undefined);assert(restored.geometry.lines.length<=4);
});


