(function(){
 'use strict';
 const $=id=>document.getElementById(id),RAW='https://raw.githubusercontent.com/trongdatfx-hash/D-github-thanh/',ROOT=RAW+'main/ai-engine/reports/';
 let report=null,paper=null,selected=4,busy=false,socket=null,retry=null,head=null,headFreshUntil=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—',pct=v=>Number.isFinite(v)?num(v*100)+'%':'—';
 const signed=v=>Number.isFinite(v)?(v>=0?'+':'')+num(v):'—';
 const date=v=>Number.isFinite(v)?new Date(v).toLocaleString('vi-VN'):'—';
 const cls=p=>p==='BULL'?'bull':p==='BEAR'?'bear':'neutral';
 function stale(){return !report||report.stale||Date.now()-report.data_as_of>45*60000||report.generated_at>Date.now()+60000}
 function blocked(){return (report?.live_market_available??report?.live_rest_available)===false||(!(report?.live_market_available)&&report?.collection?.market?.['SPYUSDT/last']?.source==='vision_historical')}
 function render(){
  if(!report)return;
  const old=stale(),warming=report.feature_ready===false,inhibited=old||blocked()||warming,r=report.horizons.find(h=>h.bars===selected)||report.horizons[0];if(!r)return;
  $('dataStatus').textContent=(blocked()?'● REST runner bị chặn · WAIT':old?'● DỮ LIỆU CŨ · WAIT':warming?'● Dữ liệu mới · chờ đủ nến cho feature · WAIT':'● Dữ liệu nến đã đóng')+' · '+date(report.data_as_of);
  $('dataStatus').className=inhibited?'neutral':'bull';
  $('selectedTitle').textContent='Dự báo '+r.minutes+' phút · dữ liệu '+date(report.data_as_of);
  $('composite').className=cls(r.phase)+(inhibited?' dim':'');$('composite').textContent=signed(r.score)+' · '+r.phase;
  $('decision').textContent=(inhibited?'WAIT':r.signal)+' · '+(r.evidence==='SUPPORTED'?'Có hỗ trợ OOS':r.evidence==='INSUFFICIENT_DATA'?'Chưa đủ dữ liệu':'Chưa chứng minh lợi thế OOS');
  const p=r.probabilities;
  $('explanation').textContent=p?'BULL '+pct(p.bull)+' · NEUTRAL '+pct(p.neutral)+' · BEAR '+pct(p.bear)+' | Lợi suất proxy trước chi phí '+signed(r.expected_gross_bps)+' bps':'Đang tích lũy đủ mẫu để train.';
  $('horizons').innerHTML=report.horizons.map(h=>'<button class="horizon" data-bars="'+h.bars+'" aria-pressed="'+(h.bars===r.bars)+'">'+h.minutes+' phút<strong class="'+cls(h.phase)+'">'+signed(h.score)+' · '+esc(h.phase)+'</strong><small>'+esc(inhibited?'WAIT':h.signal)+' · '+esc(h.evidence==='SUPPORTED'?'OOS hỗ trợ':'OOS chưa đủ hỗ trợ')+'</small></button>').join('');
  document.querySelectorAll('[data-bars]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.bars);render()});
  const names={flow:'Dòng lệnh',price:'Phản ứng giá',derivatives:'Vị thế phái sinh',cross_asset:'SPY × QQQ',context:'Bối cảnh H1/H4'};
  const groups=Object.keys(names).map(k=>r.groups.find(g=>g.key===k)||{key:k,name:names[k],available:false,phase:'NEUTRAL',score:0,weight:0,contribution:0,train_n:0,coverage:0,features:[]});
  $('groups').innerHTML=groups.map(g=>'<tr><td>'+esc(g.name)+(g.available?'':'<br><small>Chưa đủ dữ liệu / dùng prior</small>')+'</td><td class="'+cls(g.phase)+'">'+esc(g.phase)+'</td><td class="'+cls(g.phase)+'">'+signed(g.score)+'</td><td>'+pct(g.weight)+'</td><td>'+signed(g.contribution)+'</td><td>'+esc(g.train_n)+'</td><td>'+pct(g.coverage)+'</td></tr>').join('');
  $('features').innerHTML=groups.map(g=>'<p><b>'+esc(g.name)+'</b>: '+esc(g.features.join(', ')||'Chưa có model nhóm')+'</p>').join('');
  $('regime').textContent='Bối cảnh: '+({HIGH_VOL:'Biến động cao',TREND:'Xu hướng',RANGE:'Đi ngang'}[report.regime]||report.regime);
  const e=r.evaluation||{},t=e.trades||{},s=e.stress_trades||{};
  const metrics=[['Mẫu OOS / folds',esc(e.samples||0)+' / '+(e.folds?.length||0)],['Accuracy',pct(e.accuracy)],['Balanced accuracy',pct(e.balanced_accuracy)],['Accuracy baseline',pct(e.baseline_accuracy)],['Log-loss / baseline',num(e.log_loss,3)+' / '+num(e.baseline_log_loss,3)],['Brier · thấp hơn tốt hơn',num(e.brier,3)],['Lệnh thử / Net bps',esc(t.n||0)+' / '+signed(t.net_bps)],['Stress net bps · 10 bps chi phí',signed(s.net_bps)]];
  $('validation').innerHTML=metrics.map(([label,value])=>'<div class="metric"><span class="label">'+label+'</span><strong>'+value+'</strong></div>').join('');
  const live=paper?.horizons?.find(h=>h.bars===r.bars);
  $('paper').textContent=live?(live.mature_predictions+' dự báo đã hoàn tất · accuracy '+pct(live.accuracy)+' · '+live.trades+' lệnh · net '+signed(live.net_bps)+' bps'):'Chờ dự báo live có đủ thời gian hoàn tất.';
  const c=report.collection?.market||{},aux=report.collection?.auxiliary||{},unavailable=Object.entries(aux).filter(([,v])=>!v.ok).map(([k])=>k);
  $('provenance').innerHTML='<p>Thu gần nhất: '+esc(report.collection?.collected_at||'—')+'<br>Xuất dự báo: '+date(report.generated_at)+' · Train: '+date(report.model_trained_at)+'<br>'+esc(report.dataset_rows)+' nến · '+esc(report.missing_bars)+' khoảng trống · '+(old?'Dữ liệu quá cũ':'Dữ liệu trong ngưỡng 45 phút')+'</p><p>Nguồn: '+esc(Object.entries(c).map(([k,v])=>k+': '+(v.source||'không tải được')).join(' · '))+'<br>Aux lỗi: '+esc(unavailable.join(', ')||'không có lỗi được báo')+' · Liquidation: chưa thu thường trực.</p>';
 }
 async function resolveHead(force){
  if(!force&&Date.now()<headFreshUntil)return;
  try{
   // At most 30 automatic public API requests/hour, below the usual 60/IP limit.
   // Immutable commit URLs avoid the mutable raw/main CDN cache.
   const response=await fetch('https://api.github.com/repos/trongdatfx-hash/D-github-thanh/git/ref/heads/main',{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const next=(await response.json()).object?.sha;if(!/^[a-f0-9]{40}$/.test(next))throw Error('Commit không hợp lệ');
   head=next;headFreshUntil=Date.now()+120000;
  }catch(e){head=null;headFreshUntil=Date.now()+600000;console.warn('Commit lookup unavailable',e.message)}
 }
 async function getJson(url){
  const response=await fetch(url+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('HTTP '+response.status);return response.json();
 }
 async function json(name){
  if(head){try{return await getJson(RAW+head+'/ai-engine/reports/'+name)}catch(e){console.warn('Commit report unavailable',e.message)}}
  // If the public API/raw route is limited, pick the newer of both cached copies.
  const results=await Promise.allSettled([getJson(ROOT+name),getJson('../ai-engine/reports/'+name)]);
  const available=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(available.length)return available.sort((a,b)=>(b.generated_at||b.data_as_of||0)-(a.generated_at||a.data_as_of||0))[0];
  throw Error('Không tải được '+name);
 }
 async function load(force=false){
  if(busy)return;busy=true;$('refresh').disabled=true;
  try{await resolveHead(force);const next=await json('layers_latest.json');if(next.schema_version!=='layers-v1'||!Array.isArray(next.horizons))throw Error('Kết quả chưa đúng phiên bản');report=next;try{paper=await json('paper_live.json')}catch(e){paper=null}render()}
  catch(e){$('dataStatus').textContent='Không tải được kết quả · '+e.message;if(report)render()}
  finally{busy=false;$('refresh').disabled=false}
 }
 function connect(){
  if(socket&&socket.readyState<2)return;
  socket=new WebSocket('wss://fstream.binance.com/market/stream?streams=spyusdt@aggTrade');
  socket.onopen=()=>{$('socketStatus').textContent='● live'};
  socket.onmessage=e=>{try{const d=JSON.parse(e.data).data;if(d.e==='aggTrade')$('livePrice').textContent=num(Number(d.p),4)}catch(err){console.warn('Price stream parse failed',err.message)}};
  socket.onclose=()=>{$('socketStatus').textContent='mất kết nối';clearTimeout(retry);retry=setTimeout(connect,3000)};
  socket.onerror=()=>{$('socketStatus').textContent='lỗi stream'};
 }
 $('refresh').onclick=()=>load(true);$('fullscreen').onclick=()=>{const panel=$('marketChart').closest('.panel');if(document.fullscreenElement)document.exitFullscreen?.();else panel.requestFullscreen?.().catch(()=>{})};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();connect()}});
 load();connect();setInterval(load,60000);setInterval(render,15000);
})();
