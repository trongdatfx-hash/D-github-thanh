import {volatilityQuoteState} from './volatility-quotes.mjs?v=20261103-vix-dayoi1';
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
 const button=document.createElement('button');button.type='button';button.textContent='Cập nhật VIX / VIX9D';section.append(button);panel.querySelector('.market-watchlist-body')?.prepend(section);
 // Refresh VIX independently of watchlist/full chart visibility.
 const compact=document.createElement('button');compact.type='button';compact.id='chart-vix-quote';
 compact.textContent='VIX — · WAIT';compact.setAttribute('aria-label','VIX · báo giá trễ · bấm để cập nhật');
 compact.style.cssText='font-size:12px;line-height:1.3;padding:5px 8px;white-space:normal;font-variant-numeric:tabular-nums';
 const live=document.getElementById('live-indicator');
 if(live)live.insertAdjacentElement('afterend',compact);else document.querySelector('.chart-actions')?.append(compact);
 let snapshot=null,failed=false,pending=false;
 const format=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'});
 function render(){for(const [name,c] of cards){const state=volatilityQuoteState(snapshot?.quotes?.[name],Date.now(),failed);c.card.dataset.state=state.status.startsWith('DELAYED')?'delayed':state.price===null?'wait':'stale';c.value.textContent=state.price===null?'—':state.price.toFixed(2);c.change.textContent=state.changePct===null?'':`${state.changePct>=0?'+':''}${state.changePct.toFixed(2)}% so phiên trước`;c.status.textContent=state.status;c.stamp.textContent=state.asOf===null?'Chưa có báo giá hợp lệ':`Giờ dữ liệu ${format.format(state.asOf)} · cách hiện tại ${Math.floor(state.lagMinutes)} phút`;}
 const vix=volatilityQuoteState(snapshot?.quotes?.VIX,Date.now(),failed);
 compact.textContent=vix.price===null?'VIX — · WAIT':`VIX ${vix.price.toFixed(2)} · ${vix.status==='DỮ LIỆU CŨ'?'CŨ':'TRỄ'} ${Math.floor(vix.lagMinutes)}p`;
 compact.title=vix.asOf===null?'Chưa có báo giá VIX hợp lệ · bấm để thử lại':`${vix.status} · giờ dữ liệu ${format.format(vix.asOf)} · Yahoo Finance · bấm để cập nhật`;
 compact.dataset.state=vix.status;compact.style.color=vix.status==='DỮ LIỆU CŨ'?'#f6c85f':'#c9d8e8';
 }
 async function refresh(){if(pending)return;pending=true;button.disabled=true;compact.disabled=true;try{const response=await fetch(new URL('./data/volatility.json?v='+Date.now(),import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('snapshot unavailable');const data=await response.json();if(data.version!==1||!data.quotes)throw Error('invalid snapshot');for(const name of ['VIX','VIX9D']){const old=snapshot?.quotes?.[name];if(old?.asOf>data.quotes[name]?.asOf)data.quotes[name]=old;}snapshot=data;failed=false;}catch{failed=true;}finally{pending=false;button.disabled=false;compact.disabled=false;render();}}
 button.onclick=compact.onclick=refresh;
 panel.addEventListener('toggle',()=>{if(panel.open)void refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('focus',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{if(!document.hidden)void refresh();},60000);
 setInterval(()=>{if(!document.hidden)render();},15000);
 void refresh();
}
