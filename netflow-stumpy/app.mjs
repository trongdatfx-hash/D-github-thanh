import {mountGex} from './gex-ui.mjs?v=20261126-gex1';
let gexLayer;
import {clusterTakerNf} from './cluster-taker-nf.mjs?v=20261125-cluster-live1';
let compositeClusterRows=[];
import {mountOiBottomBars} from './oi-bottom-bars.mjs?v=20261125-cluster-live1';
let oiBottomLayer;
import {CHART_SETUP_KEY,readChartSetup,restoreSetupControls} from './chart-setup-state.mjs?v=20261122-setup1';
import {mountOrderBook} from './orderbook-ui.mjs?v=20261125-ob-persist1';
import {mountTpo} from './tpo-ui.mjs?v=20261123-tpo-trades4';
import {TPO_CONTROL_IDS} from './tpo-profile.mjs?v=20261123-tpo-trades4';
import {mountPriceChartStyle} from './price-chart-style.mjs?v=20261123-line-colors1';
let priceStyleLayer;
let tpoLayer;
import {h1AccumulatedStops} from './stop-loss-h1.mjs?v=20261114-slh1b';
import {StopLossBands} from './stop-loss-band.mjs?v=20261114-slh1';
import {scoreH1OiMarkers} from './h1-oi-markers.mjs?v=20261110-h1-oi-visible2';
import {buildH1ScoreLine,h1ScoreLineReading} from './h1-score-line.mjs?v=20261107-h1-score-line1';
import {h1OiLabel,OiPercentColor} from './h1-oi-label.mjs?v=20261107-h1-label-arrows1';
import {mountChartSettings} from './chart-settings.mjs?v=20261107-outside-fast1';
import {mountH1ScoreHistogram} from './h1-box-score-ui.mjs?v=20261118-remove-h1-matrix-m15-status';
import {mountGptPattern} from './gpt-pattern-ui.mjs?v=20261106-chatflow1';
import {CurrentOiLoader,RunningOiState} from './oi-current.mjs?v=20261106-oi-live1';
import {oi8PivotLevels} from './oi8-pivot-levels.mjs?v=20261120-clean1';
import {strengthOi8} from './strength-oi8.mjs?v=20261111-oi8';
import {strengthOiPhase,oiPhasePrimitive} from './strength-oi-phase.mjs?v=20261119-oi-phase1';
let oiPhaseLayer;
import {bodyReversalCache} from './spy-body-reversal.mjs?v=20261120-v2-first-line1';
import {bodyReversalPrimitive} from './spy-body-reversal-ui.mjs?v=20261124-v2-last2';
const daoV2Cache=bodyReversalCache();
import {reversalTradePrimitive} from './spy-body-reversal-display.mjs?v=20261120-tk-display1';
let daoV2Layer,daoV2Stats,daoV2Trades;
import {mountReversalStats} from './spy-body-reversal-stats-ui.mjs?v=20261122-setup1';
import {compositeNfSmooth} from './composite-nf-smooth.mjs?v=20261108-c-taker-smooth1';
import {OiFastLoader} from './oi-fast-load.mjs?v=20261109-m15-flow1';
import {spyCandleVolumeFlow,buildSpectrumComparison,drawPairedSpectrum,spectrumPriceGroup,confirmSpectrumGroup} from './paired-spectrum.mjs?v=20261110-h1-oi-visible2';
import {OiHistory} from './oi-history.mjs?v=20261104-oi-stale-fast2';
import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';
import {OiBoldCandles} from './oi-bold-candles.mjs?v=20261119-narrow';
import {oiCandleBars,OI_GROUP_LABELS} from './oi-candle-bars.mjs?v=20261104-oi-p62-1';
import {oiSpectrum} from './oi-spectrum.mjs?v=20261104-oi-stale-fast2';
import {closedColorSourceKey,readH1ColorCache,saveH1ColorCache,archiveColorRevision} from './h1-color-cache.mjs?v=20261108-matrix-trend-no-oi1';
import {h1StripCell} from './h1-h4-strip.mjs?v=20261101-h1h4-align1';
import {createStrengthBoxLayer} from './strength-box-ui.mjs?v=20261031-h1-box-perf1';
import {chartFresh} from './chart-live.mjs?v=20261030-chart-live3';
import {chartHistoryFallback} from './chart-history-fallback.mjs?v=20261029-price-delta1';
import {causalChannelAba} from './aba-causal-channels.mjs?v=20261029-price-delta1';
import {wlrColorSegments} from './wlr-color-segments.mjs?v=20261108-wlr-h1-align2';
import {wlrSlopeThickness,WLR_SLOPE_DEFAULTS} from './wlr-slope-thickness.mjs?v=20261029-price-delta1';
import {wlrSoftColors} from './wlr-soft-color.mjs?v=20261029-price-delta1';
import {wlrH1Styles} from './wlr-h1-style.mjs?v=20261108-wlr-score-color3';
import {wlrDisplayColors,WLR_COLOR_DEFAULTS} from './wlr-display-color.mjs?v=20261029-price-delta1';
import {createSeriesWriter} from './chart-data-cache.mjs?v=20261029-price-delta1';
import {COMPOSITE_STRENGTH_VERSION,STEPS,composite,strengthAgreementCandleSignal,strengthPhaseLineStyle,directionalVolumeDelta,volumeDeltaStrengthValue,symmetricPriceRange,calculateVolumeStrength,analyze,weightedPriceBands,candleRegimeClusters,continuousCvdSpectrum,projectNetFlowToPrice,dayBoundaryTimes} from './engine.mjs?v=20261118-wlr-band-slope';
import {spyUsdtSessionChange} from './spy-session-change.mjs?v=20261110-spy-post-close1';
import {load,getJSON} from './data.mjs?v=20261107-outside-fast1';
import {oiWidthByBar} from './oi-width.mjs?v=20261029-oi-width1';
import {loadForexCalendar,selectCalendarEvents,calendarEventState,actualVsForecast,CALENDAR_TIME_ZONE} from './forex-calendar.mjs?v=20261126-calendar-path1';
const $=id=>document.getElementById(id),fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'�',fmtK=x=>Number.isFinite(x)?`${(x/1000).toLocaleString('en-US',{maximumFractionDigits:2})}K`:'�';
const L=window.LightweightCharts;
let chart,price,series={},marks,cache=null,chartLiveResponse=false,rows={},volumeStrengthRows=[],spyVolumeDeltaRows=[],maps={},priceBandMap=new Map(),cvdProfile={bins:[],maxAbs:0,binStep:.5,range:12},cvdAnchorTime=null,cvdSourceLabel='C?S',dayBoundaries=[],dayFrame=0,geometryFrame=0,geometryState={pivots:[],events:[],lines:[],summary:{}},causalChannelState={trends:[],total:0},geometryStatePoints=[],geometryStatePointsKey='',breakoutState=null,controller,generation=0,loading=false,lastSuccess=null,serverOffsetMs=0;
const colors={SPYUSDT:'#5ba8ff',QQQUSDT:'#c194ff',COMPOSITE:'#38dfba'};
let displayVolumeStrengthRows=[];
let h1ScoreLineState={points:[],preview:[],timeline:[],previewMeta:null};
let h1CandleMap=new Map(),h1H4CandleMap=new Map(),abaBandPhaseMap=new Map(),abaBandFrame=0;
let h1H4StripFrame=0,h1ScoreLayer=null,h1OiMarkers=[],h1OiMarkerCoverage={},h1OiMarkerLayer=null;
let geometryOiRevision=0;
let h1CacheAttempt='',h1CacheArchive=null,h1HistoryKnown=false,h1HistoryRevision=null,studyColorInput=null;

let volumeStrengthMap=new Map(),wlrThicknessMap=new Map(),wlrColorMap=new Map(),wlrH1StyleMap=new Map();
const usesH1WlrStyle=()=>$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
function wlrH1StyleText(x){
  if(!x?.ready)return 'WLR theo H1: x�m, 2 px � ch? �i?m H1 �? d? li?u ho?c �i?m tr�?c �? h?t h?n; kh�ng coi thi?u d? li?u l� �i?m 0.';
  const score=x.score>0?'+'+x.score:String(x.score),tone={confirmed:'�?ng thu?n',weak:'l?c y?u',conflict:'�i?m ngh?ch m�u h?p � v�ng m?nh',neutral:'h?p trung t�nh'}[x.tone];
  const time=t=>new Date(t).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}),box=Number.isFinite(x.blockStart)?`${time(x.blockStart)}�${time(x.blockStart+3600000)} (VN)`:'�';
  return `WLR theo H1 ${box} � �i?m ${score}/�5 � h?p ${x.boxDirection>0?'?':x.boxDirection<0?'?':'?'} � ${tone} � ${fmt(x.width)}/7 px${x.preview?' � T?M 3/4: m�u h?p xem tr�?c, n�t nh?t t?i �a 3 px':x.historical?' � t� ��ng h?p trong l?ch s? sau khi H1 ��ng; kh�ng ph?i t�n hi?u �? bi?t t? �?u h?p':' � �i?m kh�a'}. �i?m m� t? �?ng thu?n, kh�ng ph?i x�c su?t.`;
}
const oiHistory=new OiHistory();
const runningOiState=new RunningOiState();
const oiPercentColor=new OiPercentColor();

