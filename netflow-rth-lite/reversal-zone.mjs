// REV6 V2: causal, robust nearest-neighbour estimate for a price zone where
// the selected Strength source historically changed sign. This remains
// descriptive statistics, not a trained or out-of-sample calibrated model.
import {eligibleMarketBar} from './market-calendar.mjs';

export const REVERSAL_VERSION='REV6 V2';
export const REVERSAL_WINDOW=6;
export const REVERSAL_HORIZON=2;
export const REVERSAL_NEIGHBORS=60;
export const REVERSAL_MIN_MATCHES=24;
export const REVERSAL_MIN_EFFECTIVE=15;
export const REVERSAL_MIN_EVENTS=6;
export const REVERSAL_SHRINKAGE=.45;
export const REVERSAL_PRIOR_STRENGTH=10;
const RIDGE=.1;
const clamp=(x,low=0,high=1)=>Math.max(low,Math.min(high,x));
const sign=x=>x>0?1:x<0?-1:0;

function quantile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*p,lower=Math.floor(position),fraction=position-lower;
  return sorted[lower]+(sorted[lower+1]===undefined?0:fraction*(sorted[lower+1]-sorted[lower]));
}
function weightedQuantile(values,p){
  const sorted=values.filter(x=>Number.isFinite(x.value)&&x.weight>0).sort((a,b)=>a.value-b.value),total=sorted.reduce((sum,x)=>sum+x.weight,0);
  if(!sorted.length||!(total>0))return null;
  const target=clamp(p)*total;let cumulative=0;
  for(const item of sorted){cumulative+=item.weight;if(cumulative>=target)return item.value;}
  return sorted.at(-1).value;
}
function wilsonLower(successes,n,z=1.645){
  if(!(n>0))return 0;
  const p=clamp(successes/n),z2=z*z,center=p+z2/(2*n),spread=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n));
  return (center-spread)/(1+z2/n);
}
function continuous(sample,step){
  for(let i=1;i<sample.length;i++)if(sample[i].price.t-sample[i-1].price.t!==step)return false;
  return true;
}
function commonNf(spy,qqq){
  const q=spy.q+qqq.q;return q>0?100*(spy.net+qqq.net)/q:0;
}
function slope(values){
  const n=values.length,xm=(n-1)/2,ym=values.reduce((sum,x)=>sum+x,0)/n;
  let xx=0,xy=0;for(let i=0;i<n;i++){xx+=(i-xm)**2;xy+=(i-xm)*(values[i]-ym);}
  return xx>0?xy/xx:0;
}
function squash(value,scale){return 2*Math.atan(value/scale)/Math.PI;}

function shape(sample,direction){
  if(!direction||sample.length<2)return null;
  const prices=sample.map(x=>x.price),strength=sample.map(x=>x.strength.adjusted),spies=sample.map(x=>x.spy),qqqs=sample.map(x=>x.qqq);
  if(!prices.every(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite))||!strength.every(Number.isFinite))return null;
  if(![...spies,...qqqs].every(x=>x&&[x.q,x.net,x.nf].every(Number.isFinite)))return null;
  const trueRanges=prices.map((x,i)=>Math.max(x.h-x.l,i?Math.abs(x.h-prices[i-1].c):0,i?Math.abs(x.l-prices[i-1].c):0));
  const atr=trueRanges.reduce((a,b)=>a+b,0)/trueRanges.length;if(!(atr>0))return null;
  const high=Math.max(...prices.map(x=>x.h)),low=Math.min(...prices.map(x=>x.l)),range=high-low;if(!(range>0))return null;
  let progression=0;for(let i=1;i<prices.length;i++)progression+=direction>0?prices[i].h>prices[i-1].h:prices[i].l<prices[i-1].l;
  const body=prices.reduce((sum,x)=>sum+(direction*(x.c-x.o)>0?1:0),0)/prices.length;
  const closePosition=direction>0?(prices.at(-1).c-low)/range:(high-prices.at(-1).c)/range;
  const tail=prices.slice(-2),rejection=tail.reduce((sum,x)=>sum+(direction>0?x.h-Math.max(x.o,x.c):Math.min(x.o,x.c)-x.l),0)/(tail.length*atr);
  const signedMove=direction*(prices.at(-1).c-prices[0].o)/atr;
  const strengthMean=strength.reduce((sum,x)=>sum+direction*x,0)/strength.length;
  const strengthSlope=direction*(strength.at(-1)-strength[0]);
  const totalQ=spies.reduce((sum,x)=>sum+x.q,0)+qqqs.reduce((sum,x)=>sum+x.q,0),totalNet=spies.reduce((sum,x)=>sum+x.net,0)+qqqs.reduce((sum,x)=>sum+x.net,0);
  const flow=spies.map((spy,i)=>commonNf(spy,qqqs[i])),flowTotal=totalQ>0?100*totalNet/totalQ:0;
  const pairAgreement=spies.reduce((sum,spy,i)=>sum+direction*(sign(spy.net)+sign(qqqs[i].net))/2,0)/spies.length;
  const pairSeparation=spies.reduce((sum,spy,i)=>sum+Math.abs(spy.nf-qqqs[i].nf),0)/spies.length;
  const anchor=prices[0].o;
  const pricePath=prices.map(x=>clamp(direction*(x.c-anchor)/(atr*3),-1,1));
  const strengthPath=strength.map(x=>clamp(direction*x/1.5,-1,1));
  const flowPath=flow.flatMap((value,i)=>[squash(direction*value,20),squash(spies[i].nf-qqqs[i].nf,20)]);
  return {atr,direction,session:prices.at(-1).session,features:[signedMove,progression/(prices.length-1),body,closePosition,rejection,strengthMean,strengthSlope,direction*flowTotal,direction*slope(flow),pairAgreement,pairSeparation],pricePath,strengthPath,flowPath};
}

