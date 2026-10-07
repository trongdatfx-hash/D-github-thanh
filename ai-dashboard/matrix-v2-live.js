/* Integration is isolated: remove the V2 panel/scripts to roll back to V1. */
(function(){
 'use strict';
 const M=window.SignalMatrixV2,STEP=900000,STORE='spy-signal-matrix-v2-closed-v1';
 let history=[],saved=[],currentBars=new Map(),timer=null,connected=false,lastEvent=0,storageOK=true;
 let lastCapture=-1,lastRender=0,markTime=0;
 try{const parsed=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(parsed))saved=parsed.filter(r=>Number.isFinite(r.time)&&Number.isFinite(r.closeTime)&&r.last>0&&r.closeTime<Date.now()).slice(-2000)}catch(e){storageOK=false;console.warn('Matrix V2 local history unavailable',e)}
 function causalRows(){return rows.map(r=>({...r,...r.v2Aux}))}
 function decorate(fx,raw){
  return fx.map((r,i)=>{
   const a=raw[i],prev=raw[i-1],available={...a.v2Available};
   for(const key of ['topLS','topAcctLS','globalLS','takerRatio'])available[key]=Number.isFinite(a[key]);
   available.oiZ=Number.isFinite(a.oi)&&Number.isFinite(prev?.oi);
   available.fundingZ=Number.isFinite(a.funding);
   return {...r,v2Available:available};
  });
 }
 function recalculate(){
  const raw=causalRows();history=decorate(features(raw),raw);
  // Prefer previously observed snapshots so later REST revisions cannot repaint observations.
  const snapshots=new Map(saved.map(r=>[r.time,r]));history=history.map(r=>snapshots.get(r.time)||r);
  const latest=history.at(-1);
  if(latest&&latest.time>lastCapture){
   lastCapture=latest.time;saved=[...saved,latest].filter((r,i,a)=>a.findIndex(z=>z.time===r.time)===i).slice(-2000);
   try{localStorage.setItem(STORE,JSON.stringify(saved,(k,v)=>typeof v==='number'&&!Number.isFinite(v)?null:v))}catch(e){storageOK=false;console.warn('Matrix V2 persistence unavailable',e)}
  }
  render();
 }
 function provisional(){
  const bucket=Math.floor(Date.now()/STEP)*STEP,spy=currentBars.get('SPYUSDT'),q=currentBars.get('QQQUSDT'),last=rows.at(-1);
  if(!last||last.time!==bucket-STEP||!spy||spy.time!==bucket||Date.now()-spy.received>30000)return null;
  // Last closed aux values are known; their per-row availability still applies.
  const aux=last.v2Aux||{},liq=liqByBucket.get(bucket),hasMark=Date.now()-markTime<=30000&&Number.isFinite(live.index)&&Number.isFinite(live.mark);
  const quote=spy.volume*spy.last,qquote=q?.volume*q?.last;
  const qValid=q?.time===bucket&&Date.now()-q.received<=30000;
  const raw={...last,...aux,...spy,funding:hasMark?live.funding:aux.funding,mark:live.mark,index:live.index,basis:spy.last-live.index,
   netflowPct:qValid&&quote+qquote>0?100*((spy.tbuy-spy.tsell)*spy.last+(q.tbuy-q.tsell)*q.last)/(quote+qquote):NaN,
   qqqNetflowPct:qValid&&q.volume>0?100*(q.tbuy-q.tsell)/q.volume:NaN,
   liqLong:liq?.liqLong||0,liqShort:liq?.liqShort||0,liqNet:liq?.liqNet||0,
   v2Available:{bz:hasMark,liqNetZ:!!liq}};
  const rawRows=[...causalRows(),raw];return decorate(features(rawRows),rawRows).at(-1);
 }
 const fmt=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—',signed=v=>Number.isFinite(v)?(v>=0?'+':'')+v.toFixed(1):'—';
 function render(){
  lastRender=Date.now();if(!history.length)return;
  const liveRow=connected?provisional():null,current=liveRow||history.at(-1),asOf=liveRow?Date.now():current.closeTime+1;
  const result=M.evaluate(history,current,asOf),fresh=connected&&Date.now()-lastEvent<30000;
  const cls=p=>p==='BULL'?'matrixBull':p==='BEAR'?'matrixBear':'matrixNeutral';
  $('matrixV2Composite').className='signal '+(result.phase==='BULL'?'LONG':result.phase==='BEAR'?'SHORT':'WAIT');
  $('matrixV2Composite').textContent=signed(result.composite)+' · '+result.phase;
  document.querySelector('#matrixV2Table tbody').innerHTML=result.factors.map(f=>'<tr><td>'+f.name+'</td><td>'+fmt(f.value,3)+'</td><td class="'+cls(f.phase)+'">'+f.phase+'</td><td class="'+cls(M.phase(f.score/100))+'">'+signed(f.score)+'</td><td>'+fmt(100*f.confidence)+'%</td><td>'+fmt(100*f.hit)+'%</td><td>'+signed(100*f.edge)+' pp</td><td>'+signed(f.bps)+'</td><td>'+f.n+'</td><td>'+(Number.isFinite(f.value)?(liveRow?'LIVE provisional':'CLOSED M15'):'NO DATA')+'</td></tr>').join('');
  $('matrixV2Status').textContent=(fresh?'● LIVE':'● STALE / disconnected')+' · '+(liveRow?'Nến đang chạy':'Nến đóng '+new Date(current.closeTime).toLocaleString('vi-VN'))+' · '+result.coverage+'/12 factors · '+history.length+' nến lịch sử · '+saved.length+' snapshots cục bộ'+(storageOK?'':' · không lưu được localStorage')+' · cập nhật '+new Date().toLocaleTimeString('vi-VN');
 }
 function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;try{render()}catch(e){console.error('Matrix V2 render error',e);$('matrixV2Status').textContent='V2 error: '+e.message}},Math.max(0,3000-(Date.now()-lastRender)))}
 function event(d){
  lastEvent=Date.now();if(d.e==='markPriceUpdate')markTime=lastEvent;
  const bucket=Math.floor(Date.now()/STEP)*STEP;
  if(live.flowBucket!==bucket){live.flowBucket=bucket;live.buy=0;live.sell=0}
  if(d.e==='kline'&&d.k?.i==='15m'){
   const k=d.k;currentBars.set(d.s,{time:+k.t,closeTime:+k.T,open:+k.o,high:+k.h,low:+k.l,last:+k.c,volume:+k.v,tbuy:+k.V,tsell:+k.v-+k.V,received:Date.now()});
   if(k.x&&d.s==='SPYUSDT')setTimeout(refreshAndTrain,2000);
  }
  schedule();
 }
 window.matrixV2Controller={recalculate,event,connected(){connected=true;lastEvent=0;markTime=0;currentBars.clear();schedule()},disconnected(){connected=false;currentBars.clear();render()}};
 $('matrixV2Run').onclick=recalculate;
 setInterval(()=>{if(Date.now()-lastEvent>30000)schedule()},10000);
 // Boundary-aligned refresh also works if the socket misses the close event.
 function boundary(){setTimeout(async()=>{if(!rows.length){try{await loadHistory()}catch(e){console.warn('History retry failed',e)}}else await refreshAndTrain();boundary()},STEP-Date.now()%STEP+5000)}
 boundary();
 // Cached REST can finish while external V2 scripts are still loading on reload.
 connected=streamSocket?.readyState===1;
 if(rows.length)recalculate();
})();
