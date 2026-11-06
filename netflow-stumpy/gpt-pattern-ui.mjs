import {CHAT_MEMORY_KEY,updateMemory,exportChatSample} from './chat-pattern-export.mjs?v=20261106-chat1';
export function mountGptPattern({chart,getState}){
  const host=document.getElementById('chart'),card=document.querySelector('.chart-card');if(!host||document.getElementById('gpt-pattern-button'))return;
  const style=document.createElement('style');style.textContent=`
    #gpt-pattern-button{position:absolute;top:8px;left:8px;z-index:25;background:#142b43;color:#d9f8ed;border:1px solid #3a786e;border-radius:7px;padding:7px 10px;font-size:12px;cursor:pointer;touch-action:manipulation}
    #gpt-pattern-dialog{width:min(680px,calc(100vw - 24px));max-height:85dvh;box-sizing:border-box;background:#0e1b2c;color:#e6edf7;border:1px solid #36516d;border-radius:12px;padding:16px;overflow:auto;z-index:1000}
    #gpt-pattern-dialog::backdrop{background:#0009}#gpt-pattern-dialog h3{margin:0 0 12px;font-size:17px}#gpt-pattern-dialog p{font-size:13px;line-height:1.6}
    #gpt-pattern-dialog .gpt-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}#gpt-pattern-dialog button{min-height:38px;border:1px solid #42617a;border-radius:6px;padding:7px 12px;background:#19324a;color:#eef7ff;cursor:pointer}
    #gpt-pattern-meta,#gpt-pattern-status{white-space:pre-wrap;color:#a9c5dd;font-size:13px;line-height:1.6}#gpt-pattern-text{box-sizing:border-box;width:100%;height:180px;background:#091320;color:#dbeafe;border:1px solid #42617a;border-radius:6px;padding:10px;font:12px/1.5 monospace;resize:vertical}
  `;document.head.append(style);
  const button=document.createElement('button');button.id='gpt-pattern-button';button.type='button';button.textContent='Gửi mẫu vào chat';host.append(button);
  const dialog=document.createElement('dialog');dialog.id='gpt-pattern-dialog';dialog.setAttribute('aria-labelledby','gpt-pattern-title');
  dialog.innerHTML='<h3 id="gpt-pattern-title">Phân tích trong cuộc chat này</h3><p>Bấm Sao chép mẫu, quay lại cuộc chat hoặc nhóm ChatGPT anh đang dùng và dán vào ô nhắn tin. Dữ liệu được phân tích khi anh gửi tin nhắn.</p><div class="gpt-row"><button id="gpt-pattern-copy" type="button">Sao chép mẫu</button><button id="gpt-pattern-run" type="button">Cập nhật vùng đang xem</button><button id="gpt-pattern-close" type="button">Đóng</button></div><p id="gpt-pattern-meta"></p><p id="gpt-pattern-status" role="status" aria-live="polite"></p><textarea id="gpt-pattern-text" readonly aria-label="Dữ liệu mẫu để dán vào chat"></textarea><p>Không cần khóa API. Tối đa 3 mẫu M15 mới/ngày New York, gộp SPY/QQQ trên trình duyệt này; mẫu cùng pivot được cập nhật lại. Bộ nhớ 90 ngày nằm trên trình duyệt, cần gửi kèm vào chat để đối chiếu. Xóa dữ liệu trình duyệt sẽ mất bộ nhớ và bộ đếm; thiết bị khác chưa đồng bộ. Chart không tự gửi tin hoặc tự chọn model trong nhóm chat.</p>';
  card.append(dialog);
  const el=id=>dialog.querySelector('#gpt-pattern-'+id),field=el('text'),status=el('status'),meta=el('meta'),copy=el('copy');let lastSettled='';
  function read(){const raw=localStorage.getItem(CHAT_MEMORY_KEY);if(!raw)return null;const data=JSON.parse(raw);if(data?.version!==1||!Array.isArray(data.samples))throw Error('Bộ nhớ mẫu không hợp lệ.');return data;}
  function createLocked(){
    field.value='';copy.disabled=true;meta.textContent='';
    try {
      const state=getState();if(state.interval!=='15m')throw Error('Chuyển chart sang M15 để lấy mẫu.');
      const visible=chart.timeScale().getVisibleRange();if(!visible||!Number.isFinite(Number(visible.from))||!Number.isFinite(Number(visible.to)))throw Error('Chart chưa có vùng nến hiển thị.');
      const result=exportChatSample({bars:(state.bars||[]).slice(-2500),symbol:state.symbol,live:state.live,visible:{from:Number(visible.from),to:Number(visible.to)},memory:read()});
      localStorage.setItem(CHAT_MEMORY_KEY,JSON.stringify(result.memory));field.value=result.text;copy.disabled=false;
      const fmt=t=>new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
      meta.textContent=`${state.symbol} · M15 · ${result.current.sequence}\n${fmt(result.current.firstTime)} → ${fmt(result.current.asOf)} · chỉ nến đóng\nĐã lấy ${result.count}/3 mẫu hôm nay NY · ${result.memory.samples.filter(s=>s.outcome).length} mẫu đã có kết quả 8 nến.`;
      status.textContent='Gói dữ liệu đã sẵn sàng. Sao chép rồi dán vào cuộc chat này; tôi sẽ phân tích khi anh gửi.';
    }catch(error){status.textContent=error.name==='SecurityError'||error.name==='QuotaExceededError'?'Không lưu được bộ nhớ trình duyệt nên chưa lấy mẫu mới. Hãy cho phép lưu dữ liệu trang để giữ giới hạn 3 mẫu/ngày.':error.message;}
  }
  async function create(){
    if(!navigator.locks?.request){status.textContent='Trình duyệt chưa hỗ trợ khóa bộ nhớ giữa các tab. Hãy cập nhật trình duyệt để giữ giới hạn 3 mẫu/ngày.';return;}
    await navigator.locks.request('dvp-chat-pattern-daily-limit',createLocked);
  }
  copy.onclick=async()=>{if(!field.value)return;try{await navigator.clipboard.writeText(field.value);status.textContent='Đã sao chép. Quay lại cuộc chat này, dán và gửi mẫu.';}catch{field.focus();field.select();status.textContent='Trình duyệt chưa cho sao chép tự động. Dữ liệu đã được chọn: nhấn Ctrl+C, hoặc chạm giữ và chọn Sao chép.';}};
  button.onclick=e=>{e.stopPropagation();if(!dialog.open)dialog.showModal();create();};el('run').onclick=create;el('close').onclick=()=>dialog.close();
  for(const event of ['pointerdown','dblclick','touchstart'])button.addEventListener(event,e=>e.stopPropagation());
  setInterval(()=>{
    if(document.hidden)return;const s=getState();if(s.interval!=='15m'||!s.bars?.length)return;
    const key=s.symbol+':'+s.bars.at(-1).t;if(key===lastSettled)return;
    try{const saved=read();if(!saved)return;const next=updateMemory(saved,s.bars.slice(-2500),s.symbol);if(JSON.stringify(next)!==JSON.stringify(saved))localStorage.setItem(CHAT_MEMORY_KEY,JSON.stringify(next));lastSettled=key;}catch{/* Keep chart operational if storage is unavailable. */}
  },20000);
}
