// REV6 Pivot Zones: confirmed price pivots anchor the levels. Historical
// retests and a shuffled-increment bridge set the band width; neither is a
// calibrated probability that support or resistance will hold.
import {causalAtr,confirmedPricePivots} from './geometry.mjs';

export const PIVOT_ZONE_VERSION='REV6 Pivot Zones C×V';
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const sign=x=>x>.05?1:x<-.05?-1:0;
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),at=(sorted.length-1)*p,i=Math.floor(at);return sorted[i]+(sorted[i+1]===undefined?0:(sorted[i+1]-sorted[i])*(at-i));};
const weightedQuantile=(rows,p)=>{const sorted=rows.filter(row=>Number.isFinite(row.value)&&row.weight>0).sort((a,b)=>a.value-b.value),total=sorted.reduce((sum,row)=>sum+row.weight,0);if(!total)return null;let weight=0;for(const row of sorted){weight+=row.weight;if(weight>=p*total)return row.value;}return sorted.at(-1).value;};
export function wlrPivotPhase(composite,volume){
  if(!Number.isFinite(composite)||!Number.isFinite(volume)||composite===0||volume===0)return {key:'neutral',label:'Vàng trung tính',width:2,color:'#f6c85f',direction:0};
  if(Math.sign(composite)!==Math.sign(volume))return {key:'thin',label:'Vàng mỏng',width:1,color:'#f6c85f',direction:0};
  const direction=Math.sign(composite);return {key:direction>0?'thick_up':'thick_down',label:direction>0?'Dày xanh':'Dày đỏ',width:6,color:direction>0?'#1ae0a3':'#ff4d70',direction};
}
function rankAt(values,index){const current=values[index];if(!Number.isFinite(current))return null;let n=0,below=0;for(let j=Math.max(0,index-500);j<index;j++){if(Number.isFinite(values[j])){n++;below+=Math.abs(values[j])<=Math.abs(current);}}return n>=30?below/n:null;}
function seedRandom(seed){let state=seed>>>0||1;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};}

// Permuting the observed close-to-close increments preserves the two endpoints
// and the interval's empirical return distribution. It destroys their order,
// so this is a descriptive random-walk bridge null, not a future-price model.
export function randomWalkBridge(price,firstIndex,secondIndex,{draws=64}={}){
  if(!Array.isArray(price)||!Number.isInteger(firstIndex)||!Number.isInteger(secondIndex)||secondIndex-firstIndex<3||draws<8)return null;
  const closes=price.slice(firstIndex,secondIndex+1).map(row=>row?.c);
  if(!closes.every(Number.isFinite))return null;
  const steps=closes.slice(1).map((value,i)=>value-closes[i]),gap=steps.length,total=closes.at(-1)-closes[0],observed=Math.max(...closes.map((value,i)=>Math.abs(value-(closes[0]+total*i/gap))));
  const random=seedRandom((price[firstIndex].t^price[secondIndex].t^gap)>>>0),nullWidths=[];
  for(let draw=0;draw<draws;draw++){
    const shuffled=[...steps];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    let value=closes[0],maximum=0;for(let i=0;i<gap;i++){value+=shuffled[i];maximum=Math.max(maximum,Math.abs(value-(closes[0]+total*(i+1)/gap)));}
    nullWidths.push(maximum);
  }
  return {q75:quantile(nullWidths,.75),observed,percentile:nullWidths.filter(width=>width<=observed).length/draws,gap,draws};
}

