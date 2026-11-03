import {h4AgeReadout} from './h4-trend-age.mjs?v=20261103-h4-age1';
const $=id=>document.getElementById(id);
const pct=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}%`:'—';
export function compactWeeklyDayLabel(name,packet){
  if(!packet)return '';
  const direction=packet.direction>0?'UP':packet.direction<0?'DOWN':'WAIT',quality=Math.round(100*packet.quality);
  return `${name} · ${direction} · ${quality}% · ${packet.blocks}H1${packet.preview?' · PREVIEW':''}`;
}

export function renderWeeklyTrendMap(state){
  const root=$('weekly-trend-map');if(!root)return;
  const label=state?.label??'WAIT',ready=state?.ready===true;root.dataset.state=label.toLowerCase();
  $('weekly-signal').textContent=label;$('weekly-signal').className=label.toLowerCase();$('weekly-phase').textContent=state?.phase??'WAIT';
  $('weekly-confidence').textContent=ready?`CONF ${state.confidence}% · WAIT ${state.wait}% · GIỮ HƯỚNG ${Math.round(100*state.continuation)}%`:'CONF 0% · WAIT 100%';
  const age=h4AgeReadout(state?.h4Age);$('weekly-age').textContent=age.text;$('weekly-age-note').textContent=age.note;$('weekly-age').title=age.title;
  $('weekly-box').textContent=ready?`${pct(state.box.low.p50)} → ${pct(state.box.high.p50)}`:'—';$('weekly-box-note').textContent=ready?`Neo Open tuần · P10–P90 ${pct(state.box.low.p10)} → ${pct(state.box.high.p90)}`:'Envelope chưa sẵn sàng';
  $('weekly-cohort').textContent=ready?`${state.n} tuần · Nₑ ${state.neff.toFixed(1)}`:`${state?.sampleN??0} tuần`;$('weekly-cohort-note').textContent=ready?(state.referenceOnly?'THAM KHẢO · cần Nₑ ≥20':'Đủ ngưỡng nghiên cứu'):(state?.reason??'Đang tính');
  const cellRows=state?.cells??['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(name=>({name,packet:null})),cells=$('weekly-days');cells.replaceChildren(...(cellRows.map(({name,packet})=>{const node=document.createElement('div'),direction=packet?.direction??0;node.className=`weekly-day ${direction>0?'up':direction<0?'down':'wait'}${packet?.preview?' preview':''}`;node.innerHTML=`<small>${name}</small><b>${packet?direction>0?'UP':direction<0?'DOWN':'WAIT':'—'}</b><span>${packet?Math.round(100*packet.quality)+'% · '+packet.blocks+'H1':'chưa có'}</span>${packet?.preview?'<em>PREVIEW</em>':''}`;return node;})));
  const chartLabel=$('weekly-day-chart-label'),latest=cellRows.filter(x=>x.packet).at(-1);if(chartLabel){if(!latest){chartLabel.hidden=true;}else{const direction=latest.packet.direction??0;chartLabel.hidden=false;chartLabel.className=`weekly-day-chart-label ${direction>0?'up':direction<0?'down':'wait'}${latest.packet.preview?' preview':''}`;chartLabel.textContent=compactWeeklyDayLabel(latest.name,latest.packet);chartLabel.title='Tuổi ngày tính từ 00:00 New York, chỉ cộng H1 đã đóng; chạy liên tục cả 7 ngày trong tuần và khóa khi sang 00:00 ngày kế tiếp. H1 đầu tiên cộng lúc 01:00; trước đó WAIT · 0H1. Daily packet hiện tại: hướng tổng hợp Giá 45% + Hộp 30% + tuổi trend 25%; phần trăm là chất lượng, H1 là số khối đã đóng.';}}
  $('weekly-method-note').textContent=state?.reason??'Daily packet dùng Hộp sức mạnh, tuổi trend và các H1 đã đóng.';
}

