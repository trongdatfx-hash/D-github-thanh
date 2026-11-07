import test from 'node:test';
import assert from 'node:assert/strict';
import {LargeTakerBook,LargeTakerLoader,percentile95,dayNY,largeTakerDetail} from '../large-taker-spectrum.mjs';
import {drawPairedSpectrum} from '../paired-spectrum.mjs';
const step=900000,t=Date.UTC(2026,10,6,15);
const trade=(a,T,value=10,m=false,p=735)=>({a,T,p:String(p),q:String(value/p),m});
function seeded(){const b=new LargeTakerBook({minSamples:4});b.ingest([1,2,3,4].map(a=>trade(a,t+a,10)),t+100);return b;}
test('P95 interpolates and does not mutate source',()=>{const a=[40,10,20,30];assert.equal(percentile95(a),38.5);assert.deepEqual(a,[40,10,20,30]);});
test('threshold excludes current bucket; maker direction and real price bin',()=>{const b=seeded();b.ingest([trade(5,t+step,100,false,736.1),trade(6,t+step+1,200,true,736.1)],t+step+2);const p=b.profile({now:t+2*step});assert.equal(p.threshold,10);assert.equal(p.rows[0].price,736);assert.equal(p.rows[0].buy,100);assert.equal(p.rows[0].sell,200);assert.equal(p.rows[0].buyPercent,null);});
test('forming M15 and chart cutoff excluded',()=>{const b=seeded();b.ingest([trade(5,t+step,100)],t+step+1);assert.equal(b.profile({now:t+step+10}).large,0);assert.equal(b.profile({now:t+2*step,cutoff:t+step}).large,0);assert.equal(b.profile({now:t+2*step}).large,1);});
test('threshold remains locked despite large incoming trades',()=>{const b=seeded();b.ingest([trade(5,t+step,100000),trade(6,t+step+5,20)],t+step+10);assert.equal(b.buckets.at(-1).threshold,10);assert.equal(b.buckets.at(-1).large,2);});
test('deduplicates and rejects invalid and future records',()=>{const b=seeded();b.ingest([trade(4,t+4),trade(5,t+step,100),trade(6,t+step+1,200,'false'),trade(7,t+3*step,20)],t+2*step);assert.equal(b.lastId,5);assert.equal(b.profile({now:t+2*step}).large,1);});
test('NY day rollover does not mix past day or infer full coverage',()=>{const b=seeded();b.ingest([trade(5,t+step,100)],t+2*step);assert.equal(b.profile({now:t+86400000}).large,0);assert.equal(b.profile({now:t+86400000}).partial,true);assert.equal(dayNY(Date.UTC(2026,10,7,3)), '2026-11-06');});
test('restore preserves decisions, expired or malformed cache rejected',()=>{const b=seeded();b.ingest([trade(5,t+step,100)],t+2*step);const c=new LargeTakerBook({minSamples:4});assert.equal(c.restore(JSON.parse(JSON.stringify(b.save())),t+2*step),true);assert.deepEqual(c.profile({now:t+2*step}),b.profile({now:t+2*step}));assert.equal(c.restore(b.save(),t+2*86400000),false);assert.equal(c.restore({...b.save(),pool:[[0,NaN]]},t+2*step),false);});
test('ratio requires at least five large executions per bin',()=>{const b=seeded();b.ingest([5,6,7,8,9].map(a=>trade(a,t+step+a,100,a===9)),t+2*step);assert.equal(b.profile({now:t+2*step}).rows[0].buyPercent,80);});
test('loader errors keep collected bins and flag stale, no fake fallback',async()=>{const l=new LargeTakerLoader({get:async()=>{throw new Error('HTTP 451');},now:()=>t+2*step});l.book=seeded();l.book.ingest([trade(5,t+step,100)],t+2*step);l.active=true;await l.poll();assert.equal(l.snapshot().large,1);assert.equal(l.snapshot().stale,true);assert.match(l.snapshot().error,/451/);});
test('loader follows aggregate ids and suppresses duplicate backfill',async()=>{const urls=[],l=new LargeTakerLoader({get:async url=>{urls.push(url);return [trade(1,t),trade(2,t+1)];},now:()=>t+100});l.active=true;await l.poll();await l.poll();assert.match(urls[1],/fromId=3/);assert.equal(l.book.pool.length,2);assert.match(largeTakerDetail(l.snapshot()),/không phải trọn ngày/);});
test('spectrum renderer keeps OI, replaces CVD and renders both taker sides',()=>{
  const labels=[],lines=[];let current=[];const context={save(){},restore(){},beginPath(){current=[];},rect(){},clip(){},fillRect(){},fillText(s){labels.push(s);},moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},stroke(){lines.push({points:current,color:this.strokeStyle});}};
  drawPairedSpectrum({context,mediaSize:{width:360,height:350},anchor:100,priceToY:()=>100,history:{bins:[],maxAbs:0},comparison:{rows:[{price:735,opened:20,closed:10,grossOi:30}],maxOiGross:30,pairedReady:true},large:{rows:[{price:735,buy:100,sell:200}],maxTotal:300,ready:true,stale:false}});
  assert(labels.includes('Taker P95'));assert(labels.includes('OI + / −'));assert(!labels.includes('CVD ngày'));
  assert(lines.some(l=>l.color==='#ff627d'&&l.points[0][0]<l.points[1][0]));assert(lines.some(l=>l.color==='#23e0a4'&&l.points[0][0]<l.points[1][0]));
});
test('loader matches chart getJSON relative path and AbortSignal contract',async()=>{let checked=false;const l=new LargeTakerLoader({get:async(path,signal)=>{assert(path.startsWith('/fapi/v1/aggTrades?'));assert(signal instanceof AbortSignal);checked=true;return [];},now:()=>t});l.active=true;await l.poll();assert.equal(checked,true);assert.equal(l.error,null);});
test('P61 P85 P90 P95 are frozen from the same prior baseline and give nested real trade counts',()=>{
  const b=new LargeTakerBook({minSamples:100});b.ingest(Array.from({length:100},(_,i)=>trade(i+1,t+i,i+1)),t+step);
  b.ingest(Array.from({length:100},(_,i)=>trade(i+101,t+step+i,i+1)),t+2*step);
  const profiles=[.61,.85,.90,.95].map(percentile=>b.profile({percentile,now:t+2*step}));assert.deepEqual(profiles.map(p=>p.large),[39,15,10,5]);assert.deepEqual(profiles.map(p=>p.percentileLabel),['P61','P85','P90','P95']);assert.equal(b.profile({now:t+2*step}).large,10);
  const saved=JSON.stringify(b.save());b.profile({percentile:.61,now:t+2*step});assert.equal(JSON.stringify(b.save()),saved);
});
test('loader bootstraps one hour and falls back to last trades when the hour is empty',async()=>{
  const urls=[],l=new LargeTakerLoader({get:async url=>{urls.push(url);return urls.length===1?[]:[trade(1,t-3*step)];},now:()=>t});l.active=true;await l.poll();assert.match(urls[0],/startTime=/);assert(!urls[1].includes('startTime'));assert.equal(l.book.lastId,1);
});
test('selecting P61 changes only tier, does not erase data or make network calls',()=>{
  let calls=0;const l=new LargeTakerLoader({get:async()=>{calls++;return [];},now:()=>t});l.book=seeded();const id=l.book.lastId;l.setPercentile(.61);assert.equal(l.snapshot().percentileLabel,'P61');assert.equal(l.book.lastId,id);assert.equal(calls,0);l.setPercentile(.77);assert.equal(l.snapshot().percentileLabel,'P90');
});
test('older available NY day is explicitly marked stale and never called live',()=>{
  const l=new LargeTakerLoader({get:async()=>[],now:()=>t+86400000});l.book=seeded();l.book.ingest([trade(5,t+step,100)],t+2*step);const r=l.snapshot();assert(r.dayOld);assert(r.stale);assert.match(r.status,/CŨ/);assert.equal(r.large,1);
});

