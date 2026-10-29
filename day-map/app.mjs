import {loadPersistentHistory} from '../netflow-stumpy/history-store.mjs?v=20261029-day-map1';
import {analyze,composite,calculateVolumeStrength,STEPS} from '../netflow-stumpy/engine.mjs?v=20261029-day-map1';
import {trendSessionRows} from '../netflow-stumpy/trend-session.mjs?v=20261029-day-map1';
import {causalTrendChannels} from '../netflow-stumpy/causal-trend-channel.mjs?v=20261029-day-map1';
import {historicalTrendAgeStates} from '../netflow-stumpy/pre-rth-wlr-trend.mjs?v=20261029-day-map1';
import {channelStrengthBoxes} from '../netflow-stumpy/channel-strength-boxes.mjs?v=20261029-day-map1';
import {buildDailyMaps,similarDayForecast,pcaProjection} from './day-map-core.mjs?v=20261029-day-map1';

const $=id=>document.getElementById(id),STEP=STEPS['15m'];let days=[],forecast=null,manifest=null;
const pct=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}%`:'—';
const tone=x=>x>0?'positive':x<0?'negative':'';

function resizeCanvas(canvas){
  const dpr=devicePixelRatio||1,w=Math.max(320,canvas.clientWidth),h=Number(canvas.getAttribute('height'))||330;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h};
}
function scaleRange(envelope,current=[]){
  const values=[...current,...envelope.flatMap(x=>[x.p10,x.p90]).filter(Number.isFinite)],max=Math.max(.25,...values.map(Math.abs));return [-max*1.12,max*1.12];
}
function drawPathMap(id,envelope,current=null,{forecastMap=false}={}){
  const canvas=$(id),{c,w,h}=resizeCanvas(canvas),pad={l:48,r:18,t:16,b:32},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b,[lo,hi]=scaleRange(envelope,current??[]),x=i=>pad.l+iw*i/47,y=v=>pad.t+ih*(hi-v)/(hi-lo);
  c.clearRect(0,0,w,h);c.font='11px system-ui';c.strokeStyle='rgba(78,104,133,.35)';c.fillStyle='#8196ad';c.lineWidth=1;
  for(let j=0;j<=4;j++){const v=lo+(hi-lo)*j/4,yy=y(v);c.beginPath();c.moveTo(pad.l,yy);c.lineTo(w-pad.r,yy);c.stroke();c.fillText(`${v.toFixed(2)}%`,4,yy+4);}
  for(const [slot,label] of [[0,'04:00'],[22,'09:30'],[32,'12:00'],[47,'15:45']]){const xx=x(slot);c.beginPath();c.moveTo(xx,pad.t);c.lineTo(xx,h-pad.b);c.stroke();c.fillText(label,xx-17,h-10);}
  const area=(a,b,color)=>{c.beginPath();envelope.forEach((p,i)=>i?c.lineTo(x(i),y(p[a])):c.moveTo(x(i),y(p[a])));for(let i=envelope.length-1;i>=0;i--)c.lineTo(x(i),y(envelope[i][b]));c.closePath();c.fillStyle=color;c.fill();};
  area('p90','p10','rgba(54,223,255,.12)');area('p75','p25','rgba(54,223,255,.22)');
  const line=(key,color,width,dash=[])=>{c.beginPath();envelope.forEach((p,i)=>i?c.lineTo(x(i),y(p[key])):c.moveTo(x(i),y(p[key])));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);};
  line('p50','#f6c85f',2.2);
  if(current){c.beginPath();current.forEach((v,i)=>i?c.lineTo(x(i),y(v)):c.moveTo(x(i),y(v)));c.strokeStyle='#36dfff';c.lineWidth=2.4;c.stroke();}
  c.strokeStyle='rgba(176,194,215,.55)';c.setLineDash([4,4]);c.beginPath();c.moveTo(pad.l,y(0));c.lineTo(w-pad.r,y(0));c.stroke();c.setLineDash([]);
  if(forecastMap){c.fillStyle='#9eb2c8';c.fillText('Kỳ vọng từ các ngày kế tiếp lịch sử',pad.l+6,pad.t+14);}
}
function drawStateMap(index){
  const points=pcaProjection(days,index),canvas=$('state-map'),{c,w,h}=resizeCanvas(canvas),pad=30,xs=points.map(x=>x.x),ys=points.map(x=>x.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),x=v=>pad+(w-2*pad)*(v-xmin)/(xmax-xmin||1),y=v=>h-pad-(h-2*pad)*(v-ymin)/(ymax-ymin||1);
  c.clearRect(0,0,w,h);c.strokeStyle='rgba(80,105,132,.35)';c.beginPath();c.moveTo(pad,y(0));c.lineTo(w-pad,y(0));c.moveTo(x(0),pad);c.lineTo(x(0),h-pad);c.stroke();
  for(const p of points){const color=p.current?'#36dfff':!Number.isFinite(p.target)?'#78889a':p.target>.15?'#28d6a2':p.target<-.15?'#ff6685':'#78889a';c.beginPath();c.arc(x(p.x),y(p.y),p.current?7:3.2,0,Math.PI*2);c.fillStyle=color;c.globalAlpha=p.current?1:.72;c.fill();c.globalAlpha=1;if(p.current){c.fillStyle='#eaf2fb';c.font='11px system-ui';c.fillText(p.day,x(p.x)+9,y(p.y)-8);}}
  c.fillStyle='#8ea3ba';c.font='11px system-ui';c.fillText('PC1 quỹ đạo + trạng thái',w/2-62,h-7);c.save();c.translate(10,h/2+50);c.rotate(-Math.PI/2);c.fillText('PC2 quỹ đạo + trạng thái',0,0);c.restore();
}
function renderSimilar(){
  $('similar').innerHTML=forecast.ranked.map((x,i)=>{const target=x.day.next.dayMove;return `<div class="similar-row"><b>${x.day.day}</b><span>d=${x.distance.toFixed(2)} · w=${Math.round(100*x.weight)}%</span><em class="${tone(target)}">${pct(target)}</em><em>#${i+1}</em></div>`;}).join('');
}
function render(){
  const index=Number($('day').value),k=Number($('neighbors').value);forecast=similarDayForecast(days,index,{k,minSamples:12});
  if(!forecast.ready){$('signal').textContent='WAIT';$('status').textContent=forecast.reason;return;}
  const f=forecast;$('signal').textContent=f.label;$('signal').className=f.label.toLowerCase();$('confidence').textContent=`CONF ${f.confidence}% · WAIT ${f.wait}%`;
  $('close').textContent=pct(f.close.p50);$('close').className=tone(f.close.p50);$('close-band').textContent=`P10 ${pct(f.close.p10)} · P90 ${pct(f.close.p90)}`;
  $('range').textContent=`${pct(f.low.p50)} → ${pct(f.high.p50)}`;$('range-band').textContent=`Neo theo PRE Open ngày kế tiếp`;
  $('cohort').textContent=`${f.n} ngày · N hiệu dụng ${f.neff.toFixed(1)}`;$('cohort-note').textContent=f.referenceOnly?'THAM KHẢO · cần ≥50 mẫu hiệu dụng':'Đủ ngưỡng nghiên cứu';
  drawPathMap('today-map',f.todayEnvelope,f.current.path);drawPathMap('next-map',f.nextEnvelope,null,{forecastMap:true});drawStateMap(index);renderSimilar();
  const lag=manifest?.collection?.lagHours;$('status').textContent=`${days.length} ngày hoàn chỉnh · dữ liệu đến ${new Date(manifest.lastTime).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}${Number.isFinite(lag)?` · trễ ${lag.toFixed(1)}h`:''}`;
}
async function init(){
  document.body.classList.add('loading');
  try{
    const raw=await loadPersistentHistory({days:365});manifest=raw.manifest;const now=(manifest.lastTime??Date.now())+STEP;
    const spy=analyze(raw.SPYUSDT,STEP),qqq=analyze(raw.QQQUSDT,STEP),comp=analyze(composite(raw.SPYUSDT,raw.QQQUSDT,STEP),STEP),volume=analyze(raw.SPYUSDT,STEP,{strength:calculateVolumeStrength(raw.SPYUSDT,STEP)});
    const market=trendSessionRows(spy.filter(x=>x.end<now)),times=new Set(market.map(x=>x.t)),marketVolume=volume.filter(x=>times.has(x.t)),channels=causalTrendChannels(market.map(x=>x.session==='EURO'?{...x,session:'PRE'}:x),{volumeRows:marketVolume,maxHistory:Infinity});
    const trendStates=historicalTrendAgeStates({priceRows:spy,strengthRows:comp,volumeRows:marketVolume,channelTrends:channels.episodes,now,fromTime:-Infinity});
    const boxes=channelStrengthBoxes(spy,{channels:channels.episodes,showEarly:false,back:8,now,step:STEP,compositeRows:new Map(comp.map(x=>[x.t,x])),volumeRows:new Map(volume.map(x=>[x.t,x])),compositeMode:'annotate'});
    days=buildDailyMaps({priceRows:spy,boxSnapshots:boxes.snapshots,trendStates});
    if(days.length<13)throw Error('Chưa đủ ngày hoàn chỉnh để lập cohort');
    $('day').innerHTML=days.map((x,i)=>`<option value="${i}">${x.day}${i===days.length-1?' · mới nhất':''}</option>`).reverse().join('');$('day').value=String(days.length-1);render();
  }catch(error){$('status').textContent=error.message;$('status').className='negative';}
  finally{document.body.classList.remove('loading');}
}
$('day').addEventListener('change',render);$('neighbors').addEventListener('change',render);$('latest').addEventListener('click',()=>{$('day').value=String(days.length-1);render();});
addEventListener('resize',()=>{if(forecast)render();});init();
