import {resizeCanvas,selectedDayIndex,collectionIsStale,collectionLastTime,fetchHistoryManifest,topUpStatusLabel} from './view-runtime.mjs?v=20261030-h1-status2';
import {analyze,composite,calculateVolumeStrength,weightedPriceBands,STEPS,sessionAt} from '../netflow-stumpy/engine.mjs?v=20261029-colorstrength1';
import {trendSessionRows} from '../netflow-stumpy/trend-session.mjs?v=20261029-h1-map1';
import {causalTrendChannels} from '../netflow-stumpy/causal-trend-channel.mjs?v=20261029-h1-map1';
import {historicalTrendAgeStates} from '../netflow-stumpy/pre-rth-wlr-trend.mjs?v=20261029-h1-map1';
import {channelStrengthBoxes} from '../netflow-stumpy/channel-strength-boxes.mjs?v=20261029-h1-map1';
import {wlrSoftColors} from '../netflow-stumpy/wlr-soft-color.mjs?v=20261029-colorstrength1';
import {collectionFor,openClosedPairStream,topUpLive} from './live-topup.mjs?v=20261030-h1-perf1';
import {buildDailyMaps,buildIntradayDay,additiveMacroForecast,macroPcaProjection,walkForwardMacroAudit,weeklyWlrReversalForecast} from './day-map-core.mjs?v=20261029-wlrweek1';

