import {STEPS,composite,flowAlignment,analyze,weightedPriceBands,continuousCvdSpectrum} from './engine.mjs';
import {load} from './data.mjs';
import {strengthStatistics,trendStrength6,HORIZONS,MIN_SAMPLES,TREND_MIN_HISTORY} from './strength-stats.mjs';
import {reversalZone,REVERSAL_MIN_MATCHES} from './reversal-zone.mjs';
const $=id=>document.getElementById(id),fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—',fmtK=x=>Number.isFinite(x)?`${(x/1000).toLocaleString('en-US',{maximumFractionDigits:2})}K`:'—';
const L=window.LightweightCharts;
let chart,price,series={},marks,strengthMarks,cache=null,rows={},maps={},alignmentMap=new Map(),priceBandMap=new Map(),cvdProfile={bins:[],maxAbs:0,binStep:.5,range:12},cvdAnchorTime=null,cvdFrame=0,controller,generation=0,loading=false,lastSuccess=null;
const colors={SPYUSDT:'#5ba8ff',QQQUSDT:'#c194ff',COMPOSITE:'#38dfba'};
const flowTitles={SPYUSDT:'S Taker NF',QQQUSDT:'Q Taker NF',COMPOSITE:'C Taker NF'};
const flowColors={
  SPYUSDT:{up:'rgba(39,211,164,.38)',down:'rgba(255,91,116,.38)'},
  QQQUSDT:{up:'rgba(39,211,164,.58)',down:'rgba(255,91,116,.58)'},
  COMPOSITE:{up:'rgba(39,211,164,.82)',down:'rgba(255,91,116,.82)'}
};
const LIVE_REFRESH_MS=3000;
let statsMap=new Map(),trendMap=new Map(),reversalState={ready:false,reason:'window',n:0},inspectedTime=null;
const sourceName=key=>({SPYUSDT:'SPY',QQQUSDT:'QQQ',COMPOSITE:'Composite'}[key]);
const signed=x=>Number.isFinite(x)?`${x>0?'+':''}${fmt(x)}`:'—';
const returnText=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}%`:'—';
const signLabel=x=>x>0?'+':x<0?'−':'0';
const tone=x=>x>0?'positive':x<0?'negative':'neutral';
class VariableWidthLineRenderer{
  update(data,options){this.data=data;this.options=options;}
  draw(target,priceToCoordinate){
    const bars=this.data?.bars,range=this.data?.visibleRange;if(!bars?.length||!range)return;
    target.useBitmapCoordinateSpace(({context,horizontalPixelRatio,verticalPixelRatio})=>{
      context.save();context.strokeStyle=this.options.color;context.lineCap='round';context.lineJoin='round';
      // Both endpoints must be inside the visible range; off-screen custom bars can carry stale x coordinates.
      const start=Math.max(1,range.from+1),end=Math.min(bars.length,range.to);
      for(let i=start;i<end;i++){
        const previous=bars[i-1],current=bars[i],a=previous.originalData,b=current.originalData;
        if(!Number.isFinite(a?.value)||!Number.isFinite(b?.value))continue;
        const xGap=current.x-previous.x;if(!Number.isFinite(xGap)||xGap<=0||xGap>Math.max(2,this.data.barSpacing*1.6))continue;
        const y1=priceToCoordinate(a.value),y2=priceToCoordinate(b.value);if(y1===null||y2===null)continue;
        context.beginPath();context.lineWidth=Math.max(1,Math.round((b.width??1)*verticalPixelRatio));
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
function init(){
  if(!L){status('Không tải được thư viện chart cục bộ. Kiểm tra network hoặc tải lại trang.',true);return false;}
  chart=L.createChart($('chart'),{autoSize:true,layout:{background:{type:'solid',color:'#0e1726'},textColor:'#91a5bd',attributionLogo:true},grid:{vertLines:{color:'#1a283a'},horzLines:{color:'#1a283a'}},crosshair:{mode:L.CrosshairMode.Normal,vertLine:{visible:true,labelVisible:true},horzLine:{visible:true,labelVisible:true}},timeScale:{timeVisible:true,secondsVisible:false,rightOffset:22},rightPriceScale:{autoScale:true},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true},localization:{locale:'vi-VN',timeFormatter:t=>new Date(t*1000).toLocaleString('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}});
  price=chart.addSeries(L.CandlestickSeries,{priceLineVisible:false,borderVisible:false},0);
  series.priceMid=chart.addCustomSeries(new VariableWidthLineSeries,{color:'#f6c85f',baseLineVisible:false,priceLineVisible:false,lastValueVisible:false,title:''},0);
  for(const key of ['priceUpper','priceLower'])series[key]=chart.addSeries(L.LineSeries,{color:'#4aa3ff',lineWidth:1,lineStyle:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:''},0);
  series.reversalLow=chart.addSeries(L.LineSeries,{color:'rgba(255,180,84,.65)',lineWidth:1,lineStyle:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,title:''},0);
  series.reversalHigh=chart.addSeries(L.LineSeries,{color:'rgba(255,180,84,.65)',lineWidth:1,lineStyle:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,title:''},0);
  series.reversalMid=chart.addSeries(L.LineSeries,{color:'#ffb454',lineWidth:4,lineStyle:L.LineStyle.Solid,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false,title:'REV6 R'},0);
  for(const key of Object.keys(colors))series[key]=chart.addSeries(L.HistogramSeries,{base:0,color:flowColors[key].up,title:flowTitles[key],priceLineVisible:false,priceFormat:{type:'custom',formatter:fmtK}},1);
  series.relative=chart.addSeries(L.HistogramSeries,{priceScaleId:'relative',base:0,color:'rgba(245,166,35,.65)',title:'S−Q Relative',priceLineVisible:false,lastValueVisible:true,priceFormat:{type:'custom',formatter:x=>`${fmt(x)}%`}},1);
  series.relative.priceScale().applyOptions({scaleMargins:{top:.58,bottom:.20}});
  series.relative.createPriceLine({price:0,color:'#65768b',lineWidth:1,lineStyle:L.LineStyle.Dotted,axisLabelVisible:false});
  series.alignment=chart.addSeries(L.HistogramSeries,{priceScaleId:'alignment',base:0,color:'#f5a623',title:'SPY↔QQQ',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'custom',formatter:()=>''}},1);
  series.alignment.priceScale().applyOptions({scaleMargins:{top:.80,bottom:.02}});
  series.strength=chart.addSeries(L.BaselineSeries,{baseValue:{type:'price',price:0},topLineColor:'#1ae0a3',topFillColor1:'rgba(26,224,163,0)',topFillColor2:'rgba(26,224,163,0)',bottomLineColor:'#ff4d70',bottomFillColor1:'rgba(255,77,112,0)',bottomFillColor2:'rgba(255,77,112,0)',lineWidth:3,title:'',priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:4},2);
  for(const key of ['mid','upper','lower'])series[key]=chart.addSeries(L.LineSeries,{color:key==='mid'?'#9db5d1':'#8596ad',lineWidth:key==='mid'?2:1,lineStyle:key==='mid'?L.LineStyle.Dotted:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:''},2);
  series.strength.createPriceLine({price:0,color:'#d7e5f3',lineWidth:2,lineStyle:L.LineStyle.Solid,axisLabelVisible:true,title:'0'});
  series.strength.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.08}});
  series.COMPOSITE.createPriceLine({price:0,color:'#60748c',lineWidth:1,lineStyle:L.LineStyle.Solid,axisLabelVisible:false});
  chart.panes()[0].setStretchFactor(.50);chart.panes()[1].setStretchFactor(.24);chart.panes()[2].setStretchFactor(.26);
  marks=L.createSeriesMarkers(price,[]);
  strengthMarks=L.createSeriesMarkers(series.strength,[]);
  chart.subscribeCrosshairMove(p=>{if(!p.sourceEvent)return;inspectedTime=p.time?p.time*1000:null;showTooltip(inspectedTime??rows[$('symbol').value]?.at(-1)?.t);});
  $('chart').addEventListener('pointerleave',()=>{inspectedTime=null;showTooltip(rows[$('symbol').value]?.at(-1)?.t);});
  chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleCvdSpectrum);
  window.addEventListener('resize',scheduleCvdSpectrum);
  return true;
}
function mixColor(from,to,t){return '#'+from.map((v,i)=>Math.round(v+(to[i]-v)*t).toString(16).padStart(2,'0')).join('');}
function candlePalette(x){
  if(!Number.isFinite(x?.adjusted))return {body:'#68778a',wick:'#8290a2',border:'#76869a'};
  const magnitude=Math.min(1,Math.abs(x.adjusted));
  const confidence=.8+.2*Math.max(0,Math.min(1,x.confidence));
  const intensity=Math.min(1,.18+.82*Math.sqrt(magnitude)*confidence);
  const target=x.adjusted>=0?[8,232,169]:[255,65,99];
  return {body:mixColor([91,105,124],target,intensity),wick:mixColor([112,126,145],target,Math.min(1,intensity+.1)),border:mixColor([74,89,108],target,Math.min(1,intensity+.06))};
}
function lineData(data,key){return data.map(x=>Number.isFinite(x[key])?{time:x.t/1000,value:x[key]}:{time:x.t/1000});}
function oppositionLineWidth(x){return Math.round((1+8*Math.max(0,Math.min(1,x))**.7)*10)/10;}
function priceLineData(data,alignment){const variable=$('phase-width').checked;return data.map(x=>Number.isFinite(x.mid)?{time:x.t/1000,value:x.mid,width:variable?oppositionLineWidth(alignment.get(x.t)?.opposition??0):2}:{time:x.t/1000});}
function flowData(data,key){const palette=flowColors[key];return data.map(x=>Number.isFinite(x.net)?{time:x.t/1000,value:x.net,color:x.net>=0?palette.up:palette.down}:{time:x.t/1000});}
function relativeData(data){return data.map(x=>{const alpha=.28+.62*x.volumeConfidence,color=x.relative>0?`rgba(245,166,35,${alpha})`:x.relative<0?`rgba(169,124,255,${alpha})`:'rgba(112,126,145,.3)';return Number.isFinite(x.relative)?{time:x.t/1000,value:x.relative,color}:{time:x.t/1000};});}
function alignmentData(data){return data.map(x=>({time:x.t/1000,value:x.score,color:x.state==='THUẬN MUA'?`rgba(26,224,163,${.48+.45*x.intensity})`:x.state==='THUẬN BÁN'?`rgba(255,77,112,${.48+.45*x.intensity})`:`rgba(245,166,35,${.58+.35*x.intensity})`}));}
function scheduleCvdSpectrum(){if(cvdFrame)return;cvdFrame=requestAnimationFrame(()=>{cvdFrame=requestAnimationFrame(()=>{cvdFrame=0;drawCvdSpectrum();});});}
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
  context.font=`600 ${width<650?9:10}px Inter,system-ui,sans-serif`;context.textBaseline='bottom';context.textAlign='center';context.fillStyle='rgba(196,210,226,.9)';context.fillText(`CVD∞ ${$('symbol').value==='SPYUSDT'?'S':'Q'} · bin ${cvdProfile.binStep}`,xBase,Math.max(12,visible[0].y-5));
  if(width>=650){context.textBaseline='middle';if(buy){context.textAlign='left';context.fillStyle='#70aef4';context.fillText(`▲ ${fmt(buy.price)}`,Math.min(usableRight-42,buy.x+5),buy.y);}if(sell){context.textAlign='right';context.fillStyle='#f28a61';context.fillText(`▼ ${fmt(sell.price)}`,Math.max(42,sell.x-5),sell.y);}}
  context.restore();
}
function render(fit=false){
  const range=chart.timeScale().getVisibleLogicalRange();
  const p=rows[$('symbol').value]??[],signalRows=rows[$('signal').value]??[],signals=maps[$('signal').value]??new Map();
  cvdProfile=continuousCvdSpectrum(p);cvdAnchorTime=p.at(-1)?.t??null;
  price.setData(p.map(x=>{const color=candlePalette(signals.get(x.t));return {time:x.t/1000,open:x.o,high:x.h,low:x.l,close:x.c,color:color.body,wickColor:color.wick,borderColor:color.border};}));
  const alignment=flowAlignment(rows.SPYUSDT??[],rows.QQQUSDT??[],{step:STEPS[$('interval').value]});alignmentMap=new Map(alignment.map(x=>[x.t,x]));
  statsMap=strengthStatistics({...rows,alignment},$('symbol').value,$('signal').value,STEPS[$('interval').value]);
  trendMap=trendStrength6({...rows,alignment},$('signal').value,STEPS[$('interval').value]);
  reversalState=reversalZone(rows,$('symbol').value,$('signal').value,STEPS[$('interval').value]);
  const priceBands=weightedPriceBands(p,STEPS[$('interval').value]);priceBandMap=new Map(priceBands.map(x=>[x.t,x]));
  series.priceMid.setData(priceLineData(priceBands,alignmentMap));series.priceUpper.setData(lineData(priceBands,'upper'));series.priceLower.setData(lineData(priceBands,'lower'));
  for(const key of Object.keys(colors))series[key].setData(flowData(rows[key]??[],key));
  series.relative.setData(relativeData(alignment));
  series.alignment.setData(alignmentData(alignment));
  series.strength.setData(lineData(signalRows,'adjusted'));
  strengthMarks.setMarkers(signalRows.filter(x=>Number.isFinite(x.adjusted)&&x.adjusted>.95).map(x=>({time:x.t/1000,position:'inBar',color:'#7dffd9',shape:'circle',text:''})));
  for(const key of ['mid','upper','lower'])series[key].setData(lineData(signalRows,key));
  let previousDay=null,previousSession=null;
  marks.setMarkers(p.flatMap(x=>{let text=null;if(x.session==='RTH'&&previousSession!=='RTH')text='RTH';else if(x.day!==previousDay)text=x.day.slice(5);previousDay=x.day;previousSession=x.session;return text?[{time:x.t/1000,position:'aboveBar',color:text==='RTH'?'#f8bc62':'#788ca5',shape:'circle',text}]:[];}));
  toggle();
  if(fit)chart.timeScale().fitContent();else if(range)chart.timeScale().setVisibleLogicalRange(range);
  if(inspectedTime!==null&&!maps[$('symbol').value]?.has(inspectedTime))inspectedTime=null;
  showTooltip(inspectedTime??p.at(-1)?.t);
  scheduleCvdSpectrum();
  $('export').disabled=!p.length;
}
function statValue(id,text,color='neutral'){const node=$(id);node.textContent=text;node.className=color;}
function historyText(summary){return summary?.ready?`${fmt(summary.rate)}% cùng dấu`:`Mẫu mỏng · n=${summary?.n??0}`;}
function latestStrength(key){const data=rows[key]??[];for(let i=data.length-1;i>=0;i--)if(Number.isFinite(data[i].adjusted))return data[i].adjusted;return null;}
function updateStrengthLabels(){
  $('strength-readout').style.display=$('show-strength').checked?'flex':'none';
  for(const [key,id,label] of [['SPYUSDT','strength-spy','SPY'],['QQQUSDT','strength-qqq','QQQ'],['COMPOSITE','strength-composite','']]){const value=latestStrength(key),node=$(id);node.textContent=label?`${label} ${fmt(value)}`:fmt(value);node.className=Number.isFinite(value)?value>=0?'positive':'negative':'missing';}
  const t=(rows[$('signal').value]??[]).at(-1)?.t,trend=trendMap.get(t),node=$('trend-strength');
  if(!trend){node.textContent='TREND6 —';node.className='missing';node.removeAttribute('title');return;}
  const rank=trend.ready?`P${Math.round(trend.percentile)}`:'P—';
  node.textContent=`TREND6 ${trend.label} ${trend.score} · ${rank} · n=${trend.n}`;
  node.className=trend.direction>0?'positive':'negative';
  node.title=`Điểm cụm 6 nến ${trend.score}/100; phân vị lịch sử ${trend.ready?Math.round(trend.percentile):'chưa đủ'}; ${trend.n} cụm đổi dấu đã hoàn tất`;
}
function updateReversalZone(){
  const enabled=$('reversal-zone').checked,node=$('reversal-readout'),visible=enabled&&reversalState.ready;
  if(!visible){for(const key of ['reversalLow','reversalMid','reversalHigh'])series[key].setData([]);node.style.display=enabled?'block':'none';node.className='missing';node.textContent=reversalState.reason==='matches'?`REV6 — cần ≥${REVERSAL_MIN_MATCHES} mẫu`:reversalState.reason==='events'?'REV6 — quá ít lần đảo dấu':reversalState.reason==='confidence'?'REV6 — chưa vượt tỷ lệ nền':'REV6 — chờ đủ 6 nến';node.title='Chỉ vẽ vùng giá khi nhóm hình dạng gần nhất có tỷ lệ đổi dấu cao hơn nền với cận tin cậy một phía 90%.';return;}
  const color=reversalState.direction>0?'#ffb454':'#5bc8ff',edge=reversalState.direction>0?'rgba(255,180,84,.65)':'rgba(91,200,255,.65)',side=reversalState.direction>0?'KHÁNG CỰ':'HỖ TRỢ';
  const line=(value)=>[{time:reversalState.start/1000,value},{time:reversalState.end/1000,value}];
  series.reversalLow.setData(line(reversalState.low));series.reversalMid.setData(line(reversalState.level));series.reversalHigh.setData(line(reversalState.high));
  series.reversalLow.applyOptions({visible:true,color:edge});series.reversalHigh.applyOptions({visible:true,color:edge});series.reversalMid.applyOptions({visible:true,color,title:`REV6 ${reversalState.direction>0?'KC':'HT'}`});
  node.style.display='block';node.className=reversalState.direction>0?'resistance':'support';node.textContent=`REV6 ${side} ${fmt(reversalState.low)}–${fmt(reversalState.high)} · ${fmt(reversalState.rate*100)}% vs nền ${fmt(reversalState.baselineRate*100)}% · n=${reversalState.n}`;
  node.title=`Đổi dấu trong 3 nến: ${fmt(reversalState.rate*100)}%; nền ${fmt(reversalState.baselineRate*100)}%; cận tin cậy 90% ${fmt(reversalState.lower*100)}%; ${reversalState.eventCount}/${reversalState.n} cụm gần nhất.`;
}
function showTooltip(t){
  const p=maps[$('symbol').value]?.get(t),record=statsMap.get(t),state=record?.state,trend=trendMap.get(t);
  const time=p?new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York'})+' ET':'Chưa có dữ liệu';
  const running=p&&p.end>=(cache?.serverTime??Infinity),mode=inspectedTime!==null?'NẾN ĐANG XEM':'MỚI NHẤT';
  $('stats-latest').hidden=inspectedTime===null;
  $('stats-context').textContent=`${mode} · ${time}${p?` · ${running?'ĐANG CHẠY':'ĐÃ ĐÓNG'} · Giá ${sourceName($('symbol').value)} / Strength ${sourceName($('signal').value)}`:''} · Thống kê mô tả, ML chưa train`;
  if(!state){
    for(const id of ['stat-group','stat-score','stat-pair','stat-history'])statValue(id,'—');
    for(const id of ['stat-group-note','stat-score-note','stat-pair-note','stat-history-note'])$(id).textContent='Chờ đủ Strength và quote volume của SPY/QQQ';
    $('tooltip').textContent=`${time} · Chưa đủ dữ liệu để chấm điểm và thống kê nhóm Strength.`;return;
  }
  $('stat-group').replaceChildren(...state.signs.map((s,i)=>{const span=document.createElement('span');span.className=tone(s);span.textContent=`${['S','Q','C'][i]}${signLabel(s)}`;return span;}));
  $('stat-group-note').textContent=`${sourceName($('signal').value)} ${signed(state.value)} · ${state.session}${state.marker?' · ● >0.95':state.extreme?' · <−0.95':''}`;
  statValue('stat-score',state.score===null?'Trung tính':`${state.score}/100`,state.score>=65?'positive':state.score<40?'negative':'neutral');
  $('stat-score-note').textContent=`Mua ${fmt(state.buyShare*100)}% / Bán ${fmt(state.sellShare*100)}% · ${state.flowDirection===0?'Cân bằng':state.flowDirection===state.direction?'Cùng dấu':'Ngược dấu Strength'}`;
  const a=state.alignment;
  statValue('stat-pair',a.detailState, a.detailState==='THUẬN MUA'?'positive':a.detailState==='THUẬN BÁN'?'negative':'neutral');
  $('stat-pair-note').textContent=`NF% mượt · S ${signed(a.smoothSpyNf)} / Q ${signed(a.smoothQqqNf)}`;
  const h=+$('stat-horizon').value,history=record.stats[h];
  statValue('stat-history',state.direction?historyText(history):'Strength bằng 0',history.ready?tone(history.mean):'neutral');
  $('stat-history-note').textContent=`n=${history.n} · ${history.scope==='detail'?'Cùng điểm & dải':'Cùng nhóm dấu / phiên'}${history.ready?` · TB ${returnText(history.mean)}`:` · cần ≥${MIN_SAMPLES}`}`;
  const text=[`${time} · ${state.session} · Giá ${sourceName($('symbol').value)}, dấu từ ${sourceName($('signal').value)}${running?' · Nến đang chạy: điểm tạm thời, lịch sử so sánh dùng nến đóng':''}`,
    `Điểm xác nhận ${state.score??'—'}/100 = Taker ${fmt(state.taker)}/50 + Dải ${fmt(state.pair)}/30 + |Strength| ${fmt(state.strength)}/20. Điểm theo quy tắc, không phải xác suất thắng.`,
    trend?`TREND6 ${trend.label} ${trend.score}/100${trend.ready?` · P${Math.round(trend.percentile)}`:' · chưa đủ phân vị'} · n=${trend.n} cụm đổi dấu ${trend.scope==='same-sign'?'cùng hướng':'hai hướng'}. Điểm gốc ${trend.raw}: bền dấu ${fmt(trend.components.persistence)}/25 + biên độ ${fmt(trend.components.magnitude)}/20 + dốc ${fmt(trend.components.slope)}/10 + Taker ${fmt(trend.components.taker)}/25 + SPY↔QQQ ${fmt(trend.components.pair)}/10 + đồng thuận S/Q/C ${fmt(trend.components.consensus)}/10.`:`TREND6 cần đủ 6 nến liên tiếp có Strength, Taker Buy/Sell và dải SPY↔QQQ. Phân vị chỉ bật từ ${TREND_MIN_HISTORY} cụm đổi dấu đã hoàn tất.`,
    `So sánh mẫu có cùng dấu S/Q/C và cùng phiên. Ưu tiên cùng nhóm điểm, trạng thái dải và độ cực trị nếu đủ ${MIN_SAMPLES} mẫu; nếu thiếu thì mở rộng về nhóm dấu/phiên và ghi rõ ở bảng.`];
  const nodes=text.map(value=>{const div=document.createElement('div');div.textContent=value;return div;});
  const table=document.createElement('table');table.className='stats-table';
  const header=table.createTHead().insertRow();for(const title of ['Sau','Nhóm / n','Cùng dấu','TB theo dấu','So với nền']){const th=document.createElement('th');th.textContent=title;header.append(th);}
  const body=table.createTBody();
  for(const horizon of HORIZONS){const s=record.stats[horizon],row=body.insertRow();row.classList.toggle('selected',horizon===h);
    for(const value of [`${horizon} nến`,`${s.scope==='detail'?'Điểm & dải':'Dấu / phiên'} · ${s.n}`,s.ready?`${fmt(s.rate)}%`:'Mẫu mỏng',s.ready?returnText(s.mean):'—',s.lift===null?'—':`${signed(s.lift)} đpt · n=${s.baseline.n}`])row.insertCell().textContent=value;
  }
  const note=document.createElement('div');note.className='stats-note';note.textContent='Đo close → close sau 1/3/6 nến theo dấu Strength; loại đoạn mất nến/đổi phiên/ngày. Các cửa sổ kết quả trong mỗi nhóm không chồng nhau, chỉ tính kết quả đã đóng trước nến đang xem. Nền = cùng phiên và cùng dấu nguồn. Chưa trừ phí; đây là thống kê lịch sử, chưa phải backtest chiến lược.';
  $('tooltip').replaceChildren(...nodes,table,note);
}
function toggle(){
  for(const [id,key] of [['spy','SPYUSDT'],['qqq','QQQUSDT'],['composite','COMPOSITE'],['show-strength','strength']])series[key].applyOptions({visible:$(id).checked});
  strengthMarks.applyOptions({visible:$('show-strength').checked});
  $('cvd-spectrum').style.display=$('cvd-spectrum-toggle').checked?'block':'none';scheduleCvdSpectrum();
  series.relative.applyOptions({visible:$('relative').checked});
  series.alignment.applyOptions({visible:$('alignment').checked});
  for(const key of ['priceMid','priceUpper','priceLower'])series[key].applyOptions({visible:$('price-bands').checked});
  updateReversalZone();
  updateStrengthLabels();
  for(const key of ['mid','upper','lower'])series[key].applyOptions({visible:$('bands').checked});
  marks.applyOptions({visible:$('markers').checked});
}
async function refresh(clear=false){
  controller?.abort();controller=new AbortController();const gen=++generation;
  loading=true;$('refresh').disabled=true;
  if(clear){cache=null;rows={};maps={};lastSuccess=null;inspectedTime=null;render(true);}
  const interval=$('interval').value,days=+$('days').value;
  status(`Đang xác minh SPYUSDT/QQQUSDT và tải ${interval} · ${days} ngày…`);
  try{
    const data=await load(interval,days,{signal:controller.signal,previous:cache});if(gen!==generation)return;
    const step=STEPS[interval];
    rows={SPYUSDT:analyze(data.SPYUSDT,step),QQQUSDT:analyze(data.QQQUSDT,step),COMPOSITE:analyze(composite(data.SPYUSDT,data.QQQUSDT),step)};
    maps=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,new Map(v.map(x=>[x.t,x]))]));
    cache=data;lastSuccess=new Date();render(clear);setLive(true);
    status(`SPYUSDT + QQQUSDT · TRADING / ${data.contracts.map(x=>x.contractType).join(' + ')} · ${rows.SPYUSDT.length}/${rows.QQQUSDT.length} nến, gồm nến đang chạy · ${rows.COMPOSITE.length} timestamp chung · ${data.incremental?'cập nhật realtime ~3 giây':'tải lịch sử song song'} · cập nhật ${lastSuccess.toLocaleTimeString('vi-VN')} · ${rows.COMPOSITE.length?'Dữ liệu thật Binance':'Composite chưa có dữ liệu giao nhau'}`);
  }catch(e){
    if(gen!==generation)return;
    setLive(false);status(`${e.message}. Có thể bị CORS, vùng truy cập, mất mạng hoặc rate limit. ${cache?`Dữ liệu cũ chưa cập nhật (lần thành công ${lastSuccess.toLocaleTimeString('vi-VN')}).`:'Không có dữ liệu thay thế; biểu đồ để trống.'} Dùng Tải lại sau khi kiểm tra kết nối.`,true);
  }finally{if(gen===generation){loading=false;$('refresh').disabled=false;}}
}
function exportCSV(){
  const source=$('signal').value,data=rows[source]??[];
  const keys=['t','session','q','buy','sell','net','nf','raw','adjusted','mid','upper','lower','confidence'];
  const csv=[keys.join(','),...data.map(x=>keys.map(k=>x[k]??'').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${source}-${$('interval').value}-quote-netflow.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fitChart(){for(let pane=0;pane<3;pane++)chart.priceScale('right',pane).applyOptions({autoScale:true});series.relative.priceScale().applyOptions({autoScale:true});series.alignment.priceScale().applyOptions({autoScale:true});chart.timeScale().fitContent();scheduleCvdSpectrum();}
function isFullChart(){const card=document.querySelector('.chart-card');return document.fullscreenElement===card||card.classList.contains('fullscreen-fallback');}
function syncFullChart(){const active=isFullChart();$('fullscreen').textContent=active?'✕ Thu nhỏ':'⛶ Full chart';$('fullscreen').setAttribute('aria-pressed',String(active));document.body.classList.toggle('chart-fullscreen',active);setTimeout(()=>{window.dispatchEvent(new Event('resize'));scheduleCvdSpectrum();},50);}
async function toggleFullChart(){
  const card=document.querySelector('.chart-card');
  if(document.fullscreenElement===card){await document.exitFullscreen();return;}
  if(card.classList.contains('fullscreen-fallback')){card.classList.remove('fullscreen-fallback');syncFullChart();return;}
  try{if(!card.requestFullscreen)throw Error('Fullscreen API unavailable');await card.requestFullscreen({navigationUI:'hide'});}catch{card.classList.add('fullscreen-fallback');syncFullChart();}
}
if(init()){
  $('refresh').onclick=()=>refresh();for(const id of ['interval','days'])$(id).onchange=()=>refresh(true);
  for(const id of ['symbol','signal'])$(id).onchange=()=>render(false);
  for(const id of ['spy','qqq','composite','relative','alignment','price-bands','reversal-zone','cvd-spectrum-toggle','show-strength','bands','markers'])$(id).onchange=toggle;
  $('phase-width').onchange=()=>render(false);
  $('fit').onclick=fitChart;$('chart-fit').onclick=fitChart;$('fullscreen').onclick=toggleFullChart;
  document.addEventListener('fullscreenchange',syncFullChart);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.chart-card').classList.contains('fullscreen-fallback')){document.querySelector('.chart-card').classList.remove('fullscreen-fallback');syncFullChart();}});
  $('export').onclick=exportCSV;
  $('stat-horizon').onchange=()=>showTooltip(inspectedTime??rows[$('symbol').value]?.at(-1)?.t);
  $('stats-latest').onclick=()=>{inspectedTime=null;showTooltip(rows[$('symbol').value]?.at(-1)?.t);};
  setLive(false);refresh(true);setInterval(()=>{if(lastSuccess&&Date.now()-lastSuccess>15000)setLive(false);if(!document.hidden&&!loading)refresh();},LIVE_REFRESH_MS);
}
