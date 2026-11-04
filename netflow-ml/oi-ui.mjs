import {OiHistory} from './oi-history.mjs?v=20261104-ml-oi1';
import {OiFastLoader} from './oi-fast-load.mjs?v=20261104-ml-oi1';
import {oiWidthByBar} from './oi-width.mjs?v=20261104-ml-oi1';
import {oiCandleBars,OI_GROUP_LABELS} from './oi-candle-bars.mjs?v=20261104-ml-oi1';
import {oiSpectrum} from './oi-spectrum.mjs?v=20261104-ml-oi1';
import {OiBoldCandles} from './oi-bold-candles.mjs?v=20261104-ml-oi1';
import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-ml-oi1';
import {buildSpectrumComparison,drawPairedSpectrum,spectrumPriceGroup,confirmSpectrumGroup} from './paired-spectrum.mjs?v=20261104-ml-oi1';

export function createOiLayer({chart,price,L,host,getContext,get,render}){
 const $=id=>document.getElementById(id),loaders=new Map(),histories=new Map();
 let active='',market='',interval='',samples=[],phase='loading',saved=false,state=null,inspected=null;
 const controls=document.createElement('div');controls.className='chart-options oi-controls';
 const toggle=(id,text)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id=id;input.checked=true;label.append(input,text);controls.append(label);input.addEventListener('change',()=>render());return input;};
 const profileToggle=toggle('oi-spectrum-toggle','Phổ OI / CVD'),barsToggle=toggle('oi-candle-bars-toggle','ΔOI theo nến'),boldToggle=toggle('oi-bold-candles-toggle','Nến đồng thuận OI'),pinToggle=toggle('oi-candle-pin-toggle','Lọc pin bar');
 const select=document.createElement('select');select.id='oi-delta-percentile';select.setAttribute('aria-label','Ngưỡng phân vị delta OI');for(const p of [60,62,70,80]){const o=document.createElement('option');o.value=String(p/100);o.textContent=`P${p} · nền 10 nến`;select.append(o);}select.value='0.62';controls.append(select);select.onchange=()=>render();
 const status=document.createElement('span');status.id='oi-spectrum-status';status.setAttribute('role','status');controls.append(status);host.closest('.chart-card').before(controls);
 const readout=document.createElement('div');readout.id='oi-cvd-readout';readout.setAttribute('aria-live','polite');host.closest('.chart-card').after(readout);
 const badge=document.createElement('div');badge.id='oi-price-group-badge';host.append(badge);
 const hist=chart.addSeries(L.HistogramSeries,{priceScaleId:'ml-oi-bars',base:0,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'volume'},autoscaleInfoProvider:original=>{const info=original();if(info)info.priceRange.minValue=0;return info;}},1);
 hist.priceScale().applyOptions({scaleMargins:{top:.80,bottom:0}});
 const bold=new OiBoldCandles();price.attachPrimitive(bold);
 const primitive=new SpectrumPrimitive(scope=>{
  if(!state)return;const anchor=chart.timeScale().timeToCoordinate(state.anchor/1000);if(!Number.isFinite(anchor))return;
  drawPairedSpectrum({...scope,anchor,priceToY:p=>price.priceToCoordinate(p),history:state.history,comparison:state.comparison,showCvd:$('cvd-spectrum-toggle').checked,compare:profileToggle.checked,source:market,format:formatPrice});
 });price.attachPrimitive(primitive);
 function formatPrice(x){return Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:market==='EURUSDT'?5:2}):'—';}
 const number=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
 const signed=x=>(x>0?'+':'')+number(x);
 function refresh(){
  const c=getContext(),key=`${c.market}:${c.interval}`;
  if(active!==key){
   if(market&&market!==c.market)loaders.get(market)?.cancel();
   active=key;market=c.market;interval=c.interval;phase='loading';state=null;samples=[];saved=false;hist.setData([]);bold.setData([]);badge.hidden=true;primitive.redraw();
  }
  if(!loaders.has(market)){
   const symbol=market,history=new OiHistory({symbol});histories.set(symbol,history);
   const loader=new OiFastLoader({symbol,history,get,onData:data=>{
    if(active!==`${symbol}:${data.interval}`)return;samples=data.samples;saved=data.saved;phase=data.samples.length?'ready':phase;render();
   },onState:data=>{if(active!==`${symbol}:${data.interval}`)return;phase=data.phase;updateReadout();}});loaders.set(symbol,loader);
  }
  const hot=histories.get(market).peek(interval,c.now);samples=hot.samples;saved=hot.saved;
  void loaders.get(market).start(interval);updateReadout();
 }
 function update({priceData,histogram,history,anchor}){
  const c=getContext();if(active!==`${c.market}:${c.interval}`){refresh();return;}
  const oi=oiWidthByBar(samples,c.step,c.now),profile=oiSpectrum(c.priceRows,oi,c.step,c.now,c.bins),comparison=buildSpectrumComparison(c.priceRows,c.flowRows,profile,c.now,c.bins);
  const bars=oiCandleBars(c.priceRows,histogram,c.flowRows,oi,c.step,c.now,{filterPin:pinToggle.checked,history:true,minOiMultiplier:1,oiPercentile:Number(select.value)});
  state={...c,history,anchor,profile,comparison,bars};
  hist.setData(barsToggle.checked?bars.data:[]);
  bold.setData(boldToggle.checked?priceData.filter(row=>bars.points.get(row.time*1000)?.matched).map(row=>({...row,oiKind:bars.points.get(row.time*1000).kind})):[]);
  host.dataset.oiMarket=market;host.dataset.oiMatched=String(bars.matched);host.dataset.oiSource='same-market';host.dataset.oiGate='previous-10-P'+Math.round(Number(select.value)*100);
  primitive.redraw();updateReadout();updateBadge();
 }
 function updateReadout(){
  const c=getContext(),comparison=state?.comparison,profile=state?.profile;
  status.textContent=`${c.market} OI · ${profile?.ready?(profile.stale?'DỮ LIỆU CŨ':`${profile.count} nến`):phase==='error'?'chưa tải được · tự thử lại':'WAIT'}${samples.length?` · ${samples.length} mẫu${saved?' đã lưu':''}`:''}`;
  readout.hidden=!profileToggle.checked;
  if(!state){readout.textContent='Chờ dữ liệu OI thật của '+c.market+'.';return;}
  const near=Number.isFinite(inspected)?comparison.rows.find(r=>Math.abs(r.price-inspected)<=c.bins.binStep/2+Number.EPSILON):null;
  readout.textContent=near?`Giá ${formatPrice(near.price)} · CVD ngày ${signed(near.cvd)} · ${comparison.pairedReady?`OI +${number(near.opened)} / −${number(near.closed)} · ròng ${signed(near.netOi)}`:'OI WAIT'}${comparison.stale?' · OI CŨ':''}`:
   `CVD ngày ${market} · ${comparison.day??'—'} NY · ${comparison.count} nến${comparison.stale?' · OI CŨ':''}. CVD∞ giữ nhiều ngày; ΔOI theo ngày, cùng timestamp khi đủ dữ liệu. OI xanh = tăng tổng vị thế, đỏ = giảm; mỗi phổ có thang riêng. Nến đồng thuận: giá + volume + Taker NF cùng dấu, |ΔOI| vượt P${Math.round(Number(select.value)*100)} của 10 nến trước. Trỏ/chạm hàng giá để xem số.`;
 }
 function updateBadge(){
  const c=getContext(),current=c.priceRows.at(-1)?.c;badge.hidden=!profileToggle.checked||!state||!Number.isFinite(current);if(badge.hidden)return;
  const group=spectrumPriceGroup(state.comparison,current),confirmation=confirmSpectrumGroup(group,state.comparison,c.priceRows,state.bars.points);
  if(!group)return;
  const labels={confirmed:'ĐÃ XÁC NHẬN',conflict:'NẾN ĐỐI NGHỊCH',forming:'CHỜ THÊM NẾN',mixed:'CHƯA ĐỒNG THUẬN',WAIT:'CHỜ ĐỦ CVD / OI'};
  const parts=[['strong',`${market} · VÙNG ${formatPrice(group.low)}–${formatPrice(group.high)}`],['span',group.ready?`${group.cvd>0?'MUA CHỦ ĐỘNG':'BÁN CHỦ ĐỘNG'} · OI ${group.netOi>0?'TĂNG':'GIẢM'} RÒNG`:'OI WAIT'],['small',`CVD ${signed(group.cvd)} · OI ròng ${group.ready?signed(group.netOi):'—'} · ${state.comparison.stale?'OI CŨ':c.live?'LIVE':'DELAYED'}`],['small',labels[confirmation.state]+(confirmation.count?` · ${confirmation.support}/${confirmation.count} nến · ${Math.round(confirmation.share*100)}% |ΔOI|`:'')]];
  badge.replaceChildren(...parts.map(([tag,text])=>{const n=document.createElement(tag);n.textContent=text;return n;}));badge.dataset.state=group.state;badge.dataset.confirmation=confirmation.state;
  badge.title='Nhóm 3 mức giá. Xác nhận: ≥2 nến hỗ trợ và ≥60% |ΔOI| của các nến vượt ngưỡng trong vùng. Nến và histogram chỉ tính một lần. Không xác định chắc vị thế long/short.';
 }
 chart.subscribeCrosshairMove(event=>{
  if(event.point&&event.point.y<chart.panes()[0].getHeight()){inspected=price.coordinateToPrice(event.point.y);updateReadout();}
  const bar=event.time&&state?.bars.points.get(Number(event.time)*1000);
  if(bar?.matched)readout.textContent+=` · ${OI_GROUP_LABELS[bar.kind]} · ΔOI ${signed(bar.delta)} · ngưỡng ${number(bar.threshold)}`;
 });
 host.addEventListener('pointerleave',()=>{inspected=null;updateReadout();});
 setInterval(()=>{if(!document.hidden)refresh();},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 return {getOiByTime:()=>{const c=getContext();return active===c.market+':'+c.interval?oiWidthByBar(samples,c.step,c.now):new Map();},refresh,update,redraw:()=>{primitive.redraw();updateBadge();}};
}