const $=id=>document.getElementById(id),STEP=STEPS['15m'],LOOKBACK_DAYS=730;let days=[],forecast=null,manifest=null,audit=null,rawHistory=null,liveStream=null,restSyncing=false,repairing=false,modelRows=[],modelWlrColors=[],autoRefresh=true,autoTimer=null,repairTimer=null,auditKey=null,stateProjection=null,drawView=null,resizeFrame=null; 
const pct=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}%`:'—';
const price=x=>Number.isFinite(x)?x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const clock=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
const compact=r=>{if(!Array.isArray(r)||r.length<9)throw Error('Shard lịch sử M15 không hợp lệ');const [t,o,h,l,c,v,end,q,buy]=r.map(Number),valid=[t,o,h,l,c,v,end,q,buy].every(Number.isFinite)&&end===t+STEP-1&&o>0&&c>0&&h>=Math.max(o,c)&&l<=Math.min(o,c)&&l>0&&q>=0&&buy>=0&&buy<=q;if(!valid)throw Error('Bar lịch sử M15 không hợp lệ');return {t,o,h,l,c,v,end,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)};};

async function loadDayHistory(){
  const root='../netflow-stumpy/data/binance/m15/',manifest=await fetchHistoryManifest(root+'manifest.json');
  if(manifest?.interval!=='15m'||!Array.isArray(manifest.months)||!Number.isFinite(manifest.lastTime))throw Error('History manifest không hợp lệ');
  const cutoff=manifest.lastTime-LOOKBACK_DAYS*86400000,months=manifest.months.filter(key=>/^\d{4}-\d{2}$/.test(key)).filter(key=>{const [y,m]=key.split('-').map(Number);return Date.UTC(y,m,1)-1>=cutoff;});
  const docs=await Promise.all(months.map(async key=>{const r=await fetch(root+key+'.json?v='+(key===months.at(-1)?manifest.lastTime:'closed'),{cache:'force-cache'});if(!r.ok)throw Error('Thiếu shard '+key);return r.json();}));
  const normalize=symbol=>{const map=new Map();for(const doc of docs)for(const raw of doc[symbol]??[]){const row=compact(raw),old=map.get(row.t);if(old&&[old.o,old.h,old.l,old.c,old.q,old.buy].some((x,i)=>x!==[row.o,row.h,row.l,row.c,row.q,row.buy][i]))throw Error('Trùng timestamp M15 khác dữ liệu: '+symbol);map.set(row.t,row);}return [...map.values()].filter(x=>x.t>=cutoff).sort((a,b)=>a.t-b.t);};
  return {manifest,SPYUSDT:normalize('SPYUSDT'),QQQUSDT:normalize('QQQUSDT')};
}

function line(c,points,color,width=2,dash=[]){if(!points.length)return;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
function latestDataIsStale(index){return index===days.length-1&&collectionIsStale(manifest?.collection,manifest?.lastTime);}
function clearForecastPanels(){drawView=null;stateProjection=null;for(const id of ['macro-map','age-map','state-map']){const canvas=$(id),ctx=canvas?.getContext?.('2d');if(ctx)ctx.clearRect(0,0,canvas.width,canvas.height);}$('similar').replaceChildren();$('macro-result').textContent='Kết quả hộp: chưa đủ dữ liệu để ước lượng.';$('age-result').textContent='Kết quả tuổi: chưa đủ dữ liệu để ước lượng.';}
function m30PreviewText(isPreview,m30){
  if(!isPreview)return 'M30 preview: không áp dụng cho ngày đã hoàn tất.';
  if(!m30?.locked)return 'M30 preview: chưa đủ 2 nến M15 đã đóng; chưa cộng tuổi.';
  const structure=m30.hh&&m30.ll?'OUTSIDE':m30.hh?'HH':m30.ll?'LL':'INSIDE';
  if(m30.aligned)return `M30 preview: ${structure} · ủng hộ hướng H1 · tạm +0,5 H1; chỉ khóa khi đủ H1.`;
  return `M30 preview: ${structure} · chưa ủng hộ hướng H1 · không cộng tuổi; không phủ định dự báo cohort.`;
}
function topUpStatusText(){const label=topUpStatusLabel(manifest);return label?` · ${label}`:'';}
function renderDataStatus(index,isPreview,reason=''){
  const end=collectionLastTime(manifest?.collection,manifest?.lastTime),dataStale=collectionIsStale(manifest?.collection,manifest?.lastTime),lag=Number.isFinite(end)?Math.max(0,(Date.now()-end-STEP)/3600000):NaN,status=dataStale?'DELAYED':'LIVE',completeDays=days.filter(x=>!x.preview).length;
  $('status').className=latestDataIsStale(index)?'negative':'';
  $('status').textContent=`${completeDays} ngày hoàn chỉnh${isPreview?` · hôm nay ${days[index].closedM15} M15 đóng`:''} · Màu+SPY V+Strength M15→H1 · H1 khóa từ 4 M15 đóng · dữ liệu đến ${Number.isFinite(end)?new Date(end).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'không xác định'} · ${status}${Number.isFinite(lag)?` · trễ ${lag.toFixed(1)}h`:''}${topUpStatusText()}${reason?` · WAIT: ${reason}`:''}`;
}
function renderAudit(){
  if(!audit?.ready){$('audit-result').textContent='WAIT';$('audit-note').textContent=audit?.reason??'Chưa đủ checkpoint đã phân giải';return;}
  const precision=Number.isFinite(audit.signalPrecision)?Math.round(100*audit.signalPrecision)+'%':'—',age=Math.round(100*audit.ageCoverage),box=Math.round(100*audit.boxCoverage),skill=Number.isFinite(audit.brierSkill)?`${audit.brierSkill>=0?'+':''}${Math.round(100*audit.brierSkill)}%`:'—';
  $('audit-result').textContent=`${audit.n} mốc · Brier ${audit.brier.toFixed(3)} · skill ${skill}`;
  $('audit-note').textContent=`Tín hiệu ${audit.signals} · đúng mở rộng ${precision} · phủ tuổi ${age}% · phủ hộp gốc ${box}% · đệm conformal ${audit.boxPadding80.toFixed(2)}%`;
}

function drawMacroMap(f){
  const canvas=$('macro-map'),{c,w,h}=resizeCanvas(canvas),pad={l:54,r:28,t:22,b:38},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b,track=f.currentTrack,anchor=f.anchor;
  const relative=value=>100*(value/anchor-1),lows=track.map(x=>relative(x.lower)),highs=track.map(x=>relative(x.upper)),closes=track.map(x=>relative(x.sourceBlock.c)),currentOpen=f.current.sourceBlock.o;
  const projected={low10:relative(currentOpen*(1+f.box.lower.p10/100)),low50:relative(currentOpen*(1+f.box.lower.p50/100)),low90:relative(currentOpen*(1+f.box.lower.p90/100)),high10:relative(currentOpen*(1+f.box.upper.p10/100)),high50:relative(currentOpen*(1+f.box.upper.p50/100)),high90:relative(currentOpen*(1+f.box.upper.p90/100))};
  const values=[...lows,...highs,...closes,...Object.values(projected),0],lo=Math.min(...values),hi=Math.max(...values),margin=Math.max(.12,(hi-lo)*.12),y=v=>pad.t+ih*(hi+margin-v)/(hi-lo+2*margin),futureX=w-pad.r-28,x=i=>track.length<2?pad.l+iw*.35:pad.l+(futureX-pad.l-34)*i/(track.length-1);
  c.clearRect(0,0,w,h);c.font='11px system-ui';c.fillStyle='#8ea3ba';c.strokeStyle='rgba(78,104,133,.35)';c.lineWidth=1;
  for(let j=0;j<=4;j++){const v=lo-margin+(hi-lo+2*margin)*j/4,yy=y(v);c.beginPath();c.moveTo(pad.l,yy);c.lineTo(w-pad.r,yy);c.stroke();c.fillText(`${v.toFixed(2)}%`,5,yy+4);}
  c.beginPath();track.forEach((s,i)=>i?c.lineTo(x(i),y(highs[i])):c.moveTo(x(i),y(highs[i])));for(let i=track.length-1;i>=0;i--)c.lineTo(x(i),y(lows[i]));c.closePath();c.fillStyle='rgba(54,223,255,.14)';c.fill();
  line(c,highs.map((v,i)=>[x(i),y(v)]),'#36dfff',1.7);line(c,lows.map((v,i)=>[x(i),y(v)]),'#36dfff',1.7);line(c,closes.map((v,i)=>[x(i),y(v)]),'#f6c85f',2.1);
  const bandTop=Math.max(projected.high10,projected.high90),bandBottom=Math.min(projected.low10,projected.low90);c.fillStyle='rgba(255,120,196,.18)';c.fillRect(futureX-14,y(bandTop),28,Math.max(3,y(bandBottom)-y(bandTop)));line(c,[[futureX-16,y(projected.high50)],[futureX+16,y(projected.high50)]],'#ff78c4',2.5);line(c,[[futureX-16,y(projected.low50)],[futureX+16,y(projected.low50)]],'#ff78c4',2.5);
  c.fillStyle='#9eb2c8';c.fillText('HỘP CUỐI',futureX-28,h-12);c.fillText(`H1 #${f.current.ageH1}`,pad.l,h-12);c.fillText(`${track.at(-1).day} ${clock(track.at(-1).minute)}`,Math.max(pad.l+55,futureX-170),h-12);
  c.strokeStyle='rgba(176,194,215,.55)';c.setLineDash([4,4]);c.beginPath();c.moveTo(pad.l,y(0));c.lineTo(w-pad.r,y(0));c.stroke();c.setLineDash([]);
}

