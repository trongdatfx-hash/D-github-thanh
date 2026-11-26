import {parseGex,drawGex} from './gex-profile.mjs?v=20261126-gex3';
import {gexMapping,closedGexReference,gexReferenceTime,gexReferenceInput,projectGexStrike} from './gex-calibration.mjs?v=20261126-gex3';
import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';
const KEY='netflow:gex:v1';
export function mountGex({chart,price,context}){
  const cvd=document.getElementById('cvd-spectrum-toggle').closest('label'),label=document.createElement('label');
  label.innerHTML='<input id="gex-spectrum-toggle" type="checkbox">Phổ GEX';cvd.after(label);
  const toggle=label.querySelector('input'),settings=document.createElement('details');settings.id='gex-settings';
  settings.innerHTML='<summary>GEX · Nạp data</summary><div class="gex-panel"><label class="gex-switch"><input id="gex-panel-toggle" type="checkbox">Hiện phổ GEX</label><label>Dán chuỗi GEX S:…|L:…|P:…<textarea id="gex-data" rows="3" placeholder="S:18.32|L:7579,ZG,ZERO GAMMA|P:7568,-2.2,-1;7668,10,1"></textarea></label><label>Mở file dữ liệu<input id="gex-file" type="file" accept=".txt,.csv,text/plain,text/csv"></label><div class="gex-buttons"><button id="gex-load" type="button">Nạp GEX</button><button id="gex-clear" type="button">Xóa GEX</button></div><fieldset><legend>Hiệu chỉnh strike → SPYUSDT</legend><label>Cách quy đổi<select id="gex-map-mode"><option value="BASIS">S / thang · xấp xỉ như Pine</option><option value="PAIR_RATIO">Cặp giá cùng mốc · giữ tỷ lệ %</option><option value="PAIR_SHIFT">Cặp giá cùng mốc · giữ bước strike</option></select></label><label class="gex-scale-field">Thang nguồn<select id="gex-scale"><option value="10">ES / SPX / CFD · 10 điểm ≈ 1 SPY</option><option value="1">SPY / SPYUSDT · 1 điểm</option></select></label><label class="gex-basis-field">Basis (điểm nguồn)<input id="gex-basis" type="number" step="any" value="0"></label><div class="gex-pair-fields"><label>Mốc chung · giờ Việt Nam<input id="gex-reference-time" type="datetime-local" step="60"></label><button id="gex-chart-reference" type="button">Lấy close SPYUSDT đúng mốc</button><label>Giá nguồn tại mốc trên<input id="gex-source-reference" type="number" step="any" inputmode="decimal" placeholder="ES / SPX / SPY theo nguồn strike"></label><label>Giá SPYUSDT tại cùng mốc<input id="gex-target-reference" type="number" step="any" inputmode="decimal"></label><small>Hai giá phải cùng thời điểm và giá nguồn phải cùng thang với strike. Để trống mốc rồi bấm lấy giá: dùng nến vừa đóng. Nút chỉ lấy close SPYUSDT; bạn điền giá nguồn đúng mốc đó.</small></div><button id="gex-apply-calibration" type="button">Áp dụng hiệu chỉnh</button><small id="gex-map-description"></small></fieldset><span id="gex-status" role="status">Chưa nạp dữ liệu GEX</span></div>';
  const style=document.createElement('style');
  style.textContent='#gex-settings summary{cursor:pointer;white-space:nowrap;font-size:12px}#gex-settings .gex-panel{position:fixed;top:78px;right:8px;z-index:210;box-sizing:border-box;width:min(430px,calc(100vw - 16px));max-height:calc(100dvh - 92px);overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:10px;padding:12px;background:#101e30;color:#e2e8f0;border:1px solid #4a657f;border-radius:9px;box-shadow:0 8px 26px #0008;white-space:normal}#gex-settings label:not(.gex-switch){display:flex;flex-direction:column;align-items:stretch;gap:4px;font-size:12px}#gex-settings .gex-switch{display:flex;gap:7px;align-items:center;min-height:32px}#gex-settings textarea,#gex-settings input:not([type=checkbox]),#gex-settings select{box-sizing:border-box;min-width:0;width:100%;max-width:100%;background:#17283c;color:#e2e8f0;border:1px solid #496178;border-radius:5px;padding:7px;font-size:14px}#gex-settings textarea{resize:vertical}#gex-settings small{font-size:11px;line-height:1.5;white-space:normal;color:#b6c8dd}#gex-settings fieldset{min-width:0;margin:0;padding:9px;border:1px solid #3c536b;display:flex;flex-direction:column;gap:9px}#gex-settings legend{font-size:12px;color:#ffe4a0}#gex-settings .gex-pair-fields{display:flex;flex-direction:column;gap:8px}#gex-settings .gex-buttons{display:flex;gap:8px}#gex-settings button{min-height:36px;white-space:normal}#gex-settings #gex-status{font-size:11px;line-height:1.5;white-space:normal}#gex-settings [hidden]{display:none!important}@media(max-width:600px){#gex-settings .gex-panel{top:66px;max-height:calc(100dvh - 80px);padding:10px;gap:9px}#gex-settings textarea,#gex-settings input:not([type=checkbox]),#gex-settings select{font-size:16px}#gex-settings button{min-height:40px}}';
  settings.append(style);document.querySelector('.chart-actions').append(settings);
  const $=id=>document.getElementById(id),status=$('gex-status'),panelToggle=$('gex-panel-toggle');
  $('gex-scale').value='10';$('gex-basis').value='0';$('gex-map-mode').value='BASIS';
  let profile=null,loadedAt=null,appliedText='',activeMapping=gexMapping({mode:'BASIS',basis:0,scale:10});
  const primitive=new SpectrumPrimitive(scope=>{
    const state=context();if(!toggle.checked||!profile||state.symbol!=='SPYUSDT'||!Number.isFinite(state.anchor))return;
    drawGex({...scope,profile,mapping:activeMapping,anchor:chart.timeScale().timeToCoordinate(state.anchor/1000),priceToY:v=>price.priceToCoordinate(v)});
  });price.attachPrimitive(primitive);
  function save(){try{localStorage.setItem(KEY,JSON.stringify({version:2,text:appliedText,basis:activeMapping.basis??0,scale:String(activeMapping.scale),mapping:activeMapping,enabled:toggle.checked,loadedAt}));}catch{status.textContent+=' · Không lưu được trên trình duyệt';}}
  function fields(){const mode=$('gex-map-mode').value;settings.querySelector('.gex-pair-fields').hidden=mode==='BASIS';settings.querySelector('.gex-basis-field').hidden=mode!=='BASIS';settings.querySelector('.gex-scale-field').hidden=mode==='PAIR_RATIO';}
  function describe(){
    const m=activeMapping;
    $('gex-map-description').textContent=m.mode==='BASIS'?'Đang dùng (strike − '+m.basis+') ÷ '+m.scale+'. S: không đủ để xác định chênh lệch riêng của SPYUSDT. Cặp giá đồng thời giúp hiệu chỉnh sát hơn.':'Đã neo '+gexReferenceInput(m.referenceTime).replace('T',' ')+' VN · nguồn '+m.source+' ↔ SPYUSDT '+m.target+'. '+(m.mode==='PAIR_RATIO'?'Giữ tỷ lệ: giá = strike × '+m.ratio.toFixed(8)+'.':'Giữ bước: giá = '+m.target+' + (strike − '+m.source+') ÷ '+m.scale+'.')+' Mốc cố định; không kéo phổ theo giá live. Đây là quy đổi tham chiếu, cần cập nhật khi chênh lệch hai thị trường thay đổi.';
  }
  function update(){
    panelToggle.checked=toggle.checked;settings.querySelector('summary').textContent=profile?'GEX · '+(toggle.checked?'BẬT':'TẮT'):'GEX · Nạp data';
    status.textContent=profile?profile.bins.length+' mức · '+(profile.zeroGamma===null?'không có Zero Gamma':'Zero Gamma '+projectGexStrike(profile.zeroGamma,activeMapping).toFixed(2))+' · nạp '+new Date(loadedAt).toLocaleString('vi-VN')+(context().symbol!=='SPYUSDT'?' · chỉ vẽ trên SPYUSDT':''):'Chưa nạp dữ liệu GEX';
    describe();primitive.redraw();
  }
  function applyCalibration(){
    try{
      const config={mode:$('gex-map-mode').value,basis:$('gex-basis').value,scale:$('gex-scale').value,source:$('gex-source-reference').value,target:$('gex-target-reference').value,referenceTime:gexReferenceTime($('gex-reference-time').value)};
      if(config.mode!=='BASIS'&&config.referenceTime>context().now)throw Error('Mốc hiệu chỉnh chưa xảy ra.');
      const next=gexMapping(config);activeMapping=next;update();save();
    }catch(e){status.textContent=e.message+' Giữ hiệu chỉnh đang áp dụng.';}
  }
  $('gex-apply-calibration').onclick=applyCalibration;
  $('gex-map-mode').onchange=()=>{fields();status.textContent='Điền các giá trị rồi bấm Áp dụng hiệu chỉnh.';};
  for(const id of ['gex-basis','gex-scale'])$(id).addEventListener('change',()=>{if($('gex-map-mode').value==='BASIS')applyCalibration();});
  $('gex-chart-reference').onclick=()=>{
    const state=context();if(state.symbol!=='SPYUSDT'){status.textContent='Chọn chart SPYUSDT để lấy giá tham chiếu.';return;}
    const input=$('gex-reference-time').value,time=input?gexReferenceTime(input):null;
    if(input&&!Number.isFinite(time)){status.textContent='Mốc thời gian không hợp lệ.';return;}
    const ref=closedGexReference(state.bars??[],{time,step:state.step,now:state.now});
    if(!ref){status.textContent='Không có nến đóng đúng mốc trong dữ liệu chart; không thay bằng nến gần nhất.';return;}
    if(gexReferenceTime($('gex-reference-time').value)!==ref.time)$('gex-source-reference').value='';
    $('gex-reference-time').value=gexReferenceInput(ref.time);$('gex-target-reference').value=String(ref.price);
    status.textContent='Đã lấy close SPYUSDT '+ref.price+' · '+gexReferenceInput(ref.time).replace('T',' ')+' VN. Điền giá nguồn đúng mốc rồi áp dụng.';
  };
  $('gex-load').onclick=()=>{
    try{const next=parseGex($('gex-data').value);profile=next;appliedText=$('gex-data').value;if(activeMapping.mode==='BASIS'){activeMapping=gexMapping({mode:'BASIS',basis:next.spread,scale:activeMapping.scale});$('gex-basis').value=String(next.spread);}loadedAt=Date.now();toggle.checked=true;update();save();}
    catch(e){status.textContent=e.message+' Dữ liệu đang vẽ được giữ nguyên.';}
  };
  $('gex-file').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>1000000){status.textContent='File quá lớn (tối đa 1 MB).';return;}try{$('gex-data').value=await file.text();status.textContent='Đã đọc file · nhấn Nạp GEX để áp dụng';}catch{status.textContent='Không đọc được file.';}};
  $('gex-clear').onclick=()=>{profile=null;loadedAt=null;appliedText='';$('gex-data').value='';toggle.checked=false;update();save();};
  toggle.addEventListener('change',()=>{update();save();});
  panelToggle.addEventListener('change',()=>{toggle.checked=panelToggle.checked;update();save();});
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.text){
      profile=parseGex(saved.text);appliedText=saved.text;$('gex-data').value=saved.text;
      try{activeMapping=gexMapping(saved.version===2&&saved.mapping?saved.mapping:{mode:'BASIS',basis:saved.basis??profile.spread,scale:saved.scale==='1'?1:10});}catch{activeMapping=gexMapping({mode:'BASIS',basis:profile.spread,scale:10});}
      $('gex-map-mode').value=activeMapping.mode;$('gex-basis').value=String(activeMapping.basis??profile.spread);$('gex-scale').value=String(activeMapping.scale);
      if(activeMapping.mode!=='BASIS'){$('gex-source-reference').value=String(activeMapping.source);$('gex-target-reference').value=String(activeMapping.target);$('gex-reference-time').value=gexReferenceInput(activeMapping.referenceTime);}
      toggle.checked=Boolean(saved.enabled);loadedAt=saved.loadedAt||Date.now();
    }
  }catch{}
  fields();update();return {update};
}
