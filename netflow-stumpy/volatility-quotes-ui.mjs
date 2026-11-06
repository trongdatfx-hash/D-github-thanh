import {volatilityQuoteState} from './volatility-quotes.mjs?v=20261106-session-open1';
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
 let snapshot=null,failed=false,pending=false;
 const format=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'});
 function render(){
  for(const [name,c] of cards){const state=volatilityQuoteState(snapshot?.quotes?.[name],Date.now(),failed);c.card.dataset.state=state.status.startsWith('DELAYED')?'delayed':state.price===null?'wait':'stale';c.value.textContent=state.price===null?'—':state.price.toFixed(2);c.change.textContent=state.changePct===null?'':`${state.changePct>=0?'+':''}${state.changePct.toFixed(2)}% so phiên trước`;c.status.textContent=state.status;c.stamp.textContent=state.asOf===null?'Chưa có báo giá hợp lệ':`Giờ dữ liệu ${format.format(state.asOf)} · cách hiện tại ${Math.floor(state.lagMinutes)} phút`;}
 }
 async function refresh(){if(pending)return;pending=true;button.disabled=true;try{const response=await fetch(new URL('./data/volatility.json?v='+Date.now(),import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('snapshot unavailable');const data=await response.json();if(data.version!==1||!data.quotes)throw Error('invalid snapshot');for(const name of ['VIX','VIX9D']){const old=snapshot?.quotes?.[name];if(old?.asOf>data.quotes[name]?.asOf)data.quotes[name]=old;}snapshot=data;failed=false;}catch{failed=true;}finally{pending=false;button.disabled=false;render();}}
 button.onclick=refresh;
 panel.addEventListener('toggle',()=>{if(panel.open)void refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.addEventListener('focus',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{if(!document.hidden)void refresh();},60000);
 setInterval(()=>{if(!document.hidden)render();},15000);
 void refresh();
}
