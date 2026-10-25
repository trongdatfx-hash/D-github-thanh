import test from 'node:test';import assert from 'node:assert/strict';
import {wlrSlopeThickness,WLR_SLOPE_DEFAULTS} from '../wlr-slope-thickness.mjs';
const step=900000;
function data({direction=1,noise=0,flow=direction,n=100}={}){
 const bars=Array.from({length:n},(_,i)=>{const c=100+direction*i*.5+noise*Math.sin(i*2);return {t:i*step,end:(i+1)*step-1,c,h:c+.2,l:c-.2};});
 const composite=new Map(bars.map(b=>[b.t,{adjusted:flow*2}])),volume=new Map(bars.map(b=>[b.t,{adjusted:flow*2}]));
 return {bars,composite,volume};
}
const run=(d,o={})=>wlrSlopeThickness(d.bars,d.composite,d.volume,{step,...o});
test('a straight orderly trend becomes thick even with near-zero residual sigma',()=>{
 const up=run(data()).at(-1),down=run(data({direction:-1})).at(-1);
 assert(up.width>9.5);assert(up.sigma<1e-8);assert(up.r2>.999);assert(Math.abs(up.width-down.width)<1e-8);
});
test('opposing flows reduce thickness and noisy trends are thinner',()=>{
 const a=run(data()).at(-1),b=run(data({flow:-1})).at(-1),c=run(data({noise:3})).at(-1);
 assert(a.width>b.width);assert(a.width>c.width);assert(c.noisePenalty<a.noisePenalty);assert.equal(b.flowQuality,0);
});
test('flat price does not become a strong trend from flow alone',()=>{
 const r=run(data({direction:0,flow:1})).at(-1);assert.equal(r.trendQuality,0);assert.equal(r.width,2);
});
test('price scaling leaves quality and thickness unchanged',()=>{
 const d=data({noise:.3}),a=run(d),b=run({...d,bars:d.bars.map(b=>({...b,c:b.c*100,h:b.h*100,l:b.l*100}))});
 a.forEach((x,i)=>assert(Math.abs(x.width-b[i].width)<1e-7));
});
test('future prices and current live strengths cannot alter prior displayed widths',()=>{
 const d=data(),a=run(d),n=60;assert.deepEqual(run({...d,bars:d.bars.slice(0,n)}),a.slice(0,n));
 const last=d.bars.at(-1),now=last.t+100,open=run(d,{closedBefore:now});last.c+=100;last.h+=101;d.composite.set(last.t,{adjusted:-10});assert.deepEqual(run(d,{closedBefore:now}),open);
});
test('gaps reset warmup and missing flow retains only the price contribution',()=>{
 const d=data();const t=d.bars[50].t;d.bars=d.bars.filter(b=>b.t!==t);const r=run(d);assert.equal(r[50].ready,false);assert.equal(r[50].width,2);
 const x=data();x.composite.clear();const y=run(x).at(-1);assert.equal(y.flowReady,false);assert.equal(y.flowQuality,0);assert(y.quality<=.61);
});
test('defaults preserve 61/39 weighting, 2-10 range and smoothing',()=>{
 assert.equal(WLR_SLOPE_DEFAULTS.trendWeight,.61);assert.equal(WLR_SLOPE_DEFAULTS.flowWeight,.39);assert.equal(WLR_SLOPE_DEFAULTS.alpha,.35);
 assert(run(data({noise:1})).every(x=>x.width>=2&&x.width<=10));assert.throws(()=>run(data(),{window:1}),/settings/);
});