function robustStandardize(history,current){
  const width=current.length,centers=[],scales=[];
  for(let col=0;col<width;col++){
    const values=history.map(row=>row[col]),center=quantile(values,.5),mad=quantile(values.map(x=>Math.abs(x-center)),.5),iqr=quantile(values,.75)-quantile(values,.25);
    const variance=Math.sqrt(values.reduce((sum,x)=>sum+(x-center)**2,0)/Math.max(1,values.length-1));
    centers.push(center);scales.push(mad>1e-9?1.4826*mad:iqr>1e-9?iqr/1.349:variance>1e-9?variance:1);
  }
  const transform=row=>row.map((x,i)=>(x-centers[i])/scales[i]);
  return {history:history.map(transform),current:transform(current),transform};
}
function covariance(rows,shrinkage){
  const n=rows.length,width=rows[0].length,means=Array(width).fill(0),matrix=Array.from({length:width},()=>Array(width).fill(0));
  for(const row of rows)for(let i=0;i<width;i++)means[i]+=row[i]/n;
  for(const row of rows)for(let i=0;i<width;i++)for(let j=0;j<=i;j++)matrix[i][j]+=(row[i]-means[i])*(row[j]-means[j])/Math.max(1,n-1);
  for(let i=0;i<width;i++)for(let j=0;j<width;j++){
    const raw=i>=j?matrix[i][j]:matrix[j][i];matrix[i][j]=i===j?Math.max(RIDGE,raw):(1-shrinkage)*raw;
  }
  return matrix;
}
function invert(matrix){
  const n=matrix.length,a=matrix.map((row,i)=>[...row,...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let col=0;col<n;col++){
    let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    if(Math.abs(a[pivot][col])<1e-10)return null;
    [a[col],a[pivot]]=[a[pivot],a[col]];const divisor=a[col][col];for(let j=0;j<2*n;j++)a[col][j]/=divisor;
    for(let row=0;row<n;row++)if(row!==col){const factor=a[row][col];for(let j=0;j<2*n;j++)a[row][j]-=factor*a[col][j];}
  }
  return a.map(row=>row.slice(n));
}
function mahalanobis(a,b,inverse){
  const delta=a.map((x,i)=>x-b[i]),projected=inverse.map(row=>row.reduce((sum,x,i)=>sum+x*delta[i],0));
  return Math.sqrt(Math.max(0,delta.reduce((sum,x,i)=>sum+x*projected[i],0))/delta.length);
}
function rms(a,b){return Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0)/a.length);}
function hybridDistances(current,targets,{metricHistory=targets,shrinkage=REVERSAL_SHRINKAGE}={}){
  const standardized=robustStandardize(metricHistory.map(x=>x.features),current.features),inverse=invert(covariance(standardized.history,shrinkage)),targetFeatures=targets.map(x=>standardized.transform(x.features));
  return targets.map((candidate,i)=>{
    const feature=inverse?mahalanobis(standardized.current,targetFeatures[i],inverse):rms(standardized.current,targetFeatures[i]);
    const path=Math.sqrt((rms(current.pricePath,candidate.pricePath)**2+rms(current.strengthPath,candidate.strengthPath)**2)/2),flow=rms(current.flowPath,candidate.flowPath);
    return .55*feature+.25*path+.20*flow;
  });
}
function nonOverlapping(candidates,limit,window){
  const selected=[];
  for(const candidate of candidates){if(selected.every(x=>Math.abs(x.end-candidate.end)>=window)){selected.push(candidate);if(selected.length===limit)break;}}
  return selected;
}
function neighborWeights(matched){
  const positives=matched.map(x=>x.distance).filter(x=>x>1e-9),anchor=matched[Math.min(19,matched.length-1)]?.distance,median=quantile(positives,.5),bandwidth=Math.max(.15,anchor>1e-9?anchor:median>1e-9?median:1);
  const weighted=matched.map(x=>({...x,weight:Math.exp(-((x.distance/bandwidth)**2))})),sum=weighted.reduce((s,x)=>s+x.weight,0),squares=weighted.reduce((s,x)=>s+x.weight*x.weight,0);
  return {weighted,bandwidth,sum,effectiveN:squares>0?sum*sum/squares:0};
}

