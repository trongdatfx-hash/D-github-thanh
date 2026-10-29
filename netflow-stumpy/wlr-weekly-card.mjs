import {analyze,composite,calculateVolumeStrength,weightedPriceBands,sessionAt,STEPS} from './engine.mjs?v=20261029-history-perf3';
import {wlrSoftColors} from './wlr-soft-color.mjs?v=20261026-early-shade1';
import {weeklyWlrReversalForecast} from '../day-map/day-map-core.mjs?v=20261029-wlrweek1';
import {topUpLive} from '../day-map/live-topup.mjs?v=20261029-topup1';

const STEP=STEPS['15m'],ROOT='./data/binance/m15/';
const $=id=>document.getElementById(id);
const price=value=>Number.isFinite(value)?value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const pct=value=>Number.isFinite(value)?`${value>0?'+':''}${value.toFixed(2)}%`:'—';
let busy=false;

function compact(row){
  if(!Array.isArray(row)||row.length<9)throw Error('Shard M15 thiếu trường');
  const [t,o,h,l,c,v,end,q,buy]=row.map(Number);
  if(![t,o,h,l,c,v,end,q,buy].every(Number.isFinite)||end!==t+STEP-1||t%STEP!==0||o<=0||c<=0||l<=0||h<Math.max(o,c)||l>Math.min(o,c)||q<0||buy<0||buy>q)throw Error('Nến M15 không hợp lệ');
  return {t,o,h,l,c,v,end,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)};
}

async function loadHistory(){
  const response=await fetch(`${ROOT}manifest.json?ts=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw Error('History manifest chưa sẵn sàng');
  const manifest=await response.json();
  if(manifest?.interval!=='15m'||!Array.isArray(manifest.months))throw Error('History manifest không hợp lệ');
  const cutoff=(manifest.lastTime??Date.now())-365*86400000;
  const months=manifest.months.filter(key=>/^\d{4}-\d{2}$/.test(key)).filter(key=>{const [y,m]=key.split('-').map(Number);return Date.UTC(y,m,1)-1>=cutoff;});
  const docs=await Promise.all(months.map(async key=>{const r=await fetch(`${ROOT}${key}.json?v=${key===months.at(-1)?manifest.lastTime:'closed'}`,{cache:'force-cache'});if(!r.ok)throw Error(`Thiếu shard ${key}`);return r.json();}));
  const base={manifest,SPYUSDT:docs.flatMap(doc=>(doc.SPYUSDT??[]).map(compact)).filter(x=>x.t>=cutoff),QQQUSDT:docs.flatMap(doc=>(doc.QQQUSDT??[]).map(compact)).filter(x=>x.t>=cutoff)};
  return topUpLive(base,compact);
}

function renderWait(message,{direction=0,detail=''}={}){
  const card=$('weekly-wlr-card'),signal=$('weekly-wlr-signal'),main=$('weekly-wlr-main'),note=$('weekly-wlr-note');
  card.dataset.state='wait';signal.className='wait';signal.textContent=direction>0?'SPY XANH ĐẬM':direction<0?'SPY ĐỎ ĐẬM':'WAIT';
  main.textContent='WAIT';note.textContent=detail?`${message} · ${detail}`:message;
}

function renderForecast(result,manifest){
  const lag=manifest?.collection?.lagHours,status=manifest?.collection?.status,top=manifest?.topUp,topDetail=top?.status==='failed'?` · nối live lỗi: ${top.reason}`:top?.status==='ok'?` · nối live +${top.added} M15`:'',detail=`${status==='live'?'LIVE':'DỮ LIỆU TRỄ'}${Number.isFinite(lag)?` · trễ ${lag.toFixed(1)}h`:''}${topDetail}`;
  if(status!=='live'||!Number.isFinite(lag)||lag>1){renderWait('Dữ liệu chưa đủ mới; không phát xác suất', {detail});return;}
  if(!result.ready){renderWait(result.reason,{direction:result.direction,detail});return;}
  const direction=result.direction,card=$('weekly-wlr-card'),signal=$('weekly-wlr-signal'),main=$('weekly-wlr-main'),note=$('weekly-wlr-note');
  card.dataset.state=direction>0?'up':'down';signal.className=direction>0?'up':'down';signal.textContent=direction>0?'SPY XANH ĐẬM':'SPY ĐỎ ĐẬM';
  main.textContent=`P đảo chiều tuần ${Math.round(100*result.reversalProbability)}%`;
  note.textContent=`P50 ${price(result.targetPrice)} · kỳ vọng ${pct(result.returnBand.p50)} / ${result.horizonDays} phiên · P10–P90 ${pct(result.returnBand.p10)} → ${pct(result.returnBand.p90)} · N ${result.n}, đảo ${result.reversalN}, Neff ${result.neff.toFixed(1)} · ${detail}`;
}

async function refresh(){
  if(busy)return;busy=true;
  const button=$('weekly-wlr-refresh'),auto=$('weekly-wlr-auto');button.disabled=true;button.textContent='↻ Đang cập nhật…';auto.textContent='● ĐANG NỐI DATA';
  try{
    const data=await loadHistory(),now=Date.now(),last=Math.min(data.SPYUSDT.at(-1)?.t??0,data.QQQUSDT.at(-1)?.t??0),closedBefore=Math.min(now,last+STEP);
    const spyRows=data.SPYUSDT.filter(x=>x.end<closedBefore),qqqRows=data.QQQUSDT.filter(x=>x.end<closedBefore);
    const spy=analyze(spyRows,STEP),qqq=analyze(qqqRows,STEP),comp=analyze(composite(spyRows,qqqRows,STEP),STEP),volume=analyze(spyRows,STEP,{strength:calculateVolumeStrength(spyRows,STEP)});
    const bands=weightedPriceBands(spyRows,STEP),colors=wlrSoftColors(spyRows,bands,new Map(comp.map(x=>[x.t,x])),new Map(volume.map(x=>[x.t,x])),{step:STEP,closedBefore});
    renderForecast(weeklyWlrReversalForecast(spy,colors,closedBefore),data.manifest);
    const lag=data.manifest?.collection?.lagHours,top=data.manifest?.topUp;
    auto.textContent=`● AUTO 60 GIÂY${Number.isFinite(lag)?` · TRỄ ${lag.toFixed(1)}H`:''}${top?.status==='ok'?` · +${top.added} M15`:top?.status==='failed'?' · NỐI LIVE LỖI':''}`;
    auto.title=top?.status==='failed'?top.reason:'';
    auto.className=data.manifest?.collection?.status==='live'?'live':'delayed';
  }catch(error){renderWait(`Không cập nhật được: ${error.message}`);auto.textContent='● LỖI DỮ LIỆU';auto.className='delayed';}
  finally{busy=false;button.disabled=false;button.textContent='↻ Làm tươi';}
}

$('weekly-wlr-refresh')?.addEventListener('click',refresh);
refresh();setInterval(refresh,60000);
