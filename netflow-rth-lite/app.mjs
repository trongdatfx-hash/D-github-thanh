import {STEPS,composite,analyze} from './engine.mjs';
import {load} from './data.mjs';
const $=id=>document.getElementById(id),fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
const L=window.LightweightCharts;
let chart,price,series={},marks,cache=null,rows={},maps={},controller,generation=0,loading=false,lastSuccess=null;
const colors={SPYUSDT:'#5ba8ff',QQQUSDT:'#c194ff',COMPOSITE:'#38dfba'};
const flowColors={
  SPYUSDT:{up:'rgba(39,211,164,.38)',down:'rgba(255,91,116,.38)'},
  QQQUSDT:{up:'rgba(39,211,164,.58)',down:'rgba(255,91,116,.58)'},
  COMPOSITE:{up:'rgba(39,211,164,.82)',down:'rgba(255,91,116,.82)'}
};
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function init(){
  if(!L){status('Không tải được thư viện chart cục bộ. Kiểm tra network hoặc tải lại trang.',true);return false;}
  chart=L.createChart($('chart'),{autoSize:true,layout:{background:{type:'solid',color:'#0e1726'},textColor:'#91a5bd',attributionLogo:true},grid:{vertLines:{color:'#1a283a'},horzLines:{color:'#1a283a'}},crosshair:{mode:L.CrosshairMode.Normal,vertLine:{visible:true,labelVisible:true},horzLine:{visible:true,labelVisible:true}},timeScale:{timeVisible:true,secondsVisible:false,rightOffset:5},rightPriceScale:{autoScale:true},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true},localization:{locale:'vi-VN',timeFormatter:t=>new Date(t*1000).toLocaleString('en-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}});
  price=chart.addSeries(L.CandlestickSeries,{priceLineVisible:false,borderVisible:false},0);
  for(const key of Object.keys(colors))series[key]=chart.addSeries(L.HistogramSeries,{base:0,color:flowColors[key].up,title:key.replace('USDT','')+' Taker NetFlow',priceLineVisible:false,priceFormat:{type:'custom',formatter:v=>fmt(v)}},1);
  series.strength=chart.addSeries(L.LineSeries,{color:'#f8bc62',lineWidth:2,title:'Strength → RTH',priceLineVisible:false},2);
  for(const key of ['mid','upper','lower'])series[key]=chart.addSeries(L.LineSeries,{color:key==='mid'?'#7c98b9':'#8596ad',lineWidth:1,lineStyle:key==='mid'?L.LineStyle.Dotted:L.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,title:key==='mid'?'Regression':key==='upper'?'+2σ':'−2σ'},2);
  series.strength.createPriceLine({price:0,color:'#4c6078',lineWidth:1,lineStyle:L.LineStyle.Dotted,axisLabelVisible:false});
  series.COMPOSITE.createPriceLine({price:0,color:'#60748c',lineWidth:1,lineStyle:L.LineStyle.Solid,axisLabelVisible:false});
  chart.panes()[0].setStretchFactor(.50);chart.panes()[1].setStretchFactor(.23);chart.panes()[2].setStretchFactor(.27);
  marks=L.createSeriesMarkers(price,[]);
  chart.subscribeCrosshairMove(p=>{if(p.time)showTooltip(p.time*1000);});
  return true;
}
function candleColor(x){
  if(!Number.isFinite(x?.adjusted))return '#68778a';
  const intensity=Math.min(1,Math.abs(x.adjusted)/30)*x.confidence;
  return x.adjusted>=0?`rgba(43,220,174,${.25+.75*intensity})`:`rgba(255,100,123,${.25+.75*intensity})`;
}
function lineData(data,key){return data.map(x=>Number.isFinite(x[key])?{time:x.t/1000,value:x[key]}:{time:x.t/1000});}
function flowData(data,key){const palette=flowColors[key];return data.map(x=>Number.isFinite(x.net)?{time:x.t/1000,value:x.net,color:x.net>=0?palette.up:palette.down}:{time:x.t/1000});}
function render(fit=false){
  const range=chart.timeScale().getVisibleLogicalRange();
  const p=rows[$('symbol').value]??[],signals=maps[$('signal').value]??new Map();
  price.setData(p.map(x=>{const color=candleColor(signals.get(x.t));return {time:x.t/1000,open:x.o,high:x.h,low:x.l,close:x.c,color,wickColor:color,borderColor:color};}));
  for(const key of Object.keys(colors))series[key].setData(flowData(rows[key]??[],key));
  const signalRows=rows[$('signal').value]??[];
  series.strength.setData(lineData(signalRows,'adjusted'));
  for(const key of ['mid','upper','lower'])series[key].setData(lineData(signalRows,key));
  let previousDay=null,previousSession=null;
  marks.setMarkers(p.flatMap(x=>{let text=null;if(x.session==='RTH'&&previousSession!=='RTH')text='RTH';else if(x.day!==previousDay)text=x.day.slice(5);previousDay=x.day;previousSession=x.session;return text?[{time:x.t/1000,position:'aboveBar',color:text==='RTH'?'#f8bc62':'#788ca5',shape:'circle',text}]:[];}));
  toggle();
  if(fit)chart.timeScale().fitContent();else if(range)chart.timeScale().setVisibleLogicalRange(range);
  if(p.length)showTooltip(p.at(-1).t);else{$('tooltip').textContent='Chưa có dữ liệu Binance xác minh.';metrics(null);}
  $('export').disabled=!p.length;
}
function metrics(s){$('buy').textContent=fmt(s?.buy);$('sell').textContent=fmt(s?.sell);$('net').textContent=s?`${fmt(s.net)} / ${fmt(s.nf)}%`:'—';$('strength').textContent=fmt(s?.adjusted);}
function showTooltip(t){
  const p=maps[$('symbol').value]?.get(t),s=maps[$('signal').value]?.get(t);metrics(s);
  const text=[new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York'})+' ET',p?`${$('symbol').value} · O ${fmt(p.o)} H ${fmt(p.h)} L ${fmt(p.l)} C ${fmt(p.c)}`:'Không có nến giá tại timestamp này'];
  for(const key of Object.keys(colors)){const b=maps[key]?.get(t);text.push(`${key} · BuyQ ${fmt(b?.buy)} · SellQ ${fmt(b?.sell)} · NetQ ${fmt(b?.net)} USDT · NF ${fmt(b?.nf)}%`);}
  text.push(`${s?.session??'—'} · Strength gốc ${fmt(s?.raw)} → RTH ${fmt(s?.adjusted)} · Regression ${fmt(s?.mid)} [${fmt(s?.lower)}, ${fmt(s?.upper)}] · đủ mẫu ${fmt((s?.confidence??0)*100)}%`,s?.reason??'Thiếu timestamp chung');
  $('tooltip').replaceChildren(...text.map(value=>{const div=document.createElement('div');div.textContent=value;return div;}));
}
function toggle(){
  for(const [id,key] of [['spy','SPYUSDT'],['qqq','QQQUSDT'],['composite','COMPOSITE'],['show-strength','strength']])series[key].applyOptions({visible:$(id).checked});
  for(const key of ['mid','upper','lower'])series[key].applyOptions({visible:$('bands').checked});
  marks.applyOptions({visible:$('markers').checked});
}
async function refresh(clear=false){
  controller?.abort();controller=new AbortController();const gen=++generation;
  loading=true;$('refresh').disabled=true;
  if(clear){cache=null;rows={};maps={};lastSuccess=null;render(true);}
  const interval=$('interval').value,days=+$('days').value;
  status(`Đang xác minh SPYUSDT/QQQUSDT và tải ${interval} · ${days} ngày…`);
  try{
    const data=await load(interval,days,{signal:controller.signal});if(gen!==generation)return;
    const step=STEPS[interval];
    rows={SPYUSDT:analyze(data.SPYUSDT,step),QQQUSDT:analyze(data.QQQUSDT,step),COMPOSITE:analyze(composite(data.SPYUSDT,data.QQQUSDT),step)};
    maps=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,new Map(v.map(x=>[x.t,x]))]));
    cache=data;lastSuccess=new Date();render(clear);
    status(`SPYUSDT + QQQUSDT · TRADING / ${data.contracts.map(x=>x.contractType).join(' + ')} · ${rows.SPYUSDT.length}/${rows.QQQUSDT.length} nến đóng · ${rows.COMPOSITE.length} timestamp chung · cập nhật ${lastSuccess.toLocaleTimeString('vi-VN')} · ${rows.COMPOSITE.length?'Dữ liệu thật Binance':'Composite chưa có dữ liệu giao nhau'}`);
  }catch(e){
    if(gen!==generation)return;
    status(`${e.message}. Có thể bị CORS, vùng truy cập, mất mạng hoặc rate limit. ${cache?`Dữ liệu cũ chưa cập nhật (lần thành công ${lastSuccess.toLocaleTimeString('vi-VN')}).`:'Không có dữ liệu thay thế; biểu đồ để trống.'} Dùng Tải lại sau khi kiểm tra kết nối.`,true);
  }finally{if(gen===generation){loading=false;$('refresh').disabled=false;}}
}
function exportCSV(){
  const source=$('signal').value,data=rows[source]??[];
  const keys=['t','session','q','buy','sell','net','nf','raw','adjusted','mid','upper','lower','confidence'];
  const csv=[keys.join(','),...data.map(x=>keys.map(k=>x[k]??'').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${source}-${$('interval').value}-quote-netflow.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
if(init()){
  $('refresh').onclick=()=>refresh();for(const id of ['interval','days'])$(id).onchange=()=>refresh(true);
  for(const id of ['symbol','signal'])$(id).onchange=()=>render(false);
  for(const id of ['spy','qqq','composite','show-strength','bands','markers'])$(id).onchange=toggle;
  $('fit').onclick=()=>{chart.priceScale('right',0).applyOptions({autoScale:true});chart.priceScale('right',1).applyOptions({autoScale:true});chart.priceScale('right',2).applyOptions({autoScale:true});chart.timeScale().fitContent();};
  $('export').onclick=exportCSV;
  refresh(true);setInterval(()=>{if(!document.hidden&&!loading)refresh();},60000);
}