function drawAgeMap(f){
  const canvas=$('age-map'),{c,w,h}=resizeCanvas(canvas),pad={l:112,r:45,t:34,b:34},iw=w-pad.l-pad.r,rows=[
    {label:'TUỔI H1',current:f.age.h1.current,band:f.age.h1.final,suffix:' H1'},
    {label:'TUỔI M15',current:f.age.bars.current,band:f.age.bars.final,suffix:' nến'},
    {label:'BẰNG CHỨNG',current:f.evidence.current,band:f.evidence.final,suffix:''}
  ],rowH=(h-pad.t-pad.b)/rows.length;
  c.clearRect(0,0,w,h);c.font='12px system-ui';
  rows.forEach((row,i)=>{const top=pad.t+i*rowH,cy=top+rowH*.46,max=Math.max(row.band.p90,row.current,1)*1.15,x=v=>pad.l+iw*v/max;c.fillStyle='#9eb2c8';c.fillText(row.label,8,cy+4);c.strokeStyle='rgba(78,104,133,.38)';c.lineWidth=8;c.beginPath();c.moveTo(pad.l,cy);c.lineTo(w-pad.r,cy);c.stroke();c.strokeStyle='rgba(54,223,255,.42)';c.lineWidth=12;c.beginPath();c.moveTo(x(row.band.p10),cy);c.lineTo(x(row.band.p90),cy);c.stroke();c.strokeStyle='#f6c85f';c.lineWidth=3;c.beginPath();c.moveTo(x(row.band.p50),cy-11);c.lineTo(x(row.band.p50),cy+11);c.stroke();c.strokeStyle='#36dfff';c.lineWidth=3;c.beginPath();c.moveTo(x(row.current),cy-15);c.lineTo(x(row.current),cy+15);c.stroke();c.fillStyle='#eaf2fb';c.fillText(`${row.current.toFixed(row.current%1?1:0)} → ${row.band.p50.toFixed(row.band.p50%1?1:0)}${row.suffix}`,pad.l,top+rowH*.82);});
  const p=Math.round(100*f.expandProbability);c.fillStyle='#9eb2c8';c.fillText(`Khả năng Hộp còn mở rộng: ${p}% · ngưỡng tăng biên ${f.expandThreshold.toFixed(2)}%`,pad.l,h-8);
}