export function reversalZone(rows,priceSymbol,source,step,{window=REVERSAL_WINDOW,horizon=REVERSAL_HORIZON,neighbors=REVERSAL_NEIGHBORS,minMatches=REVERSAL_MIN_MATCHES,minEffective=REVERSAL_MIN_EFFECTIVE,minEvents=REVERSAL_MIN_EVENTS,shrinkage=REVERSAL_SHRINKAGE,priorStrength=REVERSAL_PRIOR_STRENGTH}={}){
  if(!['SPYUSDT','QQQUSDT'].includes(priceSymbol)||!['SPYUSDT','QQQUSDT','COMPOSITE'].includes(source)||!Number.isFinite(step)||step<=0||!Number.isInteger(window)||window<3||!Number.isInteger(horizon)||horizon<1||!Number.isInteger(neighbors)||neighbors<minMatches||!Number.isInteger(minMatches)||minMatches<6||!Number.isFinite(minEffective)||minEffective<5||!Number.isInteger(minEvents)||minEvents<1||!(shrinkage>=0&&shrinkage<=1)||!Number.isFinite(priorStrength)||priorStrength<0)throw Error('Tham số vùng đảo chiều không hợp lệ');
  const price=rows[priceSymbol]??[],signalMap=new Map((rows[source]??[]).map(x=>[x.t,x])),spyMap=new Map((rows.SPYUSDT??[]).map(x=>[x.t,x])),qqqMap=new Map((rows.QQQUSDT??[]).map(x=>[x.t,x]));
  const items=price.map(bar=>({price:bar,strength:signalMap.get(bar.t),spy:spyMap.get(bar.t),qqq:qqqMap.get(bar.t)})),currentEnd=items.length-1,currentStart=currentEnd-window+1;
  if(currentStart<0)return {ready:false,reason:'window',n:0,version:REVERSAL_VERSION};
  const currentSample=items.slice(currentStart,currentEnd+1),direction=sign(currentSample.at(-1)?.strength?.adjusted);
  if(!direction||!currentSample.every(x=>x.strength&&x.spy&&x.qqq&&eligibleMarketBar(x.price))||!continuous(currentSample,step))return {ready:false,reason:'window',n:0,version:REVERSAL_VERSION};
  const currentShape=shape(currentSample,direction);if(!currentShape)return {ready:false,reason:'window',n:0,version:REVERSAL_VERSION};
  const candidates=[];
  for(let end=window-1;end+horizon<currentStart;end++){
    const sample=items.slice(end-window+1,end+1),candidateDirection=sign(sample.at(-1)?.strength?.adjusted);
    if(candidateDirection!==direction||!sample.every(x=>x.strength&&x.spy&&x.qqq&&eligibleMarketBar(x.price))||!continuous(sample,step))continue;
    const future=items.slice(end+1,end+horizon+1);if(future.length<horizon||!future.every(x=>x.strength&&x.spy&&x.qqq)||!continuous([items[end],...future],step))continue;
    if(!future.every(x=>eligibleMarketBar(x.price)))continue;
    const candidateShape=shape(sample,direction);if(!candidateShape)continue;
    const reverseOffset=future.findIndex(x=>sign(x.strength.adjusted)===-direction)+1,reversed=reverseOffset>0;
    let supportRatio=null,resistanceRatio=null;
    if(reversed){
      const turnBars=items.slice(end,end+reverseOffset+1).map(x=>x.price),anchor=items[end].price.c;
      const turnHigh=Math.max(...turnBars.map(x=>x.h)),turnLow=Math.min(...turnBars.map(x=>x.l));
      resistanceRatio=clamp((turnHigh-anchor)/candidateShape.atr,0,6);
      supportRatio=clamp((anchor-turnLow)/candidateShape.atr,0,6);
    }
    candidates.push({end,reversed,supportRatio,resistanceRatio,shape:candidateShape});
  }
  const reference=nonOverlapping([...candidates].sort((a,b)=>a.end-b.end),Infinity,window);
  if(reference.length<minMatches)return {ready:false,reason:'matches',direction,n:reference.length,eventCount:0,version:REVERSAL_VERSION};
  const distances=hybridDistances(currentShape,candidates.map(x=>x.shape),{metricHistory:reference.map(x=>x.shape),shrinkage});for(let i=0;i<candidates.length;i++)candidates[i].distance=distances[i];
  const baselineEvents=reference.reduce((sum,x)=>sum+x.reversed,0),baselineN=reference.length,baselineRate=baselineN?baselineEvents/baselineN:null;
  const matched=nonOverlapping([...candidates].sort((a,b)=>a.distance-b.distance||b.end-a.end),neighbors,window),{weighted,bandwidth,sum:weightSum,effectiveN}=neighborWeights(matched);
  const events=weighted.filter(x=>x.reversed&&Number.isFinite(x.supportRatio)&&Number.isFinite(x.resistanceRatio)),n=weighted.length,eventCount=events.length,weightedEvents=weighted.reduce((sum,x)=>sum+x.weight*(x.reversed?1:0),0);
  const rate=weightSum>0&&baselineRate!==null?(weightedEvents+priorStrength*baselineRate)/(weightSum+priorStrength):null,lower=rate===null?0:wilsonLower(rate*effectiveN,effectiveN),uplift=rate!==null&&baselineRate!==null?rate-baselineRate:null;
  const statisticallyReady=n>=minMatches&&effectiveN>=minEffective&&eventCount>=minEvents&&baselineN>=minMatches&&uplift>=.08&&lower>baselineRate;
  const supportQ=[.25,.5,.75].map(p=>weightedQuantile(events.map(x=>({value:x.supportRatio,weight:x.weight})),p)),resistanceQ=[.25,.5,.75].map(p=>weightedQuantile(events.map(x=>({value:x.resistanceRatio,weight:x.weight})),p)),last=price.at(-1);
  const common={version:REVERSAL_VERSION,direction,n,effectiveN,eventCount,rate,lower,baselineRate,baselineN,uplift,bandwidth,similarity:weightSum>0?Math.exp(-weighted.reduce((sum,x)=>sum+x.weight*x.distance,0)/weightSum):null};
  if(!statisticallyReady||![...supportQ,...resistanceQ,last?.c].every(Number.isFinite))return {ready:false,reason:n<minMatches?'matches':effectiveN<minEffective?'effective':eventCount<minEvents?'events':'confidence',...common};
  const supportProjected=supportQ.map(ratio=>last.c-ratio*currentShape.atr),resistanceProjected=resistanceQ.map(ratio=>last.c+ratio*currentShape.atr);
  const supportLow=Math.min(...supportProjected),supportLevel=supportProjected[1],supportHigh=Math.max(...supportProjected);
  const resistanceLow=Math.min(...resistanceProjected),resistanceLevel=resistanceProjected[1],resistanceHigh=Math.max(...resistanceProjected);
  const primary=direction>0?[resistanceLow,resistanceLevel,resistanceHigh]:[supportLow,supportLevel,supportHigh];
  return {ready:true,...common,low:primary[0],level:primary[1],high:primary[2],supportLow,supportLevel,supportHigh,resistanceLow,resistanceLevel,resistanceHigh,start:last.t,end:last.t+horizon*step};
}
