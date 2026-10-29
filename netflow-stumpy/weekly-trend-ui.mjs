const $=id=>document.getElementById(id);
const pct=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}%`:'—';
export function renderWeeklyTrendMap(state){
  const root=$('weekly-trend-map');if(!root)return;
  const label=state?.label??'WAIT',ready=state?.ready===true;root.dataset.state=label.toLowerCase();
  $('weekly-signal').textContent=label;$('weekly-signal').className=label.toLowerCase();$('weekly-phase').textContent=state?.phase??'WAIT';
  $('weekly-confidence').textContent=ready?`CONF ${state.confidence}% · WAIT ${state.wait}% · GIỮ HƯỚNG ${Math.round(100*state.continuation)}%`:'CONF 0% · WAIT 100%';
  $('weekly-age').textContent=ready?`${state.age.days.current} → ${state.age.days.final.p50} ngày`:'—';$('weekly-age-note').textContent=ready?`${state.age.h1.current} H1 đã cộng · cuối P10–P90 ${state.age.days.final.p10}–${state.age.days.final.p90} ngày`:'Chờ Daily packet';
  $('weekly-box').textContent=ready?`${pct(state.box.low.p50)} → ${pct(state.box.high.p50)}`:'—';$('weekly-box-note').textContent=ready?`Neo Open tuần · P10–P90 ${pct(state.box.low.p10)} → ${pct(state.box.high.p90)}`:'Envelope chưa sẵn sàng';
  $('weekly-cohort').textContent=ready?`${state.n} tuần · Nₑ ${state.neff.toFixed(1)}`:`${state?.sampleN??0} tuần`;$('weekly-cohort-note').textContent=ready?(state.referenceOnly?'THAM KHẢO · cần Nₑ ≥20':'Đủ ngưỡng nghiên cứu'):(state?.reason??'Đang tính');
  const cells=$('weekly-days');cells.replaceChildren(...((state?.cells??['Mon','Tue','Wed','Thu','Fri'].map(name=>({name,packet:null}))).map(({name,packet})=>{const node=document.createElement('div'),direction=packet?.direction??0;node.className=`weekly-day ${direction>0?'up':direction<0?'down':'wait'}${packet?.preview?' preview':''}`;node.innerHTML=`<small>${name}</small><b>${packet?direction>0?'UP':direction<0?'DOWN':'WAIT':'—'}</b><span>${packet?Math.round(100*packet.quality)+'% · '+packet.blocks+'H1':'chưa có'}</span>${packet?.preview?'<em>PREVIEW</em>':''}`;return node;})));
  $('weekly-method-note').textContent=state?.reason??'Daily packet dùng Hộp sức mạnh, tuổi trend và các H1 đã đóng.';
}

