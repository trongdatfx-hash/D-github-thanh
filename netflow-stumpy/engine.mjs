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
export function parseKlines(rows,now,step,{includeOpen=false}={}){
  if(!Array.isArray(rows)||!Number.isFinite(now)||!Object.values(STEPS).includes(step))throw Error('Kline/thời gian không hợp lệ');
  const map=new Map();
  for(const k of rows){
    if(!Array.isArray(k)||k.length<11)throw Error('Kline thiếu trường quote volume');
    const t=+k[0],o=+k[1],h=+k[2],l=+k[3],c=+k[4],v=+k[5],end=+k[6],q=+k[7],buy=+k[10];
    if(![t,o,h,l,c,v,end,q,buy].every(Number.isFinite)||t%step||end!==t+step-1||v<0||q<0||buy<0||buy>q||l>Math.min(o,c)||h<Math.max(o,c)||l>h||l<=0)throw Error('Kline hoặc volume không hợp lệ');
    if(!includeOpen&&end>=now)continue;
    map.set(t,{t,end,o,h,l,c,v,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)});
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
function thresholdSign(value,threshold){return value>threshold?1:value< -threshold?-1:0;}
function detailedFlowState(spy,qqq,threshold){
  const s=thresholdSign(spy,threshold),q=thresholdSign(qqq,threshold);
  if(s>0&&q>0)return 'THUẬN MUA';if(s<0&&q<0)return 'THUẬN BÁN';
  if(s>0&&q<0)return 'NGHỊCH · SPY mua / QQQ bán';if(s<0&&q>0)return 'NGHỊCH · SPY bán / QQQ mua';
  if(s>0)return 'SPY DẪN MUA';if(s<0)return 'SPY DẪN BÁN';if(q>0)return 'QQQ DẪN MUA';if(q<0)return 'QQQ DẪN BÁN';return 'TRUNG TÍNH';
}
function causalPercentile(history,value){return history.length<20?.35:history.reduce((n,x)=>n+(x<=value),0)/history.length;}
export function flowAlignment(spy,qqq,{halfLife=2,step=null,neutralThreshold=5,volumeWindow=100}={}){
  if(!Number.isFinite(halfLife)||halfLife<=0||!Number.isFinite(neutralThreshold)||neutralThreshold<0||!Number.isInteger(volumeWindow)||volumeWindow<20)throw Error('Tham số SPY/QQQ flow không hợp lệ');
  const other=new Map(qqq.map(x=>[x.t,x]));
  const alpha=1-2**(-1/halfLife),spyVolumes=[],qqqVolumes=[];let smoothSpy=null,smoothQqq=null,previous=null;
  return spy.flatMap(a=>{
    const b=other.get(a.t);if(!b)return [];
    if(step!==null&&previous!==null&&a.t-previous!==step){smoothSpy=null;smoothQqq=null;spyVolumes.length=0;qqqVolumes.length=0;}previous=a.t;
    let state,score;
    if(a.net>0&&b.net>0){state='THUẬN MUA';score=1;}
    else if(a.net<0&&b.net<0){state='THUẬN BÁN';score=-1;}
    else if(a.net>0&&b.net<0){state='NGHỊCH · SPY mua / QQQ bán';score=.45;}
    else if(a.net<0&&b.net>0){state='NGHỊCH · SPY bán / QQQ mua';score=-.45;}
    else{state='TRUNG TÍNH';score=0;}
    const intensity=Math.min(1,Math.min(Math.abs(a.nf??0),Math.abs(b.nf??0))/50);
    const valid=Number.isFinite(a.nf)&&Number.isFinite(b.nf);
    if(valid){smoothSpy=smoothSpy===null?a.nf:smoothSpy+alpha*(a.nf-smoothSpy);smoothQqq=smoothQqq===null?b.nf:smoothQqq+alpha*(b.nf-smoothQqq);}else{smoothSpy=null;smoothQqq=null;}
    const totalQ=(a.q??0)+(b.q??0),commonNf=totalQ>0?100*((a.net??0)+(b.net??0))/totalQ:null;
    const relative=valid?(smoothSpy-smoothQqq)/2:null;
    const opposition=valid?Math.min(1,Math.sqrt(Math.max(0,-smoothSpy*smoothQqq))/50):0;
    const agreement=valid?Math.min(1,Math.sqrt(Math.max(0,smoothSpy*smoothQqq))/50):0;
    const volumeConfidence=Math.min(causalPercentile(spyVolumes,a.q??0),causalPercentile(qqqVolumes,b.q??0));
    spyVolumes.push(a.q??0);qqqVolumes.push(b.q??0);if(spyVolumes.length>volumeWindow)spyVolumes.shift();if(qqqVolumes.length>volumeWindow)qqqVolumes.shift();
    return [{t:a.t,state,score,intensity,detailState:valid?detailedFlowState(smoothSpy,smoothQqq,neutralThreshold):'TRUNG TÍNH',smoothSpyNf:smoothSpy,smoothQqqNf:smoothQqq,commonNf,relative,opposition,agreement,volumeConfidence,spyNet:a.net,qqqNet:b.net,spyNf:a.nf,qqqNf:b.nf}];
  });
}
export function relativeFlowColor(row){
  const alpha=.36+.5*Math.min(1,Math.min(Math.abs(row?.spyNf??0),Math.abs(row?.qqqNf??0))/50);
  return row?.spyNet>0&&row?.qqqNet>0?`rgba(26,224,163,${alpha})`:row?.spyNet<0&&row?.qqqNet<0?`rgba(255,77,112,${alpha})`:(row?.spyNet??0)*(row?.qqqNet??0)<0?`rgba(245,166,35,${alpha})`:'rgba(112,126,145,.30)';
}
export function strengthAgreementCandleSignal(compositeBar,volumeBar){
  const compositeStrength=compositeBar?.adjusted,volumeStrength=volumeBar?.adjusted;
  const values={compositeStrength:Number.isFinite(compositeStrength)?compositeStrength:null,volumeStrength:Number.isFinite(volumeStrength)?volumeStrength:null};
  if(!Number.isFinite(compositeStrength)||!Number.isFinite(volumeStrength))return {...values,adjusted:0,direction:0,agreement:0,colorRegime:'TRUNG TÍNH',neutralReason:'THIẾU DỮ LIỆU'};
  if(compositeStrength===0||volumeStrength===0)return {...values,adjusted:0,direction:0,agreement:0,colorRegime:'TRUNG TÍNH',neutralReason:'CÓ NGUỒN BẰNG 0'};
  if(Math.sign(compositeStrength)!==Math.sign(volumeStrength))return {...values,adjusted:0,direction:0,agreement:0,colorRegime:'TRUNG TÍNH',neutralReason:'TRÁI DẤU'};
  const direction=Math.sign(compositeStrength),agreement=Math.min(1,Math.min(Math.abs(compositeStrength),Math.abs(volumeStrength)));
  return {...values,adjusted:direction*agreement,direction,agreement,colorRegime:direction>0?'ĐỒNG THUẬN TĂNG':'ĐỒNG THUẬN GIẢM',neutralReason:null};
}
export function priceVolumeCandleSignal(priceBar,volumeBar,{deadband=.15}={}){
  if(!Number.isFinite(deadband)||deadband<0||deadband>=1)throw Error('Dead-band màu nến không hợp lệ');
  const priceDirection=Number.isFinite(priceBar?.o)&&Number.isFinite(priceBar?.c)?Math.sign(priceBar.c-priceBar.o):0;
  const volumeStrength=volumeBar?.adjusted,volumeDirection=Number.isFinite(volumeStrength)&&Math.abs(volumeStrength)>deadband?Math.sign(volumeStrength):0;
  if(!priceDirection||!volumeDirection)return {priceDirection,volumeDirection,volumeStrength:Number.isFinite(volumeStrength)?volumeStrength:null,agreement:0,colorRegime:'TRUNG TÍNH'};
  const agreement=priceDirection===volumeDirection?1:-1;
  return {priceDirection,volumeDirection,volumeStrength,agreement,colorRegime:agreement>0?(priceDirection>0?'GIÁ TĂNG · SPY V ỦNG HỘ':'GIÁ GIẢM · SPY V ỦNG HỘ'):(priceDirection>0?'GIÁ TĂNG · SPY V CHỐNG':'GIÁ GIẢM · SPY V CHỐNG')};
}
export function strengthPhaseLineWidth(compositeBar,volumeBar,{thin=1,neutral=2,thick=6}={}){
  if(![thin,neutral,thick].every(Number.isFinite)||thin<=0||neutral<thin||thick<neutral)throw Error('Tham số độ dày theo pha không hợp lệ');
  const composite=compositeBar?.adjusted,volume=volumeBar?.adjusted;
  if(!Number.isFinite(composite)||!Number.isFinite(volume)||composite===0||volume===0)return neutral;
  return Math.sign(composite)===Math.sign(volume)?thick:thin;
}
export function strengthPhaseLineStyle(compositeBar,volumeBar,{thin=1,neutral=2,thick=6,positive='#1ae0a3',negative='#ff4d70',base='#f6c85f'}={}){
  const width=strengthPhaseLineWidth(compositeBar,volumeBar,{thin,neutral,thick}),composite=compositeBar?.adjusted,volume=volumeBar?.adjusted;
  const direction=width===thick&&Number.isFinite(composite)&&Number.isFinite(volume)&&Math.sign(composite)===Math.sign(volume)?Math.sign(composite):0;
  return {width,direction,color:direction>0?positive:direction<0?negative:base};
}
export function normCDF(z){
  z=Math.max(-8,Math.min(8,z));
  const a=Math.abs(z),t=1/(1+.2316419*a),d=.3989422804014327*Math.exp(-a*a/2);
  const p=d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return z>=0?1-p:p;
}
// DVP Strength chain, with Binance taker NetFlowQ / quote volume replacing
// TradingView up/down volume. Every state value uses the current and past bars only.
export function calculateStrength(bars,step,{normLen=20,strLen=8,halfLife=2,lookback=500}={}){
  if(!Object.values(STEPS).includes(step)||![normLen,strLen,lookback].every(x=>Number.isInteger(x)&&x>0)||!Number.isFinite(halfLife)||halfLife<0)throw Error('Tham số Strength không hợp lệ');
  let volumes=[],deltas=[],magnitudes=[],ew=null;
  const alpha=halfLife>0?1-2**(-1/Math.max(1,halfLife)):1;
  return bars.map(b=>{
    volumes.push(b.q);if(volumes.length>normLen)volumes.shift();
    const mean=volumes.reduce((s,v)=>s+v,0)/normLen;
    const delta=volumes.length===normLen&&mean>0?b.net/mean:b.net;
    deltas.push(delta);if(deltas.length>strLen)deltas.shift();
    if(deltas.length<strLen)return null;
    const r=deltas.reduce((s,v)=>s+v,0);
    ew=ew===null?r:ew+alpha*(r-ew);
    const rs=halfLife>0?ew:r;
    magnitudes.push(Math.abs(rs));if(magnitudes.length>lookback)magnitudes.shift();
    if(magnitudes.length<lookback)return null;
    const sigma=magnitudes.reduce((s,v)=>s+v,0)/lookback*Math.sqrt(Math.PI/2);
    return sigma>0?2*normCDF(rs/sigma)-1:0;
  });
}
// Directional SPY Strength from Binance original base-asset volume (kline[5]).
// Each candle assigns its original volume to the candle-body direction; doji volume is neutral.
// The rest of the causal normalization/smoothing mirrors the existing Strength chain.
export function directionalVolumeDelta(bars,step,{normLen=20}={}){
  if(!Array.isArray(bars)||!Object.values(STEPS).includes(step)||!Number.isInteger(normLen)||normLen<1)throw Error('Tham số Volume Delta không hợp lệ');
  let volumes=[],previous=null;
  return bars.map(b=>{
    if(previous!==null&&b.t-previous!==step)volumes=[];previous=b.t;
    if(!Number.isFinite(b.v)||b.v<0||![b.o,b.c].every(Number.isFinite))throw Error('SPY thiếu volume gốc Binance');
    volumes.push(b.v);if(volumes.length>normLen)volumes.shift();
    const mean=volumes.reduce((s,x)=>s+x,0)/volumes.length,direction=b.c>b.o?1:b.c<b.o?-1:0;
    return {t:b.t,value:mean>0?direction*b.v/mean:0,volume:b.v,mean,direction};
  });
}
export function volumeDeltaStrengthColor(deltaValue,strengthValue){
  const intensity=Math.min(1,Math.abs(Number.isFinite(deltaValue)?deltaValue:0)/2),alpha=.42+.5*intensity;
  const deltaSign=deltaValue>0?1:deltaValue<0?-1:0,strengthSign=strengthValue>0?1:strengthValue<0?-1:0;
  if(!deltaSign)return 'rgba(0,0,0,0)';
  if(strengthSign>0)return deltaSign>0?`rgba(26,224,163,${alpha})`:`rgba(20,86,255,${alpha})`;
  if(strengthSign<0)return deltaSign>0?`rgba(255,168,184,${alpha})`:`rgba(255,77,112,${alpha})`;
  return deltaSign>0?`rgba(26,224,163,${alpha})`:`rgba(255,77,112,${alpha})`;
}
export function volumeDeltaStrengthValue(deltaValue){
  return Number.isFinite(deltaValue)?Math.max(-1,Math.min(1,deltaValue/2)):0;
}
export function symmetricPriceRange(range,{floor=1}={}){
  if(!Number.isFinite(range?.minValue)||!Number.isFinite(range?.maxValue)||!Number.isFinite(floor)||floor<=0)throw Error('Miền giá đối xứng không hợp lệ');
  const bound=Math.max(floor,Math.abs(range.minValue),Math.abs(range.maxValue));
  return {minValue:-bound,maxValue:bound};
}
export function calculateVolumeStrength(bars,step,{normLen=20,strLen=8,halfLife=2,lookback=500}={}){
  if(!Array.isArray(bars)||!Object.values(STEPS).includes(step)||![normLen,strLen,lookback].every(x=>Number.isInteger(x)&&x>0)||!Number.isFinite(halfLife)||halfLife<0)throw Error('Tham số Volume Strength không hợp lệ');
  const deltas=directionalVolumeDelta(bars,step,{normLen});let impulses=[],magnitudes=[],ew=null,previous=null;
  const alpha=halfLife>0?1-2**(-1/Math.max(1,halfLife)):1;
  return deltas.map(delta=>{
    if(previous!==null&&delta.t-previous!==step){impulses=[];magnitudes=[];ew=null;}previous=delta.t;
    impulses.push(delta.value);if(impulses.length>strLen)impulses.shift();
    if(impulses.length<strLen)return null;
    const r=impulses.reduce((s,x)=>s+x,0);
    ew=ew===null?r:ew+alpha*(r-ew);
    const rs=halfLife>0?ew:r;
    magnitudes.push(Math.abs(rs));if(magnitudes.length>lookback)magnitudes.shift();
    if(magnitudes.length<lookback)return null;
    const sigma=magnitudes.reduce((s,x)=>s+x,0)/magnitudes.length*Math.sqrt(Math.PI/2);
    return sigma>0?2*normCDF(rs/sigma)-1:0;
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
// Linearly weighted least squares on PRIOR closes, predicting the current bar.
// Recent observations receive weights 1..window; bands use weighted residual sigma.
export function weightedPriceBands(bars,step,{window=50,mult=2}={}){
  if(!Array.isArray(bars)||!Object.values(STEPS).includes(step)||!Number.isInteger(window)||window<3||!Number.isFinite(mult)||mult<=0)throw Error('Tham số WLR giá không hợp lệ');
  let history=[],prev=null;
  return bars.map(b=>{
    if(prev!==null&&b.t-prev!==step)history=[];prev=b.t;
    let mid=null,upper=null,lower=null,sigma=null;
    if(history.length>=window){
      const sample=history.slice(-window),y=sample.map(x=>x.c),weights=sample.map((x,i)=>i+1),sw=window*(window+1)/2;
      let sx=0,sy=0,sxx=0,sxy=0;
      for(let i=0;i<window;i++){const w=weights[i];sx+=w*i;sy+=w*y[i];sxx+=w*i*i;sxy+=w*i*y[i];}
      const den=sw*sxx-sx*sx,slope=(sw*sxy-sx*sy)/den,intercept=(sy-slope*sx)/sw;
      let sse=0;for(let i=0;i<window;i++){const e=y[i]-intercept-slope*i;sse+=weights[i]*e*e;}
      sigma=Math.sqrt(sse/sw);mid=intercept+slope*window;upper=mid+mult*sigma;lower=mid-mult*sigma;
    }
    history.push({t:b.t,c:b.c});if(history.length>window)history.shift();
    return {t:b.t,mid,upper,lower,sigma};
  });
}
// Causal WLR-8 trend quality for price-line thickness. The current candle is
// excluded from both the fit and ATR, while the slope percentile uses only
// previously observed normalized slopes.
export function wlrTrendThickness(bars,step,{window=8,atrWindow=14,percentileWindow=500,minHistory=20,minWidth=1,maxWidth=6}={}){
  if(!Array.isArray(bars)||!Object.values(STEPS).includes(step)||![window,atrWindow,percentileWindow,minHistory].every(x=>Number.isInteger(x)&&x>1)||![minWidth,maxWidth].every(Number.isFinite)||minWidth<=0||maxWidth<minWidth)throw Error('Tham số độ dày WLR trend không hợp lệ');
  let history=[],ranges=[],strengthHistory=[],previous=null;
  return bars.map(bar=>{
    if(previous!==null&&bar.t-previous!==step){history=[];ranges=[];strengthHistory=[];}previous=bar.t;
    let slope=null,r2=null,normalizedSlope=null,slopePercentile=null,quality=null,width=null;
    if(history.length>=window&&ranges.length>=atrWindow){
      const sample=history.slice(-window),weights=sample.map((_,i)=>i+1),sw=window*(window+1)/2;
      let sx=0,sy=0,sxx=0,sxy=0;for(let i=0;i<window;i++){const w=weights[i],y=sample[i].c;sx+=w*i;sy+=w*y;sxx+=w*i*i;sxy+=w*i*y;}
      const den=sw*sxx-sx*sx;slope=(sw*sxy-sx*sy)/den;const intercept=(sy-slope*sx)/sw,mean=sy/sw;
      let sse=0,sst=0;for(let i=0;i<window;i++){const w=weights[i],y=sample[i].c,e=y-intercept-slope*i;sse+=w*e*e;sst+=w*(y-mean)**2;}
      r2=sst>0?Math.max(0,Math.min(1,1-sse/sst)):Math.abs(slope)<1e-12?1:0;
      const atr=ranges.slice(-atrWindow).reduce((sum,x)=>sum+x,0)/atrWindow;
      normalizedSlope=atr>0?Math.abs(slope)*window/atr:0;
      slopePercentile=normalizedSlope<=1e-12?0:strengthHistory.length>=minHistory?strengthHistory.reduce((n,x)=>n+(x<=normalizedSlope),0)/strengthHistory.length:Math.max(0,Math.min(1,normalizedSlope/2));
      quality=slopePercentile*(.35+.65*r2);width=minWidth+(maxWidth-minWidth)*quality**.7;
      strengthHistory.push(normalizedSlope);if(strengthHistory.length>percentileWindow)strengthHistory.shift();
    }
    const prevClose=history.at(-1)?.c,trueRange=[bar.h-bar.l,Number.isFinite(prevClose)?Math.abs(bar.h-prevClose):0,Number.isFinite(prevClose)?Math.abs(bar.l-prevClose):0].filter(Number.isFinite);
    if(Number.isFinite(bar.c)){history.push({c:bar.c});if(history.length>Math.max(window,2))history.shift();}
    if(trueRange.length){ranges.push(Math.max(...trueRange));if(ranges.length>atrWindow)ranges.shift();}
    return {t:bar.t,slope,r2,normalizedSlope,slopePercentile,quality,width};
  });
}
export function candleRegimeClusters(bars,volumeRows,step,{enter=.22,oppositeBars=2}={}){
  if(!Array.isArray(bars)||!Array.isArray(volumeRows)||!Object.values(STEPS).includes(step)||!Number.isFinite(enter)||enter<=0||enter>=1||!Number.isInteger(oppositeBars)||oppositeBars<1)throw Error('Tham số cụm màu nến không hợp lệ');
  const trend=wlrTrendThickness(bars,step),volumeMap=new Map(volumeRows.map(row=>[row.t,row.adjusted]));let rawHistory=[],ranges=[],group=0,pending=0,previousTime=null,previousClose=null;
  return bars.map((bar,index)=>{
    if(previousTime!==null&&bar.t-previousTime!==step){rawHistory=[];ranges=[];group=0;pending=0;previousClose=null;}previousTime=bar.t;
    const fit=trend[index],trendComponent=Number.isFinite(fit.normalizedSlope)?Math.sign(fit.slope)*Math.tanh(fit.normalizedSlope):0,volumeValue=volumeMap.get(bar.t),volumeComponent=Number.isFinite(volumeValue)?Math.max(-1,Math.min(1,volumeValue)):0;
    const atr=ranges.length?ranges.reduce((sum,value)=>sum+value,0)/ranges.length:null,bodyComponent=atr>1e-12?Math.tanh(((bar.c-bar.o)/atr)/.35):0;
    const raw=.45*trendComponent+.35*volumeComponent+.20*bodyComponent;rawHistory.push(raw);if(rawHistory.length>3)rawHistory.shift();
    const weights=rawHistory.length===1?[1]:rawHistory.length===2?[.375,.625]:[.20,.30,.50],smooth=rawHistory.reduce((sum,value,i)=>sum+value*weights[i],0),candidate=smooth>enter?1:smooth< -enter?-1:0;
    let transition=false;if(group===0){if(candidate)group=candidate;pending=0;}else if(candidate===-group){pending++;transition=true;if(pending>=oppositeBars){group=candidate;pending=0;transition=false;}}else pending=0;
    const magnitude=Math.abs(smooth),level=magnitude>=.65?'strong':magnitude>=.35?'medium':'weak',priceDirection=Math.sign(bar.c-bar.o),counter=group!==0&&priceDirection!==0&&priceDirection!==group;
    const trueRange=Math.max(bar.h-bar.l,Number.isFinite(previousClose)?Math.abs(bar.h-previousClose):0,Number.isFinite(previousClose)?Math.abs(bar.l-previousClose):0);if(Number.isFinite(trueRange)){ranges.push(trueRange);if(ranges.length>14)ranges.shift();}previousClose=bar.c;
    return {t:bar.t,group,raw,smooth,level,priceDirection,counter,transition,trendComponent,volumeComponent,bodyComponent};
  });
}
// Continuous taker CVD grouped by close-price bins. It never resets inside the loaded history.
// The vertical EMA follows the Pine reference exactly: low-price bins toward high-price bins.
export function continuousCvdSpectrum(bars,{binStep=.5,range=12,smooth=2}={}){
  if(!Array.isArray(bars)||!Number.isFinite(binStep)||binStep<=0||!Number.isFinite(range)||range<=0||!Number.isInteger(smooth)||smooth<1)throw Error('Tham số phổ CVD không hợp lệ');
  if(!bars.length)return {bins:[],maxAbs:0,binStep,range};
  const accumulated=new Map;
  for(const bar of bars){
    if(!Number.isFinite(bar.c)||!Number.isFinite(bar.net))continue;
    const key=Math.round(bar.c/binStep);accumulated.set(key,(accumulated.get(key)??0)+bar.net);
  }
  const center=bars.at(-1).c,low=Math.round((center-range)/binStep),high=Math.round((center+range)/binStep);
  const bins=[...accumulated.entries()].filter(([key])=>key>=low&&key<=high).sort((a,b)=>a[0]-b[0]).map(([key,value])=>({price:key*binStep,value}));
  if(smooth>1&&bins.length){const alpha=2/(smooth+1);let ema=bins[0].value;for(let i=1;i<bins.length;i++){ema=alpha*bins[i].value+(1-alpha)*ema;bins[i]={...bins[i],value:ema};}}
  const maxAbs=bins.reduce((m,x)=>Math.max(m,Math.abs(x.value)),0);
  return {bins,maxAbs,binStep,range};
}
export function projectNetFlowToPrice(priceBars,flowBars){
  if(!Array.isArray(priceBars)||!Array.isArray(flowBars))throw Error('Nguồn giá/NetFlow không hợp lệ');
  const flow=new Map(flowBars.filter(x=>Number.isFinite(x?.t)&&Number.isFinite(x?.net)).map(x=>[x.t,x.net]));
  return priceBars.flatMap(bar=>Number.isFinite(bar?.t)&&Number.isFinite(bar?.c)&&flow.has(bar.t)?[{t:bar.t,c:bar.c,net:flow.get(bar.t)}]:[]);
}
export function dayBoundaryTimes(bars){
  if(!Array.isArray(bars))throw Error('Dữ liệu phân tách ngày không hợp lệ');
  const result=[];let previousDay=null;
  for(const bar of bars){
    if(!Number.isFinite(bar?.t)||typeof bar?.day!=='string')throw Error('Nến phân tách ngày không hợp lệ');
    if(previousDay!==null&&bar.day!==previousDay)result.push(bar.t);
    previousDay=bar.day;
  }
  return result;
}
// Replace this adapter with a versioned model ONLY after dataset/backtest validation.
export const modelStatus={trained:false,method:'DVP Strength chain on NetFlowQ/quote volume; past-only session location/scale → RTH'};
export function analyze(bars,step,{minSamples=26,window=500,regWindow=50,strength=calculateStrength(bars,step)}={}){
  if(strength.length!==bars.length)throw Error('Chuỗi Strength không khớp dữ liệu');
  let reg=[];
  const pools=Object.fromEntries(['NIGHT','PRE','RTH','POST'].map(s=>[s,[]]));
  return bars.map((b,i)=>{
    const raw=Number.isFinite(strength[i])?strength[i]:null,src=pools[b.session],dst=pools.RTH;
    let adjusted=raw,reason=raw===null?'Đang khởi động Strength':`Chưa đủ ${minSamples} mẫu phiên: tạm giữ Strength gốc`;
    if(raw!==null&&b.session==='WEEKEND')reason='Cuối tuần: giữ Strength gốc';
    else if(raw!==null&&src.length>=minSamples&&dst.length>=minSamples){
      const s=moments(src),d=moments(dst);
      if(b.session==='RTH'){adjusted=raw;reason='RTH: giữ Strength gốc';}
      else if(s.sd>1e-9&&d.sd>1e-9){adjusted=(raw-s.mean)/s.sd*d.sd+d.mean;reason='Ánh xạ phân phối quá khứ về RTH';}
      else reason='Phân phối phẳng: giữ Strength gốc';
    }
    const band=reg.length===regWindow&&adjusted!==null?regression(reg):{mid:null,upper:null,lower:null,sigma:null};
    const confidence=adjusted===null?0:Math.min(1,Math.min(src?.length??0,dst.length)/100);
    const result={...b,raw,adjusted,...band,confidence,reason,sourceSamples:src?.length??0,rthSamples:dst.length};
    if(raw!==null&&src){src.push(raw);if(src.length>window)src.shift();}
    if(adjusted===null)reg=[];else{reg.push(adjusted);if(reg.length>regWindow)reg.shift();}
    return result;
  });
}
