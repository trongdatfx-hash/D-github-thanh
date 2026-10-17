import {STEPS,composite,flowAlignment,relativeFlowColor,strengthAgreementCandleSignal,strengthPhaseLineStyle,directionalVolumeDelta,volumeDeltaStrengthColor,volumeDeltaStrengthValue,symmetricPriceRange,calculateVolumeStrength,analyze,weightedPriceBands,continuousCvdSpectrum,projectNetFlowToPrice,dayBoundaryTimes} from './engine.mjs?v=20261017-7';
import {load} from './data.mjs';
import {loadPersistentHistory} from './history-store.mjs?v=20261015-1';
import {strengthStatistics} from './strength-stats.mjs?v=20261015-1';
import {pivotZones,pivotFlowRealtime} from './pivot-zones.mjs?v=20261017-2';
import {pivotFlowLayout,pivotFlowZeroCoordinate} from './pivot-flow-layout.mjs?v=20261016-2';
import {analyzeGeometry,analyzeBreakoutRetest,recentCausalLineStates,backtestGeometry} from './geometry.mjs?v=20261016-3';
import {loadForexCalendar,selectCalendarEvents,calendarEventState,actualVsForecast,CALENDAR_TIME_ZONE} from './forex-calendar.mjs?v=20261014-2';
import {preRthWlrTrend,formatPreRthWlrTrend} from './pre-rth-wlr-trend.mjs?v=20261017-1';
const $=id=>document.getElementById(id),fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—',fmtK=x=>Number.isFinite(x)?`${(x/1000).toLocaleString('en-US',{maximumFractionDigits:2})}K`:'—';
const L=window.LightweightCharts;
let chart,price,series={},marks,strengthMarks,cache=null,rows={},volumeStrengthRows=[],modelRows={},modelVolumeStrengthRows=[],modelStamp=null,trendRows={},trendVolumeStrengthRows=[],trendStamp=null,trainingMeta=null,maps={},priceBandMap=new Map(),cvdProfile={bins:[],maxAbs:0,binStep:.5,range:12},cvdAnchorTime=null,cvdSourceLabel='C→S',cvdFrame=0,dayBoundaries=[],dayFrame=0,geometryFrame=0,pivotFlowFrame=0,geometryState={pivots:[],events:[],lines:[],summary:{}},geometryStatePoints=[],geometryStatePointsKey='',breakoutState=null,geometryBacktest={n:0},controller,generation=0,loading=false,lastSuccess=null,serverOffsetMs=0;
const colors={SPYUSDT:'#5ba8ff',QQQUSDT:'#c194ff',COMPOSITE:'#38dfba'};
const flowTitles={SPYUSDT:'S Taker NF',QQQUSDT:'Q Taker NF',COMPOSITE:'C Taker NF'};
const flowColors={
  SPYUSDT:{up:'rgba(39,211,164,.38)',down:'rgba(255,91,116,.38)'},
  QQQUSDT:{up:'rgba(39,211,164,.58)',down:'rgba(255,91,116,.58)'},
  COMPOSITE:{up:'rgba(39,211,164,.82)',down:'rgba(255,91,116,.82)'}
};
const LIVE_REFRESH_MS=3000;
const CALENDAR_REFRESH_MS=5*60*1000;
const FIT_WINDOW_MS=36*60*60*1000,FIT_HALF_WINDOW_MS=12*60*60*1000,DOUBLE_TAP_MS=360,DOUBLE_TAP_DISTANCE=28,TAP_MOVE_TOLERANCE=14;
const SETUP_STORAGE_KEY='netflow-rth-lite:chart-setup:v1';
const SETUP_CONTROL_IDS=['symbol','interval','days','signal','spy','qqq','composite','relative','alignment','price-bands','pivot-zones','phase-width','candle-agreement-color','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','double-tap-full','geometry-toggle','geometry-pivots','geometry-score','geometry-lines','calendar-impact','calendar-currency'];
let statsMap=new Map(),candleColorMap=new Map(),rev63State=null,pivotZoneState={ready:false,reason:'history',support:null,resistance:null},pivotFlowState=null,pivotZoneKey='',inspectedTime=null;
let calendarState={events:[],updatedAt:null,loading:false};
let pendingSavedTimeRange=null,saveSetupTimer=null;
const sourceName=key=>({SPYUSDT:'SPY',QQQUSDT:'QQQ',COMPOSITE:'Composite'}[key]);
const signed=x=>Number.isFinite(x)?`${x>0?'+':''}${fmt(x)}`:'—';
const signLabel=x=>x>0?'+':x<0?'−':'0';
const symmetricAutoscale=original=>{const info=original();return info?.priceRange?{...info,priceRange:symmetricPriceRange(info.priceRange)}:info;};
const tone=x=>x>0?'positive':x<0?'negative':'neutral';
const calendarDay=new Intl.DateTimeFormat('vi-VN',{timeZone:CALENDAR_TIME_ZONE,weekday:'short',day:'2-digit',month:'2-digit'});
const calendarTime=new Intl.DateTimeFormat('vi-VN',{timeZone:CALENDAR_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const calendarImpactLabel={High:'High',Medium:'Medium',Low:'Low',Holiday:'Nghỉ','Non-Economic':'Khác'};

function renderCalendar(){
  const list=$('calendar-list'),statusNode=$('calendar-status');if(!list||!statusNode)return;
  const events=selectCalendarEvents(calendarState.events,{impact:$('calendar-impact').value,currency:$('calendar-currency').value});
  const oldRows=new Map([...list.querySelectorAll('.calendar-row')].map(row=>[row.dataset.key,row])),scrollTop=list.scrollTop,positioned=list.dataset.positioned==='true',fragment=document.createDocumentFragment();
  for(const event of events){
    const key=`${event.timestamp}|${event.country}|${event.title}`,state=calendarEventState(event),comparison=actualVsForecast(event);let row=oldRows.get(key);
    if(!row){row=document.createElement('div');row.dataset.key=key;row.innerHTML='<span class="calendar-time"><b></b><small></small></span><span class="calendar-currency"></span><span class="calendar-impact"></span><span class="calendar-title"></span><span class="calendar-value calendar-actual"></span><span class="calendar-value calendar-forecast"></span><span class="calendar-value calendar-previous"></span>';}
    row.className=`calendar-row ${state.key}${event.actual?' released':''}`;row.title=`${event.title} · ${state.label}${event.actual?` · ${comparison.label}`:''}`;
    row.querySelector('.calendar-time b').textContent=calendarTime.format(event.timestamp);row.querySelector('.calendar-time small').textContent=calendarDay.format(event.timestamp);
    row.querySelector('.calendar-currency').textContent=event.country;
    const impact=row.querySelector('.calendar-impact');impact.className=`calendar-impact ${event.impact.toLowerCase().replace(/[^a-z]+/g,'-')}`;impact.textContent=calendarImpactLabel[event.impact]??event.impact;
    row.querySelector('.calendar-title').textContent=event.title;
    const actual=row.querySelector('.calendar-actual');actual.className=`calendar-value calendar-actual ${comparison.key}`;actual.textContent=event.actual||'—';actual.title=`Thực tế · ${comparison.label}`;
    const forecast=row.querySelector('.calendar-forecast');forecast.textContent=event.forecast||'—';forecast.title='Dự báo';
    const previous=row.querySelector('.calendar-previous');previous.textContent=event.previous||'—';previous.title='Kỳ trước';
    fragment.append(row);
  }
  if(!events.length){const empty=document.createElement('div');empty.className='calendar-empty';empty.textContent=calendarState.events.length?'Không có tin phù hợp trong khoảng gần đây. Thử chọn “Tất cả”.':'Chưa có dữ liệu lịch.';fragment.append(empty);}
  list.replaceChildren(fragment);
  if(positioned)list.scrollTop=scrollTop;else requestAnimationFrame(()=>{const next=[...list.children].find(row=>row.classList.contains('future')||row.classList.contains('now'));if(next)list.scrollTop=Math.max(0,next.offsetTop-list.offsetTop-Math.round(list.clientHeight*.45));list.dataset.positioned='true';});
  if(calendarState.updatedAt){
    const age=Date.now()-calendarState.updatedAt,stale=age>26*60*60000,released=events.filter(event=>event.actual).length;statusNode.className=`calendar-status${stale?' stale':''}`;statusNode.textContent=`${events.length} tin · ${released} đã có thực tế · cập nhật ${calendarTime.format(calendarState.updatedAt)} ${calendarDay.format(calendarState.updatedAt)}${stale?' · snapshot cũ':''}`;
  }
}

async function refreshCalendar(){
  if(calendarState.loading)return;calendarState.loading=true;$('calendar-refresh').disabled=true;$('calendar-refresh').classList.add('loading');
  const statusNode=$('calendar-status');statusNode.className='calendar-status';statusNode.textContent='Đang nạp lịch Forex Factory…';
  try{const data=await loadForexCalendar();calendarState={...data,loading:false};renderCalendar();}
  catch(error){calendarState.loading=false;statusNode.className='calendar-status error';statusNode.textContent=`${error.message}. ${calendarState.events.length?'Đang giữ bản gần nhất.':'Mở Forex Factory bằng liên kết bên dưới.'}`;}
  finally{$('calendar-refresh').disabled=false;$('calendar-refresh').classList.remove('loading');}
}
class VariableWidthLineRenderer{
  update(data,options){this.data=data;this.options=options;}
  draw(target,priceToCoordinate){
    const bars=this.data?.bars,range=this.data?.visibleRange;if(!bars?.length||!range)return;
    target.useBitmapCoordinateSpace(({context,horizontalPixelRatio,verticalPixelRatio})=>{
      context.save();context.strokeStyle=this.options.color;context.lineCap='butt';context.lineJoin='round';
      // Both endpoints must be inside the visible range; off-screen custom bars can carry stale x coordinates.
      const start=Math.max(1,range.from+1),end=Math.min(bars.length,range.to);
      for(let i=start;i<end;i++){
        const previous=bars[i-1],current=bars[i],a=previous.originalData,b=current.originalData;
        if(!Number.isFinite(a?.value)||!Number.isFinite(b?.value))continue;
        const xGap=current.x-previous.x;if(!Number.isFinite(xGap)||xGap<=0||xGap>Math.max(2,this.data.barSpacing*1.6))continue;
        const y1=priceToCoordinate(a.value),y2=priceToCoordinate(b.value);if(y1===null||y2===null)continue;
        context.beginPath();context.strokeStyle=b.phaseColor??this.options.color;context.lineWidth=Math.max(1,Math.round((b.width??1)*verticalPixelRatio));
        context.moveTo(previous.x*horizontalPixelRatio,y1*verticalPixelRatio);context.lineTo(current.x*horizontalPixelRatio,y2*verticalPixelRatio);context.stroke();
      }
      context.restore();
    });
  }
}
class VariableWidthLineSeries{
  constructor(){this.lineRenderer=new VariableWidthLineRenderer;}
  renderer(){return this.lineRenderer;}
  update(data,options){this.lineRenderer.update(data,options);}
  priceValueBuilder(data){return [data.value];}
  isWhitespace(data){return !Number.isFinite(data?.value);}
  defaultOptions(){return {...L.customSeriesDefaultOptions,color:'#f6c85f',baseLineVisible:false,priceLineVisible:false,lastValueVisible:false,title:''};}
  destroy(){}
}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function setLive(live){const node=$('live-indicator');node.textContent=live?'● LIVE':'● KHÔNG LIVE';node.className=live?'live':'offline';}
function setupChartActions(){
  const actions=document.querySelector('.chart-actions'),fit=$('chart-fit'),live=$('live-indicator');
  if(!actions||!fit||!live)return;
  fit.insertAdjacentElement('afterend',live);
  const half=document.createElement('button');half.id='chart-fit-half';half.type='button';half.title='Hiển thị các nến trong 0,5 ngày gần nhất';half.textContent='Fit 0.5 ngày';live.insertAdjacentElement('afterend',half);
  const save=document.createElement('button');save.id='chart-save';save.type='button';save.title='Lưu toàn bộ lựa chọn và vùng thời gian đang xem trên trình duyệt này';save.textContent='Lưu setup';save.setAttribute('aria-live','polite');half.insertAdjacentElement('afterend',save);
  const alignmentLabel=$('alignment')?.closest('label');if(alignmentLabel){alignmentLabel.lastChild.textContent='SPY V Δ nến';alignmentLabel.dataset.pane='strength-spy-v';alignmentLabel.title='Histogram chung thang −1…+1 với Strength SPY V. Biên độ tuyến tính Δ/2: volume bằng SMA20 đạt nửa biên, từ 2× SMA20 đạt toàn biên. Bốn màu: Δ+/V+ xanh lá, Δ−/V+ xanh dương, Δ+/V− hồng nhạt, Δ−/V− đỏ.';}
  const compositeLabel=$('composite')?.closest('label');if(compositeLabel)compositeLabel.title='C Taker NF chỉ hiển thị trong pane Strength SPY/QQQ/Composite, dùng scale overlay đối xứng quanh 0 và nhãn cố định.';
  const phaseLabel=$('phase-width')?.closest('label');if(phaseLabel)phaseLabel.title='WLR dày và xanh khi Composite × SPY V cùng dương; dày và đỏ khi cùng âm; trái dấu hoặc trung tính giữ vàng.';
  const hint=document.querySelector('.hint');if(hint){hint.textContent=hint.textContent.replace('Histogram C NF sát trục giá SPY cộng Composite Taker NetFlow từ pivot đầu đã xác nhận tới nến hiện tại; khi chưa có cặp pivot, dùng 96 nến gần nhất. Cập nhật khoảng 3 giây khi trang mở. Cột cuối viền vàng là nến chưa đóng và có thể thay đổi.','Histogram C NF sát trục giá SPY chỉ vẽ 5 nến M15 gần nhất. Tiêu đề VOL phân loại biến động 5 nến thành thấp, trung bình hoặc cao theo phân vị causal của biên độ giá, realized volatility, quote volume và taker imbalance. Số % phía dưới vẫn là C NF dùng EWMA half-life 32 trên nhóm pivot hoặc 96 nến khi chưa có pivot; cả hai cập nhật theo nến live. Cột cuối viền vàng là nến chưa đóng và có thể thay đổi.');}
}
function restoreSavedSetup(){
  try{
    const saved=JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY)||'null');if(!saved||saved.version!==1||typeof saved.controls!=='object')return;
    for(const id of SETUP_CONTROL_IDS){const node=$(id),value=saved.controls[id];if(!node)continue;if(node.type==='checkbox'){if(typeof value==='boolean')node.checked=value;}else if(typeof value==='string'&&[...node.options].some(option=>option.value===value))node.value=value;}
    const from=Number(saved.timeRange?.from),to=Number(saved.timeRange?.to);if(Number.isFinite(from)&&Number.isFinite(to)&&to>from)pendingSavedTimeRange={from,to};
  }catch{}
}
function applySavedTimeRange(data){
  if(!pendingSavedTimeRange||!data.length)return false;
  const first=data[0].t/1000,last=data.at(-1).t/1000,from=Math.max(first,pendingSavedTimeRange.from),to=Math.min(last,pendingSavedTimeRange.to);pendingSavedTimeRange=null;
  if(!(to>from))return false;
  chart.timeScale().setVisibleRange({from,to});scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();return true;
}
function saveChartSetup(){
  const button=$('chart-save');
  try{
    const controls={};for(const id of SETUP_CONTROL_IDS){const node=$(id);if(node)controls[id]=node.type==='checkbox'?node.checked:node.value;}
    const visible=chart.timeScale().getVisibleRange(),timeRange=visible&&Number.isFinite(Number(visible.from))&&Number.isFinite(Number(visible.to))?{from:Number(visible.from),to:Number(visible.to)}:null;
    localStorage.setItem(SETUP_STORAGE_KEY,JSON.stringify({version:1,savedAt:Date.now(),controls,timeRange}));
    button.textContent='✓ Đã lưu';button.title='Setup đã được lưu trên trình duyệt này';
  }catch{button.textContent='Không lưu được';button.title='Trình duyệt đang chặn bộ nhớ cục bộ';}
  clearTimeout(saveSetupTimer);saveSetupTimer=setTimeout(()=>{button.textContent='Lưu setup';button.title='Lưu toàn bộ lựa chọn và vùng thời gian đang xem trên trình duyệt này';},1800);
}
function updateRev63(){
  rev63State=preRthWlrTrend({priceRows:trendRows[$('symbol').value]??[],strengthRows:trendRows.COMPOSITE??[],volumeRows:trendVolumeStrengthRows,now:cache?.serverTime??Date.now()});
  updateGeometryReadout();
}
const isCompactChart=()=>matchMedia('(max-width: 760px)').matches;
const isTouchChart=()=>matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
function applyResponsiveChartOptions(){
  if(!chart)return;
  const compact=isCompactChart(),touch=isTouchChart(),full=isFullChart();
  chart.applyOptions({
    layout:{fontSize:compact?11:12},
    rightPriceScale:{autoScale:true,minimumWidth:compact?58:64,tickMarkDensity:compact?3.5:2.5},
    timeScale:{timeVisible:true,secondsVisible:false,rightOffsetPixels:compact?68:96,barSpacing:compact?7:6,minBarSpacing:compact?.8:.5,lockVisibleTimeRangeOnResize:true,minimumHeight:compact?30:0},
    handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:touch&&full},
    handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:{time:true,price:true}},
    kineticScroll:{touch:true,mouse:false}
  });
  const host=$('chart');host.dataset.lwcVersion=L.version();host.dataset.touchProfile=touch?'touch':'pointer';host.dataset.compactProfile=String(compact);host.dataset.verticalTouchDrag=String(touch&&full);host.dataset.priceAxisMinWidth=String(compact?58:64);
}
function init(){
  if(!L){status('Không tải được thư viện chart cục bộ. Kiểm tra network hoặc tải lại trang.',true);return false;}
  const controls=document.querySelector('.toggles'),card=document.querySelector('.chart-card');
  if(controls&&card){controls.classList.add('chart-options');controls.setAttribute('aria-label','Tùy chọn biểu đồ');card.before(controls);}
  $('relative').closest('label').title='Màu theo NetFlow cùng nến: SPY và QQQ cùng mua xanh, cùng bán đỏ, trái dấu cam, thiếu hoặc cân bằng xám. Chiều cao vẫn là Relative NetFlow mượt.';
  chart=L.createChart($('chart'),{autoSize:true,layout:{background:{type:'solid',color:'#0e1726'},textColor:'#91a5bd',fontSize:12,attributionLogo:true},grid:{vertLines:{color:'#1a283a'},horzLines:{color:'#1a283a'}},crosshair:{mode:L.CrosshairMode.Normal,doNotSnapToHiddenSeriesIndices:true,vertLine:{visible:true,labelVisible:true},horzLine:{visible:true,labelVisible:true}},timeScale:{timeVisible:true,secondsVisible:false,rightOffsetPixels:96,barSpacing:6,minBarSpacing:.5,lockVisibleTimeRangeOnResize:true},rightPriceScale:{autoScale:true,minimumWidth:64,tickMarkDensity:2.5},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:{time:true,price:true}},kineticScroll:{touch:true,mouse:false},localization:{locale:'vi-VN',timeFormatter:t=>new Date(t*1000).toLocaleString('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}});
  applyResponsiveChartOptions();
  price=chart.addSeries(L.CandlestickSeries,{title:'',priceFormat:{type:'price',precision:1,minMove:.1},priceLineVisible:true,priceLineColor:'#36ddbd',priceLineWidth:1,priceLineStyle:L.LineStyle.Dashed,lastValueVisible:true,borderVisible:false},0);
  series.priceMid=chart.addCustomSeries(new VariableWidthLineSeries,{color:'#f6c85f',baseLineVisible:false,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const key of ['priceUpper','priceLower'])series[key]=chart.addSeries(L.LineSeries,{color:'#4aa3ff',lineWidth:1,lineStyle:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const [key,color,width,style,last,title] of [
    ['pivotResistanceLow','rgba(255,180,84,.55)',1,L.LineStyle.Dashed,false,''],['pivotResistanceHigh','rgba(255,180,84,.55)',1,L.LineStyle.Dashed,false,''],['pivotResistanceMid','#ffb454',3,L.LineStyle.Solid,true,'REV6 Pivot KC'],
    ['pivotSupportLow','rgba(91,200,255,.55)',1,L.LineStyle.Dashed,false,''],['pivotSupportHigh','rgba(91,200,255,.55)',1,L.LineStyle.Dashed,false,''],['pivotSupportMid','#5bc8ff',3,L.LineStyle.Solid,true,'REV6 Pivot HT']
  ])series[key]=chart.addSeries(L.LineSeries,{color,lineWidth:width,lineStyle:style,priceLineVisible:false,lastValueVisible:last,crosshairMarkerVisible:false,title},0);
  for(const key of ['SPYUSDT','QQQUSDT'])series[key]=chart.addSeries(L.HistogramSeries,{priceScaleId:'taker-flow-strength-overlay',base:0,color:flowColors[key].up,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:fmtK},autoscaleInfoProvider:symmetricAutoscale},1);
  series.relative=chart.addSeries(L.HistogramSeries,{priceScaleId:'relative-strength-overlay',base:0,color:'rgba(112,126,145,.3)',title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:x=>`${fmt(x)}%`},autoscaleInfoProvider:symmetricAutoscale},1);
  series.relative.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.relative.createPriceLine({price:0,color:'#65768b',lineWidth:1,lineStyle:L.LineStyle.Dotted,axisLabelVisible:false});
  series.COMPOSITE=chart.addSeries(L.HistogramSeries,{priceScaleId:'taker-flow-strength-overlay',base:0,color:flowColors.COMPOSITE.up,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:fmtK},autoscaleInfoProvider:symmetricAutoscale},1);
  series.COMPOSITE.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.strength=chart.addSeries(L.BaselineSeries,{baseValue:{type:'price',price:0},topLineColor:'#1ae0a3',topFillColor1:'rgba(26,224,163,0)',topFillColor2:'rgba(26,224,163,0)',bottomLineColor:'#ff4d70',bottomFillColor1:'rgba(255,77,112,0)',bottomFillColor2:'rgba(255,77,112,0)',lineWidth:1,title:'',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:4,autoscaleInfoProvider:symmetricAutoscale},1);
  for(const key of ['mid','upper','lower'])series[key]=chart.addSeries(L.LineSeries,{color:key==='mid'?'#9db5d1':'#8596ad',lineWidth:key==='mid'?2:1,lineStyle:key==='mid'?L.LineStyle.Dotted:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:'',autoscaleInfoProvider:symmetricAutoscale},1);
  series.strength.createPriceLine({price:0,color:'rgba(145,165,189,.28)',lineWidth:1,lineStyle:L.LineStyle.Dotted,axisLabelVisible:false,title:''});
  series.strength.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  const strengthUnitFormat=x=>`${x>0?'+':''}${x.toFixed(2)}`;
  series.alignment=chart.addSeries(L.HistogramSeries,{priceScaleId:'spy-volume-delta-overlay',base:0,color:'#68778a',title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},autoscaleInfoProvider:symmetricAutoscale},2);
  series.alignment.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.volumeStrength=chart.addSeries(L.BaselineSeries,{baseValue:{type:'price',price:0},topLineColor:'#f6c85f',topFillColor1:'rgba(246,200,95,.12)',topFillColor2:'rgba(246,200,95,0)',bottomLineColor:'#f3f6fb',bottomFillColor1:'rgba(243,246,251,0)',bottomFillColor2:'rgba(243,246,251,.09)',lineWidth:3,title:'',priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:4,autoscaleInfoProvider:()=>({priceRange:{minValue:-1,maxValue:1}})},2);
  series.volumeStrength.createPriceLine({price:0,color:'#6f8299',lineWidth:1,lineStyle:L.LineStyle.Solid,axisLabelVisible:true,title:'0'});
  series.volumeStrength.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  for(const [id,label] of [['composite-flow-fixed','C Taker NF'],['spy-volume-fixed','SPY V']]){const node=document.createElement('div');node.id=id;node.className='pane-fixed-readout missing';node.textContent=`${label} —`;$('chart').append(node);}
  $('chart').dataset.compositeNetflowPane='removed';$('chart').dataset.netflowPane='removed';$('chart').dataset.takerFlowOverlay='spy-qqq-composite-relative';$('chart').dataset.compositeStrengthOverlay='pane-1-only-symmetric-zero';$('chart').dataset.compositeStrengthOverlayLabel='C Taker NF';$('chart').dataset.fixedReadoutSide='right-price-scale';$('chart').dataset.strengthLineWidth='1';$('chart').dataset.spyVolumeDeltaPane='2';$('chart').dataset.spyVolumeDeltaScale='symmetric-overlay';$('chart').dataset.spyVolumeDeltaTitle='hidden';$('chart').dataset.spyVolumeStrengthLabel='fixed-right';$('chart').dataset.spyVolumeStrengthUnits='signed-2dp';$('chart').dataset.spyVolumeStrengthPositive='#f6c85f';$('chart').dataset.spyVolumeStrengthNegative='#f3f6fb';
  chart.panes()[0].setStretchFactor(.55);chart.panes()[1].setStretchFactor(.27);chart.panes()[2].setStretchFactor(.18);
  marks=L.createSeriesMarkers(price,[]);
  strengthMarks=L.createSeriesMarkers(series.strength,[]);
  chart.subscribeCrosshairMove(p=>{if(!p.sourceEvent)return;inspectedTime=p.time?p.time*1000:null;showTooltip(inspectedTime??rows[$('symbol').value]?.at(-1)?.t);});
  $('chart').addEventListener('pointerleave',()=>{inspectedTime=null;showTooltip(rows[$('symbol').value]?.at(-1)?.t);});
  chart.timeScale().subscribeVisibleLogicalRangeChange(()=>{scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();schedulePivotFlowOverlay();});
  window.addEventListener('resize',()=>{applyResponsiveChartOptions();scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();schedulePivotFlowOverlay();requestAnimationFrame(positionForecastReadout);requestAnimationFrame(positionStrengthReadout);requestAnimationFrame(positionFixedPaneReadouts);requestAnimationFrame(updateCandleCountdown);});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{applyResponsiveChartOptions();window.dispatchEvent(new Event('resize'));},120));
  $('chart').addEventListener('pointermove',schedulePivotFlowOverlay,{passive:true});$('chart').addEventListener('wheel',schedulePivotFlowOverlay,{passive:true});
  bindChartGestures();
  return true;
}
function mixColor(from,to,t){return '#'+from.map((v,i)=>Math.round(v+(to[i]-v)*t).toString(16).padStart(2,'0')).join('');}
function candlePalette(x){
  if(!x?.direction)return {body:'#68778a',wick:'#8290a2',border:'#76869a'};
  const intensity=Math.min(1,.32+.68*Math.sqrt(Math.max(0,Math.min(1,x.agreement))));
  const target=x.direction>0?[8,232,169]:[255,65,99];
  return {body:mixColor([91,105,124],target,intensity),wick:mixColor([112,126,145],target,Math.min(1,intensity+.1)),border:mixColor([74,89,108],target,Math.min(1,intensity+.06))};
}
function priceDirectionPalette(x){const up=x.c>=x.o,target=up?[8,190,145]:[235,76,101];return {body:mixColor([91,105,124],target,.78),wick:mixColor([112,126,145],target,.88),border:mixColor([74,89,108],target,.84)};}
function lineData(data,key){return data.map(x=>Number.isFinite(x[key])?{time:x.t/1000,value:x[key]}:{time:x.t/1000});}
function priceLineData(data,compositeStrength,volumeStrength){const variable=$('phase-width').checked;return data.map(x=>{if(!Number.isFinite(x.mid))return {time:x.t/1000};const phase=variable?strengthPhaseLineStyle(compositeStrength.get(x.t),volumeStrength.get(x.t),{thick:6}):{width:2,color:'#f6c85f'};return {time:x.t/1000,value:x.mid,width:phase.width,phaseColor:phase.color};});}
function flowData(data,key){const palette=flowColors[key];return data.map(x=>Number.isFinite(x.net)?{time:x.t/1000,value:x.net,color:x.net>=0?palette.up:palette.down}:{time:x.t/1000});}
function relativeData(data){
  return data.map(x=>Number.isFinite(x.relative)?{time:x.t/1000,value:x.relative,color:relativeFlowColor(x)}:{time:x.t/1000});
}
function volumeDeltaBandData(data,volumeStrengthMap){return data.map(x=>({time:x.t/1000,value:volumeDeltaStrengthValue(x.value),color:volumeDeltaStrengthColor(x.value,volumeStrengthMap.get(x.t)?.adjusted)}));}
function scheduleCvdSpectrum(){if(cvdFrame)return;cvdFrame=requestAnimationFrame(()=>{cvdFrame=requestAnimationFrame(()=>{cvdFrame=0;drawCvdSpectrum();});});}
function scheduleDaySeparators(){if(dayFrame)return;dayFrame=requestAnimationFrame(()=>{dayFrame=requestAnimationFrame(()=>{dayFrame=0;drawDaySeparators();});});}
function scheduleGeometryOverlay(){if(geometryFrame)return;geometryFrame=requestAnimationFrame(()=>{geometryFrame=requestAnimationFrame(()=>{geometryFrame=0;drawGeometryOverlay();});});}
function schedulePivotFlowOverlay(){if(pivotFlowFrame)return;pivotFlowFrame=requestAnimationFrame(()=>{pivotFlowFrame=requestAnimationFrame(()=>{pivotFlowFrame=0;drawPivotFlowOverlay();});});}
function drawPivotFlowOverlay(){
  const canvas=$('pivot-flow-overlay'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);canvas.dataset.status='hidden';canvas.dataset.bins='0';canvas.dataset.live='false';delete canvas.dataset.barWidth;delete canvas.dataset.barSpacing;delete canvas.dataset.placement;delete canvas.dataset.mode;delete canvas.dataset.volatilityKey;delete canvas.dataset.volatilityScore;canvas.setAttribute('aria-label','Histogram Composite NF và mức biến động 5 nến: chưa hiển thị vì thiếu dữ liệu SPY/QQQ hoặc chart không phải SPY.');
  const {support,resistance}=pivotZoneState,flow=pivotFlowState,live=!!flow?.live&&$('live-indicator').className==='live'&&!!lastSuccess&&Date.now()-lastSuccess<15000;
  if(!$('pivot-zones').checked||$('symbol').value!=='SPYUSDT'||!flow)return;
  const paneHeight=chart.panes()[0]?.getHeight?.()??height*.5,position=pivotFlowZeroCoordinate(paneHeight,resistance?price.priceToCoordinate(resistance.low):null,support?price.priceToCoordinate(support.high):null);
  if(!position)return;
  const scaleWidth=chart.priceScale('right',0)?.width?.()??56,right=width-scaleWidth-7,layout=pivotFlowLayout(chart.timeScale().options().barSpacing,flow.bins.length,right-12);
  if(!layout)return;
  const {panelWidth,barWidth,gap,shownCount}=layout,left=right-panelWidth,zero=position.zero,halfHeight=Math.min(width<650?26:36,zero-20,paneHeight-zero-20),bars=flow.bins.slice(-shownCount),maxPct=Math.max(10,...bars.map(bar=>Math.abs(bar.pct??0)));
  if(halfHeight<14)return;
  context.save();context.fillStyle='rgba(9,18,31,.87)';context.strokeStyle='rgba(113,137,165,.65)';context.lineWidth=1;context.fillRect(left,zero-halfHeight-15,panelWidth,2*halfHeight+30);context.strokeRect(left+.5,zero-halfHeight-14.5,panelWidth-1,2*halfHeight+29);
  context.strokeStyle='rgba(151,168,188,.75)';context.setLineDash([2,3]);context.beginPath();context.moveTo(left+3,zero+.5);context.lineTo(right-3,zero+.5);context.stroke();context.setLineDash([]);
  for(let i=0;i<bars.length;i++){
    const value=bars[i].pct;if(!Number.isFinite(value))continue;
    const x=left+6+i*(barWidth+gap),size=Math.max(1,Math.min(halfHeight-3,Math.abs(value)/maxPct*(halfHeight-3)));
    context.fillStyle=value>0?'rgba(26,224,163,.88)':value<0?'rgba(255,77,112,.88)':'rgba(120,138,158,.7)';context.fillRect(x,value>=0?zero-size:zero,barWidth,size);
    if(live&&i===bars.length-1){context.strokeStyle='#f8bc62';context.lineWidth=1.5;context.strokeRect(x-.5,(value>=0?zero-size:zero)-.5,barWidth+1,size+1);}
  }
  const volatility=flow.volatility,volScore=volatility?.score,volShort=volatility?.key==='medium'?'TB':volatility?.label??'—',wideHeader=panelWidth>=125,volText=Number.isFinite(volScore)?wideHeader?`VOL ${volatility.label} · ${volScore}%`:`V${volScore} ${volShort}`:'VOL —';
  context.font=`700 ${width<650?9:10}px Inter,system-ui,sans-serif`;context.textBaseline='middle';context.textAlign='left';context.fillStyle=volatility?.key==='high'?'#ffb454':volatility?.key==='low'?'#6ebcff':volatility?.key==='medium'?'#f6c85f':'#9aadc2';context.fillText(volText,left+5,zero-halfHeight-7,panelWidth-(live?(wideHeader?36:18):8));
  const headerRight=live?(wideHeader?'LIVE':'●'):shownCount<flow.bins.length&&panelWidth>=72?`${shownCount}/${flow.bins.length}`:'';
  if(headerRight){context.textAlign='right';context.fillStyle=live?'#f8bc62':'#b4c4d6';context.fillText(headerRight,right-5,zero-halfHeight-7);}
  context.fillStyle='rgba(3,10,19,.96)';context.fillRect(left+1,zero+halfHeight-1,panelWidth-2,14);
  context.font=`800 ${width<650?11:12}px Inter,system-ui,sans-serif`;context.textAlign='right';context.fillStyle=flow.pct>0?'#39f0b9':flow.pct<0?'#ff718d':'#e1ebf7';context.fillText(`${flow.pct>0?'+':''}${fmt(flow.pct)}%`,right-5,zero+halfHeight+6,panelWidth-10);
  context.textAlign='right';context.fillStyle='#9aadc2';context.fillText('0',right-5,zero+9);context.restore();canvas.dataset.status='visible';canvas.dataset.live=String(live);canvas.dataset.mode=flow.mode??'pivot';canvas.dataset.placement=position.placement;canvas.dataset.bins=String(bars.length);canvas.dataset.barWidth=String(barWidth);canvas.dataset.barSpacing=String(layout.barSpacing);canvas.dataset.volatilityKey=volatility?.key??'missing';canvas.dataset.volatilityScore=Number.isFinite(volScore)?String(volScore):'';canvas.setAttribute('aria-label',`Biến động 5 nến: ${volatility?`${volatility.label} ${volatility.score}%, biên độ trung bình ${fmt(volatility.rangePct)}%, realized volatility ${fmt(volatility.realizedPct)}%, chuẩn so sánh ${volatility.baselineN} cửa sổ ${volatility.baselineSession}`:'chưa đủ lịch sử'}. Histogram 5 nến Composite NF gần nhất. Phần trăm dùng EWMA half-life ${flow.pctHalfLife??32} nến, ${flow.mode==='rolling'?'trên nhóm 96 nến gần nhất':'từ cặp pivot xác nhận tới nến hiện tại'}: ${flow.pct>0?'mua':flow.pct<0?'bán':'cân bằng'} ${fmt(Math.abs(flow.pct))}%; mỗi cột rộng gấp đôi bước nến giá. ${position.placement==='pane-center'?'Mốc 0 đặt giữa pane vì chưa thấy đủ hai vùng hỗ trợ/kháng cự.':'Mốc 0 đặt giữa hỗ trợ và kháng cự.'} ${live?'Cột cuối có viền vàng; histogram, biến động và số phần trăm đều cập nhật theo nến live.':'Chưa có dữ liệu nến đang chạy mới từ cả SPY và QQQ.'} Buy trên mốc 0, sell dưới. Không phải tín hiệu OFI độc lập.`);
}
function positionForecastReadout(){
  const node=$('geometry-readout'),paneHeight=chart?.panes?.()[0]?.getHeight?.();
  if(!node||!Number.isFinite(paneHeight))return;
  node.style.top=`${Math.max(8,paneHeight-node.offsetHeight-10)}px`;
}
function updateCandleCountdown(){
  const node=$('candle-countdown'),bar=(rows.SPYUSDT??[]).at(-1),show=$('interval').value==='15m'&&$('symbol').value==='SPYUSDT';
  if(!node||!show||!bar){if(node)node.style.display='none';return;}
  node.style.display='block';
  const serverNow=Date.now()+serverOffsetMs,remaining=Math.max(0,bar.end+1-serverNow),seconds=Math.ceil(remaining/1000);
  const minutes=Math.floor(seconds/60),rest=seconds%60;
  node.textContent=`${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
  node.className=remaining>0?'':'missing';
  const y=price.priceToCoordinate(bar.c),paneHeight=chart?.panes?.()[0]?.getHeight?.();
  node.style.right='2ch';node.style.width='auto';
  if(Number.isFinite(y)&&Number.isFinite(paneHeight))node.style.top=`${Math.max(2,Math.min(paneHeight-node.offsetHeight-2,y+11))}px`;
}
function drawCvdSpectrum(){
  const canvas=$('cvd-spectrum'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
  if(!$('cvd-spectrum-toggle').checked||!cvdProfile.bins.length||!cvdProfile.maxAbs||cvdAnchorTime===null)return;
  const anchor=chart.timeScale().timeToCoordinate(cvdAnchorTime/1000);if(!Number.isFinite(anchor))return;
  const paneHeight=chart.panes()[0]?.getHeight?.()??height*.5,scaleWidth=chart.priceScale('right',0)?.width?.()??56;
  const maxWidth=Math.min(width<650?48:76,Math.max(34,width*.14)),usableRight=width-scaleWidth-5;
  const xBase=Math.max(maxWidth+5,Math.min(usableRight-maxWidth-5,anchor+maxWidth+8)),scale=maxWidth/cvdProfile.maxAbs;
  const visible=cvdProfile.bins.map(bin=>({...bin,y:price.priceToCoordinate(bin.price)})).filter(bin=>Number.isFinite(bin.y)&&bin.y>=0&&bin.y<=paneHeight);
  if(!visible.length)return;
  context.save();context.setLineDash([3,4]);context.strokeStyle='rgba(151,164,181,.55)';context.lineWidth=1;context.beginPath();context.moveTo(xBase,visible[0].y);context.lineTo(xBase,visible.at(-1).y);context.stroke();context.setLineDash([]);
  let buy=null,sell=null;
  for(const bin of visible){
    const x=xBase+bin.value*scale,ratio=Math.abs(bin.value)/cvdProfile.maxAbs;
    context.strokeStyle=bin.value>=0?`rgba(42,120,214,${.4+.5*ratio})`:`rgba(235,104,52,${.4+.5*ratio})`;context.lineWidth=(width<650?2.5:3.5)+(width<650?1:1.5)*ratio;context.beginPath();context.moveTo(xBase,bin.y);context.lineTo(x,bin.y);context.stroke();
    if(bin.value>0&&(!buy||bin.value>buy.value))buy={...bin,x};if(bin.value<0&&(!sell||bin.value<sell.value))sell={...bin,x};
  }
  context.font=`600 ${width<650?9:10}px Inter,system-ui,sans-serif`;context.textBaseline='bottom';context.textAlign='center';context.fillStyle='rgba(196,210,226,.9)';context.fillText(`CVD∞ ${cvdSourceLabel} · bin ${cvdProfile.binStep}`,xBase,Math.max(12,visible[0].y-5));
  if(width>=650){context.textBaseline='middle';if(buy){context.textAlign='left';context.fillStyle='#70aef4';context.fillText(`▲ ${fmt(buy.price)}`,Math.min(usableRight-42,buy.x+5),buy.y);}if(sell){context.textAlign='right';context.fillStyle='#f28a61';context.fillText(`▼ ${fmt(sell.price)}`,Math.max(42,sell.x-5),sell.y);}}
  context.restore();
}
function drawDaySeparators(){
  const canvas=$('day-separators'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
  canvas.dataset.count=String(dayBoundaries.length);
  if(!$('markers').checked||!dayBoundaries.length)return;
  const scaleWidth=chart.priceScale('right',0)?.width?.()??56,right=width-scaleWidth,bottom=height-26;
  context.save();context.strokeStyle='rgba(126,154,188,.38)';context.lineWidth=1;
  for(const time of dayBoundaries){
    const x=chart.timeScale().timeToCoordinate(time/1000);if(!Number.isFinite(x)||x<0||x>right)continue;
    const crisp=Math.round(x)+.5;context.beginPath();context.moveTo(crisp,0);context.lineTo(crisp,bottom);context.stroke();
  }
  context.restore();
}
function geometryLineText(line){
  const name=line.kind==='support'?'Hỗ trợ':'Kháng cự',slope=`${line.slopeAtr>=0?'+':''}${fmt(line.slopeAtr)} ATR/nến`;
  return `${name} ${line.score}/100 · ${line.touches} chạm · tuổi ${line.ageBars} · dốc ${slope} · lệch ${fmt(line.rmseAtr)} ATR · hợp lưu ${Math.round(line.confluence*100)}%`;
}
function updateGeometryReadout(){
  const node=$('geometry-readout');if(!node)return;node.style.display='block';
  node.textContent=formatPreRthWlrTrend(rev63State);
  node.className=`forecast ${rev63State.label.toLowerCase()}`;
  node.title=`PRE→RTH WLR M15 · ${rev63State.reason}. ${rev63State.active?`Điểm ${rev63State.trendScore}/100 · R² ${fmt(rev63State.r2)} · đồng pha ${Math.round((rev63State.phaseShare??0)*100)}% · mẫu ${rev63State.sampleN}, kiểm duyệt phải ${rev63State.censoredN??0}. `:''}P(tiếp diễn thêm 3 nến | trend đã tồn tại n nến) = S(n+3) / S(n), với S ước lượng Kaplan–Meier. Nến đang chạy không được tính; trend còn chạy lúc 16:00 được xem là kiểm duyệt phải, không bị gán là đã kết thúc.`;
  requestAnimationFrame(positionForecastReadout);
}
function drawGeometryOverlay(){
  const canvas=$('geometry-overlay'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);canvas.dataset.lines=String(geometryState.lines?.length??0);canvas.dataset.provisionalLines=String(geometryState.provisionalLines?.length??0);canvas.dataset.pivots=String(geometryState.pivots?.length??0);canvas.dataset.states=String(geometryStatePoints.length);
  if(!$('geometry-toggle').checked||(!geometryState.lines?.length&&!geometryState.provisionalLines?.length&&!breakoutState&&!geometryStatePoints.length))return;
  const paneHeight=chart.panes()[0]?.getHeight?.()??height*.5,scaleWidth=chart.priceScale('right',0)?.width?.()??56,right=width-scaleWidth;
  context.save();context.lineJoin='round';context.lineCap='round';
  for(const line of geometryState.provisionalLines??[]){
    const x1=chart.timeScale().timeToCoordinate(line.startTime/1000),x2=chart.timeScale().timeToCoordinate(line.endTime/1000),y1=price.priceToCoordinate(line.startValue),y2=price.priceToCoordinate(line.endValue);
    if(![x1,x2,y1,y2].every(Number.isFinite)||Math.max(x1,x2)<0||Math.min(x1,x2)>right||Math.max(y1,y2)<0||Math.min(y1,y2)>paneHeight)continue;
    context.strokeStyle=line.kind==='support'?'rgba(54,221,189,.5)':'rgba(255,180,84,.5)';context.lineWidth=1.4;context.setLineDash([3,5]);context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();
  }
  for(const line of [...geometryState.lines].reverse()){
    const x1=chart.timeScale().timeToCoordinate(line.startTime/1000),x2=chart.timeScale().timeToCoordinate(line.endTime/1000),y1=price.priceToCoordinate(line.startValue),y2=price.priceToCoordinate(line.endValue);
    if(![x1,x2,y1,y2].every(Number.isFinite)||Math.max(x1,x2)<0||Math.min(x1,x2)>right||Math.max(y1,y2)<0||Math.min(y1,y2)>paneHeight)continue;
    const alpha=.48+.45*Math.max(0,Math.min(1,(line.score-55)/35));context.strokeStyle=line.kind==='support'?`rgba(54,221,189,${alpha})`:`rgba(255,180,84,${alpha})`;context.lineWidth=1.2+2*Math.max(0,Math.min(1,(line.score-55)/35));context.setLineDash(line.score>=75?[]:[6,4]);context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();
    if(width>=650&&x2>70&&x2<right-6&&y2>10&&y2<paneHeight-8){context.setLineDash([]);context.font='700 9px Inter,system-ui,sans-serif';context.textAlign='right';context.textBaseline='bottom';context.fillStyle=line.kind==='support'?'#7dffd9':'#ffd092';context.fillText(`${line.kind==='support'?'HT':'KC'} ${line.score} · ${line.touches}x`,x2-4,y2-3);}
  }
  context.setLineDash([]);for(const point of geometryStatePoints){
    const x=chart.timeScale().timeToCoordinate(point.at/1000),y=price.priceToCoordinate(point.lineValue);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>right||y<0||y>paneHeight)continue;
    const color=point.breakDirection>0?'#1ae0a3':'#ff6383',trueBreak=point.key==='true_break';context.fillStyle=trueBreak?color:'rgba(9,18,31,.96)';context.strokeStyle=color;context.lineWidth=trueBreak?1.4:2.4;context.beginPath();context.arc(x,y,5,0,Math.PI*2);context.fill();context.stroke();context.font='900 8px Inter,system-ui,sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillStyle=trueBreak?'#07131f':color;context.fillText(point.breakDirection>0?'↑':'↓',x,y+.3);
  }
  if($('geometry-pivots').checked){
    context.setLineDash([]);for(const pivot of geometryState.pivots.slice(-60)){
      const x=chart.timeScale().timeToCoordinate(pivot.t/1000),y=price.priceToCoordinate(pivot.value);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>right||y<0||y>paneHeight)continue;
      context.fillStyle=pivot.type==='low'?'rgba(54,221,189,.8)':'rgba(255,180,84,.8)';context.beginPath();context.arc(x,y,Math.min(4,2+pivot.prominenceAtr),0,Math.PI*2);context.fill();
    }
    const priceRows=new Map((rows[$('symbol').value]??[]).map(row=>[row.t,row])),threshold=Number($('geometry-score').value);for(const event of geometryState.events.filter(event=>event.score>=threshold).slice(-16)){
      const pivot=event.secondPivot,confirmed=priceRows.get(event.at),x=chart.timeScale().timeToCoordinate(pivot.t/1000),y=price.priceToCoordinate(pivot.value),tipX=chart.timeScale().timeToCoordinate(event.at/1000),tipY=price.priceToCoordinate(confirmed?.c);if(![x,y,tipX,tipY].every(Number.isFinite)||Math.max(x,tipX)<0||Math.min(x,tipX)>right||Math.max(y,tipY)<0||Math.min(y,tipY)>paneHeight)continue;
      const color=event.direction==='bullish'?'#0c4bf8':event.direction==='bearish'?'#ffb454':'#c194ff',dx=tipX-x,dy=tipY-y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,endX=tipX-ux*5,endY=tipY-uy*5,angle=Math.atan2(dy,dx),head=6;context.strokeStyle=color;context.fillStyle=color;context.lineWidth=2.2;context.beginPath();context.moveTo(x,y);context.lineTo(endX,endY);context.stroke();context.beginPath();context.moveTo(tipX,tipY);context.lineTo(tipX-head*Math.cos(angle-Math.PI/6),tipY-head*Math.sin(angle-Math.PI/6));context.lineTo(tipX-head*Math.cos(angle+Math.PI/6),tipY-head*Math.sin(angle+Math.PI/6));context.closePath();context.fill();
      if(event.direction==='rotation'){const back=angle+Math.PI;context.beginPath();context.moveTo(x,y);context.lineTo(x-head*Math.cos(back-Math.PI/6),y-head*Math.sin(back-Math.PI/6));context.lineTo(x-head*Math.cos(back+Math.PI/6),y-head*Math.sin(back+Math.PI/6));context.closePath();context.fill();}
    }
  }
  context.restore();
}
function render(fit=false){
  const range=chart.timeScale().getVisibleLogicalRange();
  const p=rows[$('symbol').value]??[],signalRows=rows[$('signal').value]??[],model=Object.keys(modelRows).length?modelRows:rows;
  dayBoundaries=dayBoundaryTimes(p);
  const compositeCvd=$('symbol').value==='SPYUSDT',cvdBars=compositeCvd?projectNetFlowToPrice(p,rows.COMPOSITE??[]):p;
  cvdSourceLabel=compositeCvd?'C→S':'Q';$('cvd-spectrum').dataset.source=compositeCvd?'COMPOSITE→SPY':'QQQUSDT';
  cvdProfile=continuousCvdSpectrum(cvdBars);cvdAnchorTime=cvdBars.at(-1)?.t??null;
  const alignment=flowAlignment(rows.SPYUSDT??[],rows.QQQUSDT??[],{step:STEPS[$('interval').value]});
  const closedBefore=cache?.serverTime??Infinity,closedPrice=p.filter(row=>(row.end??row.t)<closedBefore),closedTimes=new Set(closedPrice.map(row=>row.t)),modelPrice=model[$('symbol').value]??p,modelClosedPrice=modelPrice.filter(row=>(row.end??row.t)<closedBefore),modelClosedTimes=new Set(modelClosedPrice.map(row=>row.t));
  const geometryInput={price:closedPrice,spy:(rows.SPYUSDT??[]).filter(row=>closedTimes.has(row.t)),qqq:(rows.QQQUSDT??[]).filter(row=>closedTimes.has(row.t)),flow:(rows.COMPOSITE??[]).filter(row=>closedTimes.has(row.t)),volume:volumeStrengthRows.filter(row=>closedTimes.has(row.t))},geometryOptions={minScore:Number($('geometry-score').value),maxLines:Number($('geometry-lines').value)};
  geometryState=analyzeGeometry(geometryInput,geometryOptions);breakoutState=analyzeBreakoutRetest(geometryInput,geometryOptions);const statePointsKey=`${$('symbol').value}|${$('interval').value}|${$('days').value}|${closedPrice.at(-1)?.t??0}|${closedPrice.length}|${geometryOptions.minScore}|${geometryOptions.maxLines}`;if(statePointsKey!==geometryStatePointsKey){geometryStatePoints=recentCausalLineStates(geometryInput,{...geometryOptions,stateLookbackBars:600},4);geometryStatePointsKey=statePointsKey;}
  geometryBacktest=backtestGeometry(closedPrice,geometryState.events,{horizon:4,minMoveAtr:.35});
  const volumeStrengthMap=new Map(volumeStrengthRows.map(x=>[x.t,x]));
  candleColorMap=new Map(p.map(x=>[x.t,strengthAgreementCandleSignal(maps.COMPOSITE?.get(x.t),volumeStrengthMap.get(x.t))]));
  const agreementColors=$('candle-agreement-color').checked;
  price.applyOptions({priceFormat:$('symbol').value==='SPYUSDT'?{type:'price',precision:1,minMove:.1}:{type:'price',precision:2,minMove:.01}});
  price.setData(p.map(x=>{const color=agreementColors?candlePalette(candleColorMap.get(x.t)):priceDirectionPalette(x);return {time:x.t/1000,open:x.o,high:x.h,low:x.l,close:x.c,color:color.body,wickColor:color.border};}));
  statsMap=strengthStatistics({...rows,alignment},$('symbol').value,$('signal').value,STEPS[$('interval').value]);
  const pivotComposite=(model.COMPOSITE??[]).filter(row=>modelClosedTimes.has(row.t)),pivotVolume=(modelVolumeStrengthRows.length?modelVolumeStrengthRows:volumeStrengthRows).filter(row=>modelClosedTimes.has(row.t));
  const nextPivotKey=`${$('symbol').value}|${$('interval').value}|${modelClosedPrice.at(-1)?.t??0}|${modelClosedPrice.length}|${pivotComposite.length}|${pivotVolume.length}`;
  if(nextPivotKey!==pivotZoneKey){pivotZoneState=pivotZones({price:modelClosedPrice,composite:pivotComposite,volume:pivotVolume},STEPS[$('interval').value]);pivotZoneKey=nextPivotKey;}
  pivotFlowState=pivotFlowRealtime(pivotZoneState.flow,rows.SPYUSDT??[],rows.COMPOSITE??[],closedBefore,pivotFlowState?.volatility?.key);
  const priceBands=weightedPriceBands(p,STEPS[$('interval').value]);priceBandMap=new Map(priceBands.map(x=>[x.t,x]));
  updateRev63();
  series.priceMid.setData(priceLineData(priceBands,maps.COMPOSITE??new Map(),volumeStrengthMap));series.priceUpper.setData(lineData(priceBands,'upper'));series.priceLower.setData(lineData(priceBands,'lower'));
  for(const key of Object.keys(colors))series[key].setData(flowData(rows[key]??[],key));
  series.relative.setData(relativeData(alignment));
  series.alignment.setData(volumeDeltaBandData(directionalVolumeDelta(rows.SPYUSDT??[],STEPS[$('interval').value]),volumeStrengthMap));
  series.strength.setData(lineData(signalRows,'adjusted'));
  series.volumeStrength.setData(lineData(volumeStrengthRows,'adjusted'));
  strengthMarks.setMarkers(signalRows.filter(x=>Number.isFinite(x.adjusted)&&x.adjusted>.95).map(x=>({time:x.t/1000,position:'inBar',color:'#7dffd9',shape:'circle',text:''})));
  for(const key of ['mid','upper','lower'])series[key].setData(lineData(signalRows,key));
  let previousDay=null,previousSession=null;
  marks.setMarkers(p.flatMap(x=>{let text=null;if(x.session==='RTH'&&previousSession!=='RTH')text='RTH';else if(x.day!==previousDay)text=x.day.slice(5);previousDay=x.day;previousSession=x.session;return text?[{time:x.t/1000,position:'aboveBar',color:text==='RTH'?'#f8bc62':'#788ca5',shape:'circle',text}]:[];}));
  toggle();
  if(fit){if(!applySavedTimeRange(p))fitChart();}else if(range)chart.timeScale().setVisibleLogicalRange(range);
  if(inspectedTime!==null&&!maps[$('symbol').value]?.has(inspectedTime))inspectedTime=null;
  showTooltip(inspectedTime??p.at(-1)?.t);
  requestAnimationFrame(updateCandleCountdown);
  scheduleCvdSpectrum();
  scheduleDaySeparators();
  scheduleGeometryOverlay();
  schedulePivotFlowOverlay();
  updateGeometryReadout();
  $('export').disabled=!p.length;
}
function statValue(id,text,color='neutral'){const node=$(id);node.textContent=text;node.className=color;}
function latestStrength(key){const data=rows[key]??[];for(let i=data.length-1;i>=0;i--)if(Number.isFinite(data[i].adjusted))return data[i].adjusted;return null;}
function positionStrengthReadout(){
  const host=$('strength-readout'),panes=chart?.panes?.();if(!host||!panes?.[1]||!series.strength)return;
  const heights=panes.map(pane=>pane.getHeight()),chartHeight=$('chart').clientHeight,total=heights.reduce((sum,height)=>sum+height,0),gap=panes.length>1?Math.max(0,chartHeight-total)/(panes.length-1):0;
  const paneTop=heights[0]+gap,paneHeight=heights[1],topLimit=paneTop+4,bottomLimit=paneTop+paneHeight-4;
  const zeroCoordinate=series.strength.priceToCoordinate(0);if(!Number.isFinite(zeroCoordinate))return;
  const points=['strength-spy','strength-qqq','strength-composite'].map(id=>{const node=$(id);return {node,height:node.offsetHeight||20};}),labelGap=4,stackHeight=points.reduce((sum,point)=>sum+point.height,0)+labelGap*(points.length-1),zeroY=paneTop+zeroCoordinate;
  let top=Math.max(topLimit,Math.min(bottomLimit-stackHeight,zeroY-stackHeight/2));
  for(const point of points){point.node.style.top=`${Math.round(top)}px`;top+=point.height+labelGap;}
  host.dataset.paneTop=String(Math.round(paneTop));host.dataset.paneBottom=String(Math.round(paneTop+paneHeight));host.dataset.zeroY=String(Math.round(zeroY));
}
function updateStrengthLabels(){
  $('strength-readout').style.display=$('show-strength').checked?'block':'none';
  for(const [key,id,label] of [['SPYUSDT','strength-spy','SPY'],['QQQUSDT','strength-qqq','QQQ'],['COMPOSITE','strength-composite','']]){const value=latestStrength(key),node=$(id);node.textContent=label?`${label} ${fmt(value)}`:fmt(value);node.className=Number.isFinite(value)?value>=0?'positive':'negative':'missing';}
  requestAnimationFrame(positionStrengthReadout);
}
function paneBounds(index){
  const panes=chart?.panes?.();if(!panes?.[index])return null;const heights=panes.map(pane=>pane.getHeight()),chartHeight=$('chart').clientHeight,total=heights.reduce((sum,height)=>sum+height,0),gap=panes.length>1?Math.max(0,chartHeight-total)/(panes.length-1):0;
  return {top:heights.slice(0,index).reduce((sum,height)=>sum+height,0)+index*gap,height:heights[index]};
}
function positionFixedPaneReadouts(){
  for(const [id,index] of [['composite-flow-fixed',1],['spy-volume-fixed',2]]){const node=$(id),bounds=paneBounds(index);if(!node||!bounds)continue;node.style.top=`${Math.round(bounds.top+6)}px`;node.dataset.paneTop=String(Math.round(bounds.top));node.dataset.paneBottom=String(Math.round(bounds.top+bounds.height));}
}
function latestFiniteValue(data,key){for(let i=data.length-1;i>=0;i--)if(Number.isFinite(data[i]?.[key]))return data[i][key];return null;}
function updateFixedPaneReadouts(){
  const compositeValue=latestFiniteValue(rows.COMPOSITE??[],'net'),compositeNode=$('composite-flow-fixed');compositeNode.textContent=`C Taker NF ${fmtK(compositeValue)}`;compositeNode.className=`pane-fixed-readout ${Number.isFinite(compositeValue)?compositeValue>=0?'positive':'negative':'missing'}`;compositeNode.style.display=$('composite').checked?'block':'none';
  const volumeValue=latestFiniteValue(volumeStrengthRows,'adjusted'),volumeNode=$('spy-volume-fixed');volumeNode.textContent=`SPY V ${signed(volumeValue)}`;volumeNode.className=`pane-fixed-readout spy-volume ${Number.isFinite(volumeValue)?volumeValue>=0?'positive':'negative':'missing'}`;volumeNode.style.display=$('spy-volume-strength').checked?'block':'none';
  requestAnimationFrame(positionFixedPaneReadouts);
}
function updatePivotZones(){
  const enabled=$('pivot-zones').checked,node=$('pivot-zone-readout');
  for(const [kind,prefix] of [['resistance','pivotResistance'],['support','pivotSupport']]){
    const zone=enabled?pivotZoneState[kind]:null;
    for(const [suffix,value] of [['Low',zone?.low],['Mid',zone?.level],['High',zone?.high]])series[prefix+suffix].setData(zone&&Number.isFinite(value)?[{time:zone.start/1000,value},{time:zone.end/1000,value}]:[]);
  }
  node.style.display='none';node.setAttribute('aria-hidden','true');node.replaceChildren();
}
function showTooltip(t){
  const p=maps[$('symbol').value]?.get(t),record=statsMap.get(t),state=record?.state,colorSignal=candleColorMap.get(t),geometryEvent=geometryState.events?.find(event=>event.at===t),breakoutEvent=geometryStatePoints.find(event=>event.at===t)??(breakoutState&&breakoutState.at===t&&['true_break','false_break'].includes(breakoutState.key)?breakoutState:null),geometryLine=inspectedTime===null?geometryState.lines?.[0]:null;
  const time=p?new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York'})+' ET':'Chưa có dữ liệu';
  const running=p&&p.end>=(cache?.serverTime??Infinity),mode=inspectedTime!==null?'NẾN ĐANG XEM':'MỚI NHẤT';
  if(!state){
    for(const id of ['stat-group','stat-score','stat-pair'])statValue(id,'—');
    for(const id of ['stat-group-note','stat-score-note','stat-pair-note'])$(id).textContent='Chờ đủ Strength và quote volume của SPY/QQQ';
    $('tooltip').textContent=`${mode} · ${time} · Chưa đủ dữ liệu để chấm điểm và thống kê nhóm Strength.`;return;
  }
  $('stat-group').replaceChildren(...state.signs.map((s,i)=>{const span=document.createElement('span');span.className=tone(s);span.textContent=`${['S','Q','C'][i]}${signLabel(s)}`;return span;}));
  $('stat-group-note').textContent=`${sourceName($('signal').value)} ${signed(state.value)} · ${state.session}${state.marker?' · ● >0.95':state.extreme?' · <−0.95':''}`;
  statValue('stat-score',state.score===null?'Trung tính':`${state.score}/100`,state.score>=65?'positive':state.score<40?'negative':'neutral');
  $('stat-score-note').textContent=`Mua ${fmt(state.buyShare*100)}% / Bán ${fmt(state.sellShare*100)}% · ${state.flowDirection===0?'Cân bằng':state.flowDirection===state.direction?'Cùng dấu':'Ngược dấu Strength'}`;
  const a=state.alignment;
  statValue('stat-pair',a.detailState, a.detailState==='THUẬN MUA'?'positive':a.detailState==='THUẬN BÁN'?'negative':'neutral');
  $('stat-pair-note').textContent=`NF% mượt · S ${signed(a.smoothSpyNf)} / Q ${signed(a.smoothQqqNf)}`;
  const regimeText=colorSignal?.direction?`Composite×Volume ${colorSignal.colorRegime}: Composite ${signed(colorSignal.compositeStrength)}, SPY Volume ${signed(colorSignal.volumeStrength)}; độ đậm theo min(|Composite|, |Volume|) = ${fmt(colorSignal.agreement)}.`:`Composite×Volume TRUNG TÍNH${colorSignal?.neutralReason?` (${colorSignal.neutralReason.toLowerCase()})`:''}: Composite ${signed(colorSignal?.compositeStrength)}, SPY Volume ${signed(colorSignal?.volumeStrength)}; trái dấu, bằng 0 hoặc thiếu dữ liệu đều dùng xám.`;
  const colorText=$('candle-agreement-color').checked?`Màu nến ${regimeText}`:`Màu nến C×V đang tắt; chart dùng xanh/đỏ theo thân giá. Chế độ thống kê vẫn ghi nhận ${regimeText}`;
  const text=[`${mode} · ${time} · ${state.session} · Giá ${sourceName($('symbol').value)}, Strength phân tích ${sourceName($('signal').value)}${running?' · Nến đang chạy: điểm tạm thời, lịch sử so sánh dùng nến đóng':''}`,
    geometryLine?`GEO hiện tại: ${geometryLineText(geometryLine)}. Line chỉ xuất hiện từ ${new Date(geometryLine.knownAt).toLocaleString('vi-VN',{timeZone:'America/New_York'})} ET, sau khi pivot thứ hai được xác nhận; không dùng nến đang chạy.`:null,
    breakoutEvent?`Thông báo cắt Trendline causal: ${breakoutEvent.label} ${breakoutEvent.breakDirection>0?'lên ↑':'xuống ↓'} tại ${breakoutEvent.lineKind==='support'?'hỗ trợ':'kháng cự'} ${fmt(breakoutEvent.lineValue)} · line ${breakoutEvent.lineScore}/100 · cách ${fmt(breakoutEvent.distanceAtr)} ATR${breakoutEvent.key==='true_break'?' · Strength Composite, SPY V và NetFlow cùng xác nhận hướng phá':' · giá đã giành lại phía cũ của line'}. Line tham chiếu đã tồn tại và được khóa trước hai nến xác nhận.`:null,
    geometryEvent?`Dị biệt được xác nhận tại nến này: ${geometryEvent.direction==='bullish'?'phân kỳ tăng':geometryEvent.direction==='bearish'?'phân kỳ giảm':'SPY/QQQ luân phiên dẫn dắt'} · điểm ${geometryEvent.score}/100 · ΔStrength SPY ${signed(geometryEvent.spyDelta)} / QQQ ${signed(geometryEvent.qqqDelta)} / SPY V ${signed(geometryEvent.volumeDelta)} · ΔNetFlow ${signed(geometryEvent.flowDelta)}${geometryEvent.pairSplit?` · Strength SPY và QQQ ngược nhau, giá đang gần nhịp ${geometryEvent.leader==='SPY'?'SPY':geometryEvent.leader==='QQQ'?'QQQ':'hỗn hợp'}`:''}. Đây là mô tả hợp lưu tại thời điểm xác nhận, không phải dự báo chắc chắn.`:null,
    `Màu SPY−QQQ tương đối dùng dấu NetFlow cùng nến: ${a.state} · SPY ${signed(a.spyNet)} / QQQ ${signed(a.qqqNet)}. Chiều cao vẫn là Relative NetFlow mượt, không dùng dữ liệu sổ lệnh.`,
    colorText,
    `Điểm xác nhận ${state.score??'—'}/100 = Taker ${fmt(state.taker)}/50 + Dải ${fmt(state.pair)}/30 + |Strength| ${fmt(state.strength)}/20. Điểm theo quy tắc, không phải xác suất thắng.`];
  const nodes=text.filter(Boolean).map(value=>{const div=document.createElement('div');div.textContent=value;return div;});
  $('tooltip').replaceChildren(...nodes);
}
function toggle(){
  for(const [id,key] of [['spy','SPYUSDT'],['qqq','QQQUSDT'],['composite','COMPOSITE'],['show-strength','strength'],['spy-volume-strength','volumeStrength']])series[key].applyOptions({visible:$(id).checked});
  strengthMarks.applyOptions({visible:$('show-strength').checked});
  $('cvd-spectrum').style.display=$('cvd-spectrum-toggle').checked?'block':'none';scheduleCvdSpectrum();
  $('day-separators').style.display=$('markers').checked?'block':'none';scheduleDaySeparators();
  $('geometry-overlay').style.display=$('geometry-toggle').checked?'block':'none';scheduleGeometryOverlay();updateGeometryReadout();
  series.relative.applyOptions({visible:$('relative').checked});
  series.alignment.applyOptions({visible:$('alignment').checked});
  for(const key of ['priceMid','priceUpper','priceLower'])series[key].applyOptions({visible:$('price-bands').checked});
  updatePivotZones();
  schedulePivotFlowOverlay();
  updateStrengthLabels();
  updateFixedPaneReadouts();
  for(const key of ['mid','upper','lower'])series[key].applyOptions({visible:$('bands').checked});
  marks.applyOptions({visible:$('markers').checked});
}
async function refresh(clear=false){
  controller?.abort();controller=new AbortController();const gen=++generation;
  loading=true;$('refresh').disabled=true;
  if(clear){cache=null;rows={};volumeStrengthRows=[];modelRows={};modelVolumeStrengthRows=[];modelStamp=null;trendRows={};trendVolumeStrengthRows=[];trendStamp=null;trainingMeta=null;maps={};lastSuccess=null;inspectedTime=null;pivotZoneKey='';pivotZoneState={ready:false,reason:'history',support:null,resistance:null};pivotFlowState=null;render(true);}
  const interval=$('interval').value,days=+$('days').value;
  status(`Đang xác minh SPYUSDT/QQQUSDT và tải ${interval} · ${days} ngày…`);
  try{
    const data=await load(interval,days,{signal:controller.signal,previous:cache});if(gen!==generation)return;
    const step=STEPS[interval];
    rows={SPYUSDT:analyze(data.SPYUSDT,step),QQQUSDT:analyze(data.QQQUSDT,step),COMPOSITE:analyze(composite(data.SPYUSDT,data.QQQUSDT),step)};
    volumeStrengthRows=analyze(data.SPYUSDT,step,{strength:calculateVolumeStrength(data.SPYUSDT,step)});
    let history=null;try{history=await loadPersistentHistory({days:365,signal:controller.signal,live:interval==='15m'?data:null});}catch{}
    const trendSource=history?.SPYUSDT?.length&&history?.QQQUSDT?.length?history:(interval==='15m'?data:null);
    if(trendSource){
      const trendStep=STEPS['15m'],closedTrendRaw={SPYUSDT:(trendSource.SPYUSDT??[]).filter(x=>x.end<data.serverTime),QQQUSDT:(trendSource.QQQUSDT??[]).filter(x=>x.end<data.serverTime)},nextTrendStamp=Math.min(closedTrendRaw.SPYUSDT.at(-1)?.t??0,closedTrendRaw.QQQUSDT.at(-1)?.t??0);
      if(nextTrendStamp&&nextTrendStamp!==trendStamp){
        trendRows={SPYUSDT:analyze(closedTrendRaw.SPYUSDT,trendStep),QQQUSDT:analyze(closedTrendRaw.QQQUSDT,trendStep),COMPOSITE:analyze(composite(closedTrendRaw.SPYUSDT,closedTrendRaw.QQQUSDT),trendStep)};
        trendVolumeStrengthRows=analyze(closedTrendRaw.SPYUSDT,trendStep,{strength:calculateVolumeStrength(closedTrendRaw.SPYUSDT,trendStep)});trendStamp=nextTrendStamp;
      }
    }
    if(interval==='15m'&&Object.keys(trendRows).length){modelRows=trendRows;modelVolumeStrengthRows=trendVolumeStrengthRows;modelStamp=trendStamp;trainingMeta=history?.manifest??null;}
    else{modelRows=rows;modelVolumeStrengthRows=volumeStrengthRows;modelStamp=null;trainingMeta=null;}
    maps=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,new Map(v.map(x=>[x.t,x]))]));
    cache=data;serverOffsetMs=data.serverTime-Date.now();lastSuccess=new Date();render(clear);setLive(true);
    const modelText=interval==='15m'?(trainingMeta?` · model ${trainingMeta.retentionDays??365}d: ${modelRows.SPYUSDT?.length??0}/${modelRows.QQQUSDT?.length??0} nến lưu GitHub`:` · model: đang dùng lịch sử live cho tới khi kho GitHub sẵn sàng`):'';
    status(`SPYUSDT + QQQUSDT · TRADING / ${data.contracts.map(x=>x.contractType).join(' + ')} · ${rows.SPYUSDT.length}/${rows.QQQUSDT.length} nến, gồm nến đang chạy · ${rows.COMPOSITE.length} timestamp chung${modelText} · ${data.incremental?'cập nhật realtime ~3 giây':'tải lịch sử song song'} · cập nhật ${lastSuccess.toLocaleTimeString('vi-VN')} · ${rows.COMPOSITE.length?'Dữ liệu thật Binance':'Composite chưa có dữ liệu giao nhau'}`);
  }catch(e){
    if(gen!==generation)return;
    setLive(false);schedulePivotFlowOverlay();status(`${e.message}. Có thể bị CORS, vùng truy cập, mất mạng hoặc rate limit. ${cache?`Dữ liệu cũ chưa cập nhật (lần thành công ${lastSuccess.toLocaleTimeString('vi-VN')}).`:'Không có dữ liệu thay thế; biểu đồ để trống.'} Dùng Tải lại sau khi kiểm tra kết nối.`,true);
  }finally{if(gen===generation){loading=false;$('refresh').disabled=false;}}
}
function exportCSV(){
  const source=$('signal').value,data=rows[source]??[];
  const keys=['t','session','v','q','buy','sell','net','nf','raw','adjusted','mid','upper','lower','confidence'];
  const csv=[keys.join(','),...data.map(x=>keys.map(k=>x[k]??'').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${source}-${$('interval').value}-quote-netflow.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fitChart(windowMs=FIT_WINDOW_MS){
  for(let pane=0;pane<3;pane++)chart.priceScale('right',pane).applyOptions({autoScale:true});series.relative.priceScale().applyOptions({autoScale:true});series.alignment.priceScale().applyOptions({autoScale:true});
  const data=rows[$('symbol').value]??[],host=$('chart');
  if(data.length){
    const lastIndex=data.length-1,lastTime=data[lastIndex].t,cutoff=lastTime-windowMs,firstIndex=Math.max(0,data.findIndex(bar=>bar.t>=cutoff));
    const rightPadding=Math.min(6,Math.max(2,Math.round((lastIndex-firstIndex+1)*.04)));
    chart.timeScale().setVisibleLogicalRange({from:firstIndex-.5,to:lastIndex+rightPadding});host.dataset.fitWindowHours=String(windowMs/3600000);host.dataset.fitStart=String(data[firstIndex].t);host.dataset.fitEnd=String(lastTime);
  }else{chart.timeScale().fitContent();delete host.dataset.fitWindowHours;delete host.dataset.fitStart;delete host.dataset.fitEnd;}
  scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();
}
function isFullChart(){const card=document.querySelector('.chart-card');return document.fullscreenElement===card||card.classList.contains('fullscreen-fallback');}
function syncFullChart(){const active=isFullChart();$('fullscreen').textContent=active?'✕ Thu nhỏ':'⛶ Full chart';$('fullscreen').setAttribute('aria-pressed',String(active));document.body.classList.toggle('chart-fullscreen',active);applyResponsiveChartOptions();setTimeout(()=>{window.dispatchEvent(new Event('resize'));scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();},50);}
async function toggleFullChart(){
  const card=document.querySelector('.chart-card');
  if(document.fullscreenElement===card){await document.exitFullscreen();return;}
  if(card.classList.contains('fullscreen-fallback')){card.classList.remove('fullscreen-fallback');syncFullChart();return;}
  try{if(!card.requestFullscreen)throw Error('Fullscreen API unavailable');await card.requestFullscreen({navigationUI:'hide'});}catch{card.classList.add('fullscreen-fallback');syncFullChart();}
}
function bindChartGestures(){
  const host=$('chart'),activeTouches=new Set();let start=null,lastTap=null,multiTouch=false;
  const enter=()=>{if($('double-tap-full').checked&&!isFullChart())void toggleFullChart();};
  host.addEventListener('dblclick',event=>{if(!$('double-tap-full').checked||isFullChart())return;event.preventDefault();enter();},{capture:true});
  host.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')return;activeTouches.add(event.pointerId);if(activeTouches.size>1){multiTouch=true;start=null;lastTap=null;return;}start={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};},{capture:true});
  host.addEventListener('pointermove',event=>{if(event.pointerType!=='touch'||!start||start.id!==event.pointerId)return;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>TAP_MOVE_TOLERANCE)start.moved=true;},{capture:true});
  const finish=event=>{
    if(event.pointerType!=='touch')return;activeTouches.delete(event.pointerId);
    if(multiTouch){if(!activeTouches.size){multiTouch=false;start=null;lastTap=null;}return;}
    if(!start||start.id!==event.pointerId||start.moved){start=null;lastTap=null;return;}
    const tap={time:performance.now(),x:event.clientX,y:event.clientY};start=null;
    if(lastTap&&tap.time-lastTap.time<=DOUBLE_TAP_MS&&Math.hypot(tap.x-lastTap.x,tap.y-lastTap.y)<=DOUBLE_TAP_DISTANCE){lastTap=null;event.preventDefault();enter();}else lastTap=tap;
  };
  host.addEventListener('pointerup',finish,{capture:true});host.addEventListener('pointercancel',event=>{if(event.pointerType==='touch'){activeTouches.delete(event.pointerId);start=null;lastTap=null;if(!activeTouches.size)multiTouch=false;}},{capture:true});
}
if(init()){
  setupChartActions();
  restoreSavedSetup();
  $('refresh').onclick=()=>refresh();for(const id of ['interval','days'])$(id).onchange=()=>refresh(true);
  for(const id of ['symbol','signal'])$(id).onchange=()=>render(false);
  for(const id of ['spy','qqq','composite','relative','alignment','price-bands','pivot-zones','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','geometry-toggle','geometry-pivots'])$(id).onchange=toggle;
  for(const id of ['geometry-score','geometry-lines'])$(id).onchange=()=>render(false);
  $('phase-width').onchange=()=>render(false);
  $('candle-agreement-color').onchange=()=>render(false);
  $('fit').onclick=()=>fitChart();$('chart-fit').onclick=()=>fitChart();$('chart-fit-half').onclick=()=>fitChart(FIT_HALF_WINDOW_MS);$('chart-save').onclick=saveChartSetup;$('fullscreen').onclick=toggleFullChart;
  document.addEventListener('fullscreenchange',syncFullChart);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.chart-card').classList.contains('fullscreen-fallback')){document.querySelector('.chart-card').classList.remove('fullscreen-fallback');syncFullChart();}});
  $('export').onclick=exportCSV;
  const changeCalendarFilter=()=>{delete $('calendar-list').dataset.positioned;renderCalendar();};$('calendar-impact').onchange=changeCalendarFilter;$('calendar-currency').onchange=changeCalendarFilter;$('calendar-refresh').onclick=refreshCalendar;
  setLive(false);refreshCalendar();refresh(true);setInterval(()=>{updateCandleCountdown();if(lastSuccess&&Date.now()-lastSuccess>15000){setLive(false);schedulePivotFlowOverlay();}if(!document.hidden&&!loading)refresh();},LIVE_REFRESH_MS);
  setInterval(()=>{if(!document.hidden)refreshCalendar();},CALENDAR_REFRESH_MS);
  setInterval(updateCandleCountdown,250);
}