function drawStateMap(index){
  const points=stateProjection??(stateProjection=macroPcaProjection(days,index)),canvas=$('state-map'),{c,w,h}=resizeCanvas(canvas);c.clearRect(0,0,w,h);if(!points.length)return;
  const pad=30,xs=points.map(x=>x.x),ys=points.map(x=>x.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),x=v=>pad+(w-2*pad)*(v-xmin)/(xmax-xmin||1),y=v=>h-pad-(h-2*pad)*(v-ymin)/(ymax-ymin||1);
  c.strokeStyle='rgba(80,105,132,.35)';c.beginPath();c.moveTo(pad,y(0));c.lineTo(w-pad,y(0));c.moveTo(x(0),pad);c.lineTo(x(0),h-pad);c.stroke();
  for(const p of points){const color=p.current?'#36dfff':!Number.isFinite(p.target)?'#78889a':p.target>.15?'#28d6a2':p.target<-.15?'#ff6685':'#78889a';c.beginPath();c.arc(x(p.x),y(p.y),p.current?7:2.8,0,Math.PI*2);c.fillStyle=color;c.globalAlpha=p.current?1:.58;c.fill();c.globalAlpha=1;if(p.current){c.fillStyle='#eaf2fb';c.font='11px system-ui';c.fillText(`${p.day} ${clock(p.minute)}`,x(p.x)+9,y(p.y)-8);}}
  c.fillStyle='#8ea3ba';c.font='11px system-ui';c.fillText('PC1 H1 + tích lũy',w/2-48,h-7);c.save();c.translate(10,h/2+38);c.rotate(-Math.PI/2);c.fillText('PC2 H1 + tích lũy',0,0);c.restore();
}

