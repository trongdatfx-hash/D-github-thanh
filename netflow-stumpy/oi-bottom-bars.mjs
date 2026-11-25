import {CHART_SETUP_KEY,readChartSetup} from './chart-setup-state.mjs?v=20261122-setup1';

export const OI_BOTTOM_CONTROL='oi-bottom-toggle';
// Signed OI changes accumulate within each contiguous SPY V body-color run.
export function oiBottomBars(bars,oiByTime,step,now,spyVByTime){
  if(!(step>0)||!Number.isFinite(now)||!oiByTime||!spyVByTime)return [];
  let total=0,phase=0,lastTime=null;
  return bars.map(row=>{
    const point={time:row.t/1000};
    const current=oiByTime.get(row.t)?.oi,previous=oiByTime.get(row.t-step)?.oi;
    const value=spyVByTime.get(row.t)?.adjusted;
    const sign=Number.isFinite(value)?Math.sign(value):0;
    if(!Number.isFinite(row.end)||row.end>=now||!sign||!Number.isFinite(current)||!Number.isFinite(previous)||current<=0||previous<=0){
      total=0;phase=0;lastTime=null;return point;
    }
    if(sign!==phase||lastTime!==row.t-step)total=0;
    total+=current-previous;phase=sign;lastTime=row.t;
    return {...point,value:total,color:sign>0?'#08e8a9':'#ff4163'};
  });
}

export function mountOiBottomBars({chart,actions,host,L,writeSeries}){
  const input=document.createElement('input');input.type='checkbox';input.id=OI_BOTTOM_CONTROL;input.hidden=true;input.checked=readChartSetup()?.controls?.[OI_BOTTOM_CONTROL]!==false;
  const button=document.createElement('button');button.id='oi-bottom-mode';button.type='button';const text=document.createElement('span');button.append(input,text);
  const help='ΔOI tích lũy theo chuỗi màu SPY V thân nến: xanh SPY V dương, đỏ SPY V âm; đổi màu hoặc thiếu dữ liệu thì bắt đầu lại. Cộng ΔOI có dấu: trên 0 tăng tổng OI, dưới 0 giảm tổng OI. Chỉ nến đã đóng có hai mốc OI liên tiếp. Hiện hỗ trợ SPYUSDT. Đây là thay đổi vị thế mở, không phải volume khớp hay phân biệt Long/Short.';
  button.title=help;actions.append(button);
  const series=chart.addSeries(L.HistogramSeries,{priceScaleId:'oi-bottom-overlay',base:0,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'volume'},autoscaleInfoProvider:original=>{const info=original();if(info)info.priceRange.minValue=Math.min(0,info.priceRange.minValue);if(info)info.priceRange.maxValue=Math.max(0,info.priceRange.maxValue);return info;}},0);
  series.priceScale().applyOptions({autoScale:true,scaleMargins:{top:.86,bottom:0}});
  let context=null;
  function update(next=context){
    context=next;const enabled=input.checked,available=next?.symbol==='SPYUSDT'&&next?.interval===next?.oiInterval;
    const data=enabled&&available?oiBottomBars(next.bars,next.oiByTime,next.step,next.now,next.spyVByTime):[];
    writeSeries('oiBottomBars',series,data,[next?.symbol,next?.interval,next?.oiInterval,enabled].join('|'));
    series.applyOptions({visible:enabled&&available});
    text.textContent=`ΣΔOI: ${enabled?'BẬT':'TẮT'}`;button.setAttribute('aria-pressed',String(enabled));
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
