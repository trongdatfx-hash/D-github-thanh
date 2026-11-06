import {sp500AlertState,volatilityQuoteState} from './volatility-quotes.mjs?v=20261106-sp500-alert1';
export function createVolatilityQuotes(panel){
 if(!panel)return;
 const section=document.createElement('section');section.className='volatility-quotes';section.setAttribute('aria-label','VIX và VIX9D · Yahoo Finance · báo giá trễ');
 const cards=new Map();
 for(const name of ['VIX','VIX9D']){
  const card=document.createElement('article'),heading=document.createElement('a'),value=document.createElement('strong'),change=document.createElement('span'),status=document.createElement('small'),stamp=document.createElement('small');
  heading.textContent=name;heading.href='https://finance.yahoo.com/quote/%5E'+name+'/';heading.target='_blank';heading.rel='noopener';
  value.textContent='—';status.textContent='WAIT';card.append(heading,value,change,status,stamp);section.append(card);cards.set(name,{card,value,change,status,stamp});
 }
 const note=document.createElement('p');note.textContent='Yahoo Finance · nguồn trễ danh nghĩa 15 phút. Giờ báo giá bên dưới là giờ Việt Nam; tác vụ cập nhật định kỳ có thể chạy chậm. Không phải LIVE.';section.append(note);
 const button=document.createElement('button');button.type='button';button.textContent='Cập nhật VIX / VIX9D / SP500';section.append(button);panel.querySelector('.market-watchlist-body')?.prepend(section);
 const sp500=document.createElement('button');sp500.type='button';sp500.id='chart-sp500-quote';sp500.setAttribute('aria-live','polite');sp500.setAttribute('aria-label','SP500 · phần trăm thay đổi so với phiên trước');sp500.textContent='SP500 — · WAIT';
 const live=document.getElementById('live-indicator');if(live)live.insertAdjacentElement('afterend',sp500);else document.querySelector('.chart-actions')?.append(sp500);
 let snapshot=null,failed=false,pending=false;
 const format=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'});
 function render(){
  for(const [name,c] of cards){const state=volatilityQuoteState(snapshot?.quotes?.[name],Date.now(),failed);c.card.dataset.state=state.status.startsWith('DELAYED')?'delayed':state.price===null?'wait':'stale';c.value.textContent=state.price===null?'—':state.price.toFixed(2);c.change.textContent=state.changePct===null?'':`${state.changePct>=0?'+':''}${state.changePct.toFixed(2)}% so phiên trước`;c.status.textContent=state.status;c.stamp.textContent=state.asOf===null?'Chưa có báo giá hợp lệ':`Giờ dữ liệu ${format.format(state.asOf)} · cách hiện tại ${Math.floor(state.lagMinutes)} phút`;}
  const state=sp500AlertState(snapshot?.quotes?.SP500,Date.now(),failed),move=state.changePct,signed=Number.isFinite(move)?`${move>=0?'+':''}${move.toFixed(2)}%`:null;
  sp500.textContent=signed?`SP500 ${signed}${state.volatile?' · TT BIẾN ĐỘNG · GIẢM VOLUME':state.status==='DỮ LIỆU CŨ'?' · CŨ':''}`:'SP500 — · WAIT';
  sp500.dataset.warning=String(state.volatile);sp500.dataset.direction=Number.isFinite(move)?move>0?'up':move<0?'down':'flat':'wait';
  sp500.title=state.asOf===null?'Chưa có dữ liệu SP500 hợp lệ':`${state.status} · ${format.format(state.asOf)} · thay đổi so với phiên trước${state.volatile?' · |%| > 1,3%: giảm Volume giao dịch':''}`;
 }
 async function refresh(){if(pending)return;pending=true;button.disabled=true;sp500.disabled=true;try{const response=await fetch(new URL('./data/volatility.json?v='+Date.now(),import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('snapshot unavailable');const data=await response.json();if(data.version!==1||!data.quotes)throw Error('invalid snapshot');for(const name of ['VIX','VIX9D','SP500']){const old=snapshot?.quotes?.[name];if(old?.asOf>data.quotes[name]?.asOf)data.quotes[name]=old;}snapshot=data;failed=false;}catch{failed=true;}finally{pending=false;button.disabled=false;sp500.disabled=false;render();}}
 button.onclick=sp500.onclick=refresh;
 panel.addEventListener('toggle',()=>{if(panel.open)void refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('focus',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{if(!document.hidden)void refresh();},60000);
 setInterval(()=>{if(!document.hidden)render();},15000);
 void refresh();
}