const currentOiLoader=new CurrentOiLoader({get:getJSON,now:()=>Date.now()+serverOffsetMs,onData:(sample,error)=>{updateH1OiReadout();oiBottomLayer?.updateLiveSample(error?null:sample,Date.now()+serverOffsetMs);}});
const oiFastLoader=new OiFastLoader({history:oiHistory,get:getJSON,onData:applyOiHistoryData,onState:handleOiLoadState});
const oiBoldCandles=new OiBoldCandles();
const stopLossBands=new StopLossBands();
const lockedStops=new Map();
let spectrumComparison={rows:[],day:null,count:0,oiCount:0,pairedReady:false,maxCvd:0,maxOiGross:0};
const spectrumPrimitive=new SpectrumPrimitive(drawCvdSpectrum);
let oiBarState={points:new Map()};
let oiWidths=new Map(),oiStamp='',oiAppliedSamples=[],oiWidthClock=-1;
const flowColors={
  COMPOSITE:{up:'rgba(39,211,164,.82)',down:'rgba(255,91,116,.82)'}
};
const LIVE_REFRESH_MS=3000;
const writeSeries=createSeriesWriter();
const optionCache=new WeakMap(),markerCache=new WeakMap();
function setOptions(target,options){const key=JSON.stringify(options);if(optionCache.get(target)===key)return;target.applyOptions(options);optionCache.set(target,key);}
function setMarkers(target,data){const key=JSON.stringify(data);if(markerCache.get(target)===key)return;target.setMarkers(data);markerCache.set(target,key);}
let studiesWorker=null,studyKey='',studyResultKey='',statsWorker=null,statsRequest=0,statsData=null,statsContext='';
const CALENDAR_REFRESH_MS=5*60*1000;
const FIT_WINDOW_MS=36*60*60*1000,FIT_HALF_WINDOW_MS=12*60*60*1000,DOUBLE_TAP_MS=360,DOUBLE_TAP_DISTANCE=28,TAP_MOVE_TOLERANCE=14;
const SETUP_STORAGE_KEY=CHART_SETUP_KEY;
let nfSmoothRows=[],nfSmoothMap=new Map();
const spyBodyVolumeEnabled=()=>$('spy-volume-body-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
const nfSmoothEnabled=()=>$('nf-smooth-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
const oi8PivotLines={low:[],high:[]};
const strengthOi8Enabled=()=>$('strength-oi8-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
const SETUP_CONTROL_IDS=['oi-bottom-toggle','dao-v2-toggle','oi8-phase-reset-toggle','oi8-pivot-toggle','strength-oi8-toggle','nf-smooth-toggle','nf-smooth-window','symbol','interval','days','signal','composite','alignment','price-bands','wlr-soft-colors','aba-band-colors','pivot-zones','phase-width','candle-agreement-color','candle-h1-box-color','cvd-spectrum-toggle','h1-oi-markers-toggle','oi-candle-bars-toggle','oi-candle-pin-toggle','oi-delta-percentile','oi-bold-candles-toggle','spy-volume-body-toggle','markers','double-tap-full','causal-trend-channel','geometry-pivots','geometry-score','calendar-impact','calendar-currency','strength-box-toggle','strength-box-trigger','strength-box-back','strength-box-early','strength-box-shape','strength-box-composite','strength-box-composite-threshold'];
let statsMap=new Map(),candleColorMap=new Map(),candleClusterMap=new Map(),pivotZoneState={ready:false,reason:'history',support:null,resistance:null},pivotZoneKey='',inspectedTime=null;
let calendarState={events:[],updatedAt:null,loading:false};
let pendingSavedTimeRange=null,saveSetupTimer=null,strengthBoxLayer=null;
const sourceName=key=>({SPYUSDT:'SPY',QQQUSDT:'QQQ',COMPOSITE:'Composite'}[key]);
const signed=x=>Number.isFinite(x)?`${x>0?'+':''}${fmt(x)}`:'�';
const signLabel=x=>x>0?'+':x<0?'?':'0';
const symmetricAutoscale=original=>{const info=original();return info?.priceRange?{...info,priceRange:symmetricPriceRange(info.priceRange)}:info;};
const LOWER_PANE_SCALE_MARGINS={top:.08,bottom:.08};
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
        for(const segment of wlrColorSegments({x:previous.x*horizontalPixelRatio,y:y1*verticalPixelRatio,color:a.phaseColor,width:a.width},{x:current.x*horizontalPixelRatio,y:y2*verticalPixelRatio,color:b.phaseColor,width:b.width},this.options.color)){context.lineWidth=Math.max(1,Math.round((segment.width??b.width??1)*verticalPixelRatio));context.beginPath();context.strokeStyle=segment.color;context.moveTo(segment.x1,segment.y1);context.lineTo(segment.x2,segment.y2);context.stroke();}
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
function isChartLive(){return chartLiveResponse&&chartFresh(cache,Date.now()+serverOffsetMs,lastSuccess?.getTime());}
function updateSpyUsdtSessionChange(){
 const node=$('spyusdt-session-change');
 if(!node)return;
 const state=spyUsdtSessionChange(rows.SPYUSDT??[],{step:STEPS[$('interval').value],now:Date.now()+serverOffsetMs});
 node.hidden=false;
 if(!state){node.textContent='SPY �';node.title='Ch? gi� SPYUSDT v� n?n ��ng phi�n Post';node.className='';delete node.dataset.changePct;delete node.dataset.session;return;}
 const signed=`${state.changePct>=0?'+':''}${state.changePct.toFixed(2)}%`;
 const freshness=isChartLive()?'':' � D? LI?U C?';
 const label=`SPY ${signed}${state.volatile?' � TT BI?N �?NG � GI?M VOLUME':''}${freshness}`;
 if(node.textContent!==label)node.textContent=label;
 node.className=state.volatile?'warning':state.changePct>0?'up':state.changePct<0?'down':'flat';
 node.dataset.changePct=String(state.changePct);node.dataset.session=state.session;
 node.title=`SPYUSDT � gi� ��ng Post ${fmt(state.reference)} (${state.postDay} � ${state.postClock} New York) � gi� m?i nh?t ${fmt(state.current)} � n?n ${new Date(state.lastTime).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (VN) � ng�?ng c?nh b�o |%| > ${state.threshold.toLocaleString('vi-VN')}%`;
}
function setLive(){
 const node=$('live-indicator'),wasLive=node.classList.contains('live'),live=isChartLive();
 node.textContent=live?'? CHART LIVE':cache?'? CHART DELAYED':'? CHART KH�NG LIVE';node.className=live?'live':'offline';
 updateSpyUsdtSessionChange();
 let source=$('chart-source-status');if(!source){source=document.createElement('p');source.id='chart-source-status';source.setAttribute('role','status');source.style.cssText='color:#f6c85f;font:12px/1.6 system-ui;margin:8px 0';$('chart').insertAdjacentElement('beforebegin',source);}
 source.hidden=live||!cache;const last=(rows[$('symbol').value]??[]).findLast(r=>r.end<(cache?.serverTime??0));
 const missing=['SPYUSDT','QQQUSDT'].filter(symbol=>!(rows[symbol]?.length));
 source.textContent=live?'':(cache?.historical?'L?CH S? �? L�U':'D? LI?U C?')+' � DELAYED'+(missing.length?' � thi?u '+missing.join('/'):'')+' � n?n ��ng cu?i '+(last?new Date(last.end+1).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'�')+' (gi? VN). �ang th? k?t n?i l?i Binance; d? b�o ph�n v? t?m d?ng.';
 scheduleAbaBandColors();strengthBoxLayer?.update();
}
function syncChartFrameButtons(){for(const id of ['chart-frame-m15','chart-frame-h1']){const button=$(id);if(!button)continue;const active=$('interval').value===button.dataset.interval;button.setAttribute('aria-pressed',String(active));button.style.background=active?'#1d4e67':'';button.style.color=active?'#e5f4ff':'';button.style.borderColor=active?'#55b8e5':'';}}
function setupChartActions(){
  const actions=document.querySelector('.chart-actions'),fit=$('chart-fit'),live=$('live-indicator');
  if(!actions||!fit||!live)return;
  if(!$('spyusdt-session-change')){const badge=document.createElement('span');badge.id='spyusdt-session-change';badge.textContent='SPY �';badge.setAttribute('aria-live','polite');live.insertAdjacentElement('afterend',badge);}
  if(!$('causal-trend-channel')){const input=document.createElement('input');input.id='causal-trend-channel';input.type='checkbox';input.checked=true;const label=document.createElement('label');label.title='Flow-Leg: SPY V kh�a h�?ng khi m? � ch? gi� ho?c SPY V b?t l?i 2 n?n ��ng li�n ti?p m?i k?t th�c � d?c OLS ch? d�ng ch?n �o�n, kh�ng c?t tu?i trend � v? ngay khi �? 8 n?n �? ��ng � k�nh �ang ch?y kh?p l?i theo t?ng n?n, ch�a c? �?nh � bi�n �2? v?i s�n ATR � k�nh �? ��ng: UP v�ng, DOWN tr?ng � k�nh �ang s?ng n�t ch?m: UP cyan, DOWN tr?ng';label.append(input,'K�nh trend causal');$('geometry-pivots').closest('label').insertAdjacentElement('beforebegin',label);}
  $('geometry-pivots').closest('label').title='�u ti�n �i?m xoay t? m�u H?p H1 �? kh�a cho Pivot, ph�n k? v� m?u n�m t�ng/gi?m; khi ch�a �? �t nh?t 2 �?nh v� 2 ��y H1, t? d�ng pivot gi� M15. Trendline ch? d�ng �i?m �? x�c nh?n causal.';
  $('geometry-overlay').setAttribute('aria-label','Pivot, ph�n k? v� K�nh trend causal');
  fit.insertAdjacentElement('afterend',live);
  const frame=document.createElement('span');frame.id='chart-frame-switch';frame.style.cssText='display:inline-flex;gap:3px;align-items:center';frame.setAttribute('aria-label','Khung bi?u �?');
  for(const [id,label,value] of [['chart-frame-m15','M15','15m'],['chart-frame-h1','H1','1h']]){const button=document.createElement('button');button.id=id;button.type='button';button.textContent=label;button.dataset.interval=value;button.setAttribute('aria-pressed','false');button.title=`Chuy?n bi?u �? sang khung ${label}`;button.onclick=()=>{if($('interval').value!==value){$('interval').value=value;updateH1TrendAgeReadout();refresh(true);}syncChartFrameButtons();syncDisplayModeButtons();};frame.append(button);}
  live.insertAdjacentElement('afterend',frame);
  const half=document.createElement('button');half.id='chart-fit-half';half.type='button';half.title='Hi?n th? c�c n?n trong 0,5 ng�y g?n nh?t';half.textContent='Fit 0.5 ng�y';live.insertAdjacentElement('afterend',half);
  const save=document.createElement('button');save.id='chart-save';save.type='button';save.title='L�u to�n b? l?a ch?n v� v�ng th?i gian �ang xem tr�n tr?nh duy?t n�y';save.textContent='L�u setup';save.setAttribute('aria-live','polite');half.insertAdjacentElement('afterend',save);
  const vix=$('chart-vix-quote');if(vix)live.insertAdjacentElement('afterend',vix);
  const alignmentLabel=$('alignment')?.closest('label');if(alignmentLabel){alignmentLabel.lastChild.textContent='SPY V ? n?n';alignmentLabel.dataset.pane='strength-spy-v';alignmentLabel.title='Histogram Delta / SMA20(volume): v? tr?c ti?p gi� tr? chu?n h�a, kh�ng chia 2 v� kh�ng ch?n �1; spike +3 v� +5 gi? ��ng bi�n �?. Thang histogram ri�ng �?i x?ng quanh 0. M�u theo d?u SPY V: d��ng xanh, �m �?, b?ng 0 ho?c thi?u d? li?u m�u x�m.';}
  const compositeLabel=$('composite')?.closest('label');if(compositeLabel)compositeLabel.title='? C Taker NF t�ch l?y c� d?u theo c?m m�u SPY V th�n n?n; �?i m�u ho?c thi?u d? li?u th? b?t �?u l?i. C?p nh?t c? n?n live kho?ng 3 gi�y; c?t live c� th? thay �?i �?n khi ��ng. M�u theo d?u t?ng NF: d��ng xanh, �m �?, b?ng 0 x�m; thang ri�ng �?i x?ng chung t�m 0 v?i Strength.';
  const phaseLabel=$('phase-width')?.closest('label');if(phaseLabel){phaseLabel.hidden=true;const button=document.createElement('button');button.id='wlr-width-mode';button.type='button';button.className='display-mode-button';phaseLabel.insertAdjacentElement('afterend',button);}
  if(!$('wlr-soft-colors')){const input=document.createElement('input');input.id='wlr-soft-colors';input.type='checkbox';input.checked=true;input.hidden=true;const button=document.createElement('button');button.id='wlr-soft-color-mode';button.type='button';button.className='display-mode-button';button.append(input,document.createElement('span'));$('wlr-width-mode').insertAdjacentElement('afterend',button);}
  const candleLabel=$('candle-agreement-color')?.closest('label');if(candleLabel){candleLabel.hidden=true;const button=document.createElement('button');button.id='candle-color-mode';button.type='button';button.className='display-mode-button';candleLabel.insertAdjacentElement('afterend',button);}
  if(candleLabel&&!$('candle-h1-box-color')){const input=document.createElement('input');input.id='candle-h1-box-color';input.type='checkbox';input.checked=true;input.hidden=true;const button=document.createElement('button');button.id='h1-box-candle-mode';button.type='button';button.className='display-mode-button';button.append(input,'N?n theo H?p H1: T?T');$('candle-color-mode').insertAdjacentElement('afterend',button);}

  if(!$('aba-band-colors')){
    const input=document.createElement('input');input.id='aba-band-colors';input.type='checkbox';input.checked=true;input.hidden=true;
    const button=document.createElement('button');button.id='aba-band-color-mode';button.type='button';button.className='display-mode-button';button.append(input,document.createElement('span'));
    $('price-bands').closest('label').insertAdjacentElement('afterend',button);
    const status=document.createElement('span');status.id='aba-band-color-status';status.setAttribute('role','status');status.style.cssText='font-size:11px;color:#9badc2;flex-basis:100%;line-height:1.45';button.insertAdjacentElement('afterend',status);
    const history=document.createElement('button');history.id='aba-band-history';history.type='button';history.textContent='Xem l?ch s? k�nh';history.disabled=true;status.insertAdjacentElement('afterend',history);history.onclick=()=>{const times=[...abaBandPhaseMap.keys()].sort((a,b)=>a-b);if(!times.length)return;const last=times.at(-1),first=times.find(t=>t>=last-36*3600000)??times[0];chart.timeScale().setVisibleRange({from:(first-3600000)/1000,to:(last+3600000)/1000});};
  }
  const spySessionChange=$('spyusdt-session-change');if(spySessionChange)live.insertAdjacentElement('afterend',spySessionChange);
  const hint=document.querySelector('.hint');if(hint){hint.textContent='Hai nh?n x?p d?c: Tu?i H1 ? tr�n, CVD/?OI Composite ? d�?i: C� = ch? �?ng; OI ?/? = t�ng/gi?m t?ng v? th? m?. ';hint.textContent+=' K�nh trend causal d�ng setup Flow-Leg: ngu?n SPY V ph�n v?, dead-band �0,15, t?i thi?u 8 n?n, R� hi?n th? 0,20 v� gi? 12 leg. Khi c� break, ��?ng l�i t?i �a 4 n?n M15 li?n tr�?c c�ng ng�y v� c�ng d?u SPY V l�m g?c. Ph� �2? theo h�?ng trend v?n h?p l?; n?n SPY V trung t�nh ho?c m?t n?n tr�i d?u v?n ��?c gi?. Gi� ph� bi�n b?t l?i, SPY V v�?t dead-band �?i ngh?ch ho?c d?c OLS ng�?c h�?ng �? m?nh ph?i k�o d�i hai n?n ��ng li�n ti?p m?i ��ng leg; n?n ph� gi� �?u ��?c nh?n �? t�i kh?p OLS v� �2?. Hai rail d�ng m?t OLS cu?i n�n lu�n th?ng. Pivot/ph�n k? ��?c t�nh �?c l?p v?i k�nh.';}
}
function syncDisplayModeButtons(){
  const soft=$('wlr-soft-color-mode');if(soft){const on=$('wlr-soft-colors').checked,h1=usesH1WlrStyle();soft.querySelector('span').textContent=`M�u WLR ${h1?'theo H1':'d?c + SPY V'}: ${on?'B?T':'T?T'}`;soft.setAttribute('aria-pressed',String(on));soft.title=h1?'SPY M15: h�?ng theo m�u H1 �? kh�a. M�u theo h?p �i?m: �i?m d��ng xanh, �m �?, 0 ho?c thi?u �i?m x�m. L?ch s? t� ��ng h?p sau khi H1 ��ng, kh�ng ph?i t�n hi?u �? bi?t ? �?u h?p. T?m 3/4 ch? �?i ph?n �ang ch?y v� theo m�u h?p xem tr�?c. T?t �? v? m�u C�V.':'D?c WLR/? v� SPY V, Composite l�m kh�a m?m; t?t �? v? m�u C�V. Ch? �? �i?m H1 �p d?ng tr�n SPY M15.';}
  const bandButton=$('aba-band-color-mode');if(bandButton){const on=Boolean($('aba-band-colors')?.checked);bandButton.querySelector('span').textContent=`M�u bi�n theo k�nh: ${on?'B?T':'T?T'}`;bandButton.setAttribute('aria-pressed',String(on));bandButton.title='T� bi�n WLR theo ph?m vi k�nh causal; kh�ng th�m nh?n A1.';}
  const width=$('wlr-width-mode'),candle=$('candle-color-mode'),h1Candle=$('h1-box-candle-mode'),trendWidth=$('phase-width').checked,priceVolume=$('candle-agreement-color').checked,h1BoxColor=$('candle-h1-box-color')?.checked;
  if(width){const h1=usesH1WlrStyle(),soft=$('wlr-soft-colors').checked&&$('symbol').value==='SPYUSDT';width.textContent=`�? d�y WLR: ${h1?(trendWidth?'�i?m H1':'C? �?nh 3'):soft?(trendWidth?'D?c/? + kh�a m?m':'C? �?nh 3'):(trendWidth?'D?c�R� + V�C':'C�V')}`;width.title=h1?'SPY M15: 2 + |�i?m H1| = 2�7 px. M�u l?y d?u �i?m; thi?u d? li?u gi? 2 px. Kh�ng th�m EWMA. �o?n l?ch s? c�n ��ng h?p t?o �i?m sau khi H1 ��ng. �i?m t?m 3/4 ch? cho n?n �ang ch?y, nh?t v� t?i �a 3 px. T?t: c? �?nh 3 px. �i?m m� t? �?ng thu?n, kh�ng ph?i x�c su?t.':soft?'�? d�y theo d?c/? + kh�a m?m, t?i �a 8; t?t d�ng n�t c? �?nh 3.':trendWidth?'�? d�y 2�10 theo d?c/R� v� V�C.':'�? d�y theo �?ng thu?n Composite � SPY V';width.setAttribute('aria-pressed',String(trendWidth));}
  if(candle){candle.textContent=`M�u n?n: ${priceVolume?'C?m Gi��SPY V':'C�V'}`;candle.title=priceVolume?'C?m causal t? WLR8, SPY V v� th�n gi�/ATR; hai n?n �?i ngh?ch m?i �?i c?m, n?n ng�?c nh? ch? gi?m s�ng':'M�u n?n theo �?ng thu?n Strength Composite � SPY V';candle.setAttribute('aria-pressed',String(priceVolume));}
  if(h1Candle){h1Candle.lastChild.textContent=`D?i H1/H4 v� n?n H1: ${h1BoxColor?'B?T':'T?T'}`;h1Candle.title='Hi?n d?i h?p v� �i?m H1 tr�n SPY M15, d?i h?p v� m�u n?n tr�n SPY H1. Bao g?m cu?i tu?n khi c� d? li?u. Xanh = UP, �? = DOWN, x�m = WAIT. L?p h?p ��?c �u ti�n h�n m�u tu?i trend v� c?m Gi��SPY V.';h1Candle.setAttribute('aria-pressed',String(Boolean(h1BoxColor)));}
}
function restoreSavedSetup(){
  try{
    const saved=readChartSetup(),valid=Boolean(saved);
    if(valid){
      restoreSetupControls(saved.controls,SETUP_CONTROL_IDS,$);
      const from=Number(saved.timeRange?.from),to=Number(saved.timeRange?.to);if(Number.isFinite(from)&&Number.isFinite(to)&&to>from)pendingSavedTimeRange={from,to};
    }
    const migrationKey='netflow:enable-h1-box-candle-default:v1';
    if(!localStorage.getItem(migrationKey)){
      $('candle-h1-box-color').checked=true;
      if(valid){saved.controls['candle-h1-box-color']=true;localStorage.setItem(SETUP_STORAGE_KEY,JSON.stringify(saved));}
      localStorage.setItem(migrationKey,'done');
    }
  }catch{$('candle-h1-box-color').checked=true;}
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
    if(daoV2Stats&&!daoV2Stats.saveSetup())throw Error('Kh�ng l�u ��?c setup TK V?; ki?m tra ph� ho?c quy?n l�u tr?');
    localStorage.setItem(SETUP_STORAGE_KEY,JSON.stringify({...readChartSetup(),version:1,savedAt:Date.now(),controls,timeRange}));
    button.textContent='? �? l�u';button.title='Setup �? ��?c l�u tr�n tr?nh duy?t n�y';
  }catch(error){button.textContent='Kh�ng l�u ��?c';button.title=error.message;}
  clearTimeout(saveSetupTimer);saveSetupTimer=setTimeout(()=>{button.textContent='L�u setup';button.title='L�u to�n b? l?a ch?n v� v�ng th?i gian �ang xem tr�n tr?nh duy?t n�y';},1800);
}

function resetStudies(){
  daoV2Cache.clear();daoV2Layer?.setData({points:[],last:null},false);daoV2Stats?.setContext(null);
  studyKey='';studyResultKey='';statsMap=new Map();++statsRequest;h1CacheAttempt='';h1CacheArchive=null;studyColorInput=null;$('chart').dataset.h1ColorCache='empty';
  geometryState={pivots:[],events:[],lines:[],summary:{}};causalChannelState={trends:[],total:0};breakoutState=null;geometryStatePoints=[];
  pivotZoneState={ready:false,reason:'history',support:null,resistance:null};h1CandleMap=new Map();h1H4CandleMap=new Map();
}
function colorStorage(){try{return globalThis.localStorage;}catch{return null;}}
function recordH1ColorPaint(){if(h1CandleMap.size||h1H4CandleMap.size)requestAnimationFrame(()=>{$('chart').dataset.firstH1ColorPaintMs??=String(Math.round(performance.now()));});}
function h1BodyColorSourceKey(data){
  const key=closedColorSourceKey(data);
  return key?`body-v1|${key}`:key;
}
function restoreH1Colors(data){
  if($('symbol').value!=='SPYUSDT'||h1CandleMap.size||h1H4CandleMap.size)return;
  const sourceKey=h1BodyColorSourceKey(data);if(!sourceKey||sourceKey===h1CacheAttempt)return;h1CacheAttempt=sourceKey;
  if(h1HistoryKnown&&h1HistoryRevision===null)return;
  const saved=readH1ColorCache(colorStorage(),data,{sourceKey,archiveRevision:h1HistoryRevision});if(!saved)return;
  h1CacheArchive=saved.archiveRevision;h1CandleMap=new Map(saved.h1.map(state=>[state.t,state]));h1H4CandleMap=new Map(saved.strip.map(state=>[state.t,state]));
  $('chart').dataset.h1ColorCache='restored';recordH1ColorPaint();
}
function ensureStudiesWorker(){
  if(!studiesWorker){
    studiesWorker=new Worker(new URL('./studies-worker.mjs?v=20261120-clean2',import.meta.url),{type:'module'});
    studiesWorker.onmessage=({data})=>{
      if(data.type==='history-ready'){
        h1HistoryKnown=true;h1HistoryRevision=archiveColorRevision(data.archive);
        if(h1CacheArchive!==null&&h1CacheArchive!==h1HistoryRevision){h1CacheArchive=null;h1CandleMap=new Map();h1H4CandleMap=new Map();$('chart').dataset.h1ColorCache='rejected';updateH1TrendAgeReadout();scheduleH1H4Strip();if(cache)render(false);}
        return;
      }
      if(data.key!==studyKey)return;
      if(data.partial==='h1'){
        h1CacheArchive=null;h1CandleMap=new Map((data.result?.h1CandleColors??[]).map(state=>[state.t,state]));h1H4CandleMap=new Map((data.result?.h1H4CandleColors??[]).map(state=>[state.t,state]));$('chart').dataset.h1ColorCache='fresh';
        if(studyColorInput?.key===data.key)saveH1ColorCache(colorStorage(),studyColorInput.raw,{sourceKey:studyColorInput.sourceKey,archiveRevision:archiveColorRevision(data.archive),h1:data.result?.h1CandleColors??[],strip:data.result?.h1H4CandleColors??[]});
        updateH1TrendAgeReadout();scheduleH1H4Strip();if($('candle-h1-box-color')?.checked||usesH1WlrStyle()||$('h1-score-line-toggle')?.checked)render(false);recordH1ColorPaint();return;
      }
      if(data.error){$('chart').dataset.studyStatus='error';$('chart').dataset.studyError=data.error;studyKey='';return;}
      h1CacheArchive=null;const r=data.result;geometryState=r.geometry;causalChannelState=r.channels;breakoutState=r.breakout;geometryStatePoints=r.points;pivotZoneState=r.pivot;h1CandleMap=new Map((r.h1CandleColors??[]).map(state=>[state.t,state]));h1H4CandleMap=new Map((r.h1H4CandleColors??[]).map(state=>[state.t,state]));
      $('chart').dataset.h1ColorCache='fresh';studyResultKey=data.key;
      $('chart').dataset.studyStatus='ready';$('chart').dataset.studyComputeMs=String(Math.round(data.computeMs));
      updateH1TrendAgeReadout();updatePivotZones();scheduleGeometryOverlay();scheduleAbaBandColors();strengthBoxLayer?.update();if($('candle-h1-box-color')?.checked||usesH1WlrStyle()||$('h1-score-line-toggle')?.checked)render(false);
    };
    studiesWorker.onerror=()=>{$('chart').dataset.studyStatus='error';studyKey='';studiesWorker?.terminate();studiesWorker=null;h1HistoryKnown=false;h1HistoryRevision=null;};
  }
}
function requestStudies(){
  if(!cache)return;
  const symbol=$('symbol').value,interval=$('interval').value,p=rows[symbol]??[],closed=p.filter(r=>r.end<cache.serverTime);
  if(!closed.length)return;
  const options={minScore:Number($('geometry-score').value)};
  const sourceKey=h1BodyColorSourceKey(cache);
  const useH1Smooth=Boolean(usesH1WlrStyle());
  const key=`${symbol}|${interval}|${$('days').value}|${closed[0]?.t}|${closed.at(-1)?.t}|${closed.length}|${options.minScore}|${sourceKey??''}|ageH1:${Number(useH1Smooth)}:${geometryOiRevision}`;
  if(key===studyKey)return;studyKey=key;
  ensureStudiesWorker();
  studyColorInput={key,raw:cache,sourceKey};
  $('chart').dataset.studyStatus='loading';$('chart').dataset.studyRequests=String(Number($('chart').dataset.studyRequests??0)+1);
  studiesWorker.postMessage({key,sourceKey,rows,volumeRows:volumeStrengthRows,symbol,interval,options,now:cache.serverTime,raw:cache,useH1Smooth,geometryOiSamples:oiStamp==='15m'?oiAppliedSamples:[]});
}
function requestStats(){
  if(!cache)return;
  const context=[$('symbol').value,$('signal').value,$('interval').value].join('|');
  if(statsData===cache&&statsContext===context)return;
  statsData=cache;statsContext=context;
  if(!statsWorker){
    statsWorker=new Worker(new URL('./stats-worker.mjs?v=20261029-price-delta1',import.meta.url),{type:'module'});
    statsWorker.onmessage=({data})=>{if(data.id!==statsRequest||data.error)return;statsMap=data.stats;showTooltip(inspectedTime??rows[$('symbol').value]?.at(-1)?.t);};
    statsWorker.onerror=()=>{statsWorker?.terminate();statsWorker=null;statsData=null;};
  }
  statsWorker.postMessage({id:++statsRequest,rows,symbol:$('symbol').value,source:$('signal').value,step:STEPS[$('interval').value]});
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
  mountChartSettings(controls,card);
  chart=L.createChart($('chart'),{autoSize:true,layout:{background:{type:'solid',color:'#0e1726'},textColor:'#91a5bd',fontSize:12,attributionLogo:true},grid:{vertLines:{color:'#1a283a'},horzLines:{color:'#1a283a'}},crosshair:{mode:L.CrosshairMode.Normal,doNotSnapToHiddenSeriesIndices:true,vertLine:{visible:true,labelVisible:true},horzLine:{visible:true,labelVisible:true}},timeScale:{timeVisible:true,secondsVisible:false,rightOffsetPixels:96,barSpacing:6,minBarSpacing:.5,lockVisibleTimeRangeOnResize:true},rightPriceScale:{autoScale:true,minimumWidth:64,tickMarkDensity:2.5},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:{time:true,price:true}},kineticScroll:{touch:true,mouse:false},localization:{locale:'vi-VN',timeFormatter:t=>new Date(t*1000).toLocaleString('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}});
  applyResponsiveChartOptions();
  price=chart.addSeries(L.CandlestickSeries,{title:'',priceFormat:{type:'price',precision:1,minMove:.1},priceLineVisible:true,priceLineColor:'#36ddbd',priceLineWidth:1,priceLineStyle:L.LineStyle.Dashed,lastValueVisible:true,borderVisible:false},0);
  priceStyleLayer=mountPriceChartStyle({chart,price,actions:document.querySelector('.chart-actions'),host:$('chart'),L,writeSeries,onChange:()=>render(false)});
  oiBottomLayer=mountOiBottomBars({chart,actions:document.querySelector('.chart-actions'),host:$('chart'),L,writeSeries});
  oiBottomLayer.button.addEventListener('click',scheduleH1Status);
  price.attachPrimitive(oiBoldCandles);
  price.attachPrimitive(stopLossBands);
  daoV2Layer=bodyReversalPrimitive(chart,price);
  daoV2Trades=reversalTradePrimitive(chart,price);
  daoV2Stats=mountReversalStats({host:card,actions:document.querySelector('.chart-actions'),requestContext:()=>render(false),onReport:(report,visible)=>daoV2Trades.setData(report,visible)});
  price.attachPrimitive(spectrumPrimitive);
  mountOrderBook({chart,price,host:$('chart'),actions:document.querySelector('.chart-actions'),symbolControl:$('symbol')});
  const paneLegends=[1,2].map(index=>{
    const legend=document.createElement('div');legend.id='pane-legend-'+index;legend.className='pane-legend';
    $('chart').append(legend);return legend;
  });
  const markerLayer=document.createElement('div');markerLayer.id='h1-oi-markers';markerLayer.setAttribute('aria-label','Tam gi�c OI theo h?p H1');
  markerLayer.style.cssText='position:absolute;inset:0;z-index:9;pointer-events:none';
  const markerDetail=document.createElement('output');markerDetail.setAttribute('popover','auto');
  markerDetail.style.cssText='max-width:min(360px,calc(100vw - 24px));margin:auto;padding:8px 10px;border:1px solid #60748c;border-radius:6px;background:#0e1726;color:#edf4ff;font:12px/1.5 system-ui;white-space:normal';
  const markerStatus=document.createElement('span');markerStatus.hidden=true;
  markerStatus.className='pane-fixed-readout missing pane-marker-status';
  markerLayer.append(markerDetail);$('chart').append(markerLayer);
  h1OiMarkerLayer={root:markerLayer,detail:markerDetail,status:markerStatus,signature:''};
  series.priceMid=chart.addCustomSeries(new VariableWidthLineSeries,{color:'#8794a5',baseLineVisible:false,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const key of ['priceUpper','priceLower'])series[key]=chart.addSeries(L.LineSeries,{color:'#4aa3ff',lineWidth:2,lineStyle:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const [key,color,width,style,last,title] of [
    ['pivotResistanceMid','#ffb454',1,L.LineStyle.Solid,true,'KC'],
    ['pivotSupportMid','#5bc8ff',1,L.LineStyle.Solid,true,'HT']
  ])series[key]=chart.addSeries(L.LineSeries,{color,lineWidth:width,lineStyle:style,priceLineVisible:false,lastValueVisible:last,crosshairMarkerVisible:false,title},0);
  const strengthUnitFormat=x=>`${x>0?'+':''}${x.toFixed(2)}`;
  series.alignment=chart.addSeries(L.HistogramSeries,{priceScaleId:'spy-volume-delta-overlay',base:0,color:'#68778a',title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},autoscaleInfoProvider:symmetricAutoscale},1);
  series.alignment.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.oiCandleBars=chart.addSeries(L.HistogramSeries,{priceScaleId:'oi-candle-bars-overlay',base:0,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'volume'},autoscaleInfoProvider:original=>{const info=original();if(info)info.priceRange.minValue=0;return info;}},1);
  series.oiCandleBars.priceScale().applyOptions({autoScale:true,scaleMargins:{top:.80,bottom:0}});
  const spyVolumeScale={priceScaleId:'right',priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},autoscaleInfoProvider:symmetricAutoscale};
  const spyVolumeBaseline={...spyVolumeScale,baseValue:{type:'price',price:0},topLineColor:'#f6c85f',bottomLineColor:'#f3f6fb'};
  series.spyBodyVolume=chart.addSeries(L.BaselineSeries,{...spyVolumeBaseline,baseLineVisible:false,topFillColor1:'transparent',topFillColor2:'transparent',bottomFillColor1:'transparent',bottomFillColor2:'transparent',lineStyle:L.LineStyle.Solid,lineWidth:2,title:'SPY V th�n n?n',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,visible:false},1);
  series.nfSmooth=chart.addSeries(L.BaselineSeries,{priceScaleId:'right',baseValue:{type:'price',price:0},topLineColor:'#28ddb0',bottomLineColor:'#ff718e',topFillColor1:'rgba(40,221,176,0)',topFillColor2:'rgba(40,221,176,0)',bottomFillColor1:'rgba(255,113,142,0)',bottomFillColor2:'rgba(255,113,142,0)',lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:3,title:'',priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},autoscaleInfoProvider:()=>({priceRange:{minValue:-1,maxValue:1}})},1);
  series.strengthOi8=chart.addSeries(L.BaselineSeries,{
    priceScaleId:'right',baseValue:{type:'price',price:0},topLineColor:'#70b7ff',bottomLineColor:'#f08aff',
    topFillColor1:'transparent',topFillColor2:'transparent',bottomFillColor1:'transparent',bottomFillColor2:'transparent',
    lineWidth:3,baseLineVisible:false,priceLineVisible:false,lastValueVisible:true,crosshairMarkerRadius:3,
    title:'?OI8',
    priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},
    autoscaleInfoProvider:()=>({priceRange:{minValue:-1,maxValue:1}})
  },1);
  oiPhaseLayer=oiPhasePrimitive(chart,series.strengthOi8);
  for(const [type,color] of [['low','#42e6bf'],['high','#ff8d9e']]){
    for(let i=0;i<2;i++)oi8PivotLines[type].push(chart.addSeries(L.LineSeries,{
      color,visible:false,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false,
      autoscaleInfoProvider:()=>null
    },0));
  }
  const nfReadout=document.createElement('div');nfReadout.id='nf-smooth-readout';nfReadout.className='pane-fixed-readout';nfReadout.hidden=true;nfReadout.style.display='none';$('chart').append(nfReadout);
  for(const [key,style] of [['h1ScoreLine',L.LineStyle.Solid],['h1ScorePreview',L.LineStyle.Dotted]])series[key]=chart.addSeries(L.LineSeries,{priceScaleId:'right',color:'rgba(210,194,174,.55)',lineWidth:1,lineStyle:style,title:'',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:2,pointMarkersVisible:true,pointMarkersRadius:key==='h1ScorePreview'?2:1,priceFormat:{type:'custom',minMove:.01,formatter:strengthUnitFormat},autoscaleInfoProvider:()=>({priceRange:{minValue:-1,maxValue:1}})},1);
  const h1LineReadout=document.createElement('div');h1LineReadout.id='h1-score-line-readout';h1LineReadout.className='pane-fixed-readout';h1LineReadout.hidden=true;h1LineReadout.style.display='none';$('chart').append(h1LineReadout);
  series.spyBodyVolume.createPriceLine({price:0,color:'#6f8299',lineWidth:1,lineStyle:L.LineStyle.Solid,axisLabelVisible:true,title:'0'});
  series.spyBodyVolume.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  // Create the flow pane only after the body/OI pane exists.
  series.COMPOSITE=chart.addSeries(L.HistogramSeries,{priceScaleId:'taker-flow-strength-overlay',base:0,color:flowColors.COMPOSITE.up,title:'',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:fmtK},autoscaleInfoProvider:symmetricAutoscale},2);
  series.COMPOSITE.priceScale().applyOptions({autoScale:true,scaleMargins:LOWER_PANE_SCALE_MARGINS});
  $('chart').dataset.compositeHistogramPane=String(series.COMPOSITE.getPane().paneIndex());
  for(const [id,label] of [['composite-flow-fixed','C Taker NF']]){const node=document.createElement('div');node.id=id;node.className='pane-fixed-readout missing';node.textContent=`${label} �`;$('chart').append(node);}
  for(const node of [$('nf-smooth-readout'),$('h1-score-line-readout'),markerStatus])paneLegends[0].append(node);
  $('chart').dataset.compositeNetflowPane='removed';$('chart').dataset.netflowPane='removed';$('chart').dataset.takerFlowOverlay='spy-qqq-composite';$('chart').dataset.compositeStrengthOverlay='pane-2-independent-scales-shared-zero-center';$('chart').dataset.compositeStrengthOverlayLabel='C Taker NF';$('chart').dataset.fixedReadoutSide='left-legend';$('chart').dataset.strengthLineWidth='1';$('chart').dataset.spyVolumeDeltaPane='1';$('chart').dataset.spyVolumeDeltaScale='symmetric-overlay';$('chart').dataset.spyVolumeDeltaTitle='hidden';$('chart').dataset.compositeStrengthSource='spy-price-confirmed-taker';$('chart').dataset.spyVolumeStrengthLabel='pane-legend';$('chart').dataset.spyVolumeStrengthUnits='signed-2dp';$('chart').dataset.spyVolumeStrengthPositive='#f6c85f';$('chart').dataset.spyVolumeStrengthNegative='#f3f6fb';
  $('chart').dataset.wlrColorMode='hysteresis-closed-bars';$('chart').dataset.wlrColorEnter=String(WLR_COLOR_DEFAULTS.enter);$('chart').dataset.wlrColorExit=String(WLR_COLOR_DEFAULTS.exit);
  $('chart').dataset.compositeStrengthVersion=COMPOSITE_STRENGTH_VERSION;
  $('chart').dataset.commonVolumeInput='true-taker-quote-delta-70-30';
  // Pane heights: price 67%, SPY V 26%, C Taker NF 7% (lower panes total 33%).
  chart.panes()[0].setStretchFactor(.67);chart.panes()[1].setStretchFactor(.26);chart.panes()[2].setStretchFactor(.07);
  marks=L.createSeriesMarkers(price,[]);
  chart.subscribeCrosshairMove(p=>{if(!p.sourceEvent)return;inspectedTime=p.time?p.time*1000:null;showTooltip(inspectedTime??rows[$('symbol').value]?.at(-1)?.t);});
  $('chart').addEventListener('pointerleave',()=>{inspectedTime=null;showTooltip(rows[$('symbol').value]?.at(-1)?.t);});
  chart.timeScale().subscribeVisibleLogicalRangeChange(()=>{scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();scheduleH1H4Strip();});
  window.addEventListener('resize',()=>{applyResponsiveChartOptions();scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();scheduleH1H4Strip();scheduleH1Status();requestAnimationFrame(positionFixedPaneReadouts);requestAnimationFrame(updateCandleCountdown);});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{applyResponsiveChartOptions();window.dispatchEvent(new Event('resize'));},120));
  const paneLayoutObserver=new ResizeObserver(()=>{scheduleH1H4Strip();scheduleH1Status();requestAnimationFrame(positionFixedPaneReadouts);});
  for(const element of [$('chart'),...chart.panes().map(pane=>pane.getHTMLElement())].filter(Boolean))paneLayoutObserver.observe(element);
  let scoreInputs=null;
  h1ScoreLayer=mountH1ScoreHistogram({chart,host:$('chart'),storage:colorStorage(),getState:({forScoreLine=false}={})=>{
    const active=$('symbol').value==='SPYUSDT'&&$('interval').value==='15m'&&(forScoreLine||$('candle-h1-box-color')?.checked);
    if(!active)return {active:false};
    const bars=rows.SPYUSDT??[],flowRows=rows.COMPOSITE??[],oiMap=oiStamp==='15m'?oiWidths:new Map(),now=cache?.serverTime??Date.now();
    if(!scoreInputs||scoreInputs.bars!==bars||scoreInputs.flowRows!==flowRows||scoreInputs.oi!==oiMap||scoreInputs.bands!==priceBandMap){
      const points=oiCandleBars(bars,spyVolumeDeltaRows,flowRows,oiMap,STEPS['15m'],now,{filterPin:true,history:true,minOiMultiplier:1,oiPercentile:.62}).points;
      scoreInputs={bars,flowRows,bands:priceBandMap,deltas:new Map(spyVolumeDeltaRows.map(r=>[r.t,r])),flows:new Map(flowRows.map(r=>[r.t,r])),oi:oiMap,oiPoints:points};
    }
    return {...scoreInputs,active:true,states:h1CandleMap,now,scoreRevision:geometryOiRevision+'|'+studyResultKey};
  }});
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
function h1BoxCandlePalette(row,state){
  const direction=state?.direction??0,target=direction>0?[24,214,163]:direction<0?[255,77,112]:[103,119,140],quality=Math.max(.20,Math.min(1,state?.quality??.35)),intensity=(state?.preview?.48:.68)+quality*(state?.preview?.24:.28);
  return {body:mixColor([68,82,99],target,intensity),wick:mixColor([105,120,138],target,Math.min(1,intensity+.10)),border:state?.preview?'#f6c85f':mixColor([57,70,86],target,Math.min(1,intensity+.14))};
}
function priceLineData(data,compositeStrength,volumeStrength,trendThickness){
  const trendMode=$('phase-width').checked,h1=usesH1WlrStyle(),soft=$('wlr-soft-colors')?.checked&&$('symbol').value==='SPYUSDT',colorOptions={step:STEPS[$('interval').value],closedBefore:cache?.serverTime??Infinity};
  const displayColors=h1&&soft?data.map(x=>wlrH1StyleMap.get(x.t)):soft?wlrSoftColors(rows[$('symbol').value]??[],data,compositeStrength,volumeStrength,colorOptions):wlrDisplayColors(data,compositeStrength,volumeStrength,colorOptions);
  $('chart').dataset.wlrColorModel=h1&&soft?'h1-box-score':soft?'slope-sigma-composite-soft':'composite-volume';
  wlrColorMap=new Map(displayColors.map(x=>[x.t,x]));$('chart').dataset.wlrEarlyCount=String(displayColors.filter(x=>x.early).length);
  if(!h1)delete $('chart').dataset.wlrH1Alignment;
  if(h1){
    wlrThicknessMap=wlrH1StyleMap;$('chart').dataset.wlrH1Alignment='same-box-history';$('chart').dataset.wlrThicknessModel=trendMode?'h1-box-score':'fixed';$('chart').dataset.wlrThicknessMax=String(trendMode?7:3);$('chart').dataset.wlrVolumeSource='h1-box-score';
    for(const key of ['wlrThicknessTrendWeight','wlrThicknessWindow','wlrThicknessPairs'])delete $('chart').dataset[key];
  }else if(soft){wlrThicknessMap=new Map(displayColors.map(x=>[x.t,x]));$('chart').dataset.wlrThicknessModel=trendMode?'slope-sigma-soft':'fixed';$('chart').dataset.wlrThicknessMax=String(trendMode?8:3);}
  return data.map((x,i)=>{
    if(!Number.isFinite(x.mid))return {time:x.t/1000};
    const phase=strengthPhaseLineStyle(compositeStrength.get(x.t),volumeStrength.get(x.t),{thin:WLR_SLOPE_DEFAULTS.minWidth,neutral:3,thick:WLR_SLOPE_DEFAULTS.maxWidth}),trend=trendThickness.get(x.t);
    const width=h1?(trendMode?wlrH1StyleMap.get(x.t)?.width??2:3):soft?(trendMode?displayColors[i].width??2:3):(trendMode&&Number.isFinite(trend?.width)?trend.width:phase.width);
    return {time:x.t/1000,value:x.mid,width,phaseColor:displayColors[i].color};
  });
}
function flowData(data,key){const palette=flowColors[key];return data.map(x=>Number.isFinite(x.net)?{time:x.t/1000,value:x.net,color:x.net>=0?palette.up:palette.down}:{time:x.t/1000});}
function spyVSignColor(value){
  if(!Number.isFinite(value)||value===0)return '#68778a';
  return value>0?'#08e8a9':'#ff4163';
}
function volumeDeltaBandData(data,spyVByTime){
  return data.map(x=>({time:x.t/1000,value:volumeDeltaStrengthValue(x.value),color:spyVSignColor(spyVByTime.get(x.t)?.adjusted)}));
}
function applyOiHistoryData(data){
 const {interval,samples,saved,source}=data;if($('interval').value!==interval||oiStamp!==interval)return;
 const host=$('chart'),changed=samples.length!==oiAppliedSamples.length||samples.some((row,i)=>row.timestamp!==oiAppliedSamples[i]?.timestamp||row.sumOpenInterest!==oiAppliedSamples[i]?.sumOpenInterest);
 host.dataset.oiHistorySamples=String(samples.length);host.dataset.oiHistorySaved=String(saved);
 if(source==='saved'&&!changed)return;
 const now=cache?.interval===interval?cache.serverTime:Date.now()+serverOffsetMs;
 if(changed||oiWidthClock!==Math.floor(now/STEPS[interval])){oiWidths=oiWidthByBar(samples,STEPS[interval],now);oiWidthClock=Math.floor(now/STEPS[interval]);oiAppliedSamples=samples;}
 if(samples.length)host.dataset.oiFirstDataMs??=String(Math.round(performance.now()));
 host.dataset.oiLoadPhase=source;if(source==='tail'||source==='history')delete host.dataset.oiError;
 if(changed){geometryOiRevision++;if(cache?.interval===interval)render(false);}
}
function handleOiLoadState({interval,phase,error}){
 if($('interval').value!==interval||oiStamp!==interval)return;
 $('chart').dataset.oiLoadPhase=phase;
 if(phase==='error')$('chart').dataset.oiError=error?.message??'OI unavailable';
}
function refreshOiWidths(interval){
 if(!STEPS[interval])return;
 if(oiStamp!==interval){oiStamp=interval;oiWidths=new Map();oiAppliedSamples=[];oiWidthClock=-1;delete $('chart').dataset.oiFirstDataMs;$('chart').dataset.oiLoadStartedMs=String(Math.round(performance.now()));}
 return oiFastLoader.start(interval);
}

