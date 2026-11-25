import {CHART_SETUP_KEY,readChartSetup} from './chart-setup-state.mjs?v=20261122-setup1';

export const OI_BOTTOM_CONTROL='oi-bottom-toggle';
// Histogram magnitude is |change in open contracts|, not traded volume or Long/Short flow.
export function oiBottomBars(bars,oiByTime,step,now){
  if(!(step>0)||!Number.isFinite(now)||!oiByTime)return [];
  return bars.map(row=>{
    const point={time:row.t/1000};
    if(!Number.isFinite(row.end)||row.end>=now)return point;
    const current=oiByTime.get(row.t)?.oi,previous=oiByTime.get(row.t-step)?.oi;
    if(!Number.isFinite(current)||!Number.isFinite(previous)||current<=0||previous<=0)return point;
    const delta=current-previous;
    return {...point,value:Math.abs(delta),color:delta>0?'rgba(38,211,154,.50)':delta<0?'rgba(246,96,125,.50)':'rgba(147,163,184,.35)'};
  });
}

export function mountOiBottomBars({chart,actions,host,L,writeSeries}){
  const input=document.createElement('input');input.type='checkbox';input.id=OI_BOTTOM_CONTROL;input.hidden=true;input.checked=readChartSetup()?.controls?.[OI_BOTTOM_CONTROL]!==false;
  const button=document.createElement('button');button.id='oi-bottom-mode';button.type='button';const text=document.createElement('span');button.append(input,text);
  const help='Cột |ΔOI| sát đáy chart giá, thang riêng: xanh OI tăng, đỏ OI giảm. Chỉ nến đã đóng có hai mốc OI liên tiếp; không lọc đồng thuận/P62. Hiện hỗ trợ SPYUSDT. Đây là thay đổi vị thế mở, không phải volume khớp hay phân biệt Long/Short.';
  button.title=help;actions.append(button);
  const series=chart.addSeries(L.HistogramSeries,{priceScaleId:'oi-bottom-overlay',base:0,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'volume'},autoscaleInfoProvider:original=>{const info=original();if(info)info.priceRange.minValue=0;return info;}},0);
  series.priceScale().applyOptions({autoScale:true,scaleMargins:{top:.86,bottom:0}});
  let context=null;
  function update(next=context){
    context=next;const enabled=input.checked,available=next?.symbol==='SPYUSDT'&&next?.interval===next?.oiInterval;
    const data=enabled&&available?oiBottomBars(next.bars,next.oiByTime,next.step,next.now):[];
    writeSeries('oiBottomBars',series,data,[next?.symbol,next?.interval,next?.oiInterval,enabled].join('|'));
    series.applyOptions({visible:enabled&&available});
    text.textContent=`OI đáy: ${enabled?'BẬT':'TẮT'}`;button.setAttribute('aria-pressed',String(enabled));
    host.dataset.oiBottomState=!enabled?'off':!available?'unavailable':data.some(p=>Number.isFinite(p.value))?'ready':'waiting';
    host.dataset.oiBottomPane='0';host.dataset.oiBottomCount=String(data.filter(p=>Number.isFinite(p.value)).length);
  }
  button.addEventListener('click',()=>{
    input.checked=!input.checked;update();
    try{const saved=readChartSetup()??{version:1,controls:{}};localStorage.setItem(CHART_SETUP_KEY,JSON.stringify({...saved,controls:{...saved.controls,[OI_BOTTOM_CONTROL]:input.checked}}));button.title=help;}
    catch{button.title=help+' Không lưu được lựa chọn trên trình duyệt này.';}
  });
  update();return {series,input,button,update};
}
