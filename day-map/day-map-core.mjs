const DAY_START=4*60,PRE_END=9*60+30,DAY_END=16*60,SLOTS=48;
const PATH_SLOTS=[0,8,16,21,25,31,39,47];
const PATH_WEIGHTS=PATH_SLOTS.map(()=>0.55);
const EXTRA_WEIGHTS=[1,1,1,1,1.1,1,1,1,1,1.1,1,1,1];

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const fmtDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

export function nyClock(t){
  const p=Object.fromEntries(fmtDay.formatToParts(t).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute),weekday:p.weekday};
}

export function weightedQuantile(values,weights,p){
  const pairs=values.map((value,i)=>({value,weight:Math.max(0,weights[i]??0)})).filter(x=>Number.isFinite(x.value)&&x.weight>0).sort((a,b)=>a.value-b.value);
  const total=pairs.reduce((s,x)=>s+x.weight,0);if(!pairs.length||total<=0)return null;
  const target=clamp(p,0,1)*total;let cumulative=0;
  for(const pair of pairs){cumulative+=pair.weight;if(cumulative>=target)return pair.value;}
  return pairs.at(-1).value;
}

function latestByDay(map,day,endMinute,{activeOnly=false}={}){
  let latest=null;
  for(const value of map?.values?.()??[]){
    const t=value.t??value.asOf??value.right;if(!Number.isFinite(t))continue;
    const clock=nyClock(t);if(clock.day!==day||clock.minute<DAY_START||clock.minute>=endMinute)continue;
    if(activeOnly&&value.active!==true)continue;
    if(!latest||t>(latest.t??latest.asOf??latest.right))latest=value;
  }
  return latest;
}

function alignmentValue(value){return value==='aligned'?1:value==='opposed'?-1:0;}
function finite(value,fallback=0){return Number.isFinite(value)?value:fallback;}

function makeFeatures(day){
  const box=day.box??{},encoding=box.encoding??{},trend=day.trend??{};
  const ruleScore=finite(encoding.ruleScore)/100,boxPercentile=finite(box.percentile,.5)-.5;
  return [
    ...PATH_SLOTS.map(i=>finite(day.path[i])),
    day.preMove,day.rthMove,day.range,day.closeLocation,
    finite(box.direction),boxPercentile,clamp(finite(box.efficiency),-4,4),clamp(finite(box.channelBars)/16,0,3),
    ruleScore,alignmentValue(box.compositeAlignment),
    finite(trend.direction),clamp(finite(trend.currentBars)/16,0,3),finite(trend.continuation,.5)-.5
  ];
}

export function buildDailyMaps({priceRows=[],boxSnapshots=new Map(),trendStates=[]}={}){
  const groups=new Map(),trendMap=new Map(trendStates.filter(x=>Number.isFinite(x?.t)).map(x=>[x.t,x]));
  for(const row of priceRows){
    const clock=nyClock(row.t);
    if(['Sat','Sun'].includes(clock.weekday)||clock.minute<DAY_START||clock.minute>=DAY_END)continue;
    if(!groups.has(clock.day))groups.set(clock.day,[]);
    groups.get(clock.day).push({...row,minute:clock.minute});
  }
  const days=[];
  for(const [day,unsorted] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    const rows=unsorted.sort((a,b)=>a.t-b.t);
    if(rows.length!==SLOTS||rows[0].minute!==DAY_START||rows.at(-1).minute!==DAY_END-15)continue;
    const preOpen=rows[0].o,rthOpen=rows.find(x=>x.minute===PRE_END)?.o;
    if(!(preOpen>0&&rthOpen>0))continue;
    const pct=value=>100*(value/preOpen-1),path=rows.map(x=>pct(x.c));
    const rth=rows.filter(x=>x.minute>=PRE_END),high=Math.max(...rth.map(x=>x.h)),low=Math.min(...rth.map(x=>x.l));
    const lastActiveTrend=[...rows].reverse().map(x=>trendMap.get(x.t)).find(x=>x?.active===true)??null;
    const directBox=[...rows].reverse().map(x=>boxSnapshots.get(x.t)).find(Boolean)??latestByDay(boxSnapshots,day,DAY_END);
    const close=rows.at(-1).c,range=100*(high-low)/preOpen,closeLocation=high>low?(close-low)/(high-low)-.5:0;
    const item={day,rows,preOpen,rthOpen,path,preMove:path[21],rthMove:100*(close/rthOpen-1),dayMove:path.at(-1),range,closeLocation,
      rthHigh:100*(high/preOpen-1),rthLow:100*(low/preOpen-1),box:directBox??null,trend:lastActiveTrend,feature:null,next:null};
    item.feature=makeFeatures(item);days.push(item);
  }
  for(let i=0;i<days.length-1;i++)days[i].next=days[i+1];
  return days;
}

