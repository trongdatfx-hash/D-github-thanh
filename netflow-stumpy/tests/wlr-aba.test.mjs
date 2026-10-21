import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {updateAba,liveGate} from '../wlr-aba-live.mjs';
import {compactArchive} from '../wlr-aba-archive.mjs';
import {SPEC,segmentWlr,knownQuery} from '../wlr-aba-core.mjs';
import {stamp,STEP} from '../rth-structure.mjs';
const day='2026-10-19',rows=Array.from({length:65},(_,i)=>({t:stamp(day,240+i*15),open:600+i*.1,c:600+i*.1,high:600.2+i*.1,low:599.8+i*.1,mid:600+i*.1,color:i<25?1:i<27?-1:i<30?1:-1,pv:Array(10).fill(.2),x:[0,.3,.5,0]}));
const archive={sourceAsOf:stamp('2026-10-16',1200),vectors:[Array(10).fill(.2)],cases:Array.from({length:20},(_,i)=>({i,day:'2026-09-'+String(i+1).padStart(2,'0'),phase:'RTH',color:1,clockMinute:585,label:{event:1,event8:0,member:1,matureAt:0,target:{deltaAtr:1}},context:Array(9).fill(0),window:Array(16).fill(0)}))},report={selectedTrial:'CYCLE8',spec:{testStart:'2026-08-21'},test:{CYCLE8:{days:33},CURRENT_MEDIAN:{days:33}},sourceAsOf:archive.sourceAsOf};
const run=(n,state=null,data=rows)=>updateAba({rows:data.slice(0,n),archive,report,now:data[n-1].t+STEP+1000,previous:state});
test('live forecast freezes known A median, follows B and recognizes unfinished next A',()=>{
 const first=run(23);assert.equal(first.status,'READY');assert.equal(first.progress.stage,'A_FORMING');assert.equal(first.track.prediction.ready,true);assert.equal(first.track.q.currentMedian,601.1);
 const b=run(27,first.state);assert.equal(b.progress.stage,'B_FORMING');assert.deepEqual(b.track,first.track);
 const next=run(30,b.state);assert.equal(next.progress.stage,'NEXT_A_FORMING');assert.equal(next.progress.observedMedian,602.8);assert.equal(next.state.history.length,0);assert.equal(next.track.prediction.value,first.track.prediction.value);
 const end=run(31,next.state);assert.equal(end.state.history.length,1);assert.equal(end.state.history[0].stage,'COMPLETE_ABA');assert.equal(end.state.history[0].actualMedian,602.8);
});
test('a third literal color breaks ABA; stale/night data never produces an active forecast',()=>{
 const first=run(23),changed=rows.map((r,i)=>i>=27?{...r,color:0}:r),result=run(28,first.state,changed);assert.equal(result.state.history[0].stage,'PATTERN_BROKEN');
 assert.match(liveGate(rows.slice(0,23),stamp(day,700)),/Chờ/);assert.match(liveGate(rows,stamp(day,1215)),/Ngoài/);
 const wait=updateAba({rows:rows.slice(0,23),archive,report,now:stamp(day,1215),previous:first.state});assert.equal(wait.status,'WAIT');assert.deepEqual(wait.state,first.state);
});
test('compact archive retains exact vectors and refuses mismatched source/report/input contracts',()=>{
 const c={i:15,label:{event:0}},data={asOf:1,spec:SPEC,source:{},rows:{SPYUSDT:Array.from({length:16},(_,i)=>({pv:Array(10).fill(i/13)}))},cases:[c],evaluations:[{split:'test'}]},r={sourceAsOf:1,spec:SPEC,test:{CURRENT_MEDIAN:{queries:1}}},out=compactArchive(data,r);assert.equal(out.archive.cases[0].window.length,16);assert.equal(out.archive.vectors[15][0],15/13);assert.equal(out.archive.inputScope,SPEC.inputScope);assert.equal(out.report.spec.inputScope,SPEC.inputScope);assert.equal(out.archive.schema,'wlr-aba-v2');assert.throws(()=>compactArchive(data,{...r,sourceAsOf:2}),/mismatch/);assert.throws(()=>compactArchive({...data,spec:{}},r),/input scope mismatch/);assert.throws(()=>compactArchive(data,{...r,spec:{}}),/input scope mismatch/);
});
const opening=(date,color=1)=>Array.from({length:20},(_,i)=>({...rows[0],t:stamp(date,15+i*15),mid:500+i,c:500+i,high:501+i,low:499+i,color:i<15?-1:color,pv:Array(10).fill(i/100)}));
test('PRE candle 0 starts live with preceding NIGHT history in summer/winter for all WLR colors',()=>{
 for(const date of ['2026-07-20','2026-12-07'])for(const color of [-1,0,1]){
  const input=opening(date,color).slice(0,16),a={...archive,cases:archive.cases.map(c=>({...c,phase:'PRE',color}))},r={...report,spec:{...SPEC,testStart:'2026-07-01'}},now=stamp(date,255);
  const result=updateAba({rows:input,archive:a,report:r,now});
  assert.equal(result.status,'READY');assert.equal(result.track.q.issuedAt,now);assert.equal(result.track.q.phase,'PRE');assert.equal(result.track.q.knownBars,1);assert.equal(result.track.q.currentMedian,input[15].mid);assert.equal(result.track.q.inputStart,stamp(date,15));assert.equal(result.track.originStart,stamp(date,240));assert.equal(result.track.prediction.ready,true);assert.equal(result.progress.stage,'A_FORMING');
  const frame=segmentWlr(input);assert.equal(frame.segments.length,1);assert.equal(frame.rows[14].segment,null);assert.equal(result.track.q.lastSameMedian,null);
  // Altering future PRE colors/prices cannot change the candle-0 query.
  const full=segmentWlr(opening(date,color).map((b,i)=>i>15?{...b,mid:9000,color:0}:b));assert.deepEqual(knownQuery(full.rows,full.segments,15),result.track.q);
 }
});
test('PRE candle 0 waits for its close and valid continuous warmup; NIGHT never starts an ABA track',()=>{
 const input=opening(day).slice(0,16),now=stamp(day,255),a={...archive,cases:archive.cases.map(c=>({...c,phase:'PRE'}))};
 const run=data=>updateAba({rows:data,archive:a,report,now});
 assert.equal(updateAba({rows:input,archive:a,report,now:now-1}).status,'WAIT');
 assert.equal(updateAba({rows:input.slice(0,15),archive:a,report,now:stamp(day,239)}).status,'WAIT');
 assert.equal(run(input.slice(1)).status,'WAIT');
 assert.equal(run(input.map((b,i)=>i===4?{...b,t:b.t-STEP}:b)).status,'WAIT');
 assert.equal(run(input.map((b,i)=>i===5?{...b,pv:[NaN,...b.pv.slice(1)]}:b)).status,'WAIT');
});
test('both pages retain the yellow age-trend readout and remove unrelated old forecasting UI',()=>{
 for(const path of [new URL('../../index.html',import.meta.url),new URL('../index.html',import.meta.url)]){const s=fs.readFileSync(path,'utf8');assert.match(s,/id="geometry-readout"/);assert.match(s,/TREND CÒN/);assert.match(s,/trend-cohort-card/);assert.doesNotMatch(s,/aeon-ui\.mjs|rth-structure-ui\.mjs|analogs-card/);}
 const app=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8');assert.match(app,/formatPreRthWlrTrend/);assert.match(app,/createWlrAba/);assert.doesNotMatch(app,/createRthForecast|rth-forecast-ui|updateAnalogs/);
});