function renderSimilar(){
  $('similar').innerHTML=forecast.ranked.map(x=>`<div class="similar-row"><b>${x.state.day}<small>${clock(x.state.minute)}</small></b><span>d=${x.distance.toFixed(2)} · w=${Math.round(100*x.weight)}%</span><em>${x.outcome.finalAgeH1} H1</em><em class="${x.outcome.growthPct>0?'positive':'negative'}">${pct(x.outcome.growthPct)}</em></div>`).join('');
}
function renderWeeklyWlr(index){
  const selected=days[index],asOf=(selected?.rows?.at(-1)?.end??selected?.rows?.at(-1)?.t??manifest?.lastTime??Date.now())+1,result=weeklyWlrReversalForecast(modelRows,modelWlrColors,asOf,{horizonDays:5,minSamples:20,deadband:.15}),signal=$('wlr-week'),main=$('wlr-week-main'),note=$('wlr-week-note');
  if(!result.active){signal.textContent='WAIT';signal.className='wait';main.textContent=result.reason;note.textContent='Chỉ kích hoạt tại WLR confirmed xanh/đỏ trên nến đã đóng.';return;}
  const color=result.direction>0?'XANH ĐẬM':'ĐỎ ĐẬM';signal.textContent=color;signal.className=result.direction>0?'positive':'negative';
  if(!result.ready){main.textContent='P đảo chiều: WAIT';note.textContent=`${result.reason} · không ép mục tiêu tuần.`;return;}
  const stale=latestDataIsStale(index);if(stale){signal.textContent='WAIT · DỮ LIỆU TRỄ';signal.className='wait';}
  const probability=Math.round(100*result.reversalProbability),move=result.returnBand.p50,target=result.targetPrice;
  main.textContent=`P đảo chiều tuần ${probability}% · P50 ${price(target)}`;
  note.textContent=`Kỳ vọng ${pct(move)} trong 5 phiên · ${result.n} mẫu (${result.reversalN} đảo chiều) · N hiệu dụng ${result.neff.toFixed(1)}${stale?' · DỮ LIỆU TRỄ · chỉ tham khảo':result.referenceOnly?' · THAM KHẢO':''}`;
}
function render(){
  stateProjection=null;
  const index=Number($('day').value),k=Number($('neighbors').value),stale=latestDataIsStale(index),isPreview=days[index]?.preview===true,m30=days[index]?.m30Preview;
  renderWeeklyWlr(index);
  forecast=additiveMacroForecast(days,index,{k,minSamples:12,minEffective:20});
  if(!forecast.ready){
    $('signal').textContent='WAIT';$('signal').className='wait';
    $('confidence').textContent=stale?'DỮ LIỆU TRỄ · không phát tín hiệu':isPreview?'M30 PREVIEW · chưa đủ cohort tuổi':'CONF 0% · WAIT 100%';
    $('box').textContent='—';$('box-band').textContent='Chờ cohort đủ điều kiện';$('cohort').textContent='—';$('cohort-note').textContent=forecast.reason;$('age').textContent='Chưa đủ dữ liệu';$('age-band').textContent='Tuổi hiện tại và tuổi cuối chưa thể ước lượng';$('age-preview').textContent=m30PreviewText(isPreview,m30);
    renderDataStatus(index,isPreview,forecast.reason);clearForecastPanels();return;
  }
  const f=forecast,pad=audit?.ready&&audit.n>=30?audit.boxPadding80:0,view=pad>0?{...f,box:{...f.box,lower:{...f.box.lower,p10:f.box.lower.p10-pad,p90:f.box.lower.p90+pad},upper:{...f.box.upper,p10:f.box.upper.p10-pad,p90:f.box.upper.p90+pad}}}:f,open=f.current.sourceBlock.o,low=open*(1+f.box.lower.p50/100),high=open*(1+f.box.upper.p50/100),shownLabel=stale||isPreview?'WAIT':f.label;
  const currentAge=f.age.h1.current,finalAge=f.age.h1.final.p50,remaining=f.age.h1.remaining.p50,ageRange=`${f.age.h1.final.p10}–${f.age.h1.final.p90} H1`;
  $('signal').textContent=shownLabel;$('signal').className=shownLabel.toLowerCase();
  $('confidence').textContent=stale?`DỮ LIỆU TRỄ · P mở tham khảo ${Math.round(100*f.expandProbability)}%`:isPreview?`M30 PREVIEW · không phát tín hiệu · P mở ${Math.round(100*f.expandProbability)}%`:`CONF ${f.confidence}% · WAIT ${f.wait}% · P mở ${Math.round(100*f.expandProbability)}%`;
  $('box').textContent=`${price(low)} → ${price(high)}`;
  $('box-band').textContent=`Open H1 ${price(open)} · vùng cuối P10–P90 ${pct(view.box.lower.p10)} → ${pct(view.box.upper.p90)}${pad?` · đệm ±${pad.toFixed(2)}%`:''}`;
  $('age').textContent=`Hiện tại ${currentAge} H1 → cuối P50 ${finalAge} H1`;
  $('age-band').textContent=`Còn lại P50: ${remaining} H1 · khoảng tuổi cuối P10–P90: ${ageRange}`;
  $('age-preview').textContent=m30PreviewText(isPreview,m30);
  $('cohort').textContent=`${f.n} chuỗi · N độc lập ${f.independentN.toFixed(1)}`;
  $('cohort-note').textContent=f.referenceOnly?`THAM KHẢO · cần ≥${f.minEffective} ngày/mẫu hiệu dụng`:'Đủ ngưỡng nghiên cứu';
  $('macro-result').textContent=`Kết quả: Hộp hiện tại rộng ${f.current.widthPct.toFixed(2)}%; trung vị Hộp cuối nằm trong ${price(low)}–${price(high)}. Xác suất còn mở rộng: ${Math.round(100*f.expandProbability)}%.`;
  $('age-result').textContent=`Kết quả: đã khóa ${currentAge} H1; dự báo kết thúc tại P50 ${finalAge} H1, tức còn khoảng ${remaining} H1. 80% cohort nằm trong ${ageRange}.`;
  drawView=view;drawMacroMap(view);drawAgeMap(f);drawStateMap(index);renderSimilar();
  renderDataStatus(index,isPreview);
}
function rebuild(raw){
    const previousDays=days,previousValue=$('day').value;
    manifest=raw.manifest;const now=manifest?.collection?.checkedAt??(manifest.lastTime??Date.now())+STEP;
    const spy=analyze(raw.SPYUSDT,STEP),comp=analyze(composite(raw.SPYUSDT,raw.QQQUSDT,STEP),STEP),volume=analyze(raw.SPYUSDT,STEP,{strength:calculateVolumeStrength(raw.SPYUSDT,STEP)});
    const market=trendSessionRows(spy.filter(x=>x.end<now)),times=new Set(market.map(x=>x.t)),marketVolume=volume.filter(x=>times.has(x.t)),channels=causalTrendChannels(market.map(x=>x.session==='EURO'?{...x,session:'PRE'}:x),{volumeRows:marketVolume,maxHistory:Infinity});
    const trendStates=historicalTrendAgeStates({priceRows:spy,strengthRows:comp,volumeRows:marketVolume,channelTrends:channels.episodes,now,fromTime:-Infinity});
    const boxes=channelStrengthBoxes(spy,{channels:channels.episodes,showEarly:false,back:8,now,step:STEP,compositeRows:new Map(comp.map(x=>[x.t,x])),volumeRows:new Map(volume.map(x=>[x.t,x])),compositeMode:'annotate'});
    const strengthMap=new Map(comp.map(x=>[x.t,x])),volumeMap=new Map(volume.map(x=>[x.t,x])),wlrColors=wlrSoftColors(spy,weightedPriceBands(spy,STEP),strengthMap,volumeMap,{step:STEP,closedBefore:now});
    modelRows=spy;modelWlrColors=wlrColors;
    days=buildDailyMaps({priceRows:spy,boxSnapshots:boxes.snapshots,trendStates,wlrColors,strengthRows:comp});if(days.length<13)throw Error('Chưa đủ ngày hoàn chỉnh để lập cohort H1');const nextAuditKey=days.map(x=>`${x.day}:${x.rows?.at(-1)?.t}:${x.h1Blocks?.length}`).join('|');if(nextAuditKey!==auditKey){audit=walkForwardMacroAudit(days,{k:60,minSamples:12,minEffective:20,minIndex:20});auditKey=nextAuditKey;}renderAudit();const intraday=buildIntradayDay({priceRows:spy,boxSnapshots:boxes.snapshots,trendStates,wlrColors,strengthRows:comp});if(intraday&&intraday.day>days.at(-1).day)days.push(intraday);
    $('day').innerHTML=days.map((x,i)=>`<option value="${i}">${x.day}${x.preview?' · HÔM NAY M30 PREVIEW':i===days.length-1?' · mới nhất':''}</option>`).reverse().join('');$('day').value=String(selectedDayIndex(previousDays,previousValue,days));render();
}
async function refreshFromRest(){
  if(restSyncing||!rawHistory)return false;restSyncing=true;
  try{
    const base=rawHistory,before=base.manifest.lastTime,next=await topUpLive(base,compact);if(rawHistory!==base)return false;rawHistory=next;manifest=next.manifest;
    const advanced=next.manifest.lastTime>before;if(advanced)rebuild(next);else render();return advanced;
  }finally{restSyncing=false;}
}
function applyClosedPair(pair){
  const lastS=rawHistory.SPYUSDT.at(-1)?.t,lastQ=rawHistory.QQQUSDT.at(-1)?.t;if(pair.t!==lastS+STEP||pair.t!==lastQ+STEP){repairStream();return;}
  const SPYUSDT=[...rawHistory.SPYUSDT,compact(pair.SPYUSDT)],QQQUSDT=[...rawHistory.QQQUSDT,compact(pair.QQQUSDT)],lastBySymbol={SPYUSDT:pair.t,QQQUSDT:pair.t},added=(rawHistory.manifest.topUp?.added??0)+1;
  const nextManifest={...rawHistory.manifest,lastTime:pair.t,collection:collectionFor({lastBySymbol,checkedAt:pair.checkedAt,source:'browser-ws'}),topUp:{...rawHistory.manifest.topUp,status:'ok',added}};
  rawHistory={manifest:nextManifest,SPYUSDT,QQQUSDT};rebuild(rawHistory);
}
function startStream(){
  clearTimeout(repairTimer);liveStream?.close();if(!autoRefresh||!rawHistory||document.visibilityState==='hidden')return;const afterT=Math.min(rawHistory?.SPYUSDT.at(-1)?.t??0,rawHistory?.QQQUSDT.at(-1)?.t??0);
  liveStream=openClosedPairStream({afterT,onPair:applyClosedPair,onGap:repairStream});
}
async function repairStream(){
  if(repairing)return;repairing=true;liveStream?.close();liveStream=null;
  try{const advanced=await refreshFromRest();repairTimer=setTimeout(startStream,advanced?1000:60000);}catch(error){$('status').textContent=`Nối lại dữ liệu lỗi: ${error.message}`;repairTimer=setTimeout(startStream,60000);}finally{repairing=false;}
}
async function init(){
  document.body.classList.add('loading');
  try{rawHistory=await loadDayHistory();rebuild(rawHistory);document.body.classList.remove('loading');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(autoRefresh){await refreshFromRest();startStream();}
  }catch(error){$('status').textContent=error.message;$('status').className='negative';}
  finally{document.body.classList.remove('loading');}
}
async function manualRefresh(){
  const button=$('refresh');if(button.disabled)return;button.disabled=true;button.textContent='↻ Đang làm tươi…';
  try{if(!rawHistory){await init();if(!rawHistory)throw Error('Chưa tải được lịch sử');}const advanced=await refreshFromRest();if(autoRefresh&&rawHistory)startStream();button.textContent=manifest?.topUp?.status==='failed'?'! Nối live thất bại':advanced?'✓ Đã có M15 mới':'✓ Đã kiểm tra';}
  catch(error){$('status').textContent=`Làm tươi lỗi: ${error.message}`;$('status').className='negative';button.textContent='! Thử lại';}
  finally{setTimeout(()=>{button.disabled=false;button.textContent='↻ Làm tươi';},1400);}
}
function setAutoRefresh(enabled){
  autoRefresh=enabled;clearTimeout(repairTimer);clearInterval(autoTimer);autoTimer=null;const button=$('auto-refresh');button.textContent=enabled?'● AUTO 60 GIÂY':'○ AUTO TẮT';button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled));
  if(enabled){autoTimer=setInterval(()=>{if(document.visibilityState==='visible')safeRefresh();},60000);if(rawHistory)startStream();}else{liveStream?.close();liveStream=null;}
}
$('day').addEventListener('change',render);$('neighbors').addEventListener('change',render);$('latest').addEventListener('click',()=>{$('day').value=String(days.length-1);render();});$('refresh').addEventListener('click',manualRefresh);$('auto-refresh').addEventListener('click',()=>setAutoRefresh(!autoRefresh));addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(drawView&&forecast?.ready){drawMacroMap(drawView);drawAgeMap(forecast);drawStateMap(Number($('day').value));}});});init();setAutoRefresh(true);
async function safeRefresh(){try{await refreshFromRest();}catch(error){$('status').textContent=`Cập nhật lỗi: ${error.message}`;$('status').className='negative';}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&autoRefresh){safeRefresh();if(rawHistory)startStream();}else{clearTimeout(repairTimer);liveStream?.close();liveStream=null;}});




