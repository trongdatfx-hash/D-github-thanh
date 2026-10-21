import {createWlrAba} from './wlr-aba-ui.mjs?v=20261021-spy1';
import {createSeriesWriter} from './chart-data-cache.mjs';
import {STEPS,composite,flowAlignment,relativeFlowColor,strengthAgreementCandleSignal,strengthPhaseLineStyle,directionalVolumeDelta,volumeDeltaStrengthColor,volumeDeltaStrengthValue,symmetricPriceRange,calculateVolumeStrength,analyze,weightedPriceBands,wlrTrendThickness,candleRegimeClusters,continuousCvdSpectrum,projectNetFlowToPrice,dayBoundaryTimes} from './engine.mjs?v=20261018-9';
import {load} from './data.mjs';
import {loadSpy,hybridSpy} from './spy-data.mjs?v=20261021-spy1';
const isSpyPrice=()=>['SPYUSDT','SPY'].includes(document.getElementById('symbol')?.value);
const selectedPrice=()=>rows[document.getElementById('symbol')?.value]??[];
import {pivotFlowRealtime} from './pivot-zones.mjs?v=20261017-2';
import {pivotFlowLayout,pivotFlowZeroCoordinate} from './pivot-flow-layout.mjs?v=20261016-2';
import {loadForexCalendar,selectCalendarEvents,calendarEventState,actualVsForecast,CALENDAR_TIME_ZONE} from './forex-calendar.mjs?v=20261014-2';
import {preRthWlrTrend,formatPreRthWlrTrend,trendReadoutState} from './pre-rth-wlr-trend.mjs?v=20261021-age-audit1';
const $=id=>document.getElementById(id),fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'�',fmtK=x=>Number.isFinite(x)?`${(x/1000).toLocaleString('en-US',{maximumFractionDigits:2})}K`:'�';
const L=window.LightweightCharts;
let chart,price,series={},marks,strengthMarks,cache=null,rows={},volumeStrengthRows=[],modelRows={},modelVolumeStrengthRows=[],modelStamp=null,trendRows={},trendVolumeStrengthRows=[],trendStamp=null,trainingMeta=null,maps={},priceBandMap=new Map(),cvdProfile={bins:[],maxAbs:0,binStep:.5,range:12},cvdAnchorTime=null,cvdSourceLabel='C?S',cvdFrame=0,dayBoundaries=[],dayFrame=0,geometryFrame=0,pivotFlowFrame=0,geometryState={pivots:[],events:[],lines:[],summary:{}},causalChannelState={trends:[],total:0},geometryStatePoints=[],geometryStatePointsKey='',breakoutState=null,geometryBacktest={n:0},controller,generation=0,loading=false,lastSuccess=null,serverOffsetMs=0;
const colors={SPYUSDT:'#5ba8ff',QQQUSDT:'#c194ff',COMPOSITE:'#38dfba'};
const flowTitles={SPYUSDT:'S Taker NF',QQQUSDT:'Q Taker NF',COMPOSITE:'C Taker NF'};
const flowColors={
  SPYUSDT:{up:'rgba(39,211,164,.38)',down:'rgba(255,91,116,.38)'},
  QQQUSDT:{up:'rgba(39,211,164,.58)',down:'rgba(255,91,116,.58)'},
  COMPOSITE:{up:'rgba(39,211,164,.82)',down:'rgba(255,91,116,.82)'}
};
const LIVE_REFRESH_MS=3000;
const seriesWriter=createSeriesWriter();
const writeSeries=(key,series,data,context)=>{if($('symbol')?.value==='SPY'){const times=new Set((rows.SPY??[]).map(b=>b.t/1000));data=data.filter(b=>times.has(b.time));}return seriesWriter(key,series,data,context);};
let studiesWorker=null,studyKey='',studyResultKey='',statsWorker=null,statsRequest=0,researchFeatures=[],studyTimingMs=0;
const CALENDAR_REFRESH_MS=5*60*1000;
const FIT_WINDOW_MS=36*60*60*1000,FIT_HALF_WINDOW_MS=12*60*60*1000,DOUBLE_TAP_MS=360,DOUBLE_TAP_DISTANCE=28,TAP_MOVE_TOLERANCE=14;
const SETUP_STORAGE_KEY='netflow-rth-lite:chart-setup:v1';
const SETUP_CONTROL_IDS=['symbol','interval','days','signal','spy','qqq','composite','relative','alignment','price-bands','pivot-zones','phase-width','candle-agreement-color','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','double-tap-full','geometry-toggle','geometry-provisional','causal-trend-channel','causal-trend-channel-provisional','geometry-pivots','geometry-score','geometry-lines','calendar-impact','calendar-currency','wlr-aba-toggle'];
let statsMap=new Map(),candleColorMap=new Map(),candleClusterMap=new Map(),rev63State=null,pivotZoneState={ready:false,reason:'history',support:null,resistance:null},pivotFlowState=null,pivotZoneKey='',inspectedTime=null;
let calendarState={events:[],updatedAt:null,loading:false};
let pendingSavedTimeRange=null,saveSetupTimer=null,forecastLayer=null;
const sourceName=key=>({SPYUSDT:'SPY',QQQUSDT:'QQQ',COMPOSITE:'Composite'}[key]);
const signed=x=>Number.isFinite(x)?`${x>0?'+':''}${fmt(x)}`:'�';
const signLabel=x=>x>0?'+':x<0?'?':'0';
const symmetricAutoscale=original=>{const info=original();return info?.priceRange?{...info,priceRange:symmetricPriceRange(info.priceRange)}:info;};
const tone=x=>x>0?'positive':x<0?'negative':'neutral';
const calendarDay=new Intl.DateTimeFormat('vi-VN',{timeZone:CALENDAR_TIME_ZONE,weekday:'short',day:'2-digit',month:'2-digit'});
const calendarTime=new Intl.DateTimeFormat('vi-VN',{timeZone:CALENDAR_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const calendarImpactLabel={High:'High',Medium:'Medium',Low:'Low',Holiday:'Ngh?','Non-Economic':'Kh�c'};

function renderCalendar(){
  const list=$('calendar-list'),statusNode=$('calendar-status');if(!list||!statusNode)return;
  const events=selectCalendarEvents(calendarState.events,{impact:$('calendar-impact').value,currency:$('calendar-currency').value});
  const oldRows=new Map([...list.querySelectorAll('.calendar-row')].map(row=>[row.dataset.key,row])),scrollTop=list.scrollTop,positioned=list.dataset.positioned==='true',fragment=document.createDocumentFragment();
  for(const event of events){
    const key=`${event.timestamp}|${event.country}|${event.title}`,state=calendarEventState(event),comparison=actualVsForecast(event);let row=oldRows.get(key);
    if(!row){row=document.createElement('div');row.dataset.key=key;row.innerHTML='<span class="calendar-time"><b></b><small></small></span><span class="calendar-currency"></span><span class="calendar-impact"></span><span class="calendar-title"></span><span class="calendar-value calendar-actual"></span><span class="calendar-value calendar-forecast"></span><span class="calendar-value calendar-previous"></span>';}
    row.className=`calendar-row ${state.key}${event.actual?' released':''}`;row.title=`${event.title} � ${state.label}${event.actual?` � ${comparison.label}`:''}`;
    row.querySelector('.calendar-time b').textContent=calendarTime.format(event.timestamp);row.querySelector('.calendar-time small').textContent=calendarDay.format(event.timestamp);
    row.querySelector('.calendar-currency').textContent=event.country;
    const impact=row.querySelector('.calendar-impact');impact.className=`calendar-impact ${event.impact.toLowerCase().replace(/[^a-z]+/g,'-')}`;impact.textContent=calendarImpactLabel[event.impact]??event.impact;
    row.querySelector('.calendar-title').textContent=event.title;
    const actual=row.querySelector('.calendar-actual');actual.className=`calendar-value calendar-actual ${comparison.key}`;actual.textContent=event.actual||'�';actual.title=`Th?c t? � ${comparison.label}`;
    const forecast=row.querySelector('.calendar-forecast');forecast.textContent=event.forecast||'�';forecast.title='D? b�o';
    const previous=row.querySelector('.calendar-previous');previous.textContent=event.previous||'�';previous.title='K? tr�?c';
    fragment.append(row);
  }
  if(!events.length){const empty=document.createElement('div');empty.className='calendar-empty';empty.textContent=calendarState.events.length?'Kh�ng c� tin ph� h?p trong kho?ng g?n ��y. Th? ch?n �T?t c?�.':'Ch�a c� d? li?u l?ch.';fragment.append(empty);}
  list.replaceChildren(fragment);
  if(positioned)list.scrollTop=scrollTop;else requestAnimationFrame(()=>{const next=[...list.children].find(row=>row.classList.contains('future')||row.classList.contains('now'));if(next)list.scrollTop=Math.max(0,next.offsetTop-list.offsetTop-Math.round(list.clientHeight*.45));list.dataset.positioned='true';});
  if(calendarState.updatedAt){
    const age=Date.now()-calendarState.updatedAt,stale=age>26*60*60000,released=events.filter(event=>event.actual).length;statusNode.className=`calendar-status${stale?' stale':''}`;statusNode.textContent=`${events.length} tin � ${released} �? c� th?c t? � c?p nh?t ${calendarTime.format(calendarState.updatedAt)} ${calendarDay.format(calendarState.updatedAt)}${stale?' � snapshot c?':''}`;
  }
}

async function refreshCalendar(){
  if(calendarState.loading)return;calendarState.loading=true;$('calendar-refresh').disabled=true;$('calendar-refresh').classList.add('loading');
  const statusNode=$('calendar-status');statusNode.className='calendar-status';statusNode.textContent='�ang n?p l?ch Forex Factory�';
  try{const data=await loadForexCalendar();calendarState={...data,loading:false};renderCalendar();}
  catch(error){calendarState.loading=false;statusNode.className='calendar-status error';statusNode.textContent=`${error.message}. ${calendarState.events.length?'�ang gi? b?n g?n nh?t.':'M? Forex Factory b?ng li�n k?t b�n d�?i.'}`;}
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
function setLive(live){const node=$('live-indicator');node.textContent=live?'? LIVE':'? KH�NG LIVE';node.className=live?'live':'offline';forecastLayer?.update();}
function setupChartActions(){
  const actions=document.querySelector('.chart-actions'),fit=$('chart-fit'),live=$('live-indicator');
  if(!actions||!fit||!live)return;
  if(!$('causal-trend-channel')){const input=document.createElement('input');input.id='causal-trend-channel';input.type='checkbox';input.checked=true;const label=document.createElement('label');label.title='Flow-Leg: SPY V kh�a h�?ng khi m? � gi� ho?c SPY V ph?i b?t l?i 2 n?n li�n ti?p m?i ��ng � n?n ph� �?u ��?c d�ng �? t�i kh?p OLS �2? � t?i thi?u 8 n?n � k�nh �? ��ng: UP v�ng, DOWN tr?ng � k�nh �ang s?ng n�t ch?m: UP cyan, DOWN tr?ng';label.append(input,'K�nh trend causal');$('geometry-toggle').closest('label').insertAdjacentElement('afterend',label);}
  if(!$('geometry-provisional')){const input=document.createElement('input');input.id='geometry-provisional';input.type='checkbox';input.checked=true;const label=document.createElement('label');label.title='Hi?n/?n ri�ng c�c Trendline causal s?m HT S?M v� KC S?M; ch? c� t�c d?ng khi Trendline causal �ang b?t';label.append(input,'Trendline causal n�t ch?m');$('geometry-toggle').closest('label').insertAdjacentElement('afterend',label);}
  if(!$('causal-trend-channel-provisional')){const input=document.createElement('input');input.id='causal-trend-channel-provisional';input.type='checkbox';input.checked=true;const label=document.createElement('label');label.title='Hi?n/?n ri�ng K�nh Flow-Leg �ang s?ng; ch? c� t�c d?ng khi K�nh trend causal �ang b?t';label.append(input,'K�nh trend causal n�t ch?m');$('causal-trend-channel').closest('label').insertAdjacentElement('afterend',label);}
  $('geometry-overlay').setAttribute('aria-label','Trendline �? x�c nh?n, trendline s?m n�t ch?m, pivot, ph�n k?, K�nh trend causal v� b?n th�ng b�o c?t line g?n nh?t');
  fit.insertAdjacentElement('afterend',live);
  const half=document.createElement('button');half.id='chart-fit-half';half.type='button';half.title='Hi?n th? c�c n?n trong 0,5 ng�y g?n nh?t';half.textContent='Fit 0.5 ng�y';live.insertAdjacentElement('afterend',half);
  const save=document.createElement('button');save.id='chart-save';save.type='button';save.title='L�u to�n b? l?a ch?n v� v�ng th?i gian �ang xem tr�n tr?nh duy?t n�y';save.textContent='L�u setup';save.setAttribute('aria-live','polite');half.insertAdjacentElement('afterend',save);
  const alignmentLabel=$('alignment')?.closest('label');if(alignmentLabel){alignmentLabel.lastChild.textContent='SPY V ? n?n';alignmentLabel.dataset.pane='strength-spy-v';alignmentLabel.title='Histogram chung thang ?1�+1 v?i Strength SPY V. Bi�n �? tuy?n t�nh ?/2: volume b?ng SMA20 �?t n?a bi�n, t? 2� SMA20 �?t to�n bi�n. B?n m�u: ?+/V+ xanh l�, ??/V+ xanh d��ng, ?+/V? h?ng nh?t, ??/V? �?.';}
  const compositeLabel=$('composite')?.closest('label');if(compositeLabel)compositeLabel.title='C Taker NF ch? hi?n th? trong pane Strength SPY/QQQ/Composite, d�ng scale overlay �?i x?ng quanh 0 v� nh?n c? �?nh.';
  const phaseLabel=$('phase-width')?.closest('label');if(phaseLabel){phaseLabel.hidden=true;const button=document.createElement('button');button.id='wlr-width-mode';button.type='button';button.className='display-mode-button';phaseLabel.insertAdjacentElement('afterend',button);}
  const candleLabel=$('candle-agreement-color')?.closest('label');if(candleLabel){candleLabel.hidden=true;const button=document.createElement('button');button.id='candle-color-mode';button.type='button';button.className='display-mode-button';candleLabel.insertAdjacentElement('afterend',button);}
  const hint=document.querySelector('.hint');if(hint){hint.textContent=hint.textContent.replace('Histogram C NF s�t tr?c gi� SPY c?ng Composite Taker NetFlow t? pivot �?u �? x�c nh?n t?i n?n hi?n t?i; khi ch�a c� c?p pivot, d�ng 96 n?n g?n nh?t. C?p nh?t kho?ng 3 gi�y khi trang m?. C?t cu?i vi?n v�ng l� n?n ch�a ��ng v� c� th? thay �?i.','Histogram C NF s�t tr?c gi� SPY ch? v? 5 n?n M15 g?n nh?t. Ti�u �? VOL ph�n lo?i bi?n �?ng 5 n?n th�nh th?p, trung b?nh ho?c cao theo ph�n v? causal c?a bi�n �? gi�, realized volatility, quote volume v� taker imbalance. S? % ph�a d�?i v?n l� C NF d�ng EWMA half-life 32 tr�n nh�m pivot ho?c 96 n?n khi ch�a c� pivot; c? hai c?p nh?t theo n?n live. C?t cu?i vi?n v�ng l� n?n ch�a ��ng v� c� th? thay �?i.');hint.textContent+=' K�nh trend causal d�ng setup Flow-Leg: ngu?n SPY V ph�n v?, dead-band �0,15, t?i thi?u 8 n?n, R� hi?n th? 0,20 v� gi? 12 leg. Khi c� break, ��?ng l�i t?i �a 4 n?n M15 li?n tr�?c c�ng ng�y v� c�ng d?u SPY V l�m g?c. Ph� �2? theo h�?ng trend v?n h?p l?; n?n SPY V trung t�nh ho?c m?t n?n tr�i d?u v?n ��?c gi?. Gi� ph� bi�n b?t l?i ho?c SPY V v�?t dead-band �?i ngh?ch ph?i k�o d�i hai n?n li�n ti?p m?i ��ng leg; n?n ph� gi� �?u ��?c nh?n �? t�i kh?p OLS v� �2?. Hai rail d�ng m?t OLS cu?i n�n lu�n th?ng. Trendline causal ch�a �? pivot x�c nh?n ��?c gi? hi?n b?ng n�t ch?m trong c?a s? s?m 8 n?n, c� nh?n HT S?M ho?c KC S?M; ch�ng ch�a tham gia th?ng k� nh�m trend.';}
}
function syncDisplayModeButtons(){
  const width=$('wlr-width-mode'),candle=$('candle-color-mode'),trendWidth=$('phase-width').checked,priceVolume=$('candle-agreement-color').checked;
  if(width){width.textContent=`�? d�y WLR: ${trendWidth?'Trend gi�':'C�V'}`;width.title=trendWidth?'�? d�y 1�6 theo ph�n v? |slope WLR8|�8/ATR14 v� R�; m�u v?n theo C�V':'�? d�y theo �?ng thu?n Composite � SPY V; m�u c?ng theo C�V';width.setAttribute('aria-pressed',String(trendWidth));}
  if(candle){candle.textContent=`M�u n?n: ${priceVolume?'C?m Gi��SPY V':'C�V'}`;candle.title=priceVolume?'C?m causal t? WLR8, SPY V v� th�n gi�/ATR; hai n?n �?i ngh?ch m?i �?i c?m, n?n ng�?c nh? ch? gi?m s�ng':'M�u n?n theo �?ng thu?n Strength Composite � SPY V';candle.setAttribute('aria-pressed',String(priceVolume));}
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
    button.textContent='? �? l�u';button.title='Setup �? ��?c l�u tr�n tr?nh duy?t n�y';
  }catch{button.textContent='Kh�ng l�u ��?c';button.title='Tr?nh duy?t �ang ch?n b? nh? c?c b?';}
  clearTimeout(saveSetupTimer);saveSetupTimer=setTimeout(()=>{button.textContent='L�u setup';button.title='L�u to�n b? l?a ch?n v� v�ng th?i gian �ang xem tr�n tr?nh duy?t n�y';},1800);
}
function updateRev63(){
  if(!rev63State)rev63State=preRthWlrTrend({priceRows:[],strengthRows:[],volumeRows:[],channelTrends:[],requireChannel:true,now:Date.now()});
  updateGeometryReadout();
  renderTrendCohorts();
}
function resetStudies(){
  studyKey='';studyResultKey='';researchFeatures=[];statsMap=new Map();++statsRequest;
  geometryState={pivots:[],events:[],lines:[],summary:{}};causalChannelState={trends:[],total:0};breakoutState=null;geometryStatePoints=[];geometryBacktest={n:0};
  pivotZoneState={ready:false,reason:'history',support:null,resistance:null};pivotFlowState=null;rev63State=null;
}
function requestStudies(){
  if(!cache)return;
  const symbol=$('symbol').value,interval=$('interval').value,p=rows[symbol]??[],closed=p.filter(r=>r.end<cache.serverTime);
  if(!closed.length)return;
  const options={minScore:Number($('geometry-score').value),maxLines:Number($('geometry-lines').value)};
  const key=`${symbol}|${interval}|${$('days').value}|${closed[0]?.t}|${closed.at(-1)?.t}|${closed.length}|${options.minScore}|${options.maxLines}`;
  if(key===studyKey)return;studyKey=key;
  if(!studiesWorker){
    studiesWorker=new Worker(new URL('./studies-worker.mjs?v=20261021-spy1',import.meta.url),{type:'module'});
    studiesWorker.onmessage=({data})=>{
      if(data.key!==studyKey)return;
      if(data.error){$('chart').dataset.studyStatus='error';$('chart').dataset.studyError=data.error;studyKey='';return;}
      const r=data.result;geometryState=r.geometry;causalChannelState=r.channels;breakoutState=r.breakout;geometryStatePoints=r.points;geometryBacktest=r.backtest;pivotZoneState=r.pivot;rev63State=r.rev63;
      researchFeatures=r.abaRows;studyResultKey=data.key;studyTimingMs=data.computeMs;trainingMeta=data.archive;
      $('chart').dataset.studyStatus='ready';$('chart').dataset.studyComputeMs=String(Math.round(studyTimingMs));
      const now=cache?.serverTime??Date.now();pivotFlowState=pivotFlowRealtime(pivotZoneState.flow,selectedPrice(),rows.COMPOSITE??[],now,pivotFlowState?.volatility?.key);
      updateRev63();updatePivotZones();scheduleGeometryOverlay();schedulePivotFlowOverlay();forecastLayer?.update();
    };
    studiesWorker.onerror=()=>{$('chart').dataset.studyStatus='error';studyKey='';studiesWorker?.terminate();studiesWorker=null;};
  }
  $('chart').dataset.studyStatus='loading';$('chart').dataset.studyRequests=String(Number($('chart').dataset.studyRequests??0)+1);
  studiesWorker.postMessage({key,rows,volumeRows:volumeStrengthRows,symbol,interval,options,now:cache.serverTime,raw:cache});
}
function requestStats(){
  if(!cache)return;
  if(!statsWorker){
    statsWorker=new Worker(new URL('./stats-worker.mjs?v=20261020-perf1',import.meta.url),{type:'module'});
    statsWorker.onmessage=({data})=>{if(data.id!==statsRequest||data.error)return;statsMap=data.stats;showTooltip(inspectedTime??rows[$('symbol').value]?.at(-1)?.t);};
    statsWorker.onerror=()=>{statsWorker?.terminate();statsWorker=null;};
  }
  statsWorker.postMessage({id:++statsRequest,rows,symbol:$('symbol').value,source:$('signal').value,step:STEPS[$('interval').value]});
}
function renderTrendCohorts(){
  const body=$('trend-cohort-body'),status=$('trend-cohort-status');if(!body||!status)return;
  const contextName={support:'?ng h?',mixed:'H?n h?p',opposed:'Ch?ng'},scopeName={'direction-session-strength':'h�?ng + phi�n + x�c nh?n Strength','direction-session':'h�?ng + phi�n','direction':'h�?ng','all':'to�n b?'},sampleLevel=n=>n>=50?'T?T':n>=30?'T?M ?N':n>=12?'TH�M D?':'CH�A �?';
  const groups=rev63State?.groups??[];body.replaceChildren(...groups.map(group=>{
    const row=document.createElement('tr'),selected=group.key===rev63State?.cohortKey;row.className=selected?'selected':'';
    const continuation=Number.isFinite(group.continuation)?`${Math.round(group.continuation*100)}%`:'�';
    const strengthMix=['support','mixed','opposed'].map(key=>`${contextName[key]} ${Math.round((group.contexts?.[key]?.share??0)*100)}%`).join(' � '),context=rev63State?.strengthContext,contextStats=context?group.contexts?.[context]:null,strengthContinuation=Number.isFinite(contextStats?.continuation)?`${Math.round(contextStats.continuation*100)}% ${contextName[context]}`:context?`� (n=${contextStats?.n??0})`:'�',r2=value=>Number.isFinite(value)?value.toFixed(2):'�',ridge=`${r2(group.ridge?.r2)} � ${r2(group.ridge?.partialComposite)} � ${r2(group.ridge?.partialVolume)}`;
    row.innerHTML=`<td><span class="trend-direction ${group.direction>0?'up':'down'}">${group.direction>0?'? UP':'? DOWN'}</span></td><td>${group.startSession}</td><td title="S? nh?p / s? ng�y; kh�ng �?ng ngh?a s? m?u �?c l?p">${group.n} nh?p / ${group.uniqueDays??0} ng�y</td><td class="strength-mix">${strengthMix}</td><td>${ridge}</td><td>${group.censoredN}</td><td>${group.medianBars??'�'} / ${group.rawMedianBars??'�'}</td><td>${group.atRiskN??'�'}</td><td>${continuation}</td><td>${strengthContinuation}</td>`;
    if(selected)row.setAttribute('aria-current','true');return row;
  }));
  const age=rev63State?.currentBars>0?`tu?i ${rev63State.currentBars} n?n � nh�m ${rev63State.ageGroup?.label??'�'}`:'ch�a c� trend �ang ho?t �?ng',scope=scopeName[rev63State?.cohort]??'ch�a ch?n cohort',context=rev63State?.strengthContext?contextName[rev63State.strengthContext]:'�';
  const ridge=rev63State?.strengthRegression,r2=value=>Number.isFinite(value)?value.toFixed(2):'�',totalN=groups.reduce((sum,group)=>sum+group.n,0);status.textContent=`${age} � ${totalN} leg l?ch s? � Strength: ${context} � R� OOS ${r2(ridge?.r2)} � C ${r2(ridge?.partialComposite)} � V ${r2(ridge?.partialVolume)} � cohort: ${scope}${rev63State?.currentBars>0?'':' � C?n +3 nh�m d�ng n?n t? tu?i 1'}`;
  let info=document.getElementById('trend-data-info');if(!info){info=document.createElement('p');info.id='trend-data-info';info.className='trend-cohort-note';status.after(info);}
  const meta=rev63State?.dataInfo,date=t=>Number.isFinite(t)?new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York'}):'�';
  info.textContent=meta?`Phi�n hi?n t?i: ${meta.currentSession??'�'}; c?t B?t �?u l� phi�n m? trend. Ngu?n: Binance M15 l�u tr�n GitHub + n?n live �? ��ng � ${date(meta.firstTime)} ? ${date(meta.lastTime)} (New York) � ${meta.bars} n?n / ${meta.days} ng�y c� PRE�RTH. N b?ng = ${totalN} episode l?ch s?. B? k�nh g?c c� ${meta.channels} Flow-Leg, ${meta.displayQualified} k�nh �?t ti�u ch� v? (tr�?c gi?i h?n 12 k�nh tr�n chart). M?i Flow-Leg �? x�c nh?n ch? ��?c t�nh m?t episode; d?ng ngay khi k�nh b�o k?t th�c, kh�ng th�m m?t l�?t dung sai ? l?p nh?n. N �?m episode theo h�?ng + phi�n b?t �?u; g?m nh?p ng?n/R� th?p. S? ng�y kh�ng ph?i s? m?u �?c l?p. Chart d�ng kho?ng l?ch s? ri�ng; trend �ang ch?y ch�a v�o N.`:'�ang n?p th�ng tin kho l?ch s?�';
  if($('symbol').value==='SPY'&&meta)info.textContent='Gi� trend: SPY ETF; Strength: Binance. '+info.textContent.replace('Binance M15 l�u tr�n GitHub + n?n live �? ��ng','SPY ETF M15 tr�n GitHub + d?ng ti?n Binance kh?p th?i gian');

}
function updateTrendMethodCopy(){
  const hint=document.querySelector('.hint');if(hint)hint.textContent=hint.textContent.replace('WLR 8 n?n ch? kh?i t?o khi �?ng pha v?i Strength Composite v� SPY V','WLR gi� 8 n?n ch? t�nh tu?i khi d?u SPY V c�ng chi?u slope; m?t n?n l?ch d?u kh�ng c?ng tu?i, hai n?n li�n ti?p k?t th�c trend; Composite ch? g�p 5% �i?m');
  const paragraph=[...document.querySelectorAll('details p')].find(node=>node.textContent.startsWith('PRE?RTH WLR d�ng c?a s? 8 n?n M15'));
  if(paragraph)paragraph.textContent='PRE?RTH WLR d�ng c?a s? 8 n?n M15 v?i tr?ng s? t�ng d?n. �i?m causal g?m 38% ph�n v? �? d?c/ATR, 28% R� gi�, 18% hi?u su?t ��?ng gi�, 11% �? b?n h�?ng th�n n?n v� ch? 5% d?u Strength Composite. SPY Volume Strength m? leg b?ng d?u v� slope; sau �� n?n trung t�nh ho?c m?t n?n tr�i d?u v?n n?m trong leg. Gi� ho?c SPY V ph?i b?t l?i hai n?n li�n ti?p m?i ��ng leg. N?n gi� ph� bi�n �?u ti�n v?n ��?c nh?n �? t�i kh?p OLS v� �2?; n?u n?n sau tr? l?i k�nh th? b? �?m ��?c x�a. S? n?n �? nh?n ��?c ph�n lo?i th�nh M?I 1�4, PH�T TRI?N 5�8, B?N 9�12 ho?c K�O D�I ?13. Kaplan�Meier t�nh theo s? n?n �? nh?n: s?ng th�m h n?n l� P(T?n+h | T?n), kh�ng ph�n nh�m b?ng �? d�i cu?i t��ng lai. N?n �ang ch?y kh�ng tham gia.';
  const medianHeader=[...document.querySelectorAll('.trend-cohort-card th')].find(node=>['TRUNG V? N?N','TRUNG V? L?C / TH�'].includes(node.textContent.trim().toUpperCase()));if(medianHeader)medianHeader.textContent='TRUNG V? LEG / TH�';
  const note=document.querySelector('.trend-cohort-note');if(note)note.textContent='M?i m?u l� m?t Flow-Leg �? x�c nh?n, k? c? leg ng?n d�?i 8 n?n ho?c R� d�?i 0,20 kh�ng ��?c v?; c�ch n�y gi? c�c th?t b?i s?m v� tr�nh thi�n l?ch s?ng s�t. Kh�ng t�i l?c b?ng WLR 6/8 hay �i?m P70. R� OOS v� partial C/V ch? ch?n �o�n Ridge, kh�ng lo?i m?u. ?ng h?/H?n h?p/Ch?ng l?y d?u ?C�Composite v� ?V�SPY V t?i n?n x�c nh?n causal. Kaplan�Meier theo Strength d�ng t? 12 m?u, 5 m?u �?t tu?i hi?n t?i v� 5 k?t qu? theo d?i th�m 3 n?n �? bi?t; thi?u th?i gian theo d?i th? WAIT. Khi ch�a c� trend ho?t �?ng, C?n +3 nh�m l� x�c su?t n?n t? tu?i 1; d? b�o c� �i?u ki?n theo tu?i ch? xu?t hi?n khi c� leg �ang s?ng. Leg h?t phi�n ch�a ph� ��?c ki?m duy?t ph?i; leg c� �i?m k?t th�c l� s? ki?n.';
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
  if(!L){status('Kh�ng t?i ��?c th� vi?n chart c?c b?. Ki?m tra network ho?c t?i l?i trang.',true);return false;}
  const controls=document.querySelector('.toggles'),card=document.querySelector('.chart-card');
  if(controls&&card){controls.classList.add('chart-options');controls.setAttribute('aria-label','T�y ch?n bi?u �?');card.before(controls);}
  $('relative').closest('label').title='M�u theo NetFlow c�ng n?n: SPY v� QQQ c�ng mua xanh, c�ng b�n �?, tr�i d?u cam, thi?u ho?c c�n b?ng x�m. Chi?u cao v?n l� Relative NetFlow m�?t.';
  chart=L.createChart($('chart'),{autoSize:true,layout:{background:{type:'solid',color:'#0e1726'},textColor:'#91a5bd',fontSize:12,attributionLogo:true},grid:{vertLines:{color:'#1a283a'},horzLines:{color:'#1a283a'}},crosshair:{mode:L.CrosshairMode.Normal,doNotSnapToHiddenSeriesIndices:true,vertLine:{visible:true,labelVisible:true},horzLine:{visible:true,labelVisible:true}},timeScale:{timeVisible:true,secondsVisible:false,rightOffsetPixels:96,barSpacing:6,minBarSpacing:.5,lockVisibleTimeRangeOnResize:true},rightPriceScale:{autoScale:true,minimumWidth:64,tickMarkDensity:2.5},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:{time:true,price:true}},kineticScroll:{touch:true,mouse:false},localization:{locale:'vi-VN',timeFormatter:t=>new Date(t*1000).toLocaleString('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}});
  applyResponsiveChartOptions();
  price=chart.addSeries(L.CandlestickSeries,{title:'',priceFormat:{type:'price',precision:1,minMove:.1},priceLineVisible:true,priceLineColor:'#36ddbd',priceLineWidth:1,priceLineStyle:L.LineStyle.Dashed,lastValueVisible:true,borderVisible:false},0);
  series.priceMid=chart.addCustomSeries(new VariableWidthLineSeries,{color:'#f6c85f',baseLineVisible:false,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const key of ['priceUpper','priceLower'])series[key]=chart.addSeries(L.LineSeries,{color:'#4aa3ff',lineWidth:1,lineStyle:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const [key,color,width,style,last,title] of [
    ['pivotResistanceLow','rgba(255,180,84,.55)',1,L.LineStyle.Dashed,false,''],['pivotResistanceHigh','rgba(255,180,84,.55)',1,L.LineStyle.Dashed,false,''],['pivotResistanceMid','#ffb454',3,L.LineStyle.Solid,true,'REV6 Pivot KC'],
    ['pivotSupportLow','rgba(91,200,255,.55)',1,L.LineStyle.Dashed,false,''],['pivotSupportHigh','rgba(91,200,255,.55)',1,L.LineStyle.Dashed,false,''],['pivotSupportMid','#5bc8ff',3,L.LineStyle.Solid,true,'REV6 Pivot HT']
  ])series[key]=chart.addSeries(L.LineSeries,{color,lineWidth:width,lineStyle:style,priceLineVisible:false,lastValueVisible:last,crosshairMarkerVisible:false,title},0);
  for(const key of ['SPYUSDT','QQQUSDT'])series[key]=chart.addSeries(L.HistogramSeries,{priceScaleId:'taker-flow-strength-overlay',base:0,color:flowColors[key].up,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:fmtK},autoscaleInfoProvider:symmetricAutoscale},2);
  series.relative=chart.addSeries(L.HistogramSeries,{priceScaleId:'relative-strength-overlay',base:0,color:'rgba(112,126,145,.3)',title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:x=>`${fmt(x)}%`},autoscaleInfoProvider:symmetricAutoscale},2);
  series.relative.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.relative.createPriceLine({price:0,color:'#65768b',lineWidth:1,lineStyle:L.LineStyle.Dotted,axisLabelVisible:false});
  series.COMPOSITE=chart.addSeries(L.HistogramSeries,{priceScaleId:'taker-flow-strength-overlay',base:0,color:flowColors.COMPOSITE.up,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:fmtK},autoscaleInfoProvider:symmetricAutoscale},2);
  series.COMPOSITE.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.strength=chart.addSeries(L.BaselineSeries,{baseValue:{type:'price',price:0},topLineColor:'#1ae0a3',topFillColor1:'rgba(26,224,163,0)',topFillColor2:'rgba(26,224,163,0)',bottomLineColor:'#ff4d70',bottomFillColor1:'rgba(255,77,112,0)',bottomFillColor2:'rgba(255,77,112,0)',lineWidth:1,title:'',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:4,autoscaleInfoProvider:symmetricAutoscale},2);
  for(const key of ['mid','upper','lower'])series[key]=chart.addSeries(L.LineSeries,{color:key==='mid'?'#9db5d1':'#8596ad',lineWidth:key==='mid'?2:1,lineStyle:key==='mid'?L.LineStyle.Dotted:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:'',autoscaleInfoProvider:symmetricAutoscale},2);
  series.strength.createPriceLine({price:0,color:'rgba(145,165,189,.28)',lineWidth:1,lineStyle:L.LineStyle.Dotted,axisLabelVisible:false,title:''});
  series.strength.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  const strengthUnitFormat=x=>`${x>0?'+':''}${x.toFixed(2)}`;
  series.alignment=chart.addSeries(L.HistogramSeries,{priceScaleId:'spy-volume-delta-overlay',base:0,color:'#68778a',title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},autoscaleInfoProvider:symmetricAutoscale},1);
  series.alignment.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.volumeStrength=chart.addSeries(L.BaselineSeries,{baseValue:{type:'price',price:0},topLineColor:'#f6c85f',topFillColor1:'rgba(246,200,95,.12)',topFillColor2:'rgba(246,200,95,0)',bottomLineColor:'#f3f6fb',bottomFillColor1:'rgba(243,246,251,0)',bottomFillColor2:'rgba(243,246,251,.09)',lineWidth:3,title:'',priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:4,autoscaleInfoProvider:()=>({priceRange:{minValue:-1,maxValue:1}})},1);
  series.volumeStrength.createPriceLine({price:0,color:'#6f8299',lineWidth:1,lineStyle:L.LineStyle.Solid,axisLabelVisible:true,title:'0'});
  series.volumeStrength.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  for(const [id,label] of [['composite-flow-fixed','C Taker NF'],['spy-volume-fixed','SPY V']]){const node=document.createElement('div');node.id=id;node.className='pane-fixed-readout missing';node.textContent=`${label} �`;$('chart').append(node);}
  $('chart').dataset.compositeNetflowPane='removed';$('chart').dataset.netflowPane='removed';$('chart').dataset.takerFlowOverlay='spy-qqq-composite-relative';$('chart').dataset.compositeStrengthOverlay='pane-2-only-symmetric-zero';$('chart').dataset.compositeStrengthOverlayLabel='C Taker NF';$('chart').dataset.fixedReadoutSide='right-price-scale';$('chart').dataset.strengthLineWidth='1';$('chart').dataset.spyVolumeDeltaPane='1';$('chart').dataset.spyVolumeDeltaScale='symmetric-overlay';$('chart').dataset.spyVolumeDeltaTitle='hidden';$('chart').dataset.spyVolumeStrengthLabel='fixed-right';$('chart').dataset.spyVolumeStrengthUnits='signed-2dp';$('chart').dataset.spyVolumeStrengthPositive='#f6c85f';$('chart').dataset.spyVolumeStrengthNegative='#f3f6fb';
  chart.panes()[0].setStretchFactor(.55);chart.panes()[1].setStretchFactor(.18);chart.panes()[2].setStretchFactor(.27);
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
function candleClusterPalette(x){
  if(!x?.group)return {body:'#657384',wick:'#8794a4',border:x?.transition?'#f6c85f':'#748294'};
  const palettes=x.group>0?{weak:['#3f746d','#6e9b92','#35645e'],medium:['#249e84','#62c9b3','#19866e'],strong:['#18d6a3','#56f2c8','#0cb989']}:{weak:['#805f69','#aa8791','#6d4e58'],medium:['#bc526a','#e48799','#9f4056'],strong:['#ff4d70','#ff8da1','#df3659']},colors=palettes[x.level]??palettes.weak;
  if(x.counter){const muted=x.group>0?['#526f72','#80999b','#466064']:['#806972','#aa9099','#6e5961'];return {body:muted[0],wick:muted[1],border:x.transition?'#f6c85f':muted[2]};}
  return {body:colors[0],wick:colors[1],border:x.transition?'#f6c85f':colors[2]};
}
function lineData(data,key){return data.map(x=>Number.isFinite(x[key])?{time:x.t/1000,value:x[key]}:{time:x.t/1000});}
function priceLineData(data,compositeStrength,volumeStrength,trendThickness){const trendMode=$('phase-width').checked;return data.map(x=>{if(!Number.isFinite(x.mid))return {time:x.t/1000};const phase=strengthPhaseLineStyle(compositeStrength.get(x.t),volumeStrength.get(x.t),{thick:6}),trend=trendThickness.get(x.t);return {time:x.t/1000,value:x.mid,width:trendMode&&Number.isFinite(trend?.width)?trend.width:phase.width,phaseColor:phase.color};});}
function flowData(data,key){const palette=flowColors[key];return data.map(x=>Number.isFinite(x.net)?{time:x.t/1000,value:x.net,color:x.net>=0?palette.up:palette.down}:{time:x.t/1000});}
function relativeData(data){
  return data.map(x=>Number.isFinite(x.relative)?{time:x.t/1000,value:x.relative,color:relativeFlowColor(x)}:{time:x.t/1000});
}
function volumeDeltaBandData(data,volumeStrengthMap){return data.map(x=>({time:x.t/1000,value:volumeDeltaStrengthValue(x.value),color:volumeDeltaStrengthColor(x.value,volumeStrengthMap.get(x.t)?.adjusted)}));}
function scheduleCvdSpectrum(){if(cvdFrame)return;cvdFrame=requestAnimationFrame(()=>{cvdFrame=requestAnimationFrame(()=>{cvdFrame=0;drawCvdSpectrum();forecastLayer?.schedule();});});}
function scheduleDaySeparators(){if(dayFrame)return;dayFrame=requestAnimationFrame(()=>{dayFrame=requestAnimationFrame(()=>{dayFrame=0;drawDaySeparators();});});}
function scheduleGeometryOverlay(){if(geometryFrame)return;geometryFrame=requestAnimationFrame(()=>{geometryFrame=requestAnimationFrame(()=>{geometryFrame=0;drawGeometryOverlay();});});}
function schedulePivotFlowOverlay(){if(pivotFlowFrame)return;pivotFlowFrame=requestAnimationFrame(()=>{pivotFlowFrame=requestAnimationFrame(()=>{pivotFlowFrame=0;drawPivotFlowOverlay();});});}
function drawPivotFlowOverlay(){
  const canvas=$('pivot-flow-overlay'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);canvas.dataset.status='hidden';canvas.dataset.bins='0';canvas.dataset.live='false';delete canvas.dataset.barWidth;delete canvas.dataset.barSpacing;delete canvas.dataset.placement;delete canvas.dataset.mode;delete canvas.dataset.volatilityKey;delete canvas.dataset.volatilityScore;canvas.setAttribute('aria-label','Histogram Composite NF v� m?c bi?n �?ng 5 n?n: ch�a hi?n th? v? thi?u d? li?u SPY/QQQ ho?c chart kh�ng ph?i SPY.');
  const {support,resistance}=pivotZoneState,flow=pivotFlowState,live=!!flow?.live&&$('live-indicator').className==='live'&&!!lastSuccess&&Date.now()-lastSuccess<15000;
  if(!$('pivot-zones').checked||!isSpyPrice()||!flow)return;
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
  const volatility=flow.volatility,volScore=volatility?.score,volShort=volatility?.key==='medium'?'TB':volatility?.label??'�',wideHeader=panelWidth>=125,volText=Number.isFinite(volScore)?wideHeader?`VOL ${volatility.label} � ${volScore}%`:`V${volScore} ${volShort}`:'VOL �';
  context.font=`700 ${width<650?9:10}px Inter,system-ui,sans-serif`;context.textBaseline='middle';context.textAlign='left';context.fillStyle=volatility?.key==='high'?'#ffb454':volatility?.key==='low'?'#6ebcff':volatility?.key==='medium'?'#f6c85f':'#9aadc2';context.fillText(volText,left+5,zero-halfHeight-7,panelWidth-(live?(wideHeader?36:18):8));
  const headerRight=live?(wideHeader?'LIVE':'?'):shownCount<flow.bins.length&&panelWidth>=72?`${shownCount}/${flow.bins.length}`:'';
  if(headerRight){context.textAlign='right';context.fillStyle=live?'#f8bc62':'#b4c4d6';context.fillText(headerRight,right-5,zero-halfHeight-7);}
  context.fillStyle='rgba(3,10,19,.96)';context.fillRect(left+1,zero+halfHeight-1,panelWidth-2,14);
  context.font=`800 ${width<650?11:12}px Inter,system-ui,sans-serif`;context.textAlign='right';context.fillStyle=flow.pct>0?'#39f0b9':flow.pct<0?'#ff718d':'#e1ebf7';context.fillText(`${flow.pct>0?'+':''}${fmt(flow.pct)}%`,right-5,zero+halfHeight+6,panelWidth-10);
  context.textAlign='right';context.fillStyle='#9aadc2';context.fillText('0',right-5,zero+9);context.restore();canvas.dataset.status='visible';canvas.dataset.live=String(live);canvas.dataset.mode=flow.mode??'pivot';canvas.dataset.placement=position.placement;canvas.dataset.bins=String(bars.length);canvas.dataset.barWidth=String(barWidth);canvas.dataset.barSpacing=String(layout.barSpacing);canvas.dataset.volatilityKey=volatility?.key??'missing';canvas.dataset.volatilityScore=Number.isFinite(volScore)?String(volScore):'';canvas.setAttribute('aria-label',`Bi?n �?ng 5 n?n: ${volatility?`${volatility.label} ${volatility.score}%, bi�n �? trung b?nh ${fmt(volatility.rangePct)}%, realized volatility ${fmt(volatility.realizedPct)}%, chu?n so s�nh ${volatility.baselineN} c?a s? ${volatility.baselineSession}`:'ch�a �? l?ch s?'}. Histogram 5 n?n Composite NF g?n nh?t. Ph?n tr�m d�ng EWMA half-life ${flow.pctHalfLife??32} n?n, ${flow.mode==='rolling'?'tr�n nh�m 96 n?n g?n nh?t':'t? c?p pivot x�c nh?n t?i n?n hi?n t?i'}: ${flow.pct>0?'mua':flow.pct<0?'b�n':'c�n b?ng'} ${fmt(Math.abs(flow.pct))}%; m?i c?t r?ng g?p ��i b�?c n?n gi�. ${position.placement==='pane-center'?'M?c 0 �?t gi?a pane v? ch�a th?y �? hai v�ng h? tr?/kh�ng c?.':'M?c 0 �?t gi?a h? tr? v� kh�ng c?.'} ${live?'C?t cu?i c� vi?n v�ng; histogram, bi?n �?ng v� s? ph?n tr�m �?u c?p nh?t theo n?n live.':'Ch�a c� d? li?u n?n �ang ch?y m?i t? c? SPY v� QQQ.'} Buy tr�n m?c 0, sell d�?i. Kh�ng ph?i t�n hi?u OFI �?c l?p.`);
}
function positionForecastReadout(){
  const node=$('geometry-readout'),paneHeight=chart?.panes?.()[0]?.getHeight?.();
  if(!node||!Number.isFinite(paneHeight))return;
  node.style.top=`${Math.max(8,paneHeight-node.offsetHeight-10)}px`;
}
function updateCandleCountdown(){
  const node=$('candle-countdown'),bar=selectedPrice().at(-1),show=$('interval').value==='15m'&&isSpyPrice();
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
function cvdSpectrumBounds(){
  const width=$('chart').clientWidth,anchor=cvdAnchorTime===null?null:chart.timeScale().timeToCoordinate(cvdAnchorTime/1000);
  if(!Number.isFinite(anchor))return null;
  const scaleWidth=chart.priceScale('right',0)?.width?.()??56,maxWidth=Math.min(width<650?48:76,Math.max(34,width*.14)),usableRight=width-scaleWidth-5;
  const xBase=Math.max(maxWidth+5,Math.min(usableRight-maxWidth-5,anchor+maxWidth+8));
  return {left:xBase-maxWidth,right:xBase+maxWidth,xBase,maxWidth,usableRight};
}
function drawCvdSpectrum(){
  const canvas=$('cvd-spectrum'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
  if(!$('cvd-spectrum-toggle').checked||!cvdProfile.bins.length||!cvdProfile.maxAbs||cvdAnchorTime===null)return;
  const bounds=cvdSpectrumBounds();if(!bounds)return;
  const paneHeight=chart.panes()[0]?.getHeight?.()??height*.5,{xBase,maxWidth,usableRight}=bounds,scale=maxWidth/cvdProfile.maxAbs;
  const visible=cvdProfile.bins.map(bin=>({...bin,y:price.priceToCoordinate(bin.price)})).filter(bin=>Number.isFinite(bin.y)&&bin.y>=0&&bin.y<=paneHeight);
  if(!visible.length)return;
  context.save();context.setLineDash([3,4]);context.strokeStyle='rgba(151,164,181,.55)';context.lineWidth=1;context.beginPath();context.moveTo(xBase,visible[0].y);context.lineTo(xBase,visible.at(-1).y);context.stroke();context.setLineDash([]);
  let buy=null,sell=null;
  for(const bin of visible){
    const x=xBase+bin.value*scale,ratio=Math.abs(bin.value)/cvdProfile.maxAbs;
    context.strokeStyle=bin.value>=0?`rgba(42,120,214,${.4+.5*ratio})`:`rgba(235,104,52,${.4+.5*ratio})`;context.lineWidth=(width<650?2.5:3.5)+(width<650?1:1.5)*ratio;context.beginPath();context.moveTo(xBase,bin.y);context.lineTo(x,bin.y);context.stroke();
    if(bin.value>0&&(!buy||bin.value>buy.value))buy={...bin,x};if(bin.value<0&&(!sell||bin.value<sell.value))sell={...bin,x};
  }
  context.font=`600 ${width<650?9:10}px Inter,system-ui,sans-serif`;context.textBaseline='bottom';context.textAlign='center';context.fillStyle='rgba(196,210,226,.9)';context.fillText(`CVD? ${cvdSourceLabel} � bin ${cvdProfile.binStep}`,xBase,Math.max(12,visible[0].y-5));
  if(width>=650){context.textBaseline='middle';if(buy){context.textAlign='left';context.fillStyle='#70aef4';context.fillText(`? ${fmt(buy.price)}`,Math.min(usableRight-42,buy.x+5),buy.y);}if(sell){context.textAlign='right';context.fillStyle='#f28a61';context.fillText(`? ${fmt(sell.price)}`,Math.max(42,sell.x-5),sell.y);}}
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
  const name=line.kind==='support'?'H? tr?':'Kh�ng c?',slope=`${line.slopeAtr>=0?'+':''}${fmt(line.slopeAtr)} ATR/n?n`;
  return `${name} ${line.score}/100 � ${line.touches} ch?m � tu?i ${line.ageBars} � d?c ${slope} � l?ch ${fmt(line.rmseAtr)} ATR � h?p l�u ${Math.round(line.confluence*100)}%`;
}
function updateGeometryReadout(){
  const state=trendReadoutState(rev63State,{now:Date.now()+serverOffsetMs,live:Boolean(lastSuccess&&Date.now()-lastSuccess<15000)});
  const node=$('geometry-readout');if(!node)return;node.style.display='block';
  node.textContent=formatPreRthWlrTrend(state);
  node.className=`forecast ${(state?.label??'WAIT').toLowerCase()}`;
  const ridge=state?.strengthRegression;node.title=`PRE?RTH WLR M15 � ${state?.reason??'Ch? d? li?u M15 �? ��ng'}. Tu?i hi?n t?i / trung v? t?ng �? d�i leg. TU?I P l� ph�n v? tu?i, kh�ng ph?i ph�n v? gi� WLR. C?N ~ l� trung v? s? n?n c?n l?i c� �i?u ki?n, kh�ng ph?i trung v? t?ng tr? tu?i hi?n t?i. TREND C?N l� kh? n�ng s?ng th�m ${state?.horizon??3} n?n �? nh?n, kh�ng ph?i x�c su?t gi� t�ng ho?c t? l? ��ng A�B�A. Kaplan�Meier d�ng v? tr� n?n th?t b?i sau n?n �? nh?n cu?i, c� ki?m duy?t ph?i v� ki?m tra �? th?i gian theo d?i. ${state?.active?`Nh�m tu?i ${state.ageGroup?.label??'�'} � �i?m ${state.trendScore}/100 � R� gi� ${fmt(state.r2)} � �? b?n h�?ng gi� ${Math.round((state.persistence??0)*100)}% � SPY V c�ng d?u t?ng n?n ${Math.round((state.volumeAlignment??0)*100)}% (ch? tham kh?o) � n?n �? nh?n v�o Flow-Leg �2? ${Math.round((state.channelAlignment??0)*100)}% (${state.currentBars}/${state.elapsedBars??state.currentBars} n?n ��?c t�nh) � Composite g�p ${Math.round((state.compositeScore??.5)*5)}/5 �i?m � Strength ${state.strengthContext??'�'} � Ridge OOS R� ${fmt(ridge?.r2)}, partial C ${fmt(ridge?.partialComposite)}, V ${fmt(ridge?.partialVolume)}, n OOS ${ridge?.oosN??0} � m?u ${state.sampleN} leg / ${state.uniqueDays??'�'} ng�y, c?n r?i ro ${state.atRiskN}, k?t qu? th�m ${state.horizon} n?n �? bi?t ${state.resolvedHorizonN??'�'}, ki?m duy?t ph?i ${state.censoredN??0}. `:''}SPY V x�c nh?n d?u+slope ? c?p trend. Ph� �2? c�ng h�?ng, n?n trung t�nh, m?t n?n SPY V tr�i d?u ho?c m?t n?n gi� ngo�i bi�n b?t l?i v?n thu?c leg v� ��?c t�i kh?p. Ch? hai n?n b?t l?i li�n ti?p m?i k?t th�c. Composite ch? g�p 5% �i?m trend; Ridge OOS v?n l� l?p m� t? ri�ng. N?n �ang ch?y kh�ng ��?c t�nh; trend c?n ch?y l�c 16:00 ��?c xem l� ki?m duy?t ph?i.`;
  requestAnimationFrame(positionForecastReadout);
}
function drawGeometryOverlay(){
  const canvas=$('geometry-overlay'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);canvas.dataset.lines=String(geometryState.lines?.length??0);canvas.dataset.provisionalLines=String(geometryState.provisionalLines?.length??0);canvas.dataset.pivots=String(geometryState.pivots?.length??0);canvas.dataset.states=String(geometryStatePoints.length);canvas.dataset.causalTrends=String(causalChannelState.trends?.length??0);
  const showGeometry=$('geometry-toggle').checked,showGeometryProvisional=$('geometry-provisional').checked,showCausal=$('causal-trend-channel').checked,showCausalProvisional=$('causal-trend-channel-provisional').checked;if(!showGeometry&&!showCausal)return;
  const paneHeight=chart.panes()[0]?.getHeight?.()??height*.5,scaleWidth=chart.priceScale('right',0)?.width?.()??56,right=width-scaleWidth;
  context.save();context.beginPath();context.rect(0,0,right,paneHeight);context.clip();canvas.dataset.clipHeight=String(paneHeight);context.lineJoin='round';context.lineCap='round';
  if(showCausal){
    for(const trend of causalChannelState.trends??[]){
      if(trend.provisional&&!showCausalProvisional)continue;
      const path=(trend.renderPoints??trend.points??[]).map(point=>({point,x:chart.timeScale().timeToCoordinate(point.time/1000),upper:price.priceToCoordinate(point.upper),lower:price.priceToCoordinate(point.lower),center:price.priceToCoordinate(point.center)})).filter(item=>[item.x,item.upper,item.lower,item.center].every(Number.isFinite)),x1=path[0]?.x,x2=path.at(-1)?.x,confirmPoint=path.find(item=>item.point.time===trend.confirmationTime);
      if(path.length<2||Math.max(x1,x2)<0||Math.min(x1,x2)>right)continue;
      const alpha=Math.max(.35,Math.min(.98,trend.qualityOpacity??.78)),rgb=trend.direction<0?'248,250,252':trend.absorbing?'251,146,60':trend.provisional?'34,211,238':'250,204,21',color=`rgba(${rgb},${alpha})`,secondaryColor=`rgba(${rgb},${Math.max(.24,alpha*.58)})`,primaryKey=trend.direction>0?'lower':'upper',secondaryKey=trend.direction>0?'upper':'lower',dash=trend.provisional?[5,4]:trend.absorbing?[9,5]:[];
      const strokeRail=(key,stroke,width)=>{context.strokeStyle=stroke;context.lineWidth=width;context.setLineDash(dash);context.beginPath();for(let i=0;i<path.length;i++)i?context.lineTo(path[i].x,path[i][key]):context.moveTo(path[i].x,path[i][key]);context.stroke();};
      strokeRail(secondaryKey,secondaryColor,1.35);strokeRail(primaryKey,color,Math.max(2,Math.min(5,trend.lineWidth??2)));
      const startY=path[0].center;
      if(Number.isFinite(startY)&&x1>=0&&x1<=right){context.setLineDash([]);context.fillStyle=color;context.beginPath();context.arc(x1,startY,4,0,Math.PI*2);context.fill();if(width>=650){context.font='800 9px Inter,system-ui,sans-serif';context.textAlign='left';context.textBaseline='bottom';context.fillText(`${trend.direction>0?'?':'?'} B?T �?U`,x1+6,startY-4);}}
      if(trend.confirmationTime!==trend.startTime&&confirmPoint&&confirmPoint.x>=0&&confirmPoint.x<=right){context.setLineDash([]);context.strokeStyle=color;context.lineWidth=1.5;context.beginPath();context.arc(confirmPoint.x,confirmPoint.center,3,0,Math.PI*2);context.stroke();}
    }
  }
  if(!showGeometry){context.restore();return;}
  if(showGeometryProvisional)for(const line of geometryState.provisionalLines??[]){
    const x1=chart.timeScale().timeToCoordinate(line.startTime/1000),x2=chart.timeScale().timeToCoordinate(line.endTime/1000),y1=price.priceToCoordinate(line.startValue),y2=price.priceToCoordinate(line.endValue);
    if(![x1,x2,y1,y2].every(Number.isFinite)||Math.max(x1,x2)<0||Math.min(x1,x2)>right||Math.max(y1,y2)<0||Math.min(y1,y2)>paneHeight)continue;
    const provisionalColor=line.kind==='support'?'rgba(54,221,189,.82)':'rgba(255,180,84,.82)';context.strokeStyle=provisionalColor;context.lineWidth=2.1;context.setLineDash([2,4]);context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();
    if(width>=650&&x2>70&&x2<right-6&&y2>10&&y2<paneHeight-8){context.setLineDash([]);context.font='700 9px Inter,system-ui,sans-serif';context.textAlign='right';context.textBaseline='bottom';context.fillStyle=line.kind==='support'?'#71f7d6':'#ffd092';context.fillText(`${line.kind==='support'?'HT':'KC'} S?M � ${line.lookbackBars}n`,x2-4,y2-3);}
  }
  for(const line of [...geometryState.lines].reverse()){
    const x1=chart.timeScale().timeToCoordinate(line.startTime/1000),x2=chart.timeScale().timeToCoordinate(line.endTime/1000),y1=price.priceToCoordinate(line.startValue),y2=price.priceToCoordinate(line.endValue);
    if(![x1,x2,y1,y2].every(Number.isFinite)||Math.max(x1,x2)<0||Math.min(x1,x2)>right||Math.max(y1,y2)<0||Math.min(y1,y2)>paneHeight)continue;
    const alpha=.48+.45*Math.max(0,Math.min(1,(line.score-55)/35));context.strokeStyle=line.kind==='support'?`rgba(54,221,189,${alpha})`:`rgba(255,180,84,${alpha})`;context.lineWidth=1.2+2*Math.max(0,Math.min(1,(line.score-55)/35));context.setLineDash(line.score>=75?[]:[6,4]);context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();
    if(width>=650&&x2>70&&x2<right-6&&y2>10&&y2<paneHeight-8){context.setLineDash([]);context.font='700 9px Inter,system-ui,sans-serif';context.textAlign='right';context.textBaseline='bottom';context.fillStyle=line.kind==='support'?'#7dffd9':'#ffd092';context.fillText(`${line.kind==='support'?'HT':'KC'} ${line.score} � ${line.touches}x`,x2-4,y2-3);}
  }
  context.setLineDash([]);for(const point of geometryStatePoints){
    const x=chart.timeScale().timeToCoordinate(point.at/1000),y=price.priceToCoordinate(point.lineValue);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>right||y<0||y>paneHeight)continue;
    const color=point.breakDirection>0?'#1ae0a3':'#ff6383',trueBreak=point.key==='true_break';context.fillStyle=trueBreak?color:'rgba(9,18,31,.96)';context.strokeStyle=color;context.lineWidth=trueBreak?1.4:2.4;context.beginPath();context.arc(x,y,5,0,Math.PI*2);context.fill();context.stroke();context.font='900 8px Inter,system-ui,sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillStyle=trueBreak?'#07131f':color;context.fillText(point.breakDirection>0?'?':'?',x,y+.3);
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
  const renderStarted=performance.now(),range=chart.timeScale().getVisibleLogicalRange();
  const seriesContext=[$('symbol').value,$('interval').value,$('signal').value,$('days').value,$('candle-agreement-color').checked,$('phase-width').checked].join('|');
  const p=rows[$('symbol').value]??[],priceTimes=new Set(p.map(b=>b.t)),signalRows=(rows[$('signal').value]??[]).filter(b=>$('symbol').value!=='SPY'||priceTimes.has(b.t)),model=Object.keys(modelRows).length?modelRows:rows;
  dayBoundaries=dayBoundaryTimes(p);
  const compositeCvd=isSpyPrice(),cvdBars=compositeCvd?projectNetFlowToPrice(p,rows.COMPOSITE??[]):p;
  cvdSourceLabel=compositeCvd?'C?S':'Q';$('cvd-spectrum').dataset.source=compositeCvd?'COMPOSITE?SPY':'QQQUSDT';
  cvdProfile=continuousCvdSpectrum(cvdBars);cvdAnchorTime=cvdBars.at(-1)?.t??null;
  const alignment=flowAlignment(rows.SPYUSDT??[],rows.QQQUSDT??[],{step:STEPS[$('interval').value]});
  const closedBefore=cache?.serverTime??Infinity,closedPrice=p.filter(row=>(row.end??row.t)<closedBefore),closedTimes=new Set(closedPrice.map(row=>row.t)),modelPrice=model[$('symbol').value]??p,modelClosedPrice=modelPrice.filter(row=>(row.end??row.t)<closedBefore),modelClosedTimes=new Set(modelClosedPrice.map(row=>row.t));
  const volumeStrengthMap=new Map(volumeStrengthRows.map(x=>[x.t,x]));
  candleColorMap=new Map(p.map(x=>[x.t,strengthAgreementCandleSignal(maps.COMPOSITE?.get(x.t),volumeStrengthMap.get(x.t))]));
  candleClusterMap=new Map(candleRegimeClusters(p,volumeStrengthRows,STEPS[$('interval').value]).map(x=>[x.t,x]));
  const clusterColors=$('candle-agreement-color').checked;
  price.applyOptions({priceFormat:$('symbol').value==='SPYUSDT'?{type:'price',precision:1,minMove:.1}:{type:'price',precision:2,minMove:.01}});
  writeSeries('price',price,p.map(x=>{const color=clusterColors?candleClusterPalette(candleClusterMap.get(x.t)):candlePalette(candleColorMap.get(x.t));return {time:x.t/1000,open:x.o,high:x.h,low:x.l,close:x.c,color:color.body,wickColor:color.wick,borderColor:color.border};}),seriesContext);
  pivotFlowState=pivotFlowRealtime(pivotZoneState.flow,selectedPrice(),rows.COMPOSITE??[],closedBefore,pivotFlowState?.volatility?.key);
  const priceBands=weightedPriceBands(p,STEPS[$('interval').value]),trendThickness=new Map(wlrTrendThickness(p,STEPS[$('interval').value]).map(x=>[x.t,x]));priceBandMap=new Map(priceBands.map(x=>[x.t,x]));
  updateRev63();
  writeSeries('priceMid',series.priceMid,priceLineData(priceBands,maps.COMPOSITE??new Map(),volumeStrengthMap,trendThickness),seriesContext);for(const [name,field] of [['priceUpper','upper'],['priceLower','lower']])writeSeries(name,series[name],lineData(priceBands,field),seriesContext);
  for(const key of Object.keys(colors))writeSeries(key,series[key],flowData(rows[key]??[],key),seriesContext);
  writeSeries('relative',series.relative,relativeData(alignment),seriesContext);
  writeSeries('alignment',series.alignment,volumeDeltaBandData(directionalVolumeDelta(rows.SPYUSDT??[],STEPS[$('interval').value]),volumeStrengthMap),seriesContext);
  writeSeries('strength',series.strength,lineData(signalRows,'adjusted'),seriesContext);
  writeSeries('volumeStrength',series.volumeStrength,lineData(volumeStrengthRows,'adjusted'),seriesContext);
  strengthMarks.setMarkers(signalRows.filter(x=>Number.isFinite(x.adjusted)&&x.adjusted>.95).map(x=>({time:x.t/1000,position:'inBar',color:'#7dffd9',shape:'circle',text:''})));
  for(const key of ['mid','upper','lower'])writeSeries(key,series[key],lineData(signalRows,key),seriesContext);
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
  forecastLayer?.update();
  $('chart').dataset.renderMs=String(Math.round(performance.now()-renderStarted));
  if(p.length){$('chart').dataset.chartReady='true';requestAnimationFrame(()=>{$('chart').dataset.firstPaintMs??=String(Math.round(performance.now()));requestStudies();requestStats();});}
}
function statValue(id,text,color='neutral'){const node=$(id);node.textContent=text;node.className=color;}
function latestStrength(key){const data=rows[key]??[];for(let i=data.length-1;i>=0;i--)if(Number.isFinite(data[i].adjusted))return data[i].adjusted;return null;}
function positionStrengthReadout(){
  const host=$('strength-readout'),bounds=paneBounds(2);if(!host||!bounds||!series.strength)return;
  const paneTop=bounds.top,paneHeight=bounds.height,topLimit=paneTop+4,bottomLimit=paneTop+paneHeight-4;
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
  for(const [id,index] of [['composite-flow-fixed',2],['spy-volume-fixed',1]]){const node=$(id),bounds=paneBounds(index);if(!node||!bounds)continue;node.style.top=`${Math.round(bounds.top+6)}px`;node.dataset.paneTop=String(Math.round(bounds.top));node.dataset.paneBottom=String(Math.round(bounds.top+bounds.height));}
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
  const p=maps[$('symbol').value]?.get(t),record=statsMap.get(t),state=record?.state,colorSignal=candleColorMap.get(t),clusterSignal=candleClusterMap.get(t),geometryEvent=geometryState.events?.find(event=>event.at===t),breakoutEvent=geometryStatePoints.find(event=>event.at===t)??(breakoutState&&breakoutState.at===t&&['true_break','false_break'].includes(breakoutState.key)?breakoutState:null),geometryLine=inspectedTime===null?geometryState.lines?.[0]:null;
  const time=p?new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York'})+' ET':'Ch�a c� d? li?u';
  const running=p&&p.end>=(cache?.serverTime??Infinity),mode=inspectedTime!==null?'N?N �ANG XEM':'M?I NH?T';
  if(!state){
    for(const id of ['stat-group','stat-score','stat-pair'])statValue(id,'�');
    for(const id of ['stat-group-note','stat-score-note','stat-pair-note'])$(id).textContent='Ch? �? Strength v� quote volume c?a SPY/QQQ';
    $('tooltip').textContent=`${mode} � ${time} � Ch�a �? d? li?u �? ch?m �i?m v� th?ng k� nh�m Strength.`;return;
  }
  $('stat-group').replaceChildren(...state.signs.map((s,i)=>{const span=document.createElement('span');span.className=tone(s);span.textContent=`${['S','Q','C'][i]}${signLabel(s)}`;return span;}));
  $('stat-group-note').textContent=`${sourceName($('signal').value)} ${signed(state.value)} � ${state.session}${state.marker?' � ? >0.95':state.extreme?' � <?0.95':''}`;
  statValue('stat-score',state.score===null?'Trung t�nh':`${state.score}/100`,state.score>=65?'positive':state.score<40?'negative':'neutral');
  $('stat-score-note').textContent=`Mua ${fmt(state.buyShare*100)}% / B�n ${fmt(state.sellShare*100)}% � ${state.flowDirection===0?'C�n b?ng':state.flowDirection===state.direction?'C�ng d?u':'Ng�?c d?u Strength'}`;
  const a=state.alignment;
  statValue('stat-pair',a.detailState, a.detailState==='THU?N MUA'?'positive':a.detailState==='THU?N B�N'?'negative':'neutral');
  $('stat-pair-note').textContent=`NF% m�?t � S ${signed(a.smoothSpyNf)} / Q ${signed(a.smoothQqqNf)}`;
  const regimeText=colorSignal?.direction?`Composite�Volume ${colorSignal.colorRegime}: Composite ${signed(colorSignal.compositeStrength)}, SPY Volume ${signed(colorSignal.volumeStrength)}; �? �?m theo min(|Composite|, |Volume|) = ${fmt(colorSignal.agreement)}.`:`Composite�Volume TRUNG T�NH${colorSignal?.neutralReason?` (${colorSignal.neutralReason.toLowerCase()})`:''}: Composite ${signed(colorSignal?.compositeStrength)}, SPY Volume ${signed(colorSignal?.volumeStrength)}; tr�i d?u, b?ng 0 ho?c thi?u d? li?u �?u d�ng x�m.`;
  const clusterName=clusterSignal?.group>0?'C?M T�NG':clusterSignal?.group<0?'C?M GI?M':'TRUNG T�NH',colorText=$('candle-agreement-color').checked?`M�u n?n C?m Gi��SPY V ${clusterName} � ${clusterSignal?.level??'weak'}${clusterSignal?.counter?' � n?n ng�?c nh?, gi? m�u c?m':''}${clusterSignal?.transition?' � th? chuy?n pha, vi?n v�ng':''}${running?' � LIVE ch? xem tr�?c':''}. �i?m m�?t ${signed(clusterSignal?.smooth)} = WLR8 45% + SPY V 35% + th�n/ATR 20%; c?n hai n?n �?i ngh?ch �? �?o c?m.`:`M�u n?n ${regimeText}`;
  const text=[`${mode} � ${time} � ${state.session} � Gi� ${sourceName($('symbol').value)}, Strength ph�n t�ch ${sourceName($('signal').value)}${running?' � N?n �ang ch?y: �i?m t?m th?i, l?ch s? so s�nh d�ng n?n ��ng':''}`,
    geometryLine?`GEO hi?n t?i: ${geometryLineText(geometryLine)}. Line ch? xu?t hi?n t? ${new Date(geometryLine.knownAt).toLocaleString('vi-VN',{timeZone:'America/New_York'})} ET, sau khi pivot th? hai ��?c x�c nh?n; kh�ng d�ng n?n �ang ch?y.`:null,
    breakoutEvent?`Th�ng b�o c?t Trendline causal: ${breakoutEvent.label} ${breakoutEvent.breakDirection>0?'l�n ?':'xu?ng ?'} t?i ${breakoutEvent.lineKind==='support'?'h? tr?':'kh�ng c?'} ${fmt(breakoutEvent.lineValue)} � line ${breakoutEvent.lineScore}/100 � c�ch ${fmt(breakoutEvent.distanceAtr)} ATR${breakoutEvent.key==='true_break'?' � Strength Composite, SPY V v� NetFlow c�ng x�c nh?n h�?ng ph�':' � gi� �? gi�nh l?i ph�a c? c?a line'}. Line tham chi?u �? t?n t?i v� ��?c kh�a tr�?c hai n?n x�c nh?n.`:null,
    geometryEvent?`D? bi?t ��?c x�c nh?n t?i n?n n�y: ${geometryEvent.direction==='bullish'?'ph�n k? t�ng':geometryEvent.direction==='bearish'?'ph�n k? gi?m':'SPY/QQQ lu�n phi�n d?n d?t'} � �i?m ${geometryEvent.score}/100 � ?Strength SPY ${signed(geometryEvent.spyDelta)} / QQQ ${signed(geometryEvent.qqqDelta)} / SPY V ${signed(geometryEvent.volumeDelta)} � ?NetFlow ${signed(geometryEvent.flowDelta)}${geometryEvent.pairSplit?` � Strength SPY v� QQQ ng�?c nhau, gi� �ang g?n nh?p ${geometryEvent.leader==='SPY'?'SPY':geometryEvent.leader==='QQQ'?'QQQ':'h?n h?p'}`:''}. ��y l� m� t? h?p l�u t?i th?i �i?m x�c nh?n, kh�ng ph?i d? b�o ch?c ch?n.`:null,
    `M�u SPY?QQQ t��ng �?i d�ng d?u NetFlow c�ng n?n: ${a.state} � SPY ${signed(a.spyNet)} / QQQ ${signed(a.qqqNet)}. Chi?u cao v?n l� Relative NetFlow m�?t, kh�ng d�ng d? li?u s? l?nh.`,
    colorText,
    `�i?m x�c nh?n ${state.score??'�'}/100 = Taker ${fmt(state.taker)}/50 + D?i ${fmt(state.pair)}/30 + |Strength| ${fmt(state.strength)}/20. �i?m theo quy t?c, kh�ng ph?i x�c su?t th?ng.`];
  const nodes=text.filter(Boolean).map(value=>{const div=document.createElement('div');div.textContent=value;return div;});
  $('tooltip').replaceChildren(...nodes);
}
function toggle(){
  for(const [id,key] of [['spy','SPYUSDT'],['qqq','QQQUSDT'],['composite','COMPOSITE'],['show-strength','strength'],['spy-volume-strength','volumeStrength']])series[key].applyOptions({visible:$(id).checked});
  strengthMarks.applyOptions({visible:$('show-strength').checked});
  $('cvd-spectrum').style.display=$('cvd-spectrum-toggle').checked?'block':'none';scheduleCvdSpectrum();
  $('day-separators').style.display=$('markers').checked?'block':'none';scheduleDaySeparators();
  $('geometry-overlay').style.display=$('geometry-toggle').checked||$('causal-trend-channel').checked?'block':'none';scheduleGeometryOverlay();updateGeometryReadout();
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
  if(clear){resetStudies();cache=null;rows={};volumeStrengthRows=[];modelRows={};modelVolumeStrengthRows=[];modelStamp=null;trendRows={};trendVolumeStrengthRows=[];trendStamp=null;trainingMeta=null;maps={};lastSuccess=null;inspectedTime=null;pivotZoneKey='';pivotZoneState={ready:false,reason:'history',support:null,resistance:null};pivotFlowState=null;render(true);}
  const interval=$('interval').value,days=+$('days').value;
  status(`�ang x�c minh SPYUSDT/QQQUSDT v� t?i ${interval} � ${days} ng�y�`);
  try{
    const wantSpy=$('symbol').value==='SPY';
    const [data,etf]=await Promise.all([load(interval,days,{signal:controller.signal,previous:cache}),wantSpy?loadSpy(interval,days,{signal:controller.signal}):null]);if(gen!==generation)return;
    if(etf){data.SPY=hybridSpy(etf.bars,data.SPYUSDT);data.spyM15=etf.m15;data.spyMeta=etf.meta;}
    const step=STEPS[interval];
    rows={SPYUSDT:analyze(data.SPYUSDT,step),QQQUSDT:analyze(data.QQQUSDT,step),COMPOSITE:analyze(composite(data.SPYUSDT,data.QQQUSDT),step)};
    if(data.SPY)rows.SPY=analyze(data.SPY,step);
    volumeStrengthRows=analyze(data.SPYUSDT,step,{strength:calculateVolumeStrength(data.SPYUSDT,step)});
    modelRows=rows;modelVolumeStrengthRows=volumeStrengthRows;
    maps=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,new Map(v.map(x=>[x.t,x]))]));
    const sourceNote=$('price-source-note');if(sourceNote)sourceNote.textContent=etf?`Gi�: SPY ETF USD / Yahoo Finance (c� th? tr?) � N?n cu?i ${new Date(etf.meta.lastTime).toLocaleString('vi-VN')} � Taker/CVD/Strength: Binance SPYUSDT + QQQUSDT � A�B�A chuy?n m� h?nh, ch�a ki?m �?nh ri�ng SPY.`:'Gi� v� d?ng ti?n: Binance perpetual.';
    cache=data;serverOffsetMs=data.serverTime-Date.now();lastSuccess=new Date();render(clear);setLive(true);
    const modelText=interval==='15m'?' � Nghi�n c?u l?ch s? ch?y n?n':'';
    status(`SPYUSDT + QQQUSDT � TRADING / ${data.contracts.map(x=>x.contractType).join(' + ')} � ${rows.SPYUSDT.length}/${rows.QQQUSDT.length} n?n, g?m n?n �ang ch?y � ${rows.COMPOSITE.length} timestamp chung${modelText} � ${data.incremental?'c?p nh?t realtime ~3 gi�y':'t?i l?ch s? song song'} � c?p nh?t ${lastSuccess.toLocaleTimeString('vi-VN')} � ${rows.COMPOSITE.length?'D? li?u th?t Binance':'Composite ch�a c� d? li?u giao nhau'}`);
  }catch(e){
    if(gen!==generation)return;
    setLive(false);schedulePivotFlowOverlay();status(`${e.message}. C� th? b? CORS, v�ng truy c?p, m?t m?ng ho?c rate limit. ${cache?`D? li?u c? ch�a c?p nh?t (l?n th�nh c�ng ${lastSuccess.toLocaleTimeString('vi-VN')}).`:'Kh�ng c� d? li?u thay th?; bi?u �? �? tr?ng.'} D�ng T?i l?i sau khi ki?m tra k?t n?i.`,true);
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
    const rightPadding=Math.max(forecastLayer?.toggle.checked?4:0,Math.min(6,Math.max(2,Math.round((lastIndex-firstIndex+1)*.04))));
    chart.timeScale().setVisibleLogicalRange({from:firstIndex-.5,to:lastIndex+rightPadding});host.dataset.fitWindowHours=String(windowMs/3600000);host.dataset.fitStart=String(data[firstIndex].t);host.dataset.fitEnd=String(lastTime);
  }else{chart.timeScale().fitContent();delete host.dataset.fitWindowHours;delete host.dataset.fitStart;delete host.dataset.fitEnd;}
  scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();
}
function isFullChart(){const card=document.querySelector('.chart-card');return document.fullscreenElement===card||card.classList.contains('fullscreen-fallback');}
function syncFullChart(){const active=isFullChart();$('fullscreen').textContent=active?'? Thu nh?':'? Full chart';$('fullscreen').setAttribute('aria-pressed',String(active));document.body.classList.toggle('chart-fullscreen',active);applyResponsiveChartOptions();setTimeout(()=>{window.dispatchEvent(new Event('resize'));scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();},50);}
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
  updateTrendMethodCopy();
  setupChartActions();
  forecastLayer=createWlrAba({chart,wlr:series.priceMid,host:$('chart'),actions:document.querySelector('.chart-actions'),paneBounds,getCvdBounds:cvdSpectrumBounds,getContext:()=>({symbol:$('symbol').value,interval:$('interval').value,features:studyResultKey===studyKey?researchFeatures:[],expectedTime:(rows[$('symbol').value]??[]).filter(r=>r.end<(cache?.serverTime??0)).at(-1)?.t,displayRows:rows[$('symbol').value]??[],live:Boolean(cache&&lastSuccess&&Date.now()-lastSuccess<15000&&($('symbol').value!=='SPY'||Date.now()-cache.spyMeta?.lastTime<20*60000)),now:Date.now()+serverOffsetMs})});
  restoreSavedSetup();
  syncDisplayModeButtons();
  $('refresh').onclick=()=>refresh();for(const id of ['interval','days'])$(id).onchange=()=>refresh(true);
  $('symbol').onchange=()=>{resetStudies();void refresh(true);};
  $('signal').onchange=()=>{resetStudies();render(false);};
  for(const id of ['spy','qqq','composite','relative','alignment','price-bands','pivot-zones','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','geometry-toggle','geometry-provisional','causal-trend-channel','causal-trend-channel-provisional','geometry-pivots'])$(id).onchange=toggle;
  for(const id of ['geometry-score','geometry-lines'])$(id).onchange=()=>render(false);
  $('wlr-width-mode').onclick=()=>{$('phase-width').checked=!$('phase-width').checked;syncDisplayModeButtons();render(false);};
  $('candle-color-mode').onclick=()=>{$('candle-agreement-color').checked=!$('candle-agreement-color').checked;syncDisplayModeButtons();render(false);};
  $('fit').onclick=()=>fitChart();$('chart-fit').onclick=()=>fitChart();$('chart-fit-half').onclick=()=>fitChart(FIT_HALF_WINDOW_MS);$('chart-save').onclick=saveChartSetup;$('fullscreen').onclick=toggleFullChart;
  document.addEventListener('fullscreenchange',syncFullChart);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.chart-card').classList.contains('fullscreen-fallback')){document.querySelector('.chart-card').classList.remove('fullscreen-fallback');syncFullChart();}});
  $('export').onclick=exportCSV;
  const changeCalendarFilter=()=>{delete $('calendar-list').dataset.positioned;renderCalendar();};$('calendar-impact').onchange=changeCalendarFilter;$('calendar-currency').onchange=changeCalendarFilter;$('calendar-refresh').onclick=refreshCalendar;
  setLive(false);refreshCalendar();refresh(true);setInterval(()=>{updateCandleCountdown();if(lastSuccess&&Date.now()-lastSuccess>15000){setLive(false);schedulePivotFlowOverlay();}updateGeometryReadout();if(!document.hidden&&!loading)refresh();},LIVE_REFRESH_MS);
  setInterval(()=>{if(!document.hidden)refreshCalendar();},CALENDAR_REFRESH_MS);
  setInterval(updateCandleCountdown,250);
}