function pivotEvents(price,pivots,atr,composite,volume,step,horizon){
  const events=[],previous={low:null,high:null};
  for(const pivot of pivots){
    const first=previous[pivot.type];previous[pivot.type]=pivot;
    if(!first||pivot.index-first.index<6||pivot.index-first.index>160)continue;
    const index=pivot.confirmedIndex,scale=atr[index],gap=pivot.index-first.index;
    if(!(scale>0)||!Number.isFinite(price[index]?.c))continue;
    const c=composite[index],v=volume[index],firstC=composite[first.index],firstV=volume[first.index],expected=pivot.type==='low'?1:-1;
    const priceExtreme=pivot.type==='low'?pivot.value<first.value-.15*scale:pivot.value>first.value+.15*scale;
    const divergence=priceExtreme&&((Number.isFinite(c)&&Number.isFinite(firstC)&&expected*(c-firstC)>.06)||(Number.isFinite(v)&&Number.isFinite(firstV)&&expected*(v-firstV)>.06));
    let offset=null;
    if(index+horizon<price.length){let continuous=true;for(let j=index+1;j<=index+horizon;j++)if(price[j].t-price[j-1].t!==step)continuous=false;
      if(continuous){const future=price.slice(index+1,index+horizon+1),extreme=pivot.type==='low'?Math.min(...future.map(bar=>bar.l)):Math.max(...future.map(bar=>bar.h));offset=(extreme-pivot.value)/scale;}}
    events.push({kind:pivot.type==='low'?'support':'resistance',first,pivot,index,at:price[index].t,atr:scale,gap,swing:Math.abs(pivot.value-first.value)/scale,compositeRank:rankAt(composite,index),volumeRank:rankAt(volume,index),compositeSign:sign(c??0),volumeSign:sign(v??0),phase:wlrPivotPhase(c,v),divergence,offset});
  }
  return events;
}
function distance(a,b){
  const rank=(x,y)=>(x===null||y===null)?.35:Math.abs(x-y);
  return .25*rank(a.compositeRank,b.compositeRank)+.25*rank(a.volumeRank,b.volumeRank)+.2*clamp(Math.abs(Math.log(a.gap/b.gap)),0,2)+.2*clamp(Math.abs(a.swing-b.swing)/2,0,2)+.1*(a.divergence!==b.divergence?1:0)+.12*(a.compositeSign!==b.compositeSign?1:0)+.12*(a.volumeSign!==b.volumeSign?1:0);
}
function zoneFor(event,events,price,step,atr,{horizon,neighbors,maxAge,draws}){
  const last=price.length-1,age=last-event.index;
  if(age>maxAge)return null;
  const bridge=randomWalkBridge(price,event.first.index,event.pivot.index,{draws});
  if(!bridge)return null;
  const rwHalf=clamp(.5*bridge.q75/Math.sqrt(bridge.gap),.15*event.atr,.6*event.atr);
  const cohort=events.filter(row=>row.kind===event.kind&&row!==event&&row.phase.key===event.phase.key&&row.index+horizon<event.index&&Number.isFinite(row.offset));
  const matched=cohort.map(row=>({...row,distance:distance(event,row)})).sort((a,b)=>a.distance-b.distance||b.index-a.index).slice(0,neighbors);
  const weighted=matched.map(row=>({value:row.offset,weight:Math.exp(-((row.distance/.55)**2))})),sum=weighted.reduce((total,row)=>total+row.weight,0),squares=weighted.reduce((total,row)=>total+row.weight**2,0),effectiveN=squares>0?sum*sum/squares:0;
  const statistical=matched.length>=12&&effectiveN>=8,q25=statistical?weightedQuantile(weighted,.25):null,q50=statistical?weightedQuantile(weighted,.5):null,q75=statistical?weightedQuantile(weighted,.75):null;
  const anchor=event.pivot.value,low=anchor+clamp(Math.min(-rwHalf,(q25??0)*event.atr),-.9*event.atr,0),high=anchor+clamp(Math.max(rwHalf,(q75??0)*event.atr),0,.9*event.atr);
  let broken=false;
  for(let i=event.index+2;i<=last;i++){
    const outside=j=>event.kind==='support'?price[j].c<low-.1*(atr[j]??event.atr):price[j].c>high+.1*(atr[j]??event.atr);
    if(outside(i-1)&&outside(i)){broken=true;break;}
  }
  if(broken)return null;
  return {kind:event.kind,low,level:anchor,high,start:event.at,end:price[last].t+4*step,pivotTime:event.pivot.t,confirmedAt:event.at,ageBars:age,divergence:event.divergence,compositeRank:event.compositeRank,volumeRank:event.volumeRank,phase:event.phase,phaseCohortN:cohort.length,n:matched.length,effectiveN,rwHalfAtr:rwHalf/event.atr,bridgePercentile:bridge.percentile,statistical,quantiles:statistical?[q25,q50,q75]:null,quantilePrices:statistical?[q25,q50,q75].map(value=>anchor+value*event.atr):null};
}

