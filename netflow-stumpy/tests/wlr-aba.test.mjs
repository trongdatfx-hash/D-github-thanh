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