import {forecastFromWlr,directionScore,sideOf} from '../wlr-aba-direction.mjs';

test('direction compares next median with frozen last closed WLR, using a causal prior majority',()=>{
 const q={day:'2026-10-19',phase:'PRE',color:1,inputStart:1000,clockMinute:255,currentMedian:100,currentWlr:105,atr:1},p={value:104,ready:true},pool=Array.from({length:12},(_,i)=>({i,day:'2026-09-'+String(i+1).padStart(2,'0'),phase:'PRE',color:1,clockMinute:255,currentWlr:100,label:{event:1,matureAt:0,target:{median:104,deltaAtr:4}}})),ranked=pool.map(c=>({case:c,distance:0})),d=forecastFromWlr(q,p,pool,ranked,'CYCLE8');
 assert.equal(d.anchor,105);assert.equal(d.side,-1);assert.equal(d.baseline.side,1);assert.equal(d.n,12);assert.equal(d.pAbove,1/14);assert.equal(d.ready,true);
 const future={...pool[0],i:100,day:'2026-10-20',label:{event:1,matureAt:1001,target:{median:10,deltaAtr:-90}}};
 assert.deepEqual(forecastFromWlr(q,p,[...pool,future],[{case:future,distance:-1},...ranked],'CYCLE8'),d);
 const duplicated=pool.flatMap(c=>[c,{...c,i:c.i+50}]);assert.equal(forecastFromWlr(q,p,duplicated,duplicated.map(c=>({case:c,distance:0})),'CYCLE8').n,12);
 assert.equal(forecastFromWlr(q,p,pool.slice(0,11),ranked.slice(0,11),'CYCLE8').ready,false);
 assert.equal(forecastFromWlr(q,{...p,value:105},pool,ranked,'CYCLE8').ready,false);
 const tied=pool.map((c,i)=>({...c,label:{...c.label,target:{median:i%2?96:104,deltaAtr:i%2?-4:4}}}));assert.equal(forecastFromWlr(q,p,tied,tied.map(c=>({case:c,distance:0})),'CYCLE8').baseline.ready,false);
});
test('direction scoring excludes unfinished and flat targets and counts paired independent days',()=>{
 const d={anchor:105,side:-1,ready:true,pAbove:.2,baseline:{side:1,ready:true,pAbove:.8}},rs=Array.from({length:30},(_,i)=>({day:'day'+i,issuedAt:i,target:104,direction:d})),s=directionScore([...rs,{day:'pending',issuedAt:31,target:null,direction:d},{day:'flat',issuedAt:32,target:105,direction:d}]);
 assert.equal(s.n,30);assert.equal(s.hits,30);assert.equal(s.baselineHits,0);assert.equal(s.flatTargets,1);assert.equal(s.unfinished,1);assert.equal(s.status,'PROMISING_REQUIRES_FORWARD_TEST');
 assert.notEqual(directionScore(rs.map(r=>({...r,day:'oneDay'}))).status,'PROMISING_REQUIRES_FORWARD_TEST');
 assert.equal(sideOf(null,105),null);assert.equal(sideOf(105,105),0);
});