function scheduleAbaBandColors(){
  if(abaBandFrame)return;
  abaBandFrame=requestAnimationFrame(()=>{abaBandFrame=0;updateAbaBandColors();});
}
function wlrBandColor(field,slope,muted){
  if(field==='lower'&&slope>0)return muted?'rgba(8,232,169,.55)':'#08e8a9';
  if(field==='upper'&&slope<0)return muted?'rgba(255,65,99,.55)':'#ff4163';
  return 'rgba(145,165,189,.35)';
}
function updateAbaBandColors(){
 if(!series.priceUpper||!series.priceLower)return;
 const on=Boolean($('aba-band-colors')?.checked),supported=$('symbol').value==='SPYUSDT'&&$('interval').value==='15m',enabled=on&&supported&&$('causal-trend-channel').checked,bands=[...priceBandMap.values()];
 const channels=enabled?(causalChannelState.trends??[]).filter(c=>!c.provisional):[],result=causalChannelAba({channels,bands,now:cache?.serverTime??0});
 abaBandPhaseMap=result.phases;
 $('aba-band-history').disabled=!abaBandPhaseMap.size;
 for(const [name,field] of [['priceUpper','upper'],['priceLower','lower']])writeSeries(name,series[name],bands.map(r=>Number.isFinite(r[field])?{time:r.t/1000,value:r[field],color:wlrBandColor(field,r.slope,enabled&&!result.phases.has(r.t))}:{time:r.t/1000}),[$('symbol').value,$('interval').value,enabled,$('wlr-soft-colors').checked].join('|'));
 $('chart').dataset.causalA1Count=String(result.channelCount);
 $('aba-band-color-status').textContent=!on?'�? t?t m�u bi�n theo k�nh causal.':!supported?'Bi�n theo k�nh causal h? tr? SPY M15.':`Bi�n theo k�nh trend causal � ${result.channelCount} k�nh. H?p s?c m?nh ghi lo?i h?p thay nh?n A1.`;
}