// Aggregate only the candles bracketed by two confirmed, opposite-side price
// pivots. Composite NF is taker buy quote minus taker sell quote, not an
// independent book-imbalance vote or a prediction of the next candle.
export function pivotFlowBetween(price,composite,pivots=confirmedPricePivots(price)){
  if(!Array.isArray(price)||!Array.isArray(composite)||!Array.isArray(pivots))return null;
  const second=pivots.at(-1),first=pivots.findLast(pivot=>second&&pivot.index<second.index&&pivot.type!==second.type);
  if(!first||!second||second.index-first.index<4||second.index-first.index>160)return null;
  const source=new Map(composite.map(row=>[row.t,row])),interval=price.slice(first.index,second.index+1),count=Math.min(10,Math.max(4,Math.round(Math.sqrt(interval.length)))),bins=[];
  let covered=0,totalNet=0,totalQuote=0;
  for(let bin=0;bin<count;bin++){
    const start=Math.floor(bin*interval.length/count),end=Math.floor((bin+1)*interval.length/count);
    let net=0,quote=0;
    for(const bar of interval.slice(start,end)){
      const row=source.get(bar.t);
      if(!Number.isFinite(row?.net)||!Number.isFinite(row?.q)||row.q<=0)continue;
      net+=row.net;quote+=row.q;covered++;
    }
    bins.push({net,quote,pct:quote?100*net/quote:null});totalNet+=net;totalQuote+=quote;
  }
  if(covered/interval.length<.8||!totalQuote)return null;
  return {firstPivotTime:first.t,secondPivotTime:second.t,confirmedAt:second.confirmedAt,bins,totalNet,totalQuote,pct:100*totalNet/totalQuote,coverage:covered/interval.length};
}

function percentileRank(values,current){
  const finite=values.filter(Number.isFinite);if(!finite.length||!Number.isFinite(current))return null;
  let below=0,equal=0;for(const value of finite){if(value<current)below++;else if(Math.abs(value-current)<=1e-12*Math.max(1,Math.abs(value),Math.abs(current)))equal++;}
  return 100*(below+.5*equal)/finite.length;
}
function volatilityWindow(price,source,end,step){
  if(end<5)return null;const bars=price.slice(end-5,end+1);if(bars.length!==6)return null;
  for(let i=1;i<bars.length;i++)if(bars[i].t-bars[i-1].t!==step)return null;
  let range=0,rv2=0,quote=0,net=0;
  for(let i=1;i<bars.length;i++){
    const previous=bars[i-1],bar=bars[i],flow=source.get(bar.t);
    if(!(previous.c>0)||![bar.h,bar.l,bar.c,flow?.q,flow?.net].every(Number.isFinite)||flow.q<=0)return null;
    range+=Math.max(bar.h-bar.l,Math.abs(bar.h-previous.c),Math.abs(bar.l-previous.c))/previous.c;
    const change=Math.log(bar.c/previous.c);rv2+=change*change;quote+=flow.q;net+=flow.net;
  }
  return {range:range/5,rv:Math.sqrt(rv2),activity:quote,imbalance:quote?Math.abs(net)/quote:0,session:bars.at(-1).session??'ALL'};
}
export function volatilityRegime(score,previous=null){
  if(!Number.isFinite(score))return {key:'missing',label:'—'};
  if(previous==='high'&&score>=65)return {key:'high',label:'CAO'};
  if(previous==='low'&&score<=35)return {key:'low',label:'THẤP'};
  if(score>=72)return {key:'high',label:'CAO'};
  if(score<=28)return {key:'low',label:'THẤP'};
  return {key:'medium',label:'TRUNG BÌNH'};
}
export function fiveBarVolatility(price,composite,previousRegime=null){
  if(!Array.isArray(price)||!Array.isArray(composite)||price.length<36)return null;
  const step=Number.isFinite(price.at(-1)?.end)?price.at(-1).end-price.at(-1).t+1:price.at(-1).t-price.at(-2).t;
  if(!(step>0))return null;const source=new Map(composite.map(row=>[row.t,row])),current=volatilityWindow(price,source,price.length-1,step);if(!current)return null;
  const candidates=[];for(let end=5;end<price.length-5;end++){const value=volatilityWindow(price,source,end,step);if(value)candidates.push(value);}
  const sameSession=candidates.filter(value=>value.session===current.session),baseline=(sameSession.length>=30?sameSession:candidates).slice(-500);if(baseline.length<30)return null;
  const percentiles={range:percentileRank(baseline.map(x=>x.range),current.range),rv:percentileRank(baseline.map(x=>x.rv),current.rv),activity:percentileRank(baseline.map(x=>x.activity),current.activity),imbalance:percentileRank(baseline.map(x=>x.imbalance),current.imbalance)};
  if(!Object.values(percentiles).every(Number.isFinite))return null;
  const score=Math.round(.55*percentiles.range+.25*percentiles.rv+.12*percentiles.activity+.08*percentiles.imbalance),regime=volatilityRegime(score,previousRegime);
  return {...regime,score,rangePct:100*current.range,realizedPct:100*current.rv,activityPercentile:percentiles.activity,imbalancePercentile:percentiles.imbalance,rangePercentile:percentiles.range,realizedPercentile:percentiles.rv,baselineN:baseline.length,baselineSession:sameSession.length>=30?current.session:'ALL',bars:5};
}