function standardizer(rows){
  const n=rows[0]?.feature.length??0,mu=Array(n).fill(0),sd=Array(n).fill(0);
  for(const row of rows)for(let j=0;j<n;j++)mu[j]+=row.feature[j]/rows.length;
  for(const row of rows)for(let j=0;j<n;j++)sd[j]+=(row.feature[j]-mu[j])**2;
  for(let j=0;j<n;j++)sd[j]=Math.sqrt(sd[j]/Math.max(1,rows.length-1))||1;
  return {mu,sd};
}

function normalizedFeature(row,{mu,sd}){return row.feature.map((x,i)=>(x-mu[i])/sd[i]);}
function distance(a,b){
  const weights=[...PATH_WEIGHTS,...EXTRA_WEIGHTS];let total=0,den=0;
  for(let i=0;i<a.length;i++){const w=weights[i]??1;total+=w*(a[i]-b[i])**2;den+=w;}
  return Math.sqrt(total/Math.max(1,den));
}

function envelope(paths,weights){
  return Array.from({length:SLOTS},(_,slot)=>({
    p10:weightedQuantile(paths.map(x=>x[slot]),weights,.10),
    p25:weightedQuantile(paths.map(x=>x[slot]),weights,.25),
    p50:weightedQuantile(paths.map(x=>x[slot]),weights,.50),
    p75:weightedQuantile(paths.map(x=>x[slot]),weights,.75),
    p90:weightedQuantile(paths.map(x=>x[slot]),weights,.90)
  }));
}