function scheduleCvdSpectrum(){spectrumPrimitive.redraw();}
function scheduleDaySeparators(){if(dayFrame)return;dayFrame=requestAnimationFrame(()=>{dayFrame=requestAnimationFrame(()=>{dayFrame=0;drawDaySeparators();});});}
function scheduleGeometryOverlay(){if(geometryFrame)return;geometryFrame=requestAnimationFrame(()=>{geometryFrame=requestAnimationFrame(()=>{geometryFrame=0;drawGeometryOverlay();});});}
function scheduleH1H4Strip(){scheduleH1OiPriceMarkers();h1ScoreLayer?.schedule();if(h1H4StripFrame)return;h1H4StripFrame=requestAnimationFrame(()=>{h1H4StripFrame=0;drawH1H4Strip();});}
function drawH1H4Strip(){
  const canvas=$('h1-h4-age-strip'),host=$('chart');if(!canvas||!host)return;
  const width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1,bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);
  if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
  const interval=$('interval').value,active=$('symbol').value==='SPYUSDT'&&['15m','1h'].includes(interval)&&$('candle-h1-box-color')?.checked;
  canvas.dataset.mode=active?'active':'off';canvas.dataset.states=String(h1CandleMap.size);canvas.dataset.structureStates=String(h1H4CandleMap.size);canvas.dataset.colorSource='H1';canvas.dataset.visibleBars='0';canvas.dataset.previewBars='0';
  canvas.setAttribute('aria-label',active?'D?i m�u ph�a tr�n pane SPY V: gi? nguy�n h?nh d�ng v� c�c � H1 c?a d?i c?, nh�ng m�u l?y t? H?p H1; vi?n v�ng l� H1 XEM TR�?C.':'D?i m�u H?p H1 hi?n th? tr�n chart SPY M15 ho?c H1 khi b?t m�u h?p.');
  const bounds=paneBounds(1);
  if(!bounds)return;
  const scaleWidth=chart.priceScale('right',1)?.width?.()??56,right=Math.max(0,width-scaleWidth),stripHeight=10,y=Math.round(bounds.top);
  canvas.dataset.paneTop=String(bounds.top);canvas.dataset.stripTop=String(y);canvas.dataset.alignment='spy-pane-top';
  if(right<8||y<0)return;
  const timeScale=chart.timeScale(),fallbackSpacing=Math.max(1,Number(timeScale.options?.().barSpacing)||6);
  const chartTimes=(rows.SPYUSDT??[]).map(row=>row.t);
  let visibleBars=0,previewBars=0;
  if(active&&h1H4CandleMap.size&&h1CandleMap.size){
  context.save();context.beginPath();context.rect(0,y,right,Math.min(stripHeight,bounds.height));context.clip();
  context.fillStyle='rgba(9,17,29,.88)';context.fillRect(0,y,right,stripHeight);
  const times=[...h1H4CandleMap.keys()].sort((x,y)=>x-y);
  let previousBlock=null;
  for(let i=0;i<times.length;i++){
    const time=times[i],state=h1H4CandleMap.get(time),colorState=h1CandleMap.get(time);
    const cell=h1StripCell(time,chartTimes,t=>timeScale.timeToCoordinate(t),fallbackSpacing);
    if(!cell)continue;
    const {x,width:cellWidth}=cell;if(x+cellWidth<0||x>right)continue;
    const color=h1BoxCandlePalette(null,colorState??{direction:0,quality:0});context.fillStyle=color.body;context.fillRect(x,y,cellWidth,stripHeight);
    if(colorState?.preview){context.strokeStyle='#f6c85f';context.lineWidth=1;context.strokeRect(x+.5,y+.5,Math.max(0,cellWidth-1),stripHeight-1);previewBars++;}
    if((state?.blockStart===time||(previousBlock!==null&&state?.blockStart!==previousBlock))&&x>=0&&x<=right){context.fillStyle='#ffffff';context.fillRect(Math.round(x)-1,y-1,3,stripHeight+2);}
    previousBlock=state?.blockStart;visibleBars++;
  }
  context.restore();
  }
  canvas.dataset.visibleBars=String(visibleBars);canvas.dataset.previewBars=String(previewBars);
  canvas.setAttribute('aria-label',`D?i m�u ph�a tr�n pane SPY V: ${visibleBars} � H1 �ang hi?n th?, m�u l?y t? H?p H1; chart ${interval==='15m'?'M15':'H1'}, ${previewBars} � XEM TR�?C vi?n v�ng � ${isChartLive()?'LIVE':'DELAYED'}. D?i b�m s�t m�p tr�n pane SPY V; k�ch th�?c � v� v?ch ph�n nh�m H4 gi? nh� d?i c?.`);
}

