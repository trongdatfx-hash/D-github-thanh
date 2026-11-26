import {parseGex,drawGex} from './gex-profile.mjs?v=20261126-gex1';
import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';
const KEY='netflow:gex:v1';
export function mountGex({chart,price,context}){
  const cvd=document.getElementById('cvd-spectrum-toggle').closest('label');
  const label=document.createElement('label');
  label.innerHTML='<input id="gex-spectrum-toggle" type="checkbox">Phổ GEX';cvd.after(label);
  const toggle=label.querySelector('input'),settings=document.createElement('details');settings.id='gex-settings';
  settings.innerHTML='<summary>GEX · Nạp data</summary><div class="gex-panel"><label>Dán chuỗi GEX S:…|L:…|P:…<textarea id="gex-data" rows="5" placeholder="S:18.32|L:7579,ZG,ZERO GAMMA|P:7568,-2.2,-1;7668,10,1"></textarea></label><label>Hoặc mở file dữ liệu <input id="gex-file" type="file" accept=".txt,.csv,text/plain,text/csv"></label><label>Thang strike <select id="gex-scale"><option value="10">ES → SPY (÷10)</option><option value="1">Giá cùng thang chart (÷1)</option></select></label><label>Basis (điểm nguồn) <input id="gex-basis" type="number" step="any" value="0"></label><small>Giá chart = (strike − basis) ÷ thang. Khi nạp chuỗi, basis lấy từ S:. Có thể sửa để khớp SPYUSDT. Đây là snapshot nhập tay.</small><button id="gex-load" type="button">Nạp GEX</button><button id="gex-clear" type="button">Xóa GEX</button><span id="gex-status" role="status">Chưa nạp dữ liệu GEX</span></div>';
  const panel=settings.querySelector('.gex-panel');panel.style.cssText='position:fixed;top:85px;right:12px;z-index:210;box-sizing:border-box;width:min(440px,92vw);max-height:75vh;overflow:auto;display:flex;flex-direction:column;gap:10px;background:#101e30;border:1px solid #36516e;border-radius:8px;padding:12px;color:#d5e5f5';
  panel.querySelector('textarea').style.cssText='box-sizing:border-box;width:100%;resize:vertical';
  document.querySelector('.chart-actions').append(settings);
  const $=id=>document.getElementById(id),status=$('gex-status');let profile=null,loadedAt=null,appliedText='';
  const primitive=new SpectrumPrimitive(scope=>{
    const state=context();if(!toggle.checked||!profile||state.symbol!=='SPYUSDT'||!Number.isFinite(state.anchor)||$('gex-basis').value==='')return;
    drawGex({...scope,profile,basis:Number($('gex-basis').value),scale:Number($('gex-scale').value),anchor:chart.timeScale().timeToCoordinate(state.anchor/1000),priceToY:v=>price.priceToCoordinate(v)});
  });price.attachPrimitive(primitive);
  function save(){try{localStorage.setItem(KEY,JSON.stringify({text:appliedText,basis:$('gex-basis').value,scale:$('gex-scale').value,enabled:toggle.checked,loadedAt}));}catch{status.textContent+=' · Không lưu được trên trình duyệt';}}
  function update(){
    const symbol=context().symbol;
    status.textContent=profile?`${profile.bins.length} mức · ${profile.zeroGamma===null?'không có Zero Gamma':'có Zero Gamma'} · nạp ${new Date(loadedAt).toLocaleString('vi-VN')}${symbol!=='SPYUSDT'?' · chỉ vẽ trên SPYUSDT':''}`:'Chưa nạp dữ liệu GEX';
    primitive.redraw();
  }
  $('gex-load').onclick=()=>{
    try{const next=parseGex($('gex-data').value);profile=next;appliedText=$('gex-data').value;$('gex-basis').value=String(next.spread);loadedAt=Date.now();toggle.checked=true;update();save();}
    catch(e){status.textContent=e.message+' Dữ liệu đang vẽ được giữ nguyên.';}
  };
  $('gex-file').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>1000000){status.textContent='File quá lớn (tối đa 1 MB).';return;}try{$('gex-data').value=await file.text();status.textContent='Đã đọc file · nhấn Nạp GEX để áp dụng';}catch{status.textContent='Không đọc được file.';}};
  $('gex-clear').onclick=()=>{profile=null;loadedAt=null;appliedText='';$('gex-data').value='';toggle.checked=false;update();save();};
  toggle.addEventListener('change',()=>{update();save();});
  for(const id of ['gex-basis','gex-scale'])$(id).addEventListener('change',()=>{if($('gex-basis').value===''||!Number.isFinite(Number($('gex-basis').value))){status.textContent='Basis không hợp lệ';return;}update();save();});
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.text){profile=parseGex(saved.text);appliedText=saved.text;$('gex-data').value=saved.text;$('gex-basis').value=String(Number.isFinite(Number(saved.basis))?Number(saved.basis):profile.spread);$('gex-scale').value=saved.scale==='1'?'1':'10';toggle.checked=Boolean(saved.enabled);loadedAt=saved.loadedAt||Date.now();}}catch{}
  update();return {update};
}
