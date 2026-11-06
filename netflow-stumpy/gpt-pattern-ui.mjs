import {pattern,STEP} from './gpt-pattern-core.mjs?v=20261106-gpt1';
import {GPT_PATTERN_ENDPOINT} from './gpt-pattern-config.mjs?v=20261106-gpt1';
const ENDPOINT_KEY='dvp:gpt-pattern:endpoint:v1',TOKEN_KEY='dvp:gpt-pattern:session-token:v1';
const read=(name,key)=>{try{return globalThis[name].getItem(key)||'';}catch{return '';}};
export function mountGptPattern({chart,getState}){
  const card=document.querySelector('.chart-card'),host=document.getElementById('chart');if(!host||document.getElementById('gpt-pattern-button'))return;
  const style=document.createElement('style');style.textContent=`
    #gpt-pattern-button{position:absolute;top:8px;left:8px;z-index:25;background:#142b43;color:#d9f8ed;border:1px solid #3a786e;border-radius:7px;padding:7px 10px;font-size:12px;cursor:pointer;touch-action:manipulation}
    #gpt-pattern-dialog{width:min(620px,calc(100vw - 24px));max-height:85dvh;box-sizing:border-box;background:#0e1b2c;color:#e6edf7;border:1px solid #36516d;border-radius:12px;padding:16px;overflow:auto;z-index:1000}
    #gpt-pattern-dialog::backdrop{background:#0009}#gpt-pattern-dialog h3{margin:0 0 12px;font-size:17px}#gpt-pattern-dialog p{font-size:13px;line-height:1.6}
    #gpt-pattern-dialog .gpt-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}#gpt-pattern-dialog button{min-height:36px;border:1px solid #42617a;border-radius:6px;padding:6px 10px;background:#19324a;color:#eef7ff;cursor:pointer}
    #gpt-pattern-dialog label{display:block;margin:12px 0;font-size:13px}#gpt-pattern-dialog input{display:block;box-sizing:border-box;width:100%;padding:9px;margin:5px 0;background:#091320;color:#fff;border:1px solid #42617a;border-radius:5px}
    #gpt-pattern-answer{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font:14px/1.65 system-ui;margin:12px 0}#gpt-pattern-meta,#gpt-pattern-learning{color:#a9c5dd;font-size:12px}
  `;document.head.append(style);
  const button=document.createElement('button');button.id='gpt-pattern-button';button.type='button';button.textContent='GPT · Mẫu hiện tại';host.append(button);
  const dialog=document.createElement('dialog');dialog.id='gpt-pattern-dialog';dialog.setAttribute('aria-labelledby','gpt-pattern-title');
  // Only fixed markup; API/model text is always assigned with textContent.
  dialog.innerHTML='<h3 id="gpt-pattern-title">GPT · Cấu trúc M15</h3><div class="gpt-row"><button type="button" id="gpt-pattern-run">Phân tích vùng đang xem</button><button type="button" id="gpt-pattern-close">Đóng</button></div><p id="gpt-pattern-meta"></p><p id="gpt-pattern-learning" role="status"></p><div id="gpt-pattern-answer" role="status" aria-live="polite"></div><details id="gpt-pattern-settings"><summary>Kết nối GPT</summary><p>Địa chỉ máy chủ phân tích đã triển khai. Khóa OpenAI chỉ lưu ở máy chủ. Mã truy cập dưới đây lưu trong phiên tab này.</p><label>API URL (HTTPS)<input id="gpt-pattern-endpoint" type="url" placeholder="https://dvp-gpt-pattern-api.…workers.dev" autocomplete="off"></label><label>Mã truy cập máy chủ<input id="gpt-pattern-token" type="password" autocomplete="off"></label><button type="button" id="gpt-pattern-save">Lưu kết nối</button></details><p>Học tối đa 3 mẫu mới/ngày New York, gộp SPY/QQQ. Tự ghi mẫu khi chart M15 đang mở và LIVE. Chỉ học nến đóng; theo dõi kết quả sau 8 nến. Bộ nhớ thống kê không thay đổi trọng số GPT.</p>';
  card.append(dialog);
  const el=id=>dialog.querySelector('#gpt-pattern-'+id),endpoint=el('endpoint'),token=el('token'),answer=el('answer'),meta=el('meta'),learning=el('learning'),run=el('run');
  endpoint.value=read('localStorage',ENDPOINT_KEY)||GPT_PATTERN_ENDPOINT;token.value=read('sessionStorage',TOKEN_KEY);
  let lastObserve='',busy=false,observing=false,retryAt=0;
  function connection(){
    const value=endpoint.value.trim();if(!value||!token.value.trim())throw Error('Chưa kết nối GPT. Điền API URL và mã truy cập máy chủ trong mục Kết nối GPT.');
    const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('API URL cần dùng HTTPS, không chứa khóa hoặc tham số.');
    return {url:url.origin,token:token.value.trim()};
  }
  async function request(path,payload){
    const c=connection(),r=await fetch(c.url+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify(payload),signal:AbortSignal.timeout(65000),credentials:'omit',referrerPolicy:'no-referrer'});
    let data;try{data=await r.json();}catch{throw Error('API không trả về JSON. Kiểm tra địa chỉ máy chủ.');}if(!r.ok)throw Error(data.error||`API HTTP ${r.status}`);return data;
  }
  function payload(visible){
    const state=getState();if(state.interval!=='15m')throw Error('Chuyển chart sang M15 để phân tích cấu trúc.');
    let bars=state.bars??[];
    if(visible){const range=chart.timeScale().getVisibleRange();if(!range||!Number.isFinite(Number(range.from))||!Number.isFinite(Number(range.to)))throw Error('Chưa có vùng nến hiển thị.');bars=bars.filter(b=>b.t>=Number(range.from)*1000&&b.t<=Number(range.to)*1000);}
    bars=bars.slice(-1200).map(({t,o,h,l,c,v,q,buy})=>({t,o,h,l,c,v,q,buy}));
    return {symbol:state.symbol,interval:'15m',bars};
  }
  async function observe(force=false){
    if(observing||document.hidden||Date.now()<retryAt)return;
    const state=getState();if(!state.live||state.interval!=='15m'||!endpoint.value||!token.value)return;
    const p=payload(false),last=p.bars.filter(b=>b.t+STEP<=Date.now()).at(-1),key=p.symbol+':'+last?.t;
    if(!last||!force&&key===lastObserve)return;
    observing=true;
    try{const data=await request('/observe',p);lastObserve=key;learning.textContent=`Bộ nhớ: ${data.reason}${data.count!==undefined?` (${data.count}/3 hôm nay NY)`:''}`;}
    catch(error){retryAt=Date.now()+60000;learning.textContent='Chưa đồng bộ bộ nhớ: '+error.message;}
    finally{observing=false;}
  }
  el('save').onclick=()=>{try{const c=connection();localStorage.setItem(ENDPOINT_KEY,c.url);sessionStorage.setItem(TOKEN_KEY,c.token);lastObserve='';retryAt=0;answer.textContent='Đã lưu kết nối. Bấm Phân tích vùng đang xem để gọi GPT.';void observe(true);}catch(error){answer.textContent=error.message;}};
  async function analyze(){
    if(busy)return;busy=true;run.disabled=true;
    try {
      const p=payload(true),current=pattern(p.bars,{symbol:p.symbol});if(!current)throw Error('Vùng đang xem cần ≥24 nến M15 liên tục và ≥4 pivot đã xác nhận. Hãy thu nhỏ chart để thấy đủ cấu trúc.');
      const fmt=t=>new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
      meta.textContent=`${p.symbol} · M15 · ${current.sequence}\nCấu trúc ${fmt(current.firstTime)} → ${fmt(current.asOf)} (giờ VN). Chỉ nến đóng, tối đa 128 nến cuối trong vùng xem.`;
      connection();answer.textContent='GPT đang phân tích ảnh chụp dữ liệu tại thời điểm bấm…';
      await observe();
      const data=await request('/analyze',p);
      answer.textContent=data.answer;meta.textContent+=`\n${data.model} · N tương tự đã có kết quả: ${data.stats.n} · ${data.stats.status==='WAIT'?'CHƯA ĐỦ MẪU':'Thống kê mô tả'}${data.cached?' · Kết quả đã lưu':''}`;
    } catch(error){answer.textContent=error.name==='TimeoutError'?'Hết thời gian chờ GPT. Hãy thử lại.':error.message;if(!endpoint.value||!token.value)el('settings').open=true;}
    finally{busy=false;run.disabled=false;}
  }
  button.onclick=e=>{e.stopPropagation();if(!dialog.open)dialog.showModal();void analyze();};
  for(const event of ['pointerdown','dblclick','touchstart'])button.addEventListener(event,e=>e.stopPropagation());
  run.onclick=analyze;el('close').onclick=()=>dialog.close();
  setInterval(()=>{void observe();},20000);void observe();
}