export function similarDayForecast(days,index,{k=20,minSamples=12,deadband=.15}={}){
  const current=days[index];if(!current)return {ready:false,reason:'Không có ngày được chọn'};
  const candidates=days.slice(0,index).filter(x=>x.next);
  if(candidates.length<minSamples)return {ready:false,reason:`Chỉ có ${candidates.length}/${minSamples} ngày quá khứ có kết quả ngày kế tiếp`,current,candidates:[]};
  const scale=standardizer(candidates),target=normalizedFeature(current,scale);
  const ranked=candidates.map(day=>({day,distance:distance(normalizedFeature(day,scale),target)})).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(k,candidates.length));
  const bandwidth=ranked[Math.floor(ranked.length/2)]?.distance||1,rawWeights=ranked.map(x=>Math.exp(-.5*(x.distance/Math.max(.05,bandwidth))**2)),sum=rawWeights.reduce((a,b)=>a+b,0)||1,weights=rawWeights.map(x=>x/sum);
  const nextPaths=ranked.map(x=>x.day.next.path),todayPaths=ranked.map(x=>x.day.path),closes=ranked.map(x=>x.day.next.dayMove),highs=ranked.map(x=>x.day.next.rthHigh),lows=ranked.map(x=>x.day.next.rthLow);
  const neff=1/weights.reduce((s,w)=>s+w*w,0),weightedUp=weights.reduce((s,w,i)=>s+w*(closes[i]>deadband?1:0),0),weightedDown=weights.reduce((s,w,i)=>s+w*(closes[i]<-deadband?1:0),0);
  const prior=20,up=(weightedUp*neff+prior*.5)/(neff+prior),down=(weightedDown*neff+prior*.5)/(neff+prior);
  const close={p10:weightedQuantile(closes,weights,.1),p50:weightedQuantile(closes,weights,.5),p90:weightedQuantile(closes,weights,.9)};
  const weightedMean=weights.reduce((s,w,i)=>s+w*closes[i],0),variance=weights.reduce((s,w,i)=>s+w*(closes[i]-weightedMean)**2,0),se=Math.sqrt(variance/Math.max(1,neff));
  const edge=Math.max(up,down)-.5,direction=up>down?1:-1,effect=direction*close.p50,rangeExcludesZero=close.p10>0||close.p90<0;
  const evidence=Math.min(1,neff/50)*Math.min(1,Math.max(0,edge)/.10)*(rangeExcludesZero?1:.55),confidence=Math.round(100*evidence);
  const label=neff>=minSamples&&Math.max(up,down)>=.56&&effect>0&&Math.abs(close.p50)>=2*se&&rangeExcludesZero?(direction>0?'UP':'DOWN'):'WAIT';
  return {ready:true,current,ranked:ranked.map((x,i)=>({...x,weight:weights[i]})),n:ranked.length,neff,up,down,label,confidence,wait:100-confidence,referenceOnly:neff<50,
    todayEnvelope:envelope(todayPaths,weights),nextEnvelope:envelope(nextPaths,weights),close,
    high:{p10:weightedQuantile(highs,weights,.1),p50:weightedQuantile(highs,weights,.5),p90:weightedQuantile(highs,weights,.9)},
    low:{p10:weightedQuantile(lows,weights,.1),p50:weightedQuantile(lows,weights,.5),p90:weightedQuantile(lows,weights,.9)},
    diagnostics:{weightedMean,se,rangeExcludesZero,candidates:candidates.length,deadband}};
}

function covariance(matrix){
  const n=matrix.length,d=matrix[0]?.length??0,c=Array.from({length:d},()=>Array(d).fill(0));
  for(const row of matrix)for(let i=0;i<d;i++)for(let j=0;j<d;j++)c[i][j]+=row[i]*row[j]/Math.max(1,n-1);
  return c;
}
function multiply(matrix,vector){return matrix.map(row=>row.reduce((s,x,i)=>s+x*vector[i],0));}
function normalize(vector){const norm=Math.sqrt(vector.reduce((s,x)=>s+x*x,0))||1;return vector.map(x=>x/norm);}
function eigenvector(matrix,seed=0){
  let v=normalize(matrix.map((_,i)=>i===seed%matrix.length?1:.01));
  for(let k=0;k<80;k++)v=normalize(multiply(matrix,v));
  const mv=multiply(matrix,v),value=v.reduce((s,x,i)=>s+x*mv[i],0);return {v,value};
}
export function pcaProjection(days,index){
  const rows=days.slice(0,index+1);if(rows.length<3)return [];
  const scale=standardizer(rows),matrix=rows.map(x=>normalizedFeature(x,scale)),cov=covariance(matrix),first=eigenvector(cov,0);
  const deflated=cov.map((row,i)=>row.map((x,j)=>x-first.value*first.v[i]*first.v[j])),second=eigenvector(deflated,1);
  return rows.map((day,i)=>({day:day.day,x:matrix[i].reduce((s,v,j)=>s+v*first.v[j],0),y:matrix[i].reduce((s,v,j)=>s+v*second.v[j],0),target:day.next?.dayMove??null,current:i===rows.length-1}));
}

export const DAY_MAP_META={slots:SLOTS,startMinute:DAY_START,preEndMinute:PRE_END,endMinute:DAY_END,pathSlots:PATH_SLOTS};