let h1OiPriceFrame=0;
function scheduleH1OiPriceMarkers(){
  if(h1OiPriceFrame)return;
  h1OiPriceFrame=requestAnimationFrame(()=>{h1OiPriceFrame=0;drawH1OiPriceMarkers();});
}
function drawH1OiPriceMarkers(){
  const showOi=usesH1WlrStyle()&&$('h1-oi-markers-toggle')?.checked;
  const bounds=showOi?paneBounds(0):null;
  if(!bounds){drawH1OiMarkers([]);return;}
  const timeScale=chart.timeScale(),step=STEPS['15m'];
  const right=$('chart').clientWidth-(chart.priceScale('right',0)?.width?.()??64);
  const hiddenReasons=new Set();
  const markers=h1OiMarkers.flatMap(mark=>{
    const state=h1CandleMap.get(mark.start);
    if(!state){hiddenReasons.add('ch? m�u h?p H1');return [];}
    if(state.preview!==false||Math.sign(mark.base)!==state.direction){hiddenReasons.add('l?c theo h?p H1');return [];}
    const group=Array.from({length:4},(_,i)=>maps.SPYUSDT?.get(mark.start+i*step));
    if(group.some(bar=>!Number.isFinite(bar?.h)||!Number.isFinite(bar?.l))){hiddenReasons.add('thi?u n?n �? v?');return [];}
    const x1=timeScale.timeToCoordinate(mark.start/1000),x2=timeScale.timeToCoordinate((mark.start+3*step)/1000);
    if(!Number.isFinite(x1)||!Number.isFinite(x2)){hiddenReasons.add('ch? t?a �? chart');return [];}
    if(Math.max(x1,x2)<0||Math.min(x1,x2)>right){hiddenReasons.add('ngo�i th?i gian �ang xem');return [];}
    const high=price.priceToCoordinate(Math.max(...group.map(bar=>bar.h)));
    const low=price.priceToCoordinate(Math.min(...group.map(bar=>bar.l)));
    if(!Number.isFinite(high)||!Number.isFinite(low)||right<16||bounds.height<18){hiddenReasons.add('ch? t?a �? chart');return [];}
    if(low<0||high>bounds.height){hiddenReasons.add('ngo�i v�ng gi� �ang xem');return [];}
    const x=Math.round(Math.max(8,Math.min(right-8,(x1+x2)/2)));
    const above=high-21,below=low+3;
    const offset=Math.max(0,Math.min(bounds.height-18,state.direction>0?below:above));
    return [{...mark,x,y:Math.round(bounds.top+offset),color:h1BoxCandlePalette(null,state).body}];
  });
  const valid=h1OiMarkerCoverage.validHours??0;
  const status=markers.length?'':hiddenReasons.size?`OI H1 � ${[...hiddenReasons].join(' � ')}`:valid<37?`OI H1 � �? d? li?u ${valid}/37 h?p`:'OI H1 � ch�a c� h?p �?t 4/5';
  drawH1OiMarkers(markers,status);
}
function drawH1OiMarkers(markers,message=''){
  const layer=h1OiMarkerLayer;if(!layer)return;
  const {root,detail,status}=layer,signature=JSON.stringify(markers);
  status.hidden=!message;status.textContent=message;
  status.title=message;
  if(signature===layer.signature)return;
  layer.signature=signature;
  const buttons=markers.map(mark=>{
    const button=document.createElement('button'),size=mark.points===5?12:10;
    button.type='button';button.dataset.start=String(mark.start);button.dataset.points=String(mark.points);
    button.style.cssText=`position:absolute;left:${mark.x}px;top:${mark.y}px;transform:translateX(-50%);width:16px;height:18px;padding:0;border:0;background:transparent;color:${mark.color};cursor:help;pointer-events:auto;display:grid;place-items:center`;
    const path=mark.direction>0?'M 6 1 L 11 10 L 1 10 Z':'M 1 2 L 11 2 L 6 11 Z';
    button.innerHTML=`<svg width="${size}" height="${size}" viewBox="0 0 12 12" aria-hidden="true"><path d="${path}" fill="${mark.filled?'currentColor':'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    const time=new Date(mark.start).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
    const pct=(mark.pct>0?'+':'')+mark.pct.toFixed(3)+'%';
    button.title=`H1 ${time} VN � OI ${pct} � P75 ${mark.p75.toFixed(3)}% � �?ng h�?ng ${Math.round(100*mark.coherence)}% � ${mark.sameDirection}/4 M15 � N?n H1 ${mark.base>0?'+':''}${mark.base} � �i?m OI ${mark.points}/5 � Taker SPY ${mark.taker===null?'thi?u':fmtK(mark.taker)+' USDT'}`;
    button.setAttribute('aria-label',button.title);
    button.onclick=()=>{detail.textContent=button.title;detail.showPopover?.();};
    return button;
  });
  if(!markers.length)detail.hidePopover?.();
  for(const button of [...root.children].slice(2))button.remove();
  root.append(...buttons);
  root.dataset.visible=String(markers.length);
}
let h1StatusFrame=0;
function scheduleH1Status(){
 if(h1StatusFrame)return;
 h1StatusFrame=requestAnimationFrame(()=>{
  h1StatusFrame=0;
  positionH1Status();
 });
}
function positionH1Status(){
 const row=$('h1-cvd-status-row'),paneHeight=chart?.panes?.()[0]?.getHeight?.();
 if(!row||row.hidden||!Number.isFinite(paneHeight))return;
 const oiVisible=$('oi-bottom-toggle')?.checked&&$('symbol').value==='SPYUSDT';
 // Match the histogram's bottom 14% scale margin and leave a clear gap above it.
 const reserved=oiVisible?Math.ceil(paneHeight*.14):0;
 const axis=chart.priceScale('right',0)?.width?.()??58;
 row.style.right=`${axis+6}px`;
 row.style.maxWidth=`calc(100% - ${axis+12}px)`;
 row.style.top=`${Math.max(4,paneHeight-reserved-Math.ceil(row.getBoundingClientRect().height)-8)}px`;
 row.dataset.oiClearance=String(reserved);
}
function currentH1TrendAge(){
  const blocks=new Map();for(const state of h1CandleMap.values()){if(!Number.isFinite(state.blockStart))continue;const old=blocks.get(state.blockStart);if(!old||state.t>old.t)blocks.set(state.blockStart,state);}
  let direction=0,ageH1=0,dayKey=null,latest=null;
  for(const state of [...blocks.values()].sort((a,b)=>a.blockStart-b.blockStart)){
    if(dayKey!==state.dayKey){dayKey=state.dayKey;direction=0;ageH1=0;}
    if(state.direction===0){direction=0;ageH1=0;}
    else if(state.direction===direction){ageH1++;}
    else{direction=state.direction;ageH1=1;}
    latest={...state,ageH1};
  }
  return latest;
}
function updateH1TrendAgeReadout(){
  let row=$('h1-cvd-status-row');
  if(!row){row=document.createElement('div');row.id='h1-cvd-status-row';row.setAttribute('role','group');row.setAttribute('aria-label','Tu?i h?p H1 v� ?OI');$('chart').append(row);}
  let node=$('h1-trend-age-readout');
  if(!node){
    node=document.createElement('span');node.id='h1-trend-age-readout';
    const oi=document.createElement('span');oi.id='h1-oi-status';
    for(const id of ['h1-oi-arrow','h1-oi-percent','h1-oi-flags']){const part=document.createElement('span');part.id=id;oi.append(part);}node.append(oi);
    const age=document.createElement('span');age.id='h1-trend-age-text';node.append(age);
    const countdown=document.createElement('span');countdown.id='h1-candle-countdown';countdown.setAttribute('aria-live','off');node.append(countdown);
    row.append(node);
  }
  const visible=usesH1WlrStyle();row.hidden=!visible;if(!visible)return;
  const state=currentH1TrendAge(),direction=state?.direction??0,word=direction>0?'?':direction<0?'?':'WAIT';
  $('h1-trend-age-text').textContent=state?`${word} ${state.ageH1} H1`:'H1 � WAIT';
  node.className=direction>0?'up':direction<0?'down':'wait';
  node.title=$('h1-trend-age-text').textContent+'. H?p H1 �?m c�c h?p H1 li�n ti?p c�ng m�u v?i n?n: xanh ?, �? ?, x�m WAIT. �?i m�u ho?c sang ng�y New York m?i s? �?t l?i tu?i. XEM TR�?C g?m h?p H1 �ang h?nh th�nh v� c� th? �?i m�u. �?ng h? l� th?i gian �?n h?t gi? H1 hi?n t?i, kh�ng x�c nh?n d? li?u LIVE.';
  updateH1OiReadout();updateH1CandleCountdown();scheduleH1Status();
}
function updateH1CandleCountdown(){
  const node=$('h1-candle-countdown'),show=$('interval').value==='15m'&&$('symbol').value==='SPYUSDT';
  if(!node)return;node.hidden=!show;if(!show)return;
  const serverNow=Date.now()+serverOffsetMs,remaining=Math.max(0,(Math.floor(serverNow/3600000)+1)*3600000-serverNow),seconds=Math.ceil(remaining/1000),minutes=Math.floor(seconds/60),rest=seconds%60;
  const label=`H1 ${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
  if(node.textContent!==label){
    node.textContent=label;
    node.setAttribute('aria-label',`N?n H1 ��ng sau ${minutes} ph�t ${rest} gi�y`);
  }
}
function updateCandleCountdown(){
  updateH1CandleCountdown();
  const node=$('candle-countdown'),bar=(rows.SPYUSDT??[]).at(-1),show=$('interval').value==='15m'&&$('symbol').value==='SPYUSDT';
  if(!node||!show||!bar){if(node)node.style.display='none';return;}
  node.style.display='block';
  const serverNow=Date.now()+serverOffsetMs,remaining=Math.max(0,bar.end+1-serverNow),seconds=Math.ceil(remaining/1000);
  const minutes=Math.floor(seconds/60),rest=seconds%60;
  const label=`${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
  if(node.textContent!==label)node.textContent=label;
  node.className=remaining>0?'':'missing';
  const y=price.priceToCoordinate(bar.c),paneHeight=chart?.panes?.()[0]?.getHeight?.();
  node.style.right='2ch';node.style.width='auto';
  if(Number.isFinite(y)&&Number.isFinite(paneHeight))node.style.top=`${Math.max(2,Math.min(paneHeight-node.offsetHeight-2,y+11))}px`;
}
function drawCvdSpectrum(scope){
   scheduleH1OiPriceMarkers();
   const showCvd=$('cvd-spectrum-toggle').checked;
   if(cvdAnchorTime===null||!showCvd)return;
   const anchor=chart.timeScale().timeToCoordinate(cvdAnchorTime/1000);if(!Number.isFinite(anchor))return;
   drawPairedSpectrum({...scope,anchor,priceToY:value=>price.priceToCoordinate(value),history:cvdProfile,comparison:spectrumComparison,showCvd,compare:false,showDaily:$('symbol').value==='SPYUSDT',source:cvdSourceLabel,format:fmt});
}
function updateH1OiReadout(){
 const node=$('h1-oi-status');if(!node)return;
 const now=Date.now()+serverOffsetMs;
 const live=runningOiState.read(currentOiLoader.sample,oiAppliedSamples,(rows.SPYUSDT??[]).at(-1),(rows.COMPOSITE??[]).at(-1),now,{chartFresh:isChartLive()});
 const label=h1OiLabel(live,!!currentOiLoader.error);
 const parts=[['h1-oi-arrow',label.arrow],['h1-oi-percent',label.value],['h1-oi-flags',label.suffix]];
 for(const [id,text] of parts){const part=$(id);if(part&&part.textContent!==text)part.textContent=text;}
 $('h1-oi-percent').dataset.tone=oiPercentColor.update(live,{now,sampleTime:currentOiLoader.sample?.time,error:!!currentOiLoader.error});
 node.title=label.title+' M?i t�n v� % c?p nh?t ngay; m�u % c?n �t nh?t 3 m?u m?i c�ng h�?ng trong 9 gi�y, gi? m�u t?i thi?u 15 gi�y. Sang n?n m?i, thi?u/c?/l?i tr? m�u trung t�nh.';node.setAttribute('aria-label',node.title);
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
function drawGeometryOverlay(){
  const canvas=$('geometry-overlay'),host=$('chart'),width=host.clientWidth,height=host.clientHeight,dpr=window.devicePixelRatio||1;
  const bitmapWidth=Math.round(width*dpr),bitmapHeight=Math.round(height*dpr);if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const context=canvas.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);canvas.dataset.lines=String(geometryState.lines?.length??0);canvas.dataset.provisionalLines=String(geometryState.provisionalLines?.length??0);canvas.dataset.pivots=String(geometryState.pivots?.length??0);canvas.dataset.states=String(geometryStatePoints.length);canvas.dataset.causalTrends=String(causalChannelState.trends?.length??0);canvas.dataset.causalActiveTrends=String((causalChannelState.trends??[]).filter(t=>t.provisional&&t.bars>=8).length);canvas.dataset.pivotSource=geometryState.pivotSource??'M15_PRICE';
  const showCausal=$('causal-trend-channel').checked,showPivots=$('geometry-pivots').checked;
  if(!showCausal&&!showPivots)return;
  const paneHeight=chart.panes()[0]?.getHeight?.()??height*.5,scaleWidth=chart.priceScale('right',0)?.width?.()??56,right=width-scaleWidth;
  context.save();context.beginPath();context.rect(0,0,right,paneHeight);context.clip();canvas.dataset.clipHeight=String(paneHeight);context.lineJoin='round';context.lineCap='round';
  if(showCausal){
    for(const trend of causalChannelState.trends??[]){
      if((trend.bars??0)<8)continue;
      const path=(trend.renderPoints??trend.points??[]).map(point=>({point,x:chart.timeScale().timeToCoordinate(point.time/1000),upper:price.priceToCoordinate(point.upper),lower:price.priceToCoordinate(point.lower),center:price.priceToCoordinate(point.center)})).filter(item=>[item.x,item.upper,item.lower,item.center].every(Number.isFinite)),x1=path[0]?.x,x2=path.at(-1)?.x,confirmPoint=path.find(item=>item.point.time===trend.confirmationTime);
      if(path.length<2||Math.max(x1,x2)<0||Math.min(x1,x2)>right)continue;
      const alpha=Math.max(.35,Math.min(.98,trend.qualityOpacity??.78)),rgb=trend.direction<0?'248,250,252':trend.absorbing?'251,146,60':trend.provisional?'34,211,238':'250,204,21',color=`rgba(${rgb},${alpha})`,secondaryColor=`rgba(${rgb},${Math.max(.24,alpha*.58)})`,primaryKey=trend.direction>0?'lower':'upper',secondaryKey=trend.direction>0?'upper':'lower',dash=trend.provisional?[4,4]:trend.absorbing?[9,5]:[];
      const strokeRail=(key,stroke,width)=>{context.strokeStyle=stroke;context.lineWidth=width;context.setLineDash(dash);context.beginPath();for(let i=0;i<path.length;i++)i?context.lineTo(path[i].x,path[i][key]):context.moveTo(path[i].x,path[i][key]);context.stroke();};
      strokeRail(secondaryKey,secondaryColor,1.35);strokeRail(primaryKey,color,Math.max(2,Math.min(trend.provisional?3:5,trend.lineWidth??2)));
      const startY=path[0].center;
      if(Number.isFinite(startY)&&x1>=0&&x1<=right){context.setLineDash([]);context.fillStyle=color;context.beginPath();context.arc(x1,startY,4,0,Math.PI*2);context.fill();if(width>=650){context.font='800 9px Inter,system-ui,sans-serif';context.textAlign='left';context.textBaseline='bottom';context.fillText(`${trend.direction>0?'?':'?'} B?T �?U`,x1+6,startY-4);}}
      if(trend.confirmationTime!==trend.startTime&&confirmPoint&&confirmPoint.x>=0&&confirmPoint.x<=right){context.setLineDash([]);context.strokeStyle=color;context.lineWidth=1.5;context.beginPath();context.arc(confirmPoint.x,confirmPoint.center,3,0,Math.PI*2);context.stroke();}
    }
  }
  if(showPivots){
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
  const renderStarted=performance.now();
  const p=rows[$('symbol').value]??[];
  tpoLayer?.update();
  gexLayer?.update();
  const h1BoxColor=$('candle-h1-box-color')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='1h',h1BoxKey=h1BoxColor?studyResultKey:'off';
  const h1StyleEnabled=usesH1WlrStyle();
  displayVolumeStrengthRows=volumeStrengthRows;
  $('chart').dataset.spyVolumeH1Smooth='off';
  $('chart').dataset.spyBodySmoothing='ewma-fixed';
  $('chart').dataset.spyBodyEwmaAlpha=String(1-2**(-.5));
  const seriesContext=[h1StyleEnabled,h1StyleEnabled?studyResultKey:'off',$('symbol').value,$('interval').value,$('signal').value,$('days').value,$('candle-agreement-color').checked ,h1BoxColor,h1BoxKey,$('phase-width').checked,$('wlr-soft-colors').checked].join('|');
  dayBoundaries=dayBoundaryTimes(p);
  const compositeCvd=$('symbol').value==='SPYUSDT',cvdBars=compositeCvd?projectNetFlowToPrice(p,rows.COMPOSITE??[]):p;
  cvdSourceLabel=compositeCvd?'C?S':'Q';$('cvd-spectrum').dataset.source=compositeCvd?'COMPOSITE?SPY':'QQQUSDT';
  // Keep paired OI data available to the chart's contextual readings.
  const oiProfile=compositeCvd?oiSpectrum(p,oiWidths,STEPS[$('interval').value],cache?.serverTime??0):{ready:false,bins:[],max:0};
  cvdProfile=continuousCvdSpectrum(cvdBars);cvdAnchorTime=cvdBars.at(-1)?.t??p.at(-1)?.t??null;
  spectrumComparison=buildSpectrumComparison(p,compositeCvd?spyCandleVolumeFlow(p):cvdBars,oiProfile,cache?.serverTime??0,{flowSource:compositeCvd?'spy-candle-volume':'taker'});
  const spectrumNode=$('cvd-spectrum');spectrumNode.dataset.renderer='chart-primitive';
  const spectrumDescription=`Ph? CVD nhi?u ng�y${compositeCvd?` v� CVD ng�y � ${spectrumComparison.day??'�'} NY � ${spectrumComparison.count} n?n`:''}.`;
  if(spectrumNode.getAttribute('aria-label')!==spectrumDescription)spectrumNode.setAttribute('aria-label',spectrumDescription);
  $('chart').dataset.oiSpectrumState='off';$('chart').dataset.cvdSpectrumPeriod='loaded-history';$('chart').dataset.cvdSpectrumBars=String(cvdBars.length);$('chart').dataset.spectrumLayout='cvd-only';$('chart').dataset.cvdDayBars=String(spectrumComparison.count);$('chart').dataset.spectrumPaired=String(spectrumComparison.pairedReady);
  const closedBefore=cache?.serverTime??Infinity;
  const wlrVolumeStrengthMap=usesH1WlrStyle()?new Map():volumeStrengthMap;
  $('chart').dataset.wlrVolumeSource='spy-v-original';
  candleColorMap=new Map(p.map(x=>[x.t,strengthAgreementCandleSignal(maps.COMPOSITE?.get(x.t),volumeStrengthMap.get(x.t))]));
  candleClusterMap=new Map(candleRegimeClusters(p,volumeStrengthRows,STEPS[$('interval').value]).map(x=>[x.t,x]));
  setOptions(price,{priceFormat:$('symbol').value==='SPYUSDT'?{type:'price',precision:1,minMove:.1}:{type:'price',precision:2,minMove:.01}});
  const priceBands=weightedPriceBands(p,STEPS[$('interval').value]),h1Wlr=usesH1WlrStyle();
  const trendThickness=h1Wlr?new Map():new Map(wlrSlopeThickness(p,maps.COMPOSITE??new Map(),wlrVolumeStrengthMap,{step:STEPS[$('interval').value],closedBefore}).map(x=>[x.t,x]));
  priceBandMap=new Map(priceBands.map(x=>[x.t,x]));
  const h1ScoreRecords=h1Wlr?(h1ScoreLayer?.getLineScores()??[]):[];
  $('chart').dataset.candleH1BoxColor=h1BoxColor?'active':'off';$('chart').dataset.candleH1BoxPreviewBars=String([...h1CandleMap.values()].filter(x=>x.preview).length);$('chart').dataset.candleH1BoxStates=String(h1CandleMap.size);
  const bodyVolumeBars=(cache?.SPYUSDT??[]).map(bar=>({...bar,v:Math.abs(bar.c-bar.o)}));
  const bodyVolumeStep=STEPS[$('interval').value];
  // Fixed half-life 2 bars for the line, candle signs, OI phases and TK V2.
  // H1 display/score updates cannot change this source or its EWMA speed.
  const bodyVolumeRows=bodyVolumeBars.length
    ?analyze(bodyVolumeBars,bodyVolumeStep,{strength:calculateVolumeStrength(bodyVolumeBars,bodyVolumeStep,{halfLife:2})}):[];
  const bodyVolumeByTime=new Map(bodyVolumeRows.map(row=>[row.t,row]));
  const daoV2On=Boolean($('dao-v2-toggle')?.checked)&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
  const daoV2Source=$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
  const daoV2State=daoV2Source&&(daoV2On||daoV2Stats?.needsContext())?daoV2Cache.get(cache?.SPYUSDT??[],new Map(),{now:cache?.serverTime??Date.now(),adaptive:false}):{points:[],last:null};
  daoV2Stats?.setContext({active:daoV2Source,waitingH1:false,bars:cache?.SPYUSDT??[],bodyRows:bodyVolumeRows,points:daoV2State.points,now:cache?.serverTime??Date.now(),source:'SPY V th�n n?n � EWMA c? �?nh � ? 0,2929'});
  daoV2Layer?.setData(daoV2State,daoV2On);
  $('chart').dataset.daoV2=daoV2On?'active':'off';
  $('chart').dataset.daoV2Points=String(daoV2State.points.length);
  $('chart').dataset.daoV2Preview=String(Boolean(daoV2State.preview));
  $('chart').dataset.daoV2NoNearby=String(daoV2On&&!daoV2State.last);
  const priceData=p.map(x=>{
    const color=spyVSignColor(bodyVolumeByTime.get(x.t)?.adjusted);
    return {time:x.t/1000,open:x.o,high:x.h,low:x.l,close:x.c,color,wickColor:color,borderColor:color};
  });
  const linePriceMode=priceStyleLayer?.update(p,$('symbol').value==='SPYUSDT'?{type:'price',precision:1,minMove:.1}:{type:'price',precision:2,minMove:.01},seriesContext,priceData)??false;
  writeSeries('price',price,priceStyleLayer?.candleData(priceData)??priceData,seriesContext+'|price-line:'+linePriceMode);
  h1OiMarkerCoverage={};
  h1OiMarkers=h1Wlr&&oiStamp==='15m'&&$('h1-oi-markers-toggle')?.checked?scoreH1OiMarkers({boxes:h1ScoreRecords,bars:p,oi:oiWidths,now:closedBefore,coverage:h1OiMarkerCoverage}):[];
  wlrH1StyleMap=new Map((h1Wlr?wlrH1Styles(priceBands,h1ScoreRecords,{now:cache?.serverTime??Date.now(),alignment:'box',boxStates:h1CandleMap,scoreColor:true}):[]).map(x=>[x.t,x]));
  wlrThicknessMap=trendThickness;const currentThickness=trendThickness.get(p.at(-1)?.t);$('chart').dataset.wlrThicknessModel='slope-r2-flow-noise';$('chart').dataset.wlrThicknessMax=String(WLR_SLOPE_DEFAULTS.maxWidth);$('chart').dataset.wlrThicknessTrendWeight=String(WLR_SLOPE_DEFAULTS.trendWeight);$('chart').dataset.wlrThicknessWindow=String(WLR_SLOPE_DEFAULTS.window);$('chart').dataset.wlrThicknessPairs=String(currentThickness?.pairs??0);
  writeSeries('priceMid',series.priceMid,priceLineData(priceBands,maps.COMPOSITE??new Map(),wlrVolumeStrengthMap,trendThickness),seriesContext);updateAbaBandColors();
  compositeClusterRows=clusterTakerNf(p,new Map((rows.COMPOSITE??[]).map(row=>[row.t,row])),bodyVolumeByTime,STEPS[$('interval').value],cache?.serverTime??0);
  writeSeries('COMPOSITE',series.COMPOSITE,compositeClusterRows,seriesContext+'|spy-body-clusters');
  const step=STEPS[$('interval').value];
  writeSeries('alignment',series.alignment,volumeDeltaBandData(spyVolumeDeltaRows,bodyVolumeByTime),seriesContext);
  oiBottomLayer?.update({bars:p,oiByTime:oiWidths,spyVByTime:bodyVolumeByTime,step,now:cache?Date.now()+serverOffsetMs:0,symbol:$('symbol').value,interval:$('interval').value,oiInterval:oiStamp,liveSample:currentOiLoader.error?null:currentOiLoader.sample});
  const oiBarsEnabled=$('oi-candle-bars-toggle')?.checked&&$('symbol').value==='SPYUSDT';
  oiBarState=oiCandleBars(p,spyVolumeDeltaRows,rows.COMPOSITE??[],oiWidths,step,cache?.serverTime??0,{filterPin:$('oi-candle-pin-toggle')?.checked??true,history:true,minOiMultiplier:1,oiPercentile:Number($('oi-delta-percentile')?.value??.62)});
  writeSeries('oiCandleBars',series.oiCandleBars,oiBarState.data,seriesContext+'|'+$('oi-candle-pin-toggle')?.checked);
  setOptions(series.oiCandleBars,{visible:oiBarsEnabled});
  const boldEnabled=$('oi-bold-candles-toggle')?.checked&&$('symbol').value==='SPYUSDT';
  const boldData=boldEnabled?priceData.filter(x=>oiBarState.points.get(x.time*1000)?.matched).map(x=>({...x,oiKind:oiBarState.points.get(x.time*1000).kind})):[];
  oiBoldCandles.setData(boldData);$('chart').dataset.oiBoldCandlesState=!boldEnabled?'off':oiBarState.gateReady?'ready':'WAIT';$('chart').dataset.oiBoldCandlesCount=String(boldData.length);$('chart').dataset.oiDownIncreaseCount=String(oiBarState.downOiIncrease??0);$('chart').dataset.oiCandleGroups=JSON.stringify(oiBarState.groups);$('chart').dataset.oiThresholdMethod='percentile';$('chart').dataset.oiThresholdPercentile=$('oi-delta-percentile')?.value??'0.62';
  $('chart').dataset.oiCandleBarsState=!oiBarsEnabled?'off':oiBarState.gateReady?'ready':'WAIT';
  $('chart').dataset.oiCandleBarsPane=String(series.oiCandleBars.getPane().paneIndex());
  $('chart').dataset.oiCandleBarsMatched=String(oiBarState.matched);$('chart').dataset.oiCandleBarsEligible=String(oiBarState.eligible);
  $('oi-candle-bars-status').textContent=$('symbol').value!=='SPYUSDT'?'?OI theo n?n � ch? SPY':!oiBarsEnabled?'?OI theo n?n':oiBarState.gateReady?`?OI theo n?n � ${oiBarState.matched}/${oiBarState.eligible} � l?ch s?`:oiBarState.eligible?'?OI � ch? n?n 10 n?n':'?OI theo n?n � WAIT';
  const oi8On=Boolean(strengthOi8Enabled());
  const oi8PivotsOn=$('oi8-pivot-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&step===900000;
  const oi8Points=(oi8On||oi8PivotsOn)&&oiStamp==='15m'&&cache?.interval==='15m'
    ?strengthOi8(cache.SPYUSDT??[],oiAppliedSamples,cache.serverTime):[];
  const oiPhaseOn=Boolean($('oi8-phase-reset-toggle')?.checked);
  const oiPhaseState=oi8On&&oiPhaseOn&&oiStamp==='15m'&&cache?.interval==='15m'
    ?strengthOiPhase(cache.SPYUSDT??[],oiAppliedSamples,bodyVolumeRows,cache.serverTime):{points:[],pending:null};
  const oiDisplayPoints=oiPhaseOn?oiPhaseState.points:oi8Points;
  writeSeries('strengthOi8',series.strengthOi8,oi8On?oiDisplayPoints.map(({time,value})=>Number.isFinite(value)?{time,value}:{time}):[],seriesContext+'|oi8|phase:'+oiPhaseOn);
  setOptions(series.strengthOi8,{topLineColor:oiPhaseOn?'transparent':'#70b7ff',bottomLineColor:oiPhaseOn?'transparent':'#f08aff',title:oiPhaseOn?'?OI8 pha':'?OI8'});
  oiPhaseLayer?.setData(oiPhaseState,oi8On&&oiPhaseOn);
  $('chart').dataset.oi8Mode=oiPhaseOn?'spy-body-phase':'continuous';
  $('chart').dataset.oi8PhasePending=String(Boolean(oiPhaseState.pending));
  const oiPhaseStatus=$('oi8-phase-status');
  if(oiPhaseStatus)oiPhaseStatus.textContent=oi8On&&oiPhaseOn&&oiPhaseState.pending?' � pha d? ki?n':'';
  const oi8Levels=oi8PivotsOn?oi8PivotLevels(p,oi8Points,cache?.serverTime??0):[];
  for(const [type,lines] of Object.entries(oi8PivotLines)){
    const levels=oi8Levels.filter(level=>level.type===type).slice(-lines.length).reverse();
    lines.forEach((line,i)=>{
      const level=levels[i];
      setOptions(line,{visible:Boolean(level),lineWidth:level?.aligned?2:1,
        lineStyle:level?.aligned?L.LineStyle.Solid:L.LineStyle.Dashed,
        title:(type==='low'?'HT':'KC')+' ?OI8'+(level?.aligned?' + NF':'')});
      writeSeries('oi8-pivot-'+type+i,line,level?[
        {time:level.start,value:level.level},
        {time:Math.max(level.start+900,p.at(-1).t/1000),value:level.level}
      ]:[],seriesContext+'|'+(level?.start??''));
    });
  }
  setOptions(series.strengthOi8,{visible:oi8On});
  const nfOn=nfSmoothEnabled(),nfWindow=Number($('nf-smooth-window')?.value??4);
  nfSmoothRows=nfOn?compositeNfSmooth(cache?.SPYUSDT??[],cache?.QQQUSDT??[],{now:cache?.serverTime??Date.now(),strLen:nfWindow}):[];
  nfSmoothMap=new Map(nfSmoothRows.map(x=>[x.t,x]));
  writeSeries('nfSmooth',series.nfSmooth,nfSmoothRows.map(x=>Number.isFinite(x.value)?{time:x.t/1000,value:x.value}:{time:x.t/1000}),seriesContext+'|c-nf-'+nfWindow);
  $('chart').dataset.nfSmoothSource='SPY+QQQ_TAKER_QUOTE';$('chart').dataset.nfSmoothWindow=String(nfWindow);$('chart').dataset.nfSmoothMode=nfOn?'closed-bars-self-adaptive':'off';
  writeSeries('spyBodyVolume',series.spyBodyVolume,lineData(bodyVolumeRows,'adjusted'),seriesContext);
  setOptions(series.spyBodyVolume,{visible:!!spyBodyVolumeEnabled()});
  const scoreLineEnabled=$('h1-score-line-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
  h1ScoreLineState=scoreLineEnabled?buildH1ScoreLine(h1ScoreRecords,{now:cache?.serverTime??Date.now()}):{points:[],preview:[],timeline:[],previewMeta:null};
  writeSeries('h1ScoreLine',series.h1ScoreLine,h1ScoreLineState.points,seriesContext+'|h1-score-direct');
  writeSeries('h1ScorePreview',series.h1ScorePreview,h1ScoreLineState.preview,seriesContext+'|h1-score-preview');
  $('chart').dataset.h1ScoreLineSource='H1_BOX_SCORE';$('chart').dataset.h1ScoreLinePreview=String(!!h1ScoreLineState.previewMeta);updateH1ScoreLineReadout(inspectedTime);
  let previousDay=null,previousSession=null;
  setMarkers(marks,p.flatMap(x=>{let text=null;if(x.session==='RTH'&&previousSession!=='RTH')text='RTH';else if(x.day!==previousDay)text=x.day.slice(5);previousDay=x.day;previousSession=x.session;return text?[{time:x.t/1000,position:'aboveBar',color:text==='RTH'?'#f8bc62':'#788ca5',shape:'circle',text}]:[];}));
  toggle();
  if(fit){if(!applySavedTimeRange(p))fitChart();}
  if(inspectedTime!==null&&!maps[$('symbol').value]?.has(inspectedTime))inspectedTime=null;
  showTooltip(inspectedTime??p.at(-1)?.t);
  requestAnimationFrame(updateCandleCountdown);
  scheduleCvdSpectrum();
  scheduleDaySeparators();
  scheduleGeometryOverlay();
  scheduleH1H4Strip();
  updateSpyUsdtSessionChange();
  $('export').disabled=!p.length;
  $('chart').dataset.renderMs=String(Math.round(performance.now()-renderStarted));
  if(p.length){$('chart').dataset.chartReady='true';requestAnimationFrame(()=>{$('chart').dataset.firstPaintMs??=String(Math.round(performance.now()));requestStudies();requestStats();});}
}
function statValue(id,text,color='neutral'){const node=$(id);node.textContent=text;node.className=color;}
function latestStrength(key){const data=rows[key]??[];for(let i=data.length-1;i>=0;i--)if(Number.isFinite(data[i].adjusted))return data[i].adjusted;return null;}
function paneBounds(index){
  const pane=chart?.panes?.()[index],host=$('chart'),element=pane?.getHTMLElement?.();
  if(!host||!element||!host.contains(element))return null;
  const hostRect=host.getBoundingClientRect(),rect=element.getBoundingClientRect();
  if(!Number.isFinite(rect.top)||!(rect.height>0))return null;
  return {top:rect.top-hostRect.top-(host.clientTop||0),height:rect.height};
}
function positionFixedPaneReadouts(){
  for(const index of [1,2]){
    const legend=$('pane-legend-'+index),bounds=paneBounds(index);if(!legend||!bounds)continue;
    legend.style.top=`${Math.round(bounds.top+(index===1?13:4))}px`;
    legend.style.right=`${(chart.priceScale('right',index)?.width?.()??64)+6}px`;
  }
  const compositeBounds=paneBounds(2);
  if(compositeBounds)$('composite-flow-fixed').style.top=`${Math.round(compositeBounds.top+6)}px`;
}
function latestFiniteValue(data,key){for(let i=data.length-1;i>=0;i--)if(Number.isFinite(data[i]?.[key]))return data[i][key];return null;}
function updateFixedPaneReadouts(){
  const compositeValue=latestFiniteValue(compositeClusterRows,'value'),compositeNode=$('composite-flow-fixed');compositeNode.textContent=`? C Taker NF ${fmtK(compositeValue)}`;compositeNode.className=`pane-fixed-readout ${Number.isFinite(compositeValue)?compositeValue>=0?'positive':'negative':'missing'}`;compositeNode.style.display=$('composite').checked?'block':'none';
  compositeNode.title=[
    '? C Taker NF � c?ng d?n NF c� d?u trong t?ng c?m m�u SPY V th�n n?n.',
    'M?i m?: NF = taker buy quote ? taker sell quote = 2 � taker buy quote ? t?ng quote volume. C Taker NF = NF(SPY) + NF(QQQ).',
    '��n v? USDT; K = ngh?n, M = tri?u. D��ng: t?ng mua ch? �?ng tr?i trong c?m; �m: t?ng b�n ch? �?ng tr?i. M�u c?t theo d?u t?ng NF: d��ng xanh, �m �?, b?ng 0 x�m.',
    '�?i m�u SPY V ho?c thi?u d? li?u th? b?t �?u l?i. C?p nh?t c? n?n live kho?ng 3 gi�y; lu�n t�nh l?i t? d? li?u �? kh�ng c?ng tr�ng. Kh�ng ph?i d?ng ti?n r?ng v�o/ra th? tr�?ng v� kh�ng x�c �?nh ch?c m?/��ng Long�Short.'
  ].join('\n');
  requestAnimationFrame(positionFixedPaneReadouts);
}
function updatePivotZones(){
  const enabled=$('pivot-zones').checked,node=$('pivot-zone-readout');
  const symbol=$('symbol').value,interval=$('interval').value,key=symbol+'|'+interval;
  const accumulation=symbol==='SPYUSDT'&&interval==='15m'?h1AccumulatedStops({price:cache?.SPYUSDT??[],records:h1ScoreLayer?.getLineScores()??[],now:cache?.serverTime??Date.now()}):{zones:[]};
  const zones=enabled?[...accumulation.zones]:[];
  const actions=document.querySelector('.chart-actions');
  if(actions&&node.parentElement!==actions)actions.append(node);
  node.hidden=!enabled;
  node.setAttribute('aria-hidden',String(!enabled));node.replaceChildren();
  for(const [kind,prefix,label] of [['resistance','pivotResistance','SL SELL'],['support','pivotSupport','SL BUY']]){
    const lockKey=key+'|'+kind,locked=lockedStops.get(lockKey);
    const zone=enabled?(locked??accumulation[kind]??pivotZoneState[kind]):null;
    const line=series[prefix+'Mid'];if(!line)continue;
    const current=cache?.[symbol]?.at(-1)?.c;
    const distance=zone&&current>0?100*Math.abs(current-zone.level)/current:null;
    setOptions(line,{lineWidth:2,lineStyle:L.LineStyle.Solid,title:label+(locked?' � KH�A':'')});
    writeSeries(prefix+'Mid',line,zone?[
      {time:zone.start/1000,value:zone.level},
      {time:Math.max(zone.start+STEPS[interval],cache?.[symbol]?.at(-1)?.t??zone.end)/1000,value:zone.level}
    ]:[],String(enabled)+'|'+lockKey+'|'+Boolean(locked));
    if(zone&&!zones.includes(zone))zones.push(zone);
    const button=document.createElement('button');button.type='button';button.disabled=!zone;
    button.dataset.side=kind;
    button.dataset.locked=String(Boolean(locked));
    button.textContent=zone?label+' '+zone.level.toFixed(2):label+' �';
    button.title=zone?(zone.source==='H1'?zone.boxes+' h?p H1 c�ng d?u � T?ng |�i?m| '+zone.points+' � '+(zone.missing?'Thi?u OI: h?p n�y t�nh 75% �i?m':'�? th�nh ph?n'):'V�ng pivot g?c � �i?m '+zone.score+'/100 � '+(zone.oiReady?'�? OI':'Thi?u OI'))+' � C�ch gi� '+distance?.toFixed(2)+'% � SL tham kh?o, kh�ng ph?i l�?ng stop tr�n s�n. Kh�a trong phi�n m? trang.':'Ch? v�ng H1 t�ch l?y ho?c pivot �? m?nh';
    if(zone){button.setAttribute('aria-label',button.textContent+(locked?' � M? kh�a':' � Kh�a'));button.setAttribute('aria-pressed',String(Boolean(locked)));}
    button.onclick=()=>{if(locked)lockedStops.delete(lockKey);else lockedStops.set(lockKey,{...zone});updatePivotZones();};node.append(button);
  }
  $('chart').dataset.slH1Zones=String(accumulation.zones.length);
  stopLossBands.setData(zones);
}

function h1ScoreLineText(asOf){
  const r=h1ScoreLineReading(h1ScoreLineState,asOf);if(!r)return '';
  return r.score===null?'�i?m H1 � thi?u d? li?u':`H1 g?c ${signed(r.score)} � m�?t ${signed(r.smoothed)}${r.preview?' � T?M 3/4':' � �? KH�A'}`;
}
function updateH1ScoreLineReadout(t){
  const node=$('h1-score-line-readout');if(!node)return;
  const enabled=$('h1-score-line-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m';
  const bar=maps.SPYUSDT?.get(t),asOf=Math.min(cache?.serverTime??Date.now(),bar?.end!==undefined?bar.end+1:t??0),text=enabled&&t!==null?h1ScoreLineText(asOf):'';
  node.hidden=!text;node.style.display=text?'block':'none';node.textContent=text;
}
function updateNfSmoothReadout(t=null){
  const node=$('nf-smooth-readout');if(!node)return;
  const on=nfSmoothEnabled(),now=cache?.serverTime??Date.now(),r=t===null?nfSmoothRows.findLast(x=>x.knownAt<=now):nfSmoothMap.get(t),value=r?.value;
  node.hidden=!on;node.style.display=on?'block':'none';
  node.textContent='C NF'+($('nf-smooth-window')?.value??'4')+' '+(Number.isFinite(value)?signed(value):r?.reason==='forming_excluded'?'ch? ��ng':'ch? n?n');
  node.className='pane-fixed-readout '+(Number.isFinite(value)?value>=0?'positive':'negative':'missing');
  node.title='C Taker NF m�?t: NF th?t SPY + QQQ / SMA20(t?ng quote volume), c?ng '+($('nf-smooth-window')?.value??'4')+' M15 ? EWMA t? th�ch ?ng ?=0,18�0,60 ? chu?n h�a �?i x?ng ?1�+1 b?ng n?n 500 �i?m. Ch? n?n ��ng c� �? hai m?; kh�ng l?c theo th�n gi�, H1 hay OI v� kh�ng d?ch t�m theo phi�n. ��y l� ch? s? kh�ng ��n v?, kh�ng ph?i NF USDT c?a ri�ng n?n m?i nh?t. '+(r?'Tr?ng th�i: '+r.reason+(Number.isFinite(r.alpha)?' � ?='+r.alpha.toFixed(3):''):'Ch�a c� d? li?u.');
}
function showTooltip(t){
  updateNfSmoothReadout(inspectedTime);
  updateH1ScoreLineReadout(inspectedTime);
  const p=maps[$('symbol').value]?.get(t),record=statsMap.get(t),state=record?.state,colorSignal=candleColorMap.get(t),clusterSignal=candleClusterMap.get(t),geometryEvent=geometryState.events?.find(event=>event.at===t);
  const time=p?new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York'})+' ET':'Ch�a c� d? li?u';
  const h1Text=$('h1-score-line-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m'?h1ScoreLineText(Math.min(cache?.serverTime??Date.now(),p?.end!==undefined?p.end+1:t)):'';
  const running=isChartLive()&&p&&p.end>=(cache?.serverTime??Infinity),mode=inspectedTime!==null?'N?N �ANG XEM':'M?I NH?T';
  if(!state){
    for(const id of ['stat-group','stat-score','stat-pair'])statValue(id,'�');
    for(const id of ['stat-group-note','stat-score-note','stat-pair-note'])$(id).textContent='Ch? �? Strength v� quote volume c?a SPY/QQQ';
    $('tooltip').textContent=`${mode} � ${time} � Ch�a �? d? li?u �? ch?m �i?m v� th?ng k� nh�m Strength.${h1Text?' � '+h1Text:''}`;return;
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
  const displayedColorText=colorText;
  const text=[`${mode} � ${time} � ${state.session} � Gi� ${sourceName($('symbol').value)}, Strength ph�n t�ch ${sourceName($('signal').value)}${running?' � N?n �ang ch?y: �i?m t?m th?i, l?ch s? so s�nh d�ng n?n ��ng':''}`,
    h1Text,
    $('phase-width').checked?(()=>{const x=wlrThicknessMap.get(t);if(x?.model==='h1-box-score')return wlrH1StyleText(x);if(x?.tone)return `�? d�y WLR ${fmt(x.width)}/8 � d?c/? EWMA ${fmt(x.smoothed)} � ${x.tone} � m� t? s?c m?nh hi?n t?i, kh�ng ph?i x�c su?t th?ng.`;return x?.ready?`�? d�y WLR ${fmt(x.width)}/${WLR_SLOPE_DEFAULTS.maxWidth} � trend 61% / V�C 39% � |d?c|�13/ATR14 ${fmt(x.normalizedSlope)}, R� ${fmt(x.r2)} � �?ng thu?n d?ng ti?n ${fmt(x.flowQuality)}${x.flowReady?'':' (thi?u Strength)'} � ?13/ATR14 ${fmt(x.atr>0?x.sigma/x.atr:0)} � h? s? gi?m nhi?u ${fmt(x.noisePenalty)}.`:`�? d�y WLR: ch? �? 14 n?n tr�?c �? ��ng (${x?.pairs??0} n?n).`;})():null,
    (()=>{const x=wlrColorMap.get(t);if(x?.model==='h1-box-score')return $('phase-width').checked?null:wlrH1StyleText(x);if(x?.tone)return `M�u WLR kh�a m?m: ${{early:'NH?P S?M � NH?T, N�T M?NG, CH�A X�C NH?N',confirmed:'�?NG THU?N �?M',weak:'CH�A X�C NH?N � NH?T',conflict:'XUNG �?T � V�NG CAM',neutral:'TRUNG T�NH � X�M'}[x.tone]} � d?c/? EWMA ${fmt(x.smoothed)}${x.early?` � d?c gi� 4/? ${fmt(x.priceScore)} � c?m 2/3 th�n n?n c�ng ph�a WLR`:``} � Composite ${fmt(x.referenceComposite)} � SPY V ${fmt(x.referenceVolume)}${x.pendingCount?' � �ang ch? n?n th? hai x�c nh?n s?c �?':''}${x.closed?' � n?n �? ��ng':' � gi? m�u n?n ��ng tr�?c'}.`;return x?`M�u WLR ${x.direction>0?'XANH':x.direction<0?'�?':'V�NG TRUNG T�NH'} theo Composite ${Number.isFinite(x.referenceComposite)?x.referenceComposite.toFixed(3):'�'} � SPY V ${Number.isFinite(x.referenceVolume)?x.referenceVolume.toFixed(3):'�'} � v�o �0,15 / tho�t �0,07${x.closed?' � �? x�c nh?n khi ��ng n?n':' � gi? m�u n?n ��ng tr�?c, ch�a d�ng Strength n?n �ang ch?y'}. M�u th? hi?n d?ng ti?n, kh�ng ph?i d?u �? d?c gi�.`:null;})(),
    geometryEvent?`D? bi?t ��?c x�c nh?n t?i n?n n�y: ${geometryEvent.direction==='bullish'?'ph�n k? t�ng':geometryEvent.direction==='bearish'?'ph�n k? gi?m':'SPY/QQQ lu�n phi�n d?n d?t'} � �i?m ${geometryEvent.score}/100 � ?Strength SPY ${signed(geometryEvent.spyDelta)} / QQQ ${signed(geometryEvent.qqqDelta)} / SPY V ${signed(geometryEvent.volumeDelta)} � ?NetFlow ${signed(geometryEvent.flowDelta)}${geometryEvent.pairSplit?` � Strength SPY v� QQQ ng�?c nhau, gi� �ang g?n nh?p ${geometryEvent.leader==='SPY'?'SPY':geometryEvent.leader==='QQQ'?'QQQ':'h?n h?p'}`:''}. ��y l� m� t? h?p l�u t?i th?i �i?m x�c nh?n, kh�ng ph?i d? b�o ch?c ch?n.`:null,
    displayedColorText,
    $('oi-candle-bars-toggle')?.checked&&$('symbol').value==='SPYUSDT'?(()=>{const x=oiBarState.points.get(t);return x?`?OI theo n?n ${signed(x.delta)} � SPY V ${signed(x.spyV)} � C Taker NF ${signed(x.net)} � ${OI_GROUP_LABELS[x.kind]??'kh�ng �? �?ng thu?n'}${x.pinAdjusted?' � pin bar ph?n �?i chi?u th�n':''} � ${x.gateReady?`|?OI| ${fmt(Math.abs(x.delta))} / ng�?ng P${Math.round(x.percentile*100)} ${fmt(x.threshold)}: ${x.gatePassed?'V�?T NG�?NG':'CH�A V�?T NG�?NG'}`:'CH? �? 10 ?OI N?N'}. Chi?u cao c?t = |?OI|; c?t xanh khi gi� t�ng, �? khi gi� gi?m. Th�n n?n: OI t�ng �?m kh�ng vi?n, OI gi?m c� vi?n kem; OI gi?m l� gi?m t?ng v? th? m?.`:'?OI theo n?n: c?n n?n ��ng v� hai m?u OI li�n ti?p trong l?ch s? �? t?i.';})():null,
    `�i?m x�c nh?n ${state.score??'�'}/100 = Taker ${fmt(state.taker)}/50 + D?i ${fmt(state.pair)}/30 + |Strength| ${fmt(state.strength)}/20. �i?m theo quy t?c, kh�ng ph?i x�c su?t th?ng.`];
  const nodes=text.filter(Boolean).map(value=>{const div=document.createElement('div');div.textContent=value;return div;});
  $('tooltip').replaceChildren(...nodes);
}
function toggle(){
  setOptions(series.nfSmooth,{visible:!!nfSmoothEnabled()});updateNfSmoothReadout(inspectedTime);
  strengthBoxLayer?.update();
  scheduleAbaBandColors();
  for(const key of ['h1ScoreLine','h1ScorePreview'])setOptions(series[key],{visible:!!$('h1-score-line-toggle')?.checked&&$('symbol').value==='SPYUSDT'&&$('interval').value==='15m'});
  updateH1ScoreLineReadout(inspectedTime);
  setOptions(series.COMPOSITE,{visible:$('composite').checked});
  $('cvd-spectrum').style.display=$('cvd-spectrum-toggle').checked?'block':'none';scheduleCvdSpectrum();
  $('day-separators').style.display=$('markers').checked?'block':'none';scheduleDaySeparators();
  $('geometry-overlay').style.display=$('causal-trend-channel').checked||$('geometry-pivots').checked?'block':'none';scheduleGeometryOverlay();updateH1TrendAgeReadout();
  setOptions(series.alignment,{visible:$('alignment').checked});
  for(const key of ['priceMid','priceUpper','priceLower'])setOptions(series[key],{visible:$('price-bands').checked});
  updatePivotZones();
  updateFixedPaneReadouts();
  setOptions(marks,{visible:$('markers').checked});
}
function showStartupPreview(data){
 const bars=data[$('symbol').value]??[];if(!bars.length)return;
 priceStyleLayer?.update(bars,$('symbol').value==='SPYUSDT'?{type:'price',precision:1,minMove:.1}:{type:'price',precision:2,minMove:.01},`startup|${data.interval}`);
 const previewCandles=bars.map(x=>({time:x.t/1000,open:x.o,high:x.h,low:x.l,close:x.c}));
 writeSeries('price',price,priceStyleLayer?.candleData(previewCandles)??previewCandles,`startup|${data.interval}|${priceStyleLayer?.isLine()}`);
 const last=bars.at(-1).t,first=bars.find(x=>x.t>=last-FIT_WINDOW_MS)?.t??bars[0].t;
 chart.timeScale().setVisibleRange({from:first/1000,to:last/1000});
 $('chart').dataset.startupPhase='preview';
 $('live-indicator').textContent='? �ANG T?I L?CH S?';
 requestAnimationFrame(()=>{$('chart').dataset.firstPricePaintMs??=String(Math.round(performance.now()));});
}
function acceptChartData(data,fit,live){
 const step=STEPS[data.interval];
 if(oiStamp!==data.interval)void refreshOiWidths(data.interval);
 rows={SPYUSDT:analyze(data.SPYUSDT,step),QQQUSDT:analyze(data.QQQUSDT,step),COMPOSITE:analyze(composite(data.SPYUSDT,data.QQQUSDT,step),step)};
 volumeStrengthRows=analyze(data.SPYUSDT,step,{strength:calculateVolumeStrength(data.SPYUSDT,step)});
 spyVolumeDeltaRows=directionalVolumeDelta(rows.SPYUSDT,step);
  volumeStrengthMap=new Map(volumeStrengthRows.map(r=>[r.t,r]));
 maps=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,new Map(v.map(x=>[x.t,x]))]));
 cache=data;
 if(oiWidthClock!==Math.floor(data.serverTime/step)){oiWidths=oiWidthByBar(oiAppliedSamples,step,data.serverTime);oiWidthClock=Math.floor(data.serverTime/step);}
 chartLiveResponse=Boolean(live&&!data.historical&&!data.partial);serverOffsetMs=data.serverTime-Date.now();lastSuccess=chartLiveResponse?new Date():null;restoreH1Colors(data);render(fit);setLive();
 void refreshOiWidths(data.interval,data.serverTime);
 $('chart').dataset.startupPhase='ready';$('chart').setAttribute('aria-busy','false');
}
async function refresh(clear=false){
  controller?.abort();controller=new AbortController();const gen=++generation;
  loading=true;$('refresh').disabled=true;
  void refreshOiWidths($('interval').value);
 if(clear){resetStudies();cache=null;chartLiveResponse=false;rows={};volumeStrengthRows=[];spyVolumeDeltaRows=[];volumeStrengthMap=new Map();maps={};lastSuccess=null;inspectedTime=null;pivotZoneKey='';pivotZoneState={ready:false,reason:'history',support:null,resistance:null};render(true);}
  const interval=$('interval').value,days=+$('days').value;
  if(!cache){$('chart').dataset.startupPhase='loading';$('chart').setAttribute('aria-busy','true');}
  status(`�ang x�c minh SPYUSDT/QQQUSDT v� t?i ${interval} � ${days} ng�y�`);
  try{
    const data=await load(interval,days,{signal:controller.signal,previous:cache,previewSymbol:$('symbol').value,onPreview:data=>{if(gen===generation&&!cache)showStartupPreview(data);}});if(gen!==generation)return;
    acceptChartData(data,clear,true);
    const modelText=interval==='15m'?' � Nghi�n c?u l?ch s? ch?y n?n':'';
    status(`SPYUSDT + QQQUSDT � TRADING / ${data.contracts.map(x=>x.contractType).join(' + ')} � ${rows.SPYUSDT.length}/${rows.QQQUSDT.length} n?n, g?m n?n �ang ch?y � ${rows.COMPOSITE.length} timestamp chung${modelText} � ${data.incremental?'c?p nh?t realtime ~3 gi�y':'t?i l?ch s? song song'} � c?p nh?t ${lastSuccess.toLocaleTimeString('vi-VN')} � ${rows.COMPOSITE.length?'D? li?u th?t Binance':'Composite ch�a c� d? li?u giao nhau'}`);
  }catch(e){
    if(gen!==generation)return;
    chartLiveResponse=false;
    if(!cache){render(true);$('chart').dataset.startupPhase='error';$('chart').setAttribute('aria-busy','false');}
    if(!cache&&interval==='15m'){
     try{const historical=await chartHistoryFallback({interval,days,signal:controller.signal});if(gen!==generation)return;acceptChartData(historical,true,false);}
     catch(historyError){if(gen!==generation)return;$('chart').dataset.historyFallbackError=historyError.message;}
    }
    setLive();updateH1OiReadout();status(`${e.message}. C� th? b? CORS, v�ng truy c?p, m?t m?ng ho?c rate limit. ${cache?(cache.historical?'�ang hi?n th? l?ch s? �? l�u, kh�ng ph?i d? li?u live.':`D? li?u c? ch�a c?p nh?t${lastSuccess?` (l?n th�nh c�ng ${lastSuccess.toLocaleTimeString('vi-VN')})`:''}.`):'Kh�ng c� d? li?u thay th?; bi?u �? �? tr?ng.'} D�ng T?i l?i sau khi ki?m tra k?t n?i.`,true);
  }finally{if(gen===generation){loading=false;$('refresh').disabled=false;}}
}
function exportCSV(){
  const source=$('signal').value,data=rows[source]??[];
  const keys=['t','session','v','q','buy','sell','net','nf','raw','adjusted','mid','upper','lower','confidence'];
  const csv=[keys.join(','),...data.map(x=>keys.map(k=>x[k]??'').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${source}-${$('interval').value}-quote-netflow.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fitChart(windowMs=FIT_WINDOW_MS){
  for(let pane=0;pane<3;pane++)chart.priceScale('right',pane).applyOptions({autoScale:true});series.alignment.priceScale().applyOptions({autoScale:true});series.COMPOSITE.priceScale().applyOptions({autoScale:true});
  const data=rows[$('symbol').value]??[],host=$('chart');
  if(data.length){
    const lastIndex=data.length-1,lastTime=data[lastIndex].t,cutoff=lastTime-windowMs,firstIndex=Math.max(0,data.findIndex(bar=>bar.t>=cutoff));
    const rightPadding=Math.max(0,Math.min(6,Math.max(2,Math.round((lastIndex-firstIndex+1)*.04))));
    chart.timeScale().setVisibleLogicalRange({from:firstIndex-.5,to:lastIndex+rightPadding});host.dataset.fitWindowHours=String(windowMs/3600000);host.dataset.fitStart=String(data[firstIndex].t);host.dataset.fitEnd=String(lastTime);
  }else{chart.timeScale().fitContent();delete host.dataset.fitWindowHours;delete host.dataset.fitStart;delete host.dataset.fitEnd;}
  scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();
}
function isFullChart(){const card=document.querySelector('.chart-card');return document.fullscreenElement===card||card.classList.contains('fullscreen-fallback');}
function syncFullChart(){const active=isFullChart();$('fullscreen').textContent=active?'? Thu nh?':'? Full chart';$('fullscreen').setAttribute('aria-pressed',String(active));document.body.classList.toggle('chart-fullscreen',active);if(active&&$('chart-settings'))$('chart-settings').open=false;applyResponsiveChartOptions();setTimeout(()=>{window.dispatchEvent(new Event('resize'));scheduleCvdSpectrum();scheduleDaySeparators();scheduleGeometryOverlay();},50);}
async function toggleFullChart(){
  const card=document.querySelector('.chart-card');
  if(document.fullscreenElement===card){await document.exitFullscreen();return;}
  if(card.classList.contains('fullscreen-fallback')){card.classList.remove('fullscreen-fallback');syncFullChart();return;}
  // A user gesture can request native fullscreen; automatic entry uses viewport layout.
  try{if(!card.requestFullscreen)throw Error('Fullscreen API unavailable');await card.requestFullscreen({navigationUI:'hide'});}catch{card.classList.add('fullscreen-fallback');syncFullChart();}
}
function bindChartGestures(){
  const host=$('chart'),activeTouches=new Set();let start=null,lastTap=null,multiTouch=false,lastTouchToggle=-Infinity;
  const canToggle=()=>isFullChart()||$('double-tap-full').checked;
  const toggle=()=>{if(canToggle())void toggleFullChart();};
  host.addEventListener('dblclick',event=>{if(performance.now()-lastTouchToggle<700||!canToggle())return;event.preventDefault();toggle();},{capture:true});
  host.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')return;activeTouches.add(event.pointerId);if(activeTouches.size>1){multiTouch=true;start=null;lastTap=null;return;}start={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};},{capture:true});
  host.addEventListener('pointermove',event=>{if(event.pointerType!=='touch'||!start||start.id!==event.pointerId)return;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>TAP_MOVE_TOLERANCE)start.moved=true;},{capture:true});
  const finish=event=>{
    if(event.pointerType!=='touch')return;activeTouches.delete(event.pointerId);
    if(multiTouch){if(!activeTouches.size){multiTouch=false;start=null;lastTap=null;}return;}
    if(!start||start.id!==event.pointerId||start.moved){start=null;lastTap=null;return;}
    const tap={time:performance.now(),x:event.clientX,y:event.clientY};start=null;
    if(lastTap&&tap.time-lastTap.time<=DOUBLE_TAP_MS&&Math.hypot(tap.x-lastTap.x,tap.y-lastTap.y)<=DOUBLE_TAP_DISTANCE){lastTap=null;event.preventDefault();lastTouchToggle=tap.time;toggle();}else lastTap=tap;
  };
  host.addEventListener('pointerup',finish,{capture:true});host.addEventListener('pointercancel',event=>{if(event.pointerType==='touch'){activeTouches.delete(event.pointerId);start=null;lastTap=null;if(!activeTouches.size)multiTouch=false;}},{capture:true});
}
if(init()){
  mountGptPattern({chart,getState:()=>{
    const symbol=$('symbol').value,interval=$('interval').value,spyBars=rows.SPYUSDT??[],delta=interval==='15m'?spyVolumeDeltaRows:[];
    const spyOi=interval==='15m'?oiCandleBars(spyBars,delta,rows.COMPOSITE??[],oiWidths,STEPS['15m'],cache?.serverTime??0,{filterPin:$('oi-candle-pin-toggle')?.checked??true,history:true,minOiMultiplier:1,oiPercentile:Number($('oi-delta-percentile')?.value??.62)}):{points:new Map()};
    return {symbol,interval,bars:cache?.[symbol]??[],live:isChartLive(),indicatorContext:{spyBars,spyVolumeRows:displayVolumeStrengthRows.length?displayVolumeStrengthRows:volumeStrengthRows,spyVolumeSource:$('chart').dataset.wlrVolumeSource??'unknown',volumeDeltaRows:delta,compositeRows:rows.COMPOSITE??[],oiByTime:oiStamp===interval?oiWidths:new Map(),oiPoints:spyOi.points,comparison:spectrumComparison,spectrumGroup:level=>{const group=spectrumPriceGroup(spectrumComparison,level);return {group,confirmation:confirmSpectrumGroup(group,spectrumComparison,spyBars,spyOi.points)};}}};
  }});
  
  setupChartActions();
  const actions=document.querySelector('.chart-actions'),shareButton=$('gpt-pattern-button');
  actions.prepend($('fullscreen'),$('live-indicator'),$('spyusdt-session-change'),$('chart-frame-switch'));
  if(shareButton)actions.append(shareButton);
  const chartCard=document.querySelector('.chart-card');
  const indicatorTools=document.createElement('section');indicatorTools.id='chart-indicator-tools';indicatorTools.className='chart-options chart-indicator-tools';indicatorTools.setAttribute('aria-label','�i?u khi?n h?p s?c m?nh v� ph�n v?');($('chart-settings-panel')??chartCard.parentElement).append(indicatorTools);
  const chartNotes=document.createElement('details');chartNotes.id='chart-notes';const notesSummary=document.createElement('summary');notesSummary.textContent='Gi?i th�ch v� tr?ng th�i ch? b�o';chartNotes.append(notesSummary);chartCard.after(chartNotes);
  for(const node of chartCard.querySelectorAll('#tooltip,.hint'))chartNotes.append(node);
  strengthBoxLayer=createStrengthBoxLayer({chart,host:$('chart'),actions:indicatorTools,getContext:()=>({rows:rows[$('symbol').value]??[],symbol:$('symbol').value,interval:$('interval').value,step:STEPS[$('interval').value],now:cache?.serverTime??0,price,composite:maps.COMPOSITE??new Map(),compositeRevision:studyResultKey,volume:volumeStrengthMap,channels:studyResultKey===studyKey&&$('causal-trend-channel').checked?(causalChannelState.trends??[]).filter(c=>!c.provisional):[]}),onChange:()=>{}});
  const h1OiMarkerLabel=document.createElement('label'),h1OiMarkerToggle=document.createElement('input');
  h1OiMarkerToggle.id='h1-oi-markers-toggle';h1OiMarkerToggle.type='checkbox';h1OiMarkerToggle.checked=true;
  h1OiMarkerLabel.title='SPY M15 � H1 �? kh�a. V? t? 4/5 �i?m: 2 �i?m khi |?OI| v�?t P75 c?a 36 h?p tr�?c, 1 �i?m khi OI r?ng chi?m �t nh?t 60% t?ng dao �?ng, 1 �i?m khi �i?m n?n H1 (kh�ng OI) c� �? l?n ?2 v� c�ng m�u h?p, th�m 1 �i?m n?u ?3/4 M15 c� ?OI c�ng d?u. ? OI t�ng, ? OI gi?m. Tam gi�c �?c khi Taker NF SPY c�ng m�u h?p.';
  h1OiMarkerLabel.append(h1OiMarkerToggle,'Tam gi�c OI � H1');$('cvd-spectrum-toggle').closest('label').after(h1OiMarkerLabel);
  h1OiMarkerToggle.onchange=()=>render(false);
  const oiBarLabel=document.createElement('label'),oiBarToggle=document.createElement('input'),oiBarStatus=document.createElement('span');
  oiBarToggle.id='oi-candle-bars-toggle';oiBarToggle.type='checkbox';oiBarToggle.checked=true;oiBarStatus.id='oi-candle-bars-status';oiBarStatus.textContent='?OI theo n?n � WAIT';
  oiBarLabel.title='C?t s�t ��y pane SPY V, cao theo |?OI|: th�n n?n, SPY V v� C Taker NF ph?i c�ng h�?ng; chia th�nh 4 nh�m t�ng/gi?m � OI t�ng/gi?m. C?t xanh khi gi� t�ng, �? khi gi� gi?m, �?c l?p d?u ?OI; m�u th�n n?n tr�n chart v?n ph�n bi?t b?n nh�m. Ph?i v�?t ng�?ng ?OI �? ch?n. C Taker NF d�ng d?u, ch�a �?t ng�?ng �? m?nh. N?n ��ng, OI li�n ti?p, l?ch s? l�u t?i �a 90 ng�y tr�n tr?nh duy?t; thi?u OI �? tr?ng.';oiBarLabel.append(oiBarToggle,oiBarStatus);h1OiMarkerLabel.after(oiBarLabel);
  const pinLabel=document.createElement('label'),pinToggle=document.createElement('input');pinToggle.id='oi-candle-pin-toggle';pinToggle.type='checkbox';pinToggle.checked=true;pinLabel.title='Th�n ?35% bi�n �?, r�u ch�nh ?60% v� �t nh?t g?p ��i r�u c?n l?i: h�?ng t? ch?i gi� theo r�u. Pin ng�?c th�n b? lo?i v? kh�ng �?ng d?u SPY V th?c t?; kh�ng �?i histogram hay m�u n?n.';pinLabel.append(pinToggle,'L?c pin bar ?OI');oiBarLabel.after(pinLabel);
  oiBarToggle.onchange=pinToggle.onchange=()=>render(false);
  const gateLabel=document.createElement('label'),gateSelect=document.createElement('select');gateSelect.id='oi-delta-percentile';gateSelect.setAttribute('aria-label','Ng�?ng ?OI');
  for(const [value,text] of [['0.60','P60 � 10 n?n'],['0.62','P62 � 10 n?n'],['0.70','P70 � 10 n?n'],['0.80','P80 � 10 n?n']]){const option=document.createElement('option');option.value=value;option.textContent=text;gateSelect.append(option);}
  gateSelect.value='0.62';
  gateLabel.title='Ch? ��nh d?u th�n n?n v� v? c?t khi |?OI| l?n h�n ph�n v? �? ch?n c?a |?OI| ? ��ng 10 n?n ��ng li?n tr�?c. M?c �?nh P62, n?i suy tuy?n t�nh. Kh�ng t�nh n?n hi?n t?i v�o n?n; thi?u d? li?u ho?c �?t chu?i th? ch? �? n?n. �p d?ng c? l?ch s?; ph? ?OI theo gi� v?n t�nh nh� c?.';gateLabel.append('Ng�?ng ?OI > ',gateSelect);pinLabel.after(gateLabel);gateSelect.onchange=()=>render(false);
  const boldLabel=document.createElement('label'),boldToggle=document.createElement('input');boldToggle.id='oi-bold-candles-toggle';boldToggle.type='checkbox';boldToggle.checked=true;boldLabel.title='N?n �?ng thu?n OI: th�n r?ng kho?ng 1,5 l?n, gi?i h?n 94% b�?c n?n. Gi� t�ng + mua ch? �?ng + OI t�ng: xanh �?m #1243be kh�ng vi?n. Gi� gi?m + b�n ch? �?ng + OI t�ng: t�m �?m #5b21b6 kh�ng vi?n. Gi� t�ng + mua ch? �?ng + OI gi?m: xanh #1351ee vi?n kem. Gi� gi?m + b�n ch? �?ng + OI gi?m: t�m #8b5cf6 vi?n kem. M�u 4 nh�m �u ti�n h�n H1/H4; ch? n?n ��ng v�?t ng�?ng ?OI. C� kh�i ph?c l?ch s?; �?c l?p n�t hi?n d?i ?OI.';boldLabel.append(boldToggle,'N?n �?ng thu?n OI �?m');gateLabel.after(boldLabel);boldToggle.onchange=()=>render(false);
  const spyBodyLabel=document.createElement('label'),spyBodyToggle=document.createElement('input');
  spyBodyToggle.id='spy-volume-body-toggle';spyBodyToggle.type='checkbox';spyBodyToggle.checked=true;
  spyBodyLabel.title='N�t li?n trong pane SPY V tr�n SPY M15, v�ng khi tr�n 0 v� tr?ng khi d�?i 0. Thay volume b?ng |Close ? Open|, gi? d?u theo h�?ng th�n n?n v� ngu?n H1 �ang d�ng cho m�u n?n, �?O V?.';
  spyBodyLabel.append(spyBodyToggle,'SPY V th�n n?n � EWMA c? �?nh');$('alignment').closest('label').after(spyBodyLabel);
  spyBodyToggle.onchange=()=>render(false);
  const daoV2Label=document.createElement('label'),daoV2Toggle=document.createElement('input');
  daoV2Toggle.id='dao-v2-toggle';daoV2Toggle.type='checkbox';daoV2Toggle.checked=true;
  daoV2Label.title='�?O V?: t?m nghi?m �?o d?u th?t sau hai M15 theo ��?ng gi� li�n t?c t? Close. N?n �? ph?i v�?t High, xanh ph?i v�?t Low. Th? t? l? hai th�n 25/75, 50/50 v� 75/25, gi? nghi?m g?n nh?t. Bi�n t?m theo P85 dao �?ng hai n?n qu� kh?, t?i �a 3 ATR; kh�ng c� nghi?m g?n th? ng?t n�t, kh�ng �p gi�. Ch? d�ng H1 �? bi?t. M?c tr�n v�ng, m?c d�?i xanh lam; n?n live d�ng v?ng r?ng v� n�t ng?n.';
  daoV2Label.append(daoV2Toggle,'�?O V?');spyBodyLabel.after(daoV2Label);
  daoV2Toggle.onchange=()=>render(false);
  const nfLabel=document.createElement('label'),nfInput=document.createElement('input'),nfWindow=document.createElement('select');
  nfInput.id='nf-smooth-toggle';nfInput.type='checkbox';nfInput.checked=true;nfWindow.id='nf-smooth-window';
  for(const n of [4,8]){const option=document.createElement('option');option.value=String(n);option.textContent=n+' M15';nfWindow.append(option);}
  nfLabel.append(nfInput,'C Taker NF m�?t � th? ',nfWindow);nfLabel.title='Line trong pane SPY tr�n SPY M15: NF SPY + QQQ th?t, chu?n h�a SMA20, c?ng 4/8 n?n, EWMA t? th�ch ?ng, n?n 500. Ch? n?n ��ng; thi?u c?p th? ng?t. Histogram NF t�ch l?y theo c?m m�u SPY V th�n n?n �? �?i chi?u.';spyBodyLabel.after(nfLabel);
  nfInput.onchange=()=>render(false);nfWindow.onchange=()=>render(false);
  const oi8Label=document.createElement('label'),oi8Toggle=document.createElement('input');
  oi8Toggle.id='strength-oi8-toggle';oi8Toggle.type='checkbox';oi8Toggle.checked=true;
  oi8Label.title='SPYUSDT M15 �? ��ng � Xanh lam s�ng: OI m? r?ng � T�m h?ng s�ng: OI thu h?p';
  oi8Label.append(oi8Toggle,'Strength ?OI8');nfLabel.after(oi8Label);
  oi8Toggle.onchange=()=>render(false);
  const oiPhaseLabel=document.createElement('label'),oiPhaseToggle=document.createElement('input'),oiPhaseStatus=document.createElement('small');
  oiPhaseToggle.id='oi8-phase-reset-toggle';oiPhaseToggle.type='checkbox';oiPhaseToggle.checked=true;
  oiPhaseStatus.id='oi8-phase-status';
  oiPhaseLabel.title='Reset t�ch l?y v� l�m m�?t ?OI8 khi SPY V th�n n?n �?i d?u tr�n n?n M15 �? ��ng. Gi? thang chu?n h�a l?ch s?; t?i �a 8 n?n trong pha. D?u b?ng 0 gi? pha. N�t �?t ? 0: pha d? ki?n, ch�a c� ?OI n?n �ang ch?y.';
  oiPhaseLabel.append(oiPhaseToggle,'?OI8 reset theo SPY V th�n n?n',oiPhaseStatus);oi8Label.after(oiPhaseLabel);
  oiPhaseToggle.onchange=()=>render(false);
  const oi8PivotLabel=document.createElement('label'),oi8PivotToggle=document.createElement('input');
  oi8PivotToggle.id='oi8-pivot-toggle';oi8PivotToggle.type='checkbox';oi8PivotToggle.checked=true;
  oi8PivotLabel.title='SPYUSDT M15 � PRE�RTH � N�t �?t: ?OI8 xoay �?i d?u � N�t li?n: th�m Taker NF ri�ng SPY c�ng h�?ng';
  oi8PivotLabel.append(oi8PivotToggle,'Pivot ?OI8 � th?');oi8Label.after(oi8PivotLabel);
  oi8PivotToggle.onchange=()=>render(false);
  tpoLayer=mountTpo({chart,price,controls:document.querySelector('.toggles'),host:$('chart'),get:getJSON,context:()=>({symbol:$('symbol').value,interval:$('interval').value,bars:rows[$('symbol').value]??[],now:cache?.serverTime??Date.now()})});
  gexLayer=mountGex({chart,price,context:()=>({symbol:$('symbol').value,anchor:cvdAnchorTime})});
  SETUP_CONTROL_IDS.push('gex-spectrum-toggle',...TPO_CONTROL_IDS);
  restoreSavedSetup();syncChartFrameButtons();
  // Restore the C histogram once for setups saved before the taker plot cleanup.
  // Subsequent user choices remain under the normal Save setup control.
  try{
    const key='netflow:restore-composite-histogram:v1';
    if(!localStorage.getItem(key)){
      $('composite').checked=true;
      const saved=JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY)||'null');
      if(saved?.version===1&&saved.controls){
        saved.controls.composite=true;
        localStorage.setItem(SETUP_STORAGE_KEY,JSON.stringify(saved));
      }
      localStorage.setItem(key,'done');
    }
  }catch{$('composite').checked=true;}
  syncDisplayModeButtons();
  $('refresh').onclick=()=>refresh();$('interval').onchange=()=>{syncChartFrameButtons();syncDisplayModeButtons();updateH1TrendAgeReadout();refresh(true);};$('days').onchange=()=>refresh(true);
  for(const id of ['symbol','signal'])$(id).onchange=()=>{syncDisplayModeButtons();resetStudies();render(false);setLive();};
  for(const id of ['composite','alignment','price-bands','pivot-zones','cvd-spectrum-toggle','markers','causal-trend-channel','geometry-pivots'])$(id).onchange=toggle;
  $('wlr-soft-color-mode').onclick=()=>{const input=$('wlr-soft-colors');input.checked=!input.checked;syncDisplayModeButtons();render(false);};
  $('wlr-width-mode').onclick=()=>{$('phase-width').checked=!$('phase-width').checked;syncDisplayModeButtons();render(false);};
  $('candle-color-mode').onclick=()=>{$('candle-agreement-color').checked=!$('candle-agreement-color').checked;syncDisplayModeButtons();render(false);};
  $('aba-band-color-mode').onclick=()=>{const input=$('aba-band-colors');input.checked=!input.checked;if(input.checked){$('price-bands').checked=true;for(const key of ['priceMid','priceUpper','priceLower'])setOptions(series[key],{visible:true});}syncDisplayModeButtons();updateAbaBandColors();};
  $('h1-box-candle-mode').onclick=()=>{$('candle-h1-box-color').checked=!$('candle-h1-box-color').checked;syncDisplayModeButtons();render(false);};
  $('fit').onclick=()=>fitChart();$('chart-fit').onclick=()=>fitChart();$('chart-fit-half').onclick=()=>fitChart(FIT_HALF_WINDOW_MS);$('chart-save').onclick=saveChartSetup;$('fullscreen').onclick=toggleFullChart;
  document.addEventListener('fullscreenchange',syncFullChart);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.chart-card').classList.contains('fullscreen-fallback')){document.querySelector('.chart-card').classList.remove('fullscreen-fallback');syncFullChart();}});
  // Automatic viewport mode does not require browser fullscreen permission.
  chartCard.classList.add('fullscreen-fallback');syncFullChart();
  $('export').onclick=exportCSV;
  const changeCalendarFilter=()=>{delete $('calendar-list').dataset.positioned;renderCalendar();};$('calendar-impact').onchange=changeCalendarFilter;$('calendar-currency').onchange=changeCalendarFilter;$('calendar-refresh').onclick=refreshCalendar;
  ensureStudiesWorker();studiesWorker.postMessage({type:'prefetch'});
  void refreshOiWidths($('interval').value);
  void currentOiLoader.start();
  setInterval(()=>{if(!document.hidden&&$('symbol').value==='SPYUSDT'){void currentOiLoader.start();updateH1OiReadout();}},1000);
  setLive();refreshCalendar();refresh(true);setInterval(()=>{if(!isChartLive()){setLive();updateH1OiReadout();}updateH1TrendAgeReadout();if(!document.hidden&&!loading)refresh();},LIVE_REFRESH_MS);
  setInterval(()=>{if(!document.hidden)void refreshOiWidths($('interval').value);},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){void refreshOiWidths($('interval').value);void currentOiLoader.start();}});
  setInterval(()=>{if(!document.hidden)refreshCalendar();},CALENDAR_REFRESH_MS);
  setInterval(updateCandleCountdown,250);
}



