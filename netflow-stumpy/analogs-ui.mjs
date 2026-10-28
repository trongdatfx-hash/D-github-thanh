import {COMPOSITE_STRENGTH_VERSION} from './engine.mjs?v=20261029-price-delta1';
let worker,latest=null,key='',request=0,activeResult=null,selected=0,source='';
const $=id=>document.getElementById(id),pct=(v,d=1)=>Number.isFinite(v)?`${v.toFixed(d)}%`:'—';
const date=t=>new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York',hour12:false});
function cell(text){const td=document.createElement('td');td.textContent=text;return td;}
function draw(){
  const canvas=$('analogs-chart');if(!canvas||!activeResult)return;
  const width=Math.max(280,canvas.clientWidth),height=240,dpr=devicePixelRatio||1;
  canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  ctx.fillStyle='#111b28';ctx.fillRect(0,0,width,height);
  const r=activeResult,match=r.matches[selected],paths=[r.queryPath,...r.matches.slice(0,8).map(x=>x.path)],vals=paths.flat(),min=Math.min(...vals,0),max=Math.max(...vals,0),pad=Math.max(.03,(max-min)*.15),lo=min-pad,hi=max+pad;
  const x=i=>40+i/(r.m+r.h-1)*(width-56),y=v=>height-28-(v-lo)/(hi-lo)*(height-54);
  ctx.strokeStyle='#314055';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(r.m-1),15);ctx.lineTo(x(r.m-1),height-27);ctx.stroke();
  ctx.fillStyle='#93a5bc';ctx.font='11px sans-serif';ctx.fillText('Mẫu quá khứ',42,14);ctx.fillText(`+${r.h} nến`,Math.min(width-60,x(r.m-1)+8),14);
  for(const v of [lo,0,hi]){ctx.fillText(pct(v,2),1,y(v)+3);}
  const line=(p,color,w=1)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke();};
  for(const p of r.matches.slice(0,8))line(p.path,'#52677b70');
  if(match)line(match.path,'#ffbd69',2);
  line(r.queryPath,'#38dfba',2.5);
}
function render(result,label){
  activeResult=result;selected=0;source=label;
  const r=result,n=r.n,age=r.queryTime?Date.now()-(r.queryTime+900000):Infinity;
  $('analogs-status').textContent=`${label} · ${r.technique==='price-volume'?'SPY V + Composite · WLR/Cụm':'Giá + Flow gốc'} · ${r.rows} nến · Mốc ${r.queryTime?date(r.queryTime)+' New York':'—'}${age>1800000?' · DỮ LIỆU CŨ':''}`;
  $('analogs-state').textContent=r.status==='WAIT'?'WAIT · Mẫu mỏng':'THỐNG KÊ THĂM DÒ';
  $('analogs-up').textContent=pct(r.pUp===null?null:100*r.pUp);
  $('analogs-down').textContent=pct(n?100*r.down/n:null);
  $('analogs-count').textContent=String(n);
  $('analogs-range').textContent=r.interval?`${pct(100*r.interval[0],0)}–${pct(100*r.interval[1],0)}`:'—';
  $('analogs-return').textContent=`${pct(r.q25,2)} / ${pct(r.median,2)} / ${pct(r.q75,2)}`;
  $('analogs-summary').textContent=`${r.candidates} cửa sổ hợp lệ; giữ tối đa 1 mẫu/ngày, các đoạn không chồng lấn. Tăng/giảm = close sau ${r.h} nến so với close mốc. ${n-r.up-r.down} mẫu đi ngang. Khoảng Wilson 95% chỉ tham khảo, chưa hiệu chỉnh phụ thuộc giữa ngày; chưa có kiểm định lợi thế ngoài mẫu hay chi phí.`;
  $('analogs-table').replaceChildren(...r.matches.map((match,i)=>{
    const tr=document.createElement('tr'),button=document.createElement('button');button.textContent='Xem';button.type='button';button.onclick=()=>{selected=i;draw();$('analogs-selection').textContent=`Đường cam: ${date(match.end)} New York · D=${match.distance.toFixed(3)} · sau ${r.h} nến ${pct(match.returnPct,2)}`;window.dispatchEvent(new CustomEvent('netflow:analog-select',{detail:match}));};
    const td=document.createElement('td');td.append(button);tr.append(cell(String(i+1)),cell(date(match.end)),cell(match.distance.toFixed(3)),cell(pct(match.returnPct,2)),cell(pct(match.mfePct,2)),cell(pct(match.maePct,2)),td);return tr;
  }));
  $('analogs-selection').textContent='Xanh ngọc: mẫu hiện tại/tham chiếu. Cam: mẫu lịch sử được chọn. Phần bên phải mốc chỉ là kết quả lịch sử.';
  draw();
}
function search(force=false){
  if(!latest)return;
  const m=+$('analogs-window').value,h=+$('analogs-horizon').value,symbol=latest.symbol,technique=$('analogs-technique')?.value??'flow';
  const next=`${symbol}:${latest.rows.at(-1)?.t}:${latest.rows.length}:${m}:${h}:${technique}`;if(!force&&key===next)return;key=next;
  $('analogs-status').textContent='Đang tìm cấu trúc giá–dòng tiền trong lịch sử…';
  if(!worker){worker=new Worker(new URL('./analogs-worker.mjs?v=20261029-price-delta1',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.id!==request)return;if(data.error){$('analogs-status').textContent=`Không tính được: ${data.error}`;return;}render(data.result,'So khớp trực tiếp · khoảng cách tương đương STUMPY MASS');};worker.onerror=()=>{$('analogs-status').textContent='Không khởi chạy được bộ so khớp. Hãy tải lại trang.';key='';worker?.terminate();worker=null;};}
  worker.postMessage({id:++request,rows:latest.rows,options:{m,h,technique}});
}
export function updateAnalogs({rows,symbol,interval}){
  if(interval!=='15m'){$('analogs-status').textContent='Historical Analogs chỉ nghiên cứu M15. Chuyển khung M15 để cập nhật.';latest=null;++request;key='';$('analogs-state').textContent='TẠM DỪNG · KHÁC M15';return;}
  latest={rows,symbol};search();
}
export function clearAnalogs(){
  latest=null;key='';++request;activeResult=null;
  const paused=$('interval')?.value!=='15m';
  $('analogs-status').textContent=paused?'Historical Analogs chỉ nghiên cứu M15. Chuyển khung M15 để cập nhật.':'Đang chờ dữ liệu M15 đã đóng…';
  $('analogs-state').textContent=paused?'TẠM DỪNG · KHÁC M15':'WAIT';
  for(const id of ['analogs-up','analogs-down','analogs-range','analogs-return'])$(id).textContent='—';
  $('analogs-count').textContent='0';$('analogs-table').replaceChildren();$('analogs-summary').textContent='';$('analogs-selection').textContent='';
  const canvas=$('analogs-chart');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
}
for(const id of ['analogs-window','analogs-horizon','analogs-technique'])$(id).onchange=()=>{if(latest)search(true);else loadSnapshot();};
$('analogs-refresh').onclick=()=>latest?search(true):loadSnapshot();
$('analogs-json').onclick=()=>{if(!activeResult)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...activeResult,source},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='netflow-historical-analogs.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let snapshot=null;
async function loadSnapshot(){
  try{if(!snapshot){const response=await fetch(new URL('./data/analogs/snapshot.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('chưa có snapshot');snapshot=await response.json();if(snapshot.strengthVersion!==COMPOSITE_STRENGTH_VERSION){snapshot=null;throw Error('Đang xây lại snapshot D common');}}
    if(latest||$('interval')?.value!=='15m')return;const symbol=$('symbol')?.value??'SPYUSDT',technique=$('analogs-technique')?.value??'flow',id=`${symbol}:${$('analogs-window').value}:${$('analogs-horizon').value}${technique==='price-volume'?':price-volume':''}`,r=snapshot.results[id];
    if(r&&(technique!=='price-volume'||r.featureSchema==='spyv-dcommon-v3'))render(r,`STUMPY Python · ${snapshot.provenance} · tham chiếu ${symbol}`);else{$('analogs-status').textContent='WAIT · Chưa có snapshot cho bộ đặc trưng đã chọn.';$('analogs-state').textContent='WAIT';}
  }catch{if(!latest)$('analogs-status').textContent='Chờ dữ liệu live hoặc snapshot STUMPY. Không tạo mẫu giả.';}
}
window.addEventListener('resize',draw);loadSnapshot();
