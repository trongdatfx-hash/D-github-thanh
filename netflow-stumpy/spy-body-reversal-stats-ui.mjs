import {backtestReversalTrades} from './spy-body-reversal-trades.mjs?v=20261119-v2-trades2';

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
      #dao-v2-stats input{width:65px;padding:4px 6px;background:#101f32;color:#f0f7ff;border:1px solid #63819f;border-radius:4px;font:inherit}
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
  const button=document.createElement('button');button.id='dao-v2-stats-toggle';button.type='button';button.textContent='TK V₂';button.title='Thống kê đổi dấu SPY V: SL mốc đầu, TP mốc kế tiếp cùng pha';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','dao-v2-stats');actions.append(button);
  const panel=document.createElement('section');panel.id='dao-v2-stats';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Thống kê ĐẢO V₂');
  panel.innerHTML=`<header><h3>Thống kê ĐẢO V₂</h3><button type="button" aria-label="Đóng thống kê">✕</button></header>
    <p data-v2-period></p><p data-v2-source></p>
    <label class="v2-cost">Chi phí khứ hồi <input type="number" min="0" max="10000" step="0.5" value="0" aria-label="Chi phí khứ hồi bps"> bps <small>1 bps = 0,01%</small></label>
    <div data-v2-results></div>
    <div class="v2-rule"><strong>Quy tắc mô phỏng</strong>
    <p>Vào BUY/SELL ở mở nến sau lần SPY V thân nến đổi dấu, khi nến tín hiệu có mốc ĐẢO V₂ làm SL hợp lệ. SL cố định tại mốc đầu.</p>
    <p>TP khi có mốc kế tiếp trên một nến đóng khác, vẫn cùng màu và cùng pha SPY V; thoát ở mở nến sau. Cập nhật live không tạo thêm mốc TP.</p>
    <p>Nếu đổi pha trước TP, lệnh cũ chỉ còn SL; không lấy mốc của pha mới làm TP. Mỗi lần giữ một lệnh. SL chạm trong nến được xử lý trước TP chỉ biết khi nến đóng; gap qua SL khớp ở giá mở.</p>
    <p>Lệnh chưa đóng, tín hiệu thiếu SL và khoảng dữ liệu gián đoạn được đếm riêng. Lãi/lỗ theo PnL sau chi phí; thoát TP theo tín hiệu vẫn có thể lỗ. Điểm giá tính cho 1 đơn vị; R theo khoảng vào–SL ban đầu. Tổng R, PF và sụt giảm dùng rủi ro ban đầu 1R/lệnh.</p></div>`;
  host.append(panel);
  const close=panel.querySelector('header button'),cost=panel.querySelector('input'),results=panel.querySelector('[data-v2-results]');
  let context=null,key='';
  function hide(){panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}
  close.onclick=hide;panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
  button.onclick=()=>{if(!panel.hidden){hide();return;}panel.hidden=false;button.setAttribute('aria-expanded','true');key='';requestContext?.();render();close.focus();};
  cost.oninput=()=>{key='';render();};
  function render(){
    if(panel.hidden)return;
    if(!context?.active){results.textContent=context?'Chọn SPYUSDT M15 để xem thống kê.':'Đang chờ dữ liệu chart…';panel.querySelector('[data-v2-period]').textContent='';panel.querySelector('[data-v2-source]').textContent='';key='';return;}
    if(context.waitingH1){results.textContent='Đang chờ hộp H1 để thống kê đúng chế độ mượt H1. Có thể tắt mượt H1 để xem bản gốc.';panel.querySelector('[data-v2-period]').textContent='';panel.querySelector('[data-v2-source]').textContent=context.source;key='';return;}
    const {bars,bodyRows,points,now,source}=context,fee=Number(cost.value||0);
    if(!Number.isFinite(fee)||fee<0||fee>10000){results.textContent='Chi phí phải từ 0 đến 10.000 bps.';return;}
    const closed=bars.filter(b=>b.t+STEP<=now),signs=new Map(bodyRows.map(r=>[r.t,r.adjusted])),live=bars.findLast(b=>b.t<=now&&b.t+STEP>now);
    if(!closed.length){results.textContent='Đang chờ nến đóng từ dữ liệu chart…';panel.querySelector('[data-v2-period]').textContent='';panel.querySelector('[data-v2-source]').textContent=source;key='';return;}
    const next=JSON.stringify([source,fee,closed.map(b=>[b.t,b.o,b.h,b.l,b.c,b.sourceComplete,signs.get(b.t)]),points.filter(p=>!p.preview).map(p=>[p.time,p.value,p.direction,p.knownAt]),live?[live.t,live.o]:null]);
    if(next===key)return;key=next;
    const report=backtestReversalTrades({bars,bodyRows,points,now,roundTripBps:fee});
    const s=report.summary;
    panel.querySelector('[data-v2-period]').textContent=`${date(report.from)} → ${date(report.to)} · ${report.closedBars} nến đóng · giờ Việt Nam`;
    panel.querySelector('[data-v2-source]').textContent=source+(fee===0?' · Chưa tính phí/trượt giá':' · Đã trừ '+number(fee,1)+' bps khứ hồi');
    const color=v=>v>0?'v2-positive':v<0?'v2-negative':'';
    const groups=[['Tất cả',s],['BUY',report.buy],['SELL',report.sell]];
    const open=report.open?`${report.open.direction>0?'BUY':'SELL'} đang mở: vào ${number(report.open.entry)}, SL ${number(report.open.stop)}${report.open.tpExpired?' · Đã đổi pha, còn SL':report.open.tpDue?' · Chờ mở nến để thoát TP':''}`:'Không có lệnh đang mở';
    results.innerHTML=`<div class="v2-tiles"><div><small>LỆNH ĐÃ ĐÓNG</small><strong>${s.count}</strong></div><div><small>TỶ LỆ LÃI</small><strong>${s.winRate===null?'—':number(s.winRate,1)+'%'}</strong></div><div><small>TỔNG R RÒNG</small><strong class="${color(s.netR)}">${signed(s.netR)}</strong></div><div><small>PF THEO R</small><strong>${number(s.profitFactor)}</strong></div></div>
      <div class="v2-scroll"><table><thead><tr><th>Nhóm</th><th>Lệnh</th><th>Lãi %</th><th>Điểm ròng</th><th>R ròng</th></tr></thead><tbody>${groups.map(([label,g])=>`<tr><td>${label}</td><td>${g.count}</td><td>${number(g.winRate,1)}</td><td class="${color(g.netPoints)}">${signed(g.netPoints)}</td><td class="${color(g.netR)}">${signed(g.netR)}</td></tr>`).join('')}</tbody></table></div>
      <p>Lãi ${s.wins} · Lỗ ${s.losses} · Hòa ${s.flat} | TP tín hiệu ${s.tp} · SL ${s.sl}</p>
      <p>R/lệnh ${number(s.meanR)} · Sụt giảm tối đa ${number(s.drawdownR)} R · Giữ TB ${number(s.meanBars,1)} M15</p>
      <p>${open}${report.pending?' · 1 tín hiệu chờ vào ở nến sau':''}</p>
      <p>Đổi dấu ${report.signals} · Bỏ thiếu mốc đầu ${report.skipped.noFirstLine} · SL sai phía ${report.skipped.invalidStop} · Đang có lệnh ${report.skipped.overlap} · Gián đoạn ${report.censored.length}</p>
      <details><summary>12 lệnh đóng gần nhất</summary><div class="v2-scroll"><table><thead><tr><th>Vào · hướng</th><th>Giá vào</th><th>SL đầu</th><th>Thoát</th><th>Lý do</th><th>R ròng</th></tr></thead><tbody>${report.trades.slice(-12).reverse().map(t=>`<tr><td>${date(t.entryTime)} · ${t.direction>0?'BUY':'SELL'}</td><td>${number(t.entry)}</td><td>${number(t.stop)}</td><td>${number(t.exit)}</td><td>${t.reason==='TP_SIGNAL'?'TP tín hiệu':t.reason==='SL_GAP'?'SL gap':'SL'}</td><td class="${color(t.netR)}">${signed(t.netR)}</td></tr>`).join('')}</tbody></table></div></details>`;
    panel.dataset.closed=String(s.count);panel.dataset.winRate=String(s.winRate??'');panel.dataset.netR=String(s.netR);panel.dataset.netPoints=String(s.netPoints);
  }
  return {isOpen:()=>!panel.hidden,setContext(next){context=next;render();}};
}
