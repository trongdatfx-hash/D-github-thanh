export const STEP = 900000;
export const SYMBOLS = ['SPYUSDT', 'QQQUSDT'];
const clock = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
export function sessionAt(time) {
  const p = Object.fromEntries(clock.formatToParts(time).map(x=>[x.type,x.value]));
  if (['Sat','Sun'].includes(p.weekday)) return 'WEEKEND';
  const m = Number(p.hour)*60+Number(p.minute);
  return m<240 || m>=1200 ? 'NIGHT' : m<570 ? 'PRE' : m<960 ? 'RTH' : 'POST';
}
export function validateSymbol(info, symbol) {
  if (!SYMBOLS.includes(symbol)) throw Error('Symbol không được hỗ trợ');
  const s = info?.symbols?.find(x=>x.symbol===symbol);
  if (!s || s.status!=='TRADING' || !['PERPETUAL','TRADIFI_PERPETUAL'].includes(s.contractType) || s.quoteAsset!=='USDT') throw Error(`${symbol}: chưa xác nhận hợp đồng USDT perpetual đang giao dịch`);
  return s;
}
export function parseKlines(rows, now) {
  if (!Array.isArray(rows)) throw Error('Kline response không hợp lệ');
  const map = new Map();
  for (const k of rows) {
    if (!Array.isArray(k) || k.length<11) throw Error('Thiếu trường kline');
    const [t,o,h,l,c,v,end,,,buy] = k.map(Number);
    if (![t,o,h,l,c,v,end,buy].every(Number.isFinite) || t%STEP!==0 || end!==t+STEP-1 || v<0 || buy<0 || buy>v || l>Math.min(o,c) || h<Math.max(o,c) || l>h) throw Error('Kline M15 không hợp lệ');
    if (end>=now) continue;
    map.set(t,{t,o,h,l,c,v,buy,sell:v-buy,net:2*buy-v,end,session:sessionAt(t)});
  }
  return [...map.values()].sort((a,b)=>a.t-b.t);
}
function moments(xs) {
  const mean=xs.reduce((a,b)=>a+b,0)/xs.length;
  const sigma=Math.sqrt(xs.reduce((a,b)=>a+(b-mean)**2,0)/xs.length);
  return {mean,sigma};
}
// Simple past-only location/scale matching to the RTH distribution.
// Statistics are read BEFORE the current bar is appended. No labels or future returns.
export function analyze(bars, strength, {window=500,minSamples=26}={}) {
  if (!Number.isInteger(window) || !Number.isInteger(minSamples) || minSamples<2 || window<minSamples || strength.length!==bars.length) throw Error('Tham số phân tích không hợp lệ');
  const pools=Object.fromEntries(['NIGHT','PRE','RTH','POST'].map(s=>[s,[]]));
  let history=[],previous=null;
  return bars.map((b,i)=>{
    if (previous!==null && b.t-previous!==STEP) {history=[];for(const s in pools)pools[s]=[];}
    previous=b.t;
    history=history.filter(x=>x.t>b.t-86400000);
    const covered=history.length===95 && history[0]?.t===b.t-95*STEP;
    const volume24=covered ? history.reduce((a,x)=>a+x.v,b.v) : null;
    const net24=covered ? history.reduce((a,x)=>a+x.net,b.net) : null;
    const raw=Number.isFinite(strength[i])?strength[i]:null;
    const source=pools[b.session],target=pools.RTH;
    let adjusted=null,reason='Chờ công thức DVP',sigma=null;
    if(raw!==null){
      reason='Chưa đủ lịch sử theo phiên';
      if (b.session==='WEEKEND') reason='Cuối tuần: không hiệu chỉnh về RTH';
      else if (target.length>=minSamples && source.length>=minSamples){
        const src=moments(source),dst=moments(target);
        sigma=dst.sigma;
        if(b.session==='RTH'){adjusted=raw;reason='RTH: giữ Strength gốc';}
        else if(src.sigma>1e-12 && dst.sigma>1e-12){
          adjusted=(raw-src.mean)/src.sigma*dst.sigma+dst.mean;
          reason='Hiệu chỉnh phân phối theo lịch sử RTH';
        } else reason='Phân phối không có độ biến thiên';
      }
    }
    const result={...b,raw,adjusted,sigma,upper:sigma===null?null:2*sigma,lower:sigma===null?null:-2*sigma,volume24,net24,reason,sourceSamples:source?.length??0,rthSamples:target.length};
    if(raw!==null && source){source.push(raw);if(source.length>window)source.shift();}
    history.push(b);
    return result;
  });
}
export function mlStatus(rows) {
  const rth=rows.filter(x=>x.session==='RTH' && x.adjusted!==null);
  return {trained:false,rthSamples:rth.length,message:'ML chưa triển khai / chưa train. Chưa có bộ dữ liệu nhãn RTH và kết quả kiểm định walk-forward cho V1.'};
}
