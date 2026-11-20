import {backtestReversalTrades} from './spy-body-reversal-trades.mjs?v=20261120-v2-hold1';

const STEP=900000;
const number=(v,n=2)=>v===null||v===undefined?'—':v===Infinity?'∞':Number.isFinite(v)?v.toLocaleString('vi-VN',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
const signed=v=>Number.isFinite(v)?(v>0?'+':'')+number(v):'—';
const date=t=>Number.isFinite(t)?new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';

export function mountReversalStats({host,actions,requestContext}){
  if(!host||!actions)return null;
  if(!document.getElementById('dao-v2-stats-style')){
    const style=document.createElement('style');style.id='dao-v2-stats-style';
    style.textContent=`
      #dao-v2-stats{position:absolute;z-index:110;top:48px;right:10px;width:min(590px,calc(100% - 20px));max-height:calc(100dvh - 78px);box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:13px;border:1px solid #6584a4;border-radius:10px;background:#0b1929;color:#d9e8f8;box-shadow:0 12px 40px #0009;font:12px/1.5 system-ui;pointer-events:auto}
      #dao-v2-stats[hidden]{display:none}
      #dao-v2-stats header{display:flex;align-items:center;justify-content:space-between;margin:0 0 6px;padding:0;background:none;border:0}
      #dao-v2-stats h3{font-size:16px;color:#f0f7ff;margin:0}
      #dao-v2-stats button{cursor:pointer;color:#d9e8f8;background:#19314a;border:1px solid #496988;border-radius:5px;padding:4px 9px;font:inherit}
      #dao-v2-stats p{margin:5px 0;color:#a9bfd6}
      #dao-v2-stats .v2-cost{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0}
      #dao-v2-stats input[type=number]{width:65px;padding:4px 6px;background:#101f32;color:#f0f7ff;border:1px solid #63819f;border-radius:4px;font:inherit}
      #dao-v2-stats .v2-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:10px 0}
      #dao-v2-stats .v2-tiles div{border:1px solid #314c66;border-radius:6px;padding:7px;background:#102439}
      #dao-v2-stats .v2-tiles small{display:block;color:#adc4dc;font-size:10px}
      #dao-v2-stats .v2-tiles strong{display:block;font-size:19px;color:#f0f7ff;white-space:nowrap}
      #dao-v2-stats .v2-scroll{overflow:auto}
      #dao-v2-stats table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px}
      #dao-v2-stats th,#dao-v2-stats td{padding:5px 6px;text-align:right;border-bottom:1px solid #263f58}
      #dao-v2-stats th:first-child,#dao-v2-stats td:first-child{text-align:left}
      #dao-v2-stats th{color:#a6bfd8;font-weight:600}
      #dao-v2-stats .v2-positive,#dao-v2-stats .v2-tiles .v2-positive{color:#76e6bd}#dao-v2-stats .v2-negative,#dao-v2-stats .v2-tiles .v2-negative{color:#ff9bad}
      #dao-v2-stats summary{cursor:pointer;color:#cce5ff;padding:6px 0}
      #dao-v2-stats .v2-rule{border-top:1px solid #314c66;margin-top:9px;padding-top:7px}
      @media(max-width:650px){#dao-v2-stats{top:43px;right:5px;width:calc(100% - 10px);padding:10px;max-height:calc(100dvh - 65px)}#dao-v2-stats .v2-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}#dao-v2-stats h3{font-size:15px}}
    `;document.head.append(style);
  }
  const button=document.createElement('button');button.id='dao-v2-stats-toggle';button.type='button';button.textContent='TK V₂';button.title='Thống kê SPY V: không SL, thoát đổi dấu hoặc mốc V₂ thứ hai cùng pha';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','dao-v2-stats');actions.append(button);
  const panel=document.createElement('section');panel.id='dao-v2-stats';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Thống kê ĐẢO V₂');
  panel.innerHTML=`<header><h3>Thống kê ĐẢO V₂</h3><button type="button" aria-label="Đóng thống kê">✕</button></header>
    <p data-v2-period></p><p data-v2-source></p><p><strong>PRE → RTH → POST</strong> · 04:00–20:00 New York · Thứ 2–6 · tự đổi DST</p>
    <p><strong>TP từ đủ 4 M15</strong> · Mốc TP đến sớm: chờ SPY V đổi dấu · Không SL</p>
    <label class="v2-cost">Chi phí khứ hồi <input type="number" min="0" max="10000" step="0.5" value="0" aria-label="Chi phí khứ hồi bps"> bps <small>1 bps = 0,01%</small></label>
    <label class="v2-cost"><input type="checkbox" data-v2-trend> Ưu tiên trend khỏe · thử</label><label class="v2-cost"><input type="checkbox" data-v2-hold checked> Giữ trend khỏe khi có mốc V₂ · thử</label><p data-v2-mode></p>
    <div data-v2-results></div>
    <div class="v2-rule"><strong>Quy tắc mô phỏng</strong>
    <p>Vào BUY/SELL ở mở nến sau lần SPY V thân nến đổi dấu, khi nến tín hiệu có mốc ĐẢO V₂ đầu để theo dõi mốc thứ hai. Không đặt SL. Chỉ vào lệnh khi tín hiệu xác nhận và mở nến vào lệnh nằm trong 04:00–20:00 New York, thứ 2–6. Vẫn theo dõi tín hiệu thoát của lệnh đang mở ngoài giờ này.</p>
    <p><strong>Bộ lọc trend khỏe (tùy chọn):</strong> sau đổi dấu chờ tối đa thêm 3 nến M15 đóng. Cần 2 dấu SPY V liên tiếp cùng hướng, |SPY V| ≥ 0,15 và không yếu đi; giá nằm thuận phía đường hồi quy WLR-8, độ dốc cùng hướng ≥ 0,02 ATR14/nến. WLR-8 dùng 8 nến trước, là bộ lọc riêng với WLR dài trên chart. Vào ở mở nến tiếp theo khi đủ điều kiện; đổi dấu hoặc hết hạn thì bỏ setup. Mốc V₂ đầu vẫn lấy ở nến đổi dấu. Bộ lọc thử nghiệm chưa chứng minh cải thiện ổn định.</p>
    <p>TP bằng mốc kế tiếp cùng màu, cùng pha SPY V chỉ khi đã giữ đủ 4 nến M15 hoàn chỉnh tính từ giá mở vào lệnh (60 phút). Thoát ở mở nến sau khi mốc được xác nhận.</p>
    <p><strong>Giữ trend khỏe khi có mốc V₂ (thử):</strong> khi đã đủ 4 M15 và có mốc TP, tiếp tục giữ nếu SPY V thân nến còn cùng dấu lệnh, giá đóng ở phía thuận WLR-8 và độ dốc thuận hướng ≥0,02 ATR14/nến. SELL: SPY V âm, giá dưới WLR-8, WLR-8 dốc xuống; BUY ngược lại. Sau khi hoãn TP, kiểm tra mỗi nến đóng; trend yếu thì thoát ở mở nến sau, không cần mốc mới. SPY V đổi dấu vẫn ưu tiên thoát. Dùng WLR-8 riêng như bộ lọc đầu vào, không dùng WLR dài trên chart hay điểm H1 biết trong tương lai. Thiếu dữ liệu không được xem là trend khỏe.</p>
    <p>Nếu mốc TP đến trước 4 nến, bỏ chốt bằng mốc này và các mốc cùng pha về sau; giữ đến khi SPY V thân nến đổi dấu trên nến đóng rồi thoát ở mở nến kế tiếp. Đổi dấu trước khi có mốc TP cũng thoát theo quy tắc này, kể cả chưa đủ 4 nến. Live chưa đóng không kích hoạt thoát.</p>
    <p>Mỗi lần giữ một lệnh. Giá chạm hoặc vượt mốc ĐẢO V₂ đầu không đóng lệnh. Chỉ hai tín hiệu trên mới cho thoát; tín hiệu được xác nhận khi nến đóng và khớp ở mở nến kế tiếp.</p>
    <p>Lệnh chưa đóng, tín hiệu thiếu mốc đầu và khoảng dữ liệu gián đoạn được đếm riêng. Lãi/lỗ theo PnL sau chi phí; thoát theo tín hiệu vẫn có thể lỗ. Điểm giá tính cho 1 đơn vị; PF và sụt giảm tính theo điểm ròng của các lệnh đã đóng.</p></div>`;
  host.append(panel);
  const close=panel.querySelector('header button'),cost=panel.querySelector('input[type=number]'),trendToggle=panel.querySelector('[data-v2-trend]'),holdToggle=panel.querySelector('[data-v2-hold]'),results=panel.querySelector('[data-v2-results]');
  let context=null,key='';
  function hide(){panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}
  close.onclick=hide;panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
  button.onclick=()=>{if(!panel.hidden){hide();return;}panel.hidden=false;button.setAttribute('aria-expanded','true');key='';requestContext?.();render();close.focus();};
  cost.oninput=()=>{key='';render();};trendToggle.onchange=()=>{key='';render();};holdToggle.onchange=()=>{key='';render();};
  function render(){
    if(panel.hidden)return;
    if(!context?.active){results.textContent=context?'Chọn SPYUSDT M15 để xem thống kê.':'Đang chờ dữ liệu chart…';panel.querySelector('[data-v2-period]').textContent='';panel.querySelector('[data-v2-source]').textContent='';key='';return;}
    if(context.waitingH1){results.textContent='Đang chờ hộp H1 để thống kê đúng chế độ mượt H1. Có thể tắt mượt H1 để xem bản gốc.';panel.querySelector('[data-v2-period]').textContent='';panel.querySelector('[data-v2-source]').textContent=context.source;key='';return;}
    const {bars,bodyRows,points,now,source}=context,fee=Number(cost.value||0);
    if(!Number.isFinite(fee)||fee<0||fee>10000){results.textContent='Chi phí phải từ 0 đến 10.000 bps.';return;}
    const closed=bars.filter(b=>b.t+STEP<=now),signs=new Map(bodyRows.map(r=>[r.t,r.adjusted])),live=bars.findLast(b=>b.t<=now&&b.t+STEP>now);
    if(!closed.length){results.textContent='Đang chờ nến đóng từ dữ liệu chart…';panel.querySelector('[data-v2-period]').textContent='';panel.querySelector('[data-v2-source]').textContent=source;key='';return;}
    const next=JSON.stringify([source,fee,trendToggle.checked,holdToggle.checked,closed.map(b=>[b.t,b.o,b.h,b.l,b.c,b.sourceComplete,signs.get(b.t)]),points.filter(p=>!p.preview).map(p=>[p.time,p.value,p.direction,p.knownAt]),live?[live.t,live.o]:null]);
    if(next===key)return;key=next;
    const report=backtestReversalTrades({bars,bodyRows,points,now,roundTripBps:fee,trendFilter:trendToggle.checked,holdStrongTrend:holdToggle.checked});
    const baseline=holdToggle.checked?backtestReversalTrades({bars,bodyRows,points,now,roundTripBps:fee,trendFilter:trendToggle.checked}):report;
    panel.querySelector('[data-v2-mode]').textContent=(trendToggle.checked?'Lọc đầu vào trend khỏe. ':'Đầu vào theo quy tắc gốc. ')+(holdToggle.checked?`Giữ trend: ${report.summary.count} lệnh / ${signed(report.summary.netPoints)} điểm · Thoát V₂ cũ cùng đầu vào: ${baseline.summary.count} lệnh / ${signed(baseline.summary.netPoints)} điểm. Cùng dữ liệu và chi phí; kết quả lịch sử chưa xác thực live.`:'Giữ trend: TẮT · Thoát V₂ theo quy tắc cũ.');
    const s=report.summary;
    panel.querySelector('[data-v2-period]').textContent=`${date(report.from)} → ${date(report.to)} · ${report.closedBars} nến đóng · giờ Việt Nam`;
    panel.querySelector('[data-v2-source]').textContent=source+(fee===0?' · Chưa tính phí/trượt giá':' · Đã trừ '+number(fee,1)+' bps khứ hồi');
    const color=v=>v>0?'v2-positive':v<0?'v2-negative':'';
    const groups=[['Tất cả',s],['BUY',report.buy],['SELL',report.sell]];
    const open=report.open?`${report.open.direction>0?'BUY':'SELL'} đang mở: vào ${number(report.open.entry)} · Không SL · Đã giữ ${Math.max(0,Math.floor((Math.min(now,report.to??now)-report.open.entryTime)/STEP))} M15${report.open.tpDue?(report.open.pendingReason==='SPY_FLIP'?' · Chờ mở nến thoát đổi dấu':' · Chờ mở nến thoát TP'):report.open.holdingTrend&&!report.open.tpExpired?' · Đã có mốc V₂, giữ theo trend':report.open.waitForFlip?' · TP đến sớm, chờ SPY V đổi dấu':report.open.tpExpired?' · Thiếu pha liên tục, chờ SPY V đổi dấu':''}`:'Không có lệnh đang mở';
    results.innerHTML=`<div class="v2-tiles"><div><small>LỆNH ĐÃ ĐÓNG</small><strong>${s.count}</strong></div><div><small>TỶ LỆ LÃI</small><strong>${s.winRate===null?'—':number(s.winRate,1)+'%'}</strong></div><div><small>ĐIỂM RÒNG</small><strong class="${color(s.netPoints)}">${signed(s.netPoints)}</strong></div><div><small>PF THEO ĐIỂM</small><strong>${number(s.profitFactor)}</strong></div></div>
      <div class="v2-scroll"><table><thead><tr><th>Nhóm</th><th>Lệnh</th><th>Lãi %</th><th>Điểm ròng</th></tr></thead><tbody>${groups.map(([label,g])=>`<tr><td>${label}</td><td>${g.count}</td><td>${number(g.winRate,1)}</td><td class="${color(g.netPoints)}">${signed(g.netPoints)}</td></tr>`).join('')}</tbody></table></div>
      <p>Lãi ${s.wins} · Lỗ ${s.losses} · Hòa ${s.flat} | TP ≥4 M15 ${s.tp} · Thoát đổi dấu ${s.flip}</p>
      <p>Điểm/lệnh ${number(s.meanPoints)} · Sụt giảm tối đa ${number(s.drawdownPoints)} điểm · Giữ TB ${number(s.meanBars,1)} M15</p>
      <p>${open}${report.pending?' · 1 tín hiệu chờ vào ở nến sau':report.watching?' · Chờ xác nhận trend khỏe':''}</p>
      <p>Đổi dấu ${report.signals} · Trong phiên ${report.inSessionSignals} · Ngoài phiên ${report.skipped.outsideSession} · Bỏ thiếu mốc đầu ${report.skipped.noFirstLine} · Đang có lệnh ${report.skipped.overlap} · Gián đoạn ${report.censored.length}${trendToggle.checked?' · Đã xác nhận trend '+report.skipped.confirmedTrend+' · Bỏ trend yếu/hết hạn '+report.skipped.weakTrend:''}</p>
      <details><summary>12 lệnh đóng gần nhất</summary><div class="v2-scroll"><table><thead><tr><th>Vào · hướng</th><th>Giá vào</th><th>Mốc V₂ đầu</th><th>Giờ thoát</th><th>Thoát</th><th>Lý do</th><th>Điểm ròng</th></tr></thead><tbody>${report.trades.slice(-12).reverse().map(t=>`<tr><td>${date(t.entryTime)} · ${t.direction>0?'BUY':'SELL'}</td><td>${number(t.entry)}</td><td>${number(t.firstLine)}</td><td>${date(t.exitTime)}</td><td>${number(t.exit)}</td><td>${t.reason==='TP_SIGNAL'?(t.deferredTpTime!==null?'Trend yếu sau mốc V₂':'TP ≥4 M15'):'Đổi dấu SPY V'}</td><td class="${color(t.netPoints)}">${signed(t.netPoints)}</td></tr>`).join('')}</tbody></table></div></details>`;
    panel.dataset.holdStrongTrend=String(holdToggle.checked);panel.dataset.trendFilter=String(trendToggle.checked);panel.dataset.closed=String(s.count);panel.dataset.winRate=String(s.winRate??'');panel.dataset.netPoints=String(s.netPoints);
  }
  return {isOpen:()=>!panel.hidden,setContext(next){context=next;render();}};
}
