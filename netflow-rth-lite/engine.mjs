export const SYMBOLS=['SPYUSDT','QQQUSDT'];
export const STEPS={'5m':300000,'15m':900000,'30m':1800000,'1h':3600000};
const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function sessionAt(t){
  const p=Object.fromEntries(clock.formatToParts(t).map(x=>[x.type,x.value]));
  const m=+p.hour*60+ +p.minute;
  return {day:`${p.year}-${p.month}-${p.day}`,session:['Sat','Sun'].includes(p.weekday)?'WEEKEND':m<240||m>=1200?'NIGHT':m<570?'PRE':m<960?'RTH':'POST'};
}
export function validateSymbol(info,symbol){
  const s=info?.symbols?.find(x=>x.symbol===symbol);
  if(!SYMBOLS.includes(symbol)||!s||s.status!=='TRADING'||s.quoteAsset!=='USDT'||!['PERPETUAL','TRADIFI_PERPETUAL'].includes(s.contractType))throw Error(`${symbol}: API chưa xác nhận hợp đồng USDT perpetual đang TRADING`);
  return s;
}
export function parseKlines(rows,now,step){
  if(!Array.isArray(rows)||!Number.isFinite(now)||!Object.values(STEPS).includes(step))throw Error('Kline/thời gian không hợp lệ');
  const map=new Map();
  for(const k of rows){
    if(!Array.isArray(k)||k.length<11)throw Error('Kline thiếu trường quote volume');
    const t=+k[0],o=+k[1],h=+k[2],l=+k[3],c=+k[4],end=+k[6],q=+k[7],buy=+k[10];
    if(![t,o,h,l,c,end,q,buy].every(Number.isFinite)||t%step||end!==t+step-1||q<0||buy<0||buy>q||l>Math.min(o,c)||h<Math.max(o,c)||l>h||l<=0)throw Error('Kline hoặc quote volume không hợp lệ');
    if(end>=now)continue;
    map.set(t,{t,end,o,h,l,c,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)});
  }
  return [...map.values()].sort((a,b)=>a.t-b.t);
}
export function composite(a,b){
  const other=new Map(b.map(x=>[x.t,x]));
  return a.flatMap(x=>{
    const y=other.get(x.t);if(!y)return [];
    const q=x.q+y.q,buy=x.buy+y.buy,sell=x.sell+y.sell,net=x.net+y.net;
    return [{t:x.t,end:x.end,day:x.day,session:x.session,q,buy,sell,net,nf:q>0?100*net/q:null}];
  });
}
function moments(a){const mean=a.reduce((s,v)=>s+v,0)/a.length;return {mean,sd:Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/a.length)};}
// OLS fits only prior adjusted strengths, predicts the CURRENT index.
export function regression(a){
  const n=a.length,xm=(n-1)/2,ym=a.reduce((s,y)=>s+y,0)/n;
  let xx=0,xy=0;for(let i=0;i<n;i++){xx+=(i-xm)**2;xy+=(i-xm)*(a[i]-ym);}
  const slope=xy/xx,intercept=ym-slope*xm;
  const sigma=Math.sqrt(a.reduce((s,y,i)=>s+(y-intercept-slope*i)**2,0)/(n-2));
  const mid=intercept+slope*n;return {mid,upper:mid+2*sigma,lower:mid-2*sigma,sigma};
}
// Replace this adapter with a versioned model ONLY after dataset/backtest validation.
export const modelStatus={trained:false,method:'EWMA NF%, half-life 2 bars; past-only session location/scale → RTH'};
export function analyze(bars,step,{minSamples=26,window=500,regWindow=50}={}){
  let ew=null,prev=null,reg=[];
  const pools=Object.fromEntries(['NIGHT','PRE','RTH','POST'].map(s=>[s,[]]));
  const alpha=1-2**(-1/2);
  return bars.map(b=>{
    if(prev!==null&&b.t-prev!==step){ew=null;reg=[];for(const s in pools)pools[s]=[];}
    prev=b.t;
    if(b.nf!==null)ew=ew===null?b.nf:ew+alpha*(b.nf-ew);
    const raw=b.nf===null?null:ew,src=pools[b.session],dst=pools.RTH;
    let adjusted=null,reason='Chờ ít nhất 26 mẫu quá khứ của phiên nguồn và RTH';
    if(b.session==='WEEKEND')reason='Cuối tuần: không ánh xạ về RTH';
    else if(raw!==null&&src.length>=minSamples&&dst.length>=minSamples){
      const s=moments(src),d=moments(dst);
      if(b.session==='RTH'){adjusted=raw;reason='RTH: giữ EWMA gốc';}
      else if(s.sd>1e-9&&d.sd>1e-9){adjusted=(raw-s.mean)/s.sd*d.sd+d.mean;reason='Ánh xạ phân phối quá khứ về RTH';}
      else reason='Phân phối phẳng: chưa hiệu chỉnh';
    }
    const band=reg.length===regWindow&&adjusted!==null?regression(reg):{mid:null,upper:null,lower:null,sigma:null};
    const confidence=adjusted===null?0:Math.min(1,Math.min(src.length,dst.length)/100);
    const result={...b,raw,adjusted,...band,confidence,reason,sourceSamples:src?.length??0,rthSamples:dst.length};
    if(raw!==null&&src){src.push(raw);if(src.length>window)src.shift();}
    if(adjusted===null)reg=[];else{reg.push(adjusted);if(reg.length>regWindow)reg.shift();}
    return result;
  });
}
