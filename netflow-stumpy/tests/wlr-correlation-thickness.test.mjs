import test from 'node:test';import assert from 'node:assert/strict';
import {wlrCorrelationThickness,pearsonCorrelation,WLR_CORRELATION_DEFAULTS} from '../wlr-correlation-thickness.mjs';
const step=900000;
function source({n=80,bear=false,inverse=false,opposed=false,flat=false}={}){
 const rows=Array.from({length:n},(_,i)=>({t:i*step,mid:100+i,sigma:flat?2:inverse?20-i*.1:1+i*.1}));
 const volume=new Map(rows.map((r,i)=>[r.t,{adjusted:(bear?-1:1)*(.2+i*.01)}]));
 const composite=new Map(rows.map((r,i)=>[r.t,{adjusted:(opposed?-1:bear?-1:1)*(.3+i*.015)}]));
 return {rows,volume,composite};
}
const run=(f,options={})=>wlrCorrelationThickness(f.rows,f.composite,f.volume,{step,...options});
test('Pearson returns signed scale-independent correlation and treats constant data as undefined',()=>{
 assert.equal(pearsonCorrelation([1,2,3],[2,4,6]),1);assert.equal(pearsonCorrelation([1,2,3],[6,4,2]),-1);
 assert.equal(pearsonCorrelation([1,1,1],[2,3,4]),null);assert.equal(pearsonCorrelation([1,NaN],[1,2]),null);
});
test('coherent bullish and bearish three-way relations produce the same thick line',()=>{
 for(const bear of [false,true]){const result=run(source({bear}));assert(result.at(-1).width>9.99);assert.equal(result[19].ready,false);assert.equal(result[20].ready,true);assert.equal(result.at(-1).pairs,34);}
});
test('inverse sigma association counts when both Strength amplitudes share it',()=>{
 const result=run(source({inverse:true})).at(-1);assert.equal(result.sigmaRelation,'inverse');assert(result.width>9.99);
});
test('opposed Strength signs and negative inter-Strength correlation remain thin',()=>{
 const result=run(source({opposed:true})).at(-1);assert.equal(result.corrVolumeComposite,-1);assert.equal(result.quality,0);assert.equal(result.width,2);
});
test('flat sigma and missing sources never fabricate a perfect correlation',()=>{
 const f=source({flat:true});assert(run(f).every(x=>!x.ready&&x.width===2));
 const g=source();g.volume.delete(40*step);const result=run(g);assert.equal(result[41].ready,false);assert.equal(result[41].pairs,0);assert(result.every(x=>Number.isFinite(x.width)));
});
test('prefix results are causal and a current live candle cannot alter its width',()=>{
 const f=source(),full=run(f);assert.deepEqual(run({...f,rows:f.rows.slice(0,60)}),full.slice(0,60));
 const n=f.rows.length-1,before=run(f,{closedBefore:n*step+100});f.rows[n].sigma=99999;f.volume.set(n*step,{adjusted:-20});f.composite.set(n*step,{adjusted:30});
 assert.deepEqual(run(f,{closedBefore:n*step+100}),before);
});
test('a gap resets the correlation window and width rather than joining sessions through missing data',()=>{
 const f=source();for(let i=50;i<f.rows.length;i++){const old=f.rows[i].t,next=old+step;f.rows[i].t=next;f.rows[i].old=old;}
 // Rebuild strength maps on the new observed timestamps.
 f.volume=new Map(f.rows.map((r,i)=>[r.t,{adjusted:.2+i*.01}]));f.composite=new Map(f.rows.map((r,i)=>[r.t,{adjusted:.3+i*.015}]));
 const result=run(f);assert.equal(result[50].pairs,0);assert.equal(result[50].width,2);assert.equal(result[69].ready,false);assert.equal(result[70].ready,true);
});
test('price-unit changes do not change thickness and input prices remain untouched',()=>{
 const f=source(),before=structuredClone(f.rows),a=run(f),g={...f,rows:f.rows.map(r=>({...r,mid:r.mid*100,sigma:r.sigma*100}))},b=run(g);
 for(let i=0;i<a.length;i++)assert(Math.abs(a[i].width-b[i].width)<1e-10);assert.deepEqual(f.rows,before);
});
test('invalid window and smoothing settings are rejected',()=>{
 assert.throws(()=>run(source(),{minPairs:40,window:34}),/settings/);assert.throws(()=>run(source(),{alpha:0}),/settings/);
});

test('sigma relationships carry 61 percent of the weighting and the maximum width is ten',()=>{
 assert.equal(WLR_CORRELATION_DEFAULTS.maxWidth,10);
 assert.equal(WLR_CORRELATION_DEFAULTS.sigmaVolumeWeight+WLR_CORRELATION_DEFAULTS.sigmaCompositeWeight,.61);
 assert.equal(WLR_CORRELATION_DEFAULTS.flowWeight,.39);
 const n=34,rows=Array.from({length:n+1},(_,i)=>({t:i*step,mid:100,sigma:2+Math.cos(2*Math.PI*i/n)}));
 const volume=new Map(rows.map((r,i)=>[r.t,{adjusted:.5+.1*Math.cos(2*Math.PI*i/n)}]));
 const composite=new Map(rows.map((r,i)=>[r.t,{adjusted:.5+.1*(.5*Math.cos(2*Math.PI*i/n)+Math.sqrt(.75)*Math.sin(2*Math.PI*i/n))}]));
 const last=run({rows,volume,composite},{alpha:1}).at(-1);
 // Orthogonal sine/cosine samples give rho(sigma,V)=1 and the other two rhos=1/2.
 assert(Math.abs(last.quality-2**(-.695))<1e-12);
 assert(Math.abs(last.width-(2+8*2**(-.695)))<1e-12);
 assert(run(source()).every(x=>x.width>=2&&x.width<=10));
 assert.throws(()=>run(source(),{flowWeight:.4}),/settings/);
});
