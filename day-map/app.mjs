import {analyze,composite,calculateVolumeStrength,STEPS,sessionAt} from '../netflow-stumpy/engine.mjs?v=20261029-h1-map1';
import {trendSessionRows} from '../netflow-stumpy/trend-session.mjs?v=20261029-h1-map1';
import {causalTrendChannels} from '../netflow-stumpy/causal-trend-channel.mjs?v=20261029-h1-map1';
import {historicalTrendAgeStates} from '../netflow-stumpy/pre-rth-wlr-trend.mjs?v=20261029-h1-map1';
import {channelStrengthBoxes} from '../netflow-stumpy/channel-strength-boxes.mjs?v=20261029-h1-map1';
import {buildDailyMaps,additiveMacroForecast,macroPcaProjection} from './day-map-core.mjs?v=20261029-h1-map2';

const $=id=>document.getElementById(id),STEP=STEPS['15m'];let days=[],forecast=null,manifest=null;
const pct=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}%`:'—';
const price=x=>Number.isFinite(x)?x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const clock=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;

async function loadDayHistory(){
  const root='../netflow-stumpy/data/binance/m15/',response=await fetch(root+'manifest.json?ts='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('History manifest chưa sẵn sàng');
  const manifest=await response.json();if(manifest?.interval!=='15m'||!Array.isArray(manifest.months))throw Error('History manifest không hợp lệ');
  const cutoff=(manifest.lastTime??Date.now())-365*86400000,months=manifest.months.filter(key=>/^\d{4}-\d{2}$/.test(key)).filter(key=>{const [y,m]=key.split('-').map(Number);return Date.UTC(y,m,1)-1>=cutoff;});
  const docs=await Promise.all(months.map(async key=>{const r=await fetch(root+key+'.json?v='+(key===months.at(-1)?manifest.lastTime:'closed'),{cache:'force-cache'});if(!r.ok)throw Error('Thiếu shard '+key);return r.json();}));
  const compact=r=>{if(!Array.isArray(r)||r.length<9)throw Error('Shard lịch sử M15 không hợp lệ');const [t,o,h,l,c,v,end,q,buy]=r.map(Number);if(![t,o,h,l,c,v,end,q,buy].every(Number.isFinite)||end!==t+STEP-1)throw Error('Bar lịch sử M15 không hợp lệ');return {t,o,h,l,c,v,end,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)};};
  return {manifest,SPYUSDT:docs.flatMap(doc=>(doc.SPYUSDT??[]).map(compact)).filter(x=>x.t>=cutoff),QQQUSDT:docs.flatMap(doc=>(doc.QQQUSDT??[]).map(compact)).filter(x=>x.t>=cutoff)};
}

function resizeCanvas(canvas){
  const dpr=devicePixelRatio||1,w=Math.max(320,canvas.clientWidth),h=Number(canvas.getAttribute('height'))||330;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h};
}
function line(c,points,color,width=2,dash=[]){if(!points.length)return;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}

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
  const points=macroPcaProjection(days,index),canvas=$('state-map'),{c,w,h}=resizeCanvas(canvas);c.clearRect(0,0,w,h);if(!points.length)return;
  const pad=30,xs=points.map(x=>x.x),ys=points.map(x=>x.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),x=v=>pad+(w-2*pad)*(v-xmin)/(xmax-xmin||1),y=v=>h-pad-(h-2*pad)*(v-ymin)/(ymax-ymin||1);
  c.strokeStyle='rgba(80,105,132,.35)';c.beginPath();c.moveTo(pad,y(0));c.lineTo(w-pad,y(0));c.moveTo(x(0),pad);c.lineTo(x(0),h-pad);c.stroke();
  for(const p of points){const color=p.current?'#36dfff':!Number.isFinite(p.target)?'#78889a':p.target>.15?'#28d6a2':p.target<-.15?'#ff6685':'#78889a';c.beginPath();c.arc(x(p.x),y(p.y),p.current?7:2.8,0,Math.PI*2);c.fillStyle=color;c.globalAlpha=p.current?1:.58;c.fill();c.globalAlpha=1;if(p.current){c.fillStyle='#eaf2fb';c.font='11px system-ui';c.fillText(`${p.day} ${clock(p.minute)}`,x(p.x)+9,y(p.y)-8);}}
  c.fillStyle='#8ea3ba';c.font='11px system-ui';c.fillText('PC1 H1 + tích lũy',w/2-48,h-7);c.save();c.translate(10,h/2+38);c.rotate(-Math.PI/2);c.fillText('PC2 H1 + tích lũy',0,0);c.restore();
}

function renderSimilar(){
  $('similar').innerHTML=forecast.ranked.map(x=>`<div class="similar-row"><b>${x.state.day}<small>${clock(x.state.minute)}</small></b><span>d=${x.distance.toFixed(2)} · w=${Math.round(100*x.weight)}%</span><em>${x.outcome.finalAgeH1} H1</em><em class="${x.outcome.growthPct>0?'positive':'negative'}">${pct(x.outcome.growthPct)}</em></div>`).join('');
}
function render(){
  const index=Number($('day').value),k=Number($('neighbors').value);forecast=additiveMacroForecast(days,index,{k,minSamples:12});
  if(!forecast.ready){$('signal').textContent='WAIT';$('signal').className='wait';$('confidence').textContent='CONF 0% · WAIT 100%';$('status').textContent=forecast.reason;return;}
  const f=forecast,open=f.current.sourceBlock.o,low=open*(1+f.box.lower.p50/100),high=open*(1+f.box.upper.p50/100);
  $('signal').textContent=f.label;$('signal').className=f.label.toLowerCase();$('confidence').textContent=`CONF ${f.confidence}% · WAIT ${f.wait}% · P mở ${Math.round(100*f.expandProbability)}%`;
  $('box').textContent=`${price(low)} → ${price(high)}`;$('box-band').textContent=`H1 Open ${price(open)} · P10–P90 ${pct(f.box.lower.p10)} → ${pct(f.box.upper.p90)}`;
  $('age').textContent=`${f.age.h1.current} → ${f.age.h1.final.p50} H1`;$('age-band').textContent=`Còn P50 ${f.age.h1.remaining.p50} H1 · P10–P90 ${f.age.h1.final.p10}–${f.age.h1.final.p90}`;
  $('cohort').textContent=`${f.n} chuỗi · N hiệu dụng ${f.neff.toFixed(1)}`;$('cohort-note').textContent=f.referenceOnly?'THAM KHẢO · cần ≥50 mẫu hiệu dụng':'Đủ ngưỡng nghiên cứu';
  drawMacroMap(f);drawAgeMap(f);drawStateMap(index);renderSimilar();
  const lag=manifest?.collection?.lagHours;$('status').textContent=`${days.length} ngày · H1 khóa từ 4 M15 đóng · dữ liệu đến ${new Date(manifest.lastTime).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}${Number.isFinite(lag)?` · trễ ${lag.toFixed(1)}h`:''}`;
}
async function init(){
  document.body.classList.add('loading');
  try{
    const raw=await loadDayHistory();manifest=raw.manifest;const now=(manifest.lastTime??Date.now())+STEP;
    const spy=analyze(raw.SPYUSDT,STEP),qqq=analyze(raw.QQQUSDT,STEP),comp=analyze(composite(raw.SPYUSDT,raw.QQQUSDT,STEP),STEP),volume=analyze(raw.SPYUSDT,STEP,{strength:calculateVolumeStrength(raw.SPYUSDT,STEP)});
    const market=trendSessionRows(spy.filter(x=>x.end<now)),times=new Set(market.map(x=>x.t)),marketVolume=volume.filter(x=>times.has(x.t)),channels=causalTrendChannels(market.map(x=>x.session==='EURO'?{...x,session:'PRE'}:x),{volumeRows:marketVolume,maxHistory:Infinity});
    const trendStates=historicalTrendAgeStates({priceRows:spy,strengthRows:comp,volumeRows:marketVolume,channelTrends:channels.episodes,now,fromTime:-Infinity});
    const boxes=channelStrengthBoxes(spy,{channels:channels.episodes,showEarly:false,back:8,now,step:STEP,compositeRows:new Map(comp.map(x=>[x.t,x])),volumeRows:new Map(volume.map(x=>[x.t,x])),compositeMode:'annotate'});
    days=buildDailyMaps({priceRows:spy,boxSnapshots:boxes.snapshots,trendStates});if(days.length<13)throw Error('Chưa đủ ngày hoàn chỉnh để lập cohort H1');
    $('day').innerHTML=days.map((x,i)=>`<option value="${i}">${x.day}${i===days.length-1?' · mới nhất':''}</option>`).reverse().join('');$('day').value=String(days.length-1);render();
  }catch(error){$('status').textContent=error.message;$('status').className='negative';}
  finally{document.body.classList.remove('loading');}
}
$('day').addEventListener('change',render);$('neighbors').addEventListener('change',render);$('latest').addEventListener('click',()=>{$('day').value=String(days.length-1);render();});addEventListener('resize',()=>{if(forecast?.ready)render();});init();
