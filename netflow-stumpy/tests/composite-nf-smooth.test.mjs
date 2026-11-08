import test from 'node:test';import assert from 'node:assert/strict';
import {compositeNfSmooth as calc} from '../composite-nf-smooth.mjs';
const M=900000;
const bars=(n,fn=()=>10)=>Array.from({length:n},(_,i)=>({t:i*M,q:100,buy:(100+fn(i))/2,o:100,c:i%2?99:101}));
const run=(a,b,options={})=>calc(a,b,{now:(a.at(-1)?.t??0)+M,normLen:3,lookback:8,...options});
test('actual composite flow includes QQQ and ignores candle direction',()=>{
 const a=bars(80,()=>-10),b=bars(80,()=>30),r=run(a,b).at(-1);assert.equal(r.net,20);assert.ok(r.value>0);assert.equal(r.reason,'closed');
 const opposite=a.map(x=>({...x,o:101,c:99}));assert.deepEqual(run(a,b),run(opposite,b));
});
test('sign symmetry, bounded scale, zero remains zero',()=>{
 const a=bars(90,i=>i%5?20:-10),b=bars(90,()=>5),neg=x=>x.map(b=>({...b,buy:b.q-b.buy}));
 const p=run(a,b),n=run(neg(a),neg(b));for(let i=0;i<p.length;i++)if(p[i].value!==null){assert.ok(Math.abs(p[i].value+n[i].value)<1e-10);assert.ok(Math.abs(p[i].value)<=1);}
 assert.equal(run(bars(60,()=>0),bars(60,()=>0)).at(-1).value,0);
});
test('no session recentering; no future/open-bar contamination',()=>{
 const a=bars(80),b=bars(80),base=run(a,b),full=run([...a,...bars(10,()=>-70).map(x=>({...x,t:x.t+80*M}))],[...b,...bars(10,()=>-40).map(x=>({...x,t:x.t+80*M}))]);assert.deepEqual(full.slice(0,80),base);
 const tagged=run(a.map(x=>({...x,session:'PRE'})),b.map(x=>({...x,session:'POST'})));assert.deepEqual(tagged,base);
 const open=run(a,b,{now:79*M+100});assert.equal(open.at(-1).value,null);assert.equal(open.at(-1).reason,'forming_excluded');assert.deepEqual(open.slice(0,-1),base.slice(0,-1));
});
test('missing QQQ, invalid quote, incomplete source and time gaps reset history',()=>{
 const a=bars(80),b=bars(80);const missing=run(a,b.filter(x=>x.t!==60*M));assert.equal(missing[60].reason,'missing_pair');assert.equal(missing[61].value,null);assert.equal(missing.at(-1).reason,'closed');
 for(const bad of [{q:-1},{buy:101},{sourceComplete:false}]){const invalid=run(a,b.map((x,i)=>i===60?{...x,...bad}:x));assert.equal(invalid[60].reason,'missing_pair');assert.equal(invalid[61].value,null);}
 const gap=run(a.filter(x=>x.t!==60*M),b);assert.equal(gap.find(x=>x.t===61*M).reason,'warmup_quote');
});
test('adaptive alpha is fast for persistent flow and slower for alternating flow',()=>{
 const stable=run(bars(80),bars(80)),noise=run(bars(80,i=>i%2?10:-10),bars(80,()=>0));assert.ok(Math.abs(stable.at(-1).alpha-.6)<1e-12);assert.equal(noise.at(-1).alpha,.18);
 const reversal=run(bars(80,i=>i<50?10:-80),bars(80,()=>0));assert.ok(reversal.some(x=>x.reversing&&x.alpha>=.48));
});
test('4/8 option replays independently; defaults need full SMA20 and scale500',()=>{
 const a=bars(600),b=bars(600),four=calc(a,b,{now:600*M}),eight=calc(a,b,{now:600*M,strLen:8});assert.equal(four.findIndex(x=>x.value!==null),521);assert.equal(eight.findIndex(x=>x.value!==null),525);assert.equal(four[521].sum,.4);assert.ok(eight.at(-1).sum>.79);
 assert.throws(()=>run(a,b,{strLen:5}));assert.throws(()=>run([a[1],a[0]],b));
});