import {freezeAbaResult,canRetainAba,abaOverlayGeometry,abaPaintKey,abaLabel} from '../wlr-aba-overlay.mjs';
const stableFixture=()=>({status:'READY',track:{day:'2026-10-21',originStart:1,q:{issuedAt:2,currentWlr:100,color:1},prediction:{ready:true,value:104,low:98,high:110},direction:{ready:true,pAbove:.72,baseline:{ready:true,pAbove:.54}}},lastTime:900000,changePct:4});
test('ABA offset is 20 logical candles at every zoom and uses WLR prices exclusively',()=>{
 const t=stableFixture().track,seen=[],wlr={priceToCoordinate:p=>{seen.push(p);return 500-p;}},pane={top:0,height:500},bounds={left:700,right:850,xBase:775};
 for(const spacing of [6,12,5.75]){const scale={coordinateToLogical:x=>x/spacing,logicalToCoordinate:l=>l*spacing,options:()=>({barSpacing:spacing})},g=abaOverlayGeometry(scale,wlr,pane,bounds,t);assert.ok(Math.abs(g.left-(700-20*spacing))<1e-8);assert.equal(g.width,150);assert.equal(g.y,396);assert.equal(g.anchorY,400);}
 assert.deepEqual(seen.slice(0,4),[100,104,98,110]);assert.equal(abaLabel(t).first,'A↑ 72%');assert.equal(abaLabel(t).second,'/ nền 54%');
});
test('same ABA issue freezes WLR anchor, quantiles and color; a new confirmed issue can change',()=>{
 const old=stableFixture(),changed={...old,track:{...old.track,q:{...old.track.q,currentWlr:900,color:-1},prediction:{...old.track.prediction,value:999,low:990,high:1005}},state:{}},fixed=freezeAbaResult(old,changed);
 assert.deepEqual(fixed.track.q,old.track.q);assert.deepEqual(fixed.track.prediction,old.track.prediction);assert.deepEqual(fixed.track.direction,old.track.direction);
 const next={...changed,track:{...changed.track,q:{...changed.track.q,issuedAt:3}}};assert.equal(freezeAbaResult(old,next),next);
});
test('ABA synchronization retention is bounded and never crosses symbol/timeframe or stale data',()=>{
 const active=stableFixture(),c={live:true,symbol:'SPYUSDT',interval:'15m',expectedTime:1800000};
 assert.equal(canRetainAba(active,c,100),true);assert.equal(canRetainAba(active,c,20001),false);
 for(const changed of [{...c,live:false},{...c,symbol:'QQQUSDT'},{...c,interval:'1h'},{...c,expectedTime:2700000}])assert.equal(canRetainAba(active,changed,100),false);
});
test('ABA canvas swaps complete frames, skips unchanged/color-only paints and retains temporary coordinates',()=>{
 const source=fs.readFileSync(new URL('../wlr-aba-ui.mjs',import.meta.url),'utf8'),src=source.slice(source.indexOf(' function clearDrawing('),source.indexOf(' function show(result)'));
 let writes=0,clears=0,swaps=0,now=0,invalid=false,spacing=6;const text=[];
 const canvas={dataset:{},setAttribute(){},getContext:()=>({setTransform(){},clearRect(){clears++;},drawImage(){swaps++;}})};
 for(const k of ['width','height']){let value=0;Object.defineProperty(canvas,k,{get:()=>value,set:v=>{value=v;writes++;}});}
 const ctx=new Proxy({measureText:t=>({width:t.length*5}),fillText:t=>text.push(t)},{get:(o,k)=>o[k]??(()=>{})}),buffer={width:0,height:0,getContext:()=>ctx},host={clientWidth:1000,clientHeight:500},toggle={checked:true},initial=stableFixture(),scale={coordinateToLogical:x=>x/spacing,logicalToCoordinate:l=>l*spacing,options:()=>({barSpacing:spacing}),width:()=>1000},chart={timeScale:()=>scale},wlr={priceToCoordinate:p=>invalid?null:500-p};
 const factory=new Function('host','canvas','buffer','toggle','initial','chart','wlr','paneBounds','getCvdBounds','window','performance','abaOverlayGeometry','abaPaintKey','abaLabel','fmt','change',"let frame=0,active=initial,lastPaintKey='',geometryMissingAt=null;"+src+";return {draw,replace:r=>active=r};");
 const r=factory(host,canvas,buffer,toggle,initial,chart,wlr,()=>({top:0,height:500}),()=>({left:700,right:850,xBase:775}),{devicePixelRatio:2},{now:()=>now},abaOverlayGeometry,abaPaintKey,abaLabel,String,String);
 r.draw();for(let i=0;i<10;i++)r.draw();assert.equal(swaps,1);assert.equal(clears,1);assert.equal(writes,2);assert.equal(canvas.dataset.left,'580');assert.equal(text[0],'A↑ 72%');assert.equal(text[1],'/ nền 54%');
 r.replace(freezeAbaResult(initial,{...initial,track:{...initial.track,q:{...initial.track.q,color:-1},prediction:{...initial.track.prediction,value:999}},state:{}}));r.draw();assert.equal(swaps,1);
 invalid=true;now=1;r.draw();assert.equal(clears,1);invalid=false;spacing=12;r.draw();assert.equal(swaps,2);assert.equal(writes,2);assert.equal(canvas.dataset.left,'460');
 toggle.checked=false;r.draw();assert.equal(canvas.dataset.status,'HIDDEN');assert.equal(clears,3);
 const css=fs.readFileSync(new URL('../wlr-aba.css',import.meta.url),'utf8');assert.ok(css.includes('#wlr-aba-overlay{width:100%;height:100%}'));
});