// The pivot anchors stay confirmed, while the display-only flow continues
// through the latest shared SPY/QQQ candle (including an unfinished candle).
// Without a usable pivot pair, keep the display alive on recent candles;
// this fallback does not create or alter any support/resistance zone.
export function pivotFlowRealtime(anchor,price,composite,serverTime,previousVolatilityRegime=null){
  if(!Array.isArray(price)||!Array.isArray(composite)||!Number.isFinite(serverTime))return null;
  const source=new Map(composite.map(row=>[row.t,row]));
  const latestShared=price.findLast(bar=>bar.t<=serverTime&&source.has(bar.t));
  const available=latestShared?price.filter(bar=>bar.t<=latestShared.t):[];
  const anchored=anchor&&available.some(bar=>bar.t===anchor.firstPivotTime)&&latestShared.t>=anchor.secondPivotTime;
  const interval=anchored?available.filter(bar=>bar.t>=anchor.firstPivotTime):available.slice(-96);
  if(interval.length<4)return null;
  const latest=interval.at(-1),live=Number.isFinite(latest.end)&&latest.end>=serverTime,count=Math.min(10,Math.max(4,Math.round(Math.sqrt(interval.length)))),bins=[],decay=Math.exp(Math.log(.5)/32);
  let covered=0,totalNet=0,totalQuote=0,weightedNet=0,weightedQuote=0;
  for(let bin=0;bin<count;bin++){
    const start=Math.floor(bin*interval.length/count),end=Math.floor((bin+1)*interval.length/count);
    let net=0,quote=0;
    for(const bar of interval.slice(start,end)){
      weightedNet*=decay;weightedQuote*=decay;
      const row=source.get(bar.t);
      if(!Number.isFinite(row?.net)||!Number.isFinite(row?.q)||row.q<=0)continue;
      net+=row.net;quote+=row.q;covered++;
      weightedNet+=row.net;weightedQuote+=row.q;
    }
    bins.push({net,quote,pct:quote?100*net/quote:null});totalNet+=net;totalQuote+=quote;
  }
  if(covered/interval.length<.8||!totalQuote)return null;
  const realtimeBins=interval.slice(-5).map(bar=>{const row=source.get(bar.t),net=Number.isFinite(row?.net)?row.net:0,quote=Number.isFinite(row?.q)&&row.q>0?row.q:0;return {t:bar.t,net,quote,pct:quote?100*net/quote:null};});
  const volatility=fiveBarVolatility(available,composite,previousVolatilityRegime);
  return {...(anchored?anchor:{}),mode:anchored?'pivot':'rolling',bins:realtimeBins,totalNet,totalQuote,pct:weightedQuote?100*weightedNet/weightedQuote:null,pctHalfLife:32,coverage:covered/interval.length,latestTime:latest.t,live,liveBinIndex:live?realtimeBins.length-1:null,volatility};
}

export function pivotZones({price=[],composite=[],volume=[]},step,{horizon=4,neighbors=60,maxAge=96,draws=64}={}){
  if(!Array.isArray(price)||!Array.isArray(composite)||!Array.isArray(volume)||!(step>0)||!Number.isInteger(horizon)||horizon<1||!Number.isInteger(neighbors)||neighbors<1||!Number.isInteger(maxAge)||maxAge<1)return {ready:false,reason:'input',support:null,resistance:null};
  if(price.length<40)return {ready:false,reason:'history',support:null,resistance:null};
  const atr=causalAtr(price),compositeMap=new Map(composite.map(row=>[row.t,row.adjusted])),volumeMap=new Map(volume.map(row=>[row.t,row.adjusted]));
  const c=price.map(row=>compositeMap.get(row.t)),v=price.map(row=>volumeMap.get(row.t)),pivots=confirmedPricePivots(price,{atr}),events=pivotEvents(price,pivots,atr,c,v,step,horizon),settings={horizon,neighbors,maxAge,draws};
  const supportEvent=events.findLast(event=>event.kind==='support'),resistanceEvent=events.findLast(event=>event.kind==='resistance');
  const support=supportEvent?zoneFor(supportEvent,events,price,step,atr,settings):null,resistance=resistanceEvent?zoneFor(resistanceEvent,events,price,step,atr,settings):null;
  return {version:PIVOT_ZONE_VERSION,ready:!!(support||resistance),reason:support||resistance?null:'no-active-pivot',support,resistance,flow:pivotFlowBetween(price,composite,pivots),asOf:price.at(-1).t};
}
