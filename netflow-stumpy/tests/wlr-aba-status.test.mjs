import test from 'node:test';
import assert from 'node:assert/strict';
import {chartFresh,collectionState,usableSignal,policyKey,M15} from '../wlr-aba-status.mjs';
import {createSnapshotLoader,validateSnapshot} from '../wlr-aba-snapshot.mjs';
import {SPEC} from '../wlr-aba-core.mjs';
import {updateAba} from '../wlr-aba-live.mjs';
const close=Date.parse('2026-10-22T00:00:00Z'),now=close+23.62*3600000;
const collection={source:'daily-archive',status:'delayed',checkedAt:now,lastTimeBySymbol:{SPYUSDT:close-M15,QQQUSDT:close-M15},lagHours:23.62};
const identity={status:'READY',a:1,b:0};
const policy={version:2,status:'READY',selectedModel:'CYCLE8',calibration:{model:identity,baseline:identity},gate:{band:'any',gap:0}};
const report=()=>({schema:'wlr-aba-v2',snapshotId:'one',sourceAsOf:close,publishedAt:now,spec:SPEC,collection:structuredClone(collection),v2:structuredClone(policy),decision:'NOT_ESTABLISHED'});
const archive=r=>({schema:r.schema,snapshotId:r.snapshotId,inputScope:SPEC.inputScope,sourceAsOf:r.sourceAsOf,collection:r.collection,cases:[],vectors:[]});
test('publish time never overrides source lag; age increases while the page stays open',()=>{
 const r=report();assert.equal(collectionState(r,now).status,'DELAYED');
 assert.ok(Math.abs(collectionState(r,now+3600000).lagHours-24.62)<1e-8);
 r.publishedAt=now+3600000;assert.equal(collectionState(r,now+3600000).lastClose,close);
 r.collection.lastTimeBySymbol.QQQUSDT-=M15;assert.ok(collectionState(r,now).lagHours>23.62);
 assert.equal(collectionState({...r,collection:null},now).status,'UNKNOWN');
 assert.equal(collectionState({collection:{...collection,lastTimeBySymbol:{SPYUSDT:now,QQQUSDT:now}}},now).status,'UNKNOWN');
});
test('fresh REST and delayed fallback are distinguished using BOTH symbols',()=>{
 const r=report();r.collection={...collection,source:'rest',status:'live'};
 assert.equal(collectionState(r,close+1000).status,'LIVE');
 assert.equal(collectionState(r,close+2*M15).status,'DELAYED');
 r.collection.source='daily-archive';assert.equal(collectionState(r,close+1000).status,'DELAYED');
});
test('CHART LIVE requires current bars for both symbols and recent successful receipt',()=>{
 const t=close+M15+1000,b={t:close+M15,end:close+2*M15-1},data={interval:'15m',SPYUSDT:[b],QQQUSDT:[b]};
 assert.equal(chartFresh(data,t,t,t),true);
 assert.equal(chartFresh({...data,QQQUSDT:[{t:close-M15,end:close-1}]},t,t,t),false);
 assert.equal(chartFresh(data,t,t,t+15000),false);
 assert.equal(chartFresh({...data,QQQUSDT:[]},t,t,t),false);
 assert.equal(chartFresh(data,t,t+1000,t),false);
});
test('selection, retrospective READY and replay sample growth never promote an unvalidated signal',()=>{
 const r=report(),track={policyKey:policyKey(r.v2),signal:{emit:true}},opts={live:true,verified:true};
 r.selectionReady=true;
 assert.equal(usableSignal(track,r,now,opts).reason,'DELAYED_ARCHIVE');
 assert.equal(usableSignal(track,r,now,{...opts,verified:false}).reason,'WAIT_SNAPSHOT');
 r.v2.status='WAIT_GATE_VALIDATION';assert.equal(usableSignal(track,r,now,opts).reason,'WAIT_GATE_VALIDATION');
 r.v2.status='READY';r.collection={...collection,source:'rest',status:'live'};
 assert.equal(usableSignal(track,r,close+1000,opts).reason,'NOT_ESTABLISHED');
 r.decision='PROMISING_REQUIRES_FUTURE_VALIDATION';r.v2.forward={queries:10000,filtered:{n:1000,status:'PROMISING_REQUIRES_FORWARD_TEST'}};
 assert.equal(usableSignal(track,r,close+1000,opts).reason,'FORWARD_NOT_VALIDATED');
 r.v2.gate=null;assert.equal(usableSignal(track,r,close+1000,opts).emit,false);
 assert.equal(usableSignal(track,null,close+1000,opts).emit,false);
});
test('snapshot loader refreshes on TTL/force, rejects mixed publication IDs and retries after failure',async()=>{
 let clock=1,calls=0,r=report(),a=archive(r);
 const load=createSnapshotLoader({clock:()=>clock,get:async(url,options)=>{calls++;assert.equal(options.cache,'no-store');return {ok:true,json:async()=>structuredClone(url.includes('/report.json')?r:a)};}});
 await load();assert.equal(calls,2);await load();assert.equal(calls,2);
 clock+=60001;r={...r,snapshotId:'two'};a=archive(r);assert.equal((await load())[1].snapshotId,'two');assert.equal(calls,4);
 a.snapshotId='one';await assert.rejects(load({force:true}),/khớp/);
 a=archive(r);assert.equal((await load())[1].snapshotId,'two');
 await load({force:true});assert.equal(calls,10);
});
test('legacy snapshots reject mismatched collections and report races',async()=>{
 const r=report();delete r.snapshotId;const a=archive(r);delete a.snapshotId;
 assert.doesNotThrow(()=>validateSnapshot(a,r));
 assert.throws(()=>validateSnapshot({...a,collection:{...a.collection,checkedAt:1}},r),/khớp/);
 let n=0;const load=createSnapshotLoader({get:async url=>({ok:true,json:async()=>url.includes('/archive.json')?a:(++n===1?r:{...r,publishedAt:now+1})})});
 await assert.rejects(load(),/publish/);
});
test('frozen/restored track retains anchor and quantiles while new policy state revokes the filter',()=>{
 const day='2026-10-23',end=Date.parse(day+'T14:00:00Z');
 const rows=Array.from({length:40},(_,i)=>({t:end-(40-i)*M15,open:600,c:600,high:601,low:599,mid:600+i*.1,color:1,pv:Array(10).fill(.2),x:[0,.3,.5,0]}));
 const r={...report(),sourceAsOf:close,spec:{...SPEC,testStart:'2026-08-21'},selectedTrial:'CYCLE8',test:{CYCLE8:{},CURRENT_MEDIAN:{}}},a={sourceAsOf:close,vectors:[],cases:[]};
 const first=updateAba({rows,archive:a,report:r,now:end+1000});assert.equal(first.status,'READY');
 const p=first.track.prediction,q=first.track.q;
 const next=updateAba({rows,archive:a,report:{...r,v2:{...r.v2,status:'WAIT_GATE_VALIDATION',gate:null}},now:end+2000,previous:first.state});
 assert.deepEqual(next.track.prediction,p);assert.deepEqual(next.track.q,q);assert.equal(next.track.signal.emit,false);assert.equal(next.track.signal.reason,'WAIT_GATE_VALIDATION');
 const missing=updateAba({rows,archive:a,report:{...r,v2:null},now:end+2000,previous:first.state});assert.equal(missing.track.signal.reason,'WAIT_POLICY');
});
