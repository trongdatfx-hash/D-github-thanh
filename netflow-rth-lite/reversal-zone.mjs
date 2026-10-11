// Causal nearest-neighbour estimate for a price zone where the selected
// Strength source historically changed sign. This is descriptive statistics,
// not a trained model or a probability calibrated out of sample.
export const REVERSAL_WINDOW=6;
export const REVERSAL_HORIZON=2;
export const REVERSAL_NEIGHBORS=40;
export const REVERSAL_MIN_MATCHES=24;
export const REVERSAL_MIN_EVENTS=6;
const clamp=x=>Math.max(0,Math.min(1,x));
const sign=x=>x>0?1:x<0?-1:0;
const weights=[1.4,1,0.8,1.1,1,1.2,0.8];

function quantile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*p,lower=Math.floor(position),fraction=position-lower;
  return sorted[lower]+(sorted[lower+1]===undefined?0:fraction*(sorted[lower+1]-sorted[lower]));
}
function wilsonLower(successes,n,z=1.645){
  if(!n)return 0;
  const p=successes/n,z2=z*z,center=p+z2/(2*n),spread=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n));
  return (center-spread)/(1+z2/n);
}
function continuous(sample,step){
  for(let i=1;i<sample.length;i++)if(sample[i].price.t-sample[i-1].price.t!==step)return false;
  return true;
}
function shape(sample,direction){
  if(!direction||sample.length<2)return null;
  const prices=sample.map(x=>x.price),strength=sample.map(x=>x.strength.adjusted);
  if(!prices.every(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite))||!strength.every(Number.isFinite))return null;
  const trueRanges=prices.map((x,i)=>Math.max(x.h-x.l,i?Math.abs(x.h-prices[i-1].c):0,i?Math.abs(x.l-prices[i-1].c):0));
  const atr=trueRanges.reduce((a,b)=>a+b,0)/trueRanges.length;if(!(atr>0))return null;
  const high=Math.max(...prices.map(x=>x.h)),low=Math.min(...prices.map(x=>x.l)),range=high-low;if(!(range>0))return null;
  let progression=0;for(let i=1;i<prices.length;i++)progression+=direction>0?prices[i].h>prices[i-1].h:prices[i].l<prices[i-1].l;
  const body=prices.reduce((sum,x)=>sum+(direction*(x.c-x.o)>0?1:0),0)/prices.length;
  const closePosition=direction>0?(prices.at(-1).c-low)/range:(high-prices.at(-1).c)/range;
  const tail=prices.slice(-2),rejection=tail.reduce((sum,x)=>sum+(direction>0?x.h-Math.max(x.o,x.c):Math.min(x.o,x.c)-x.l),0)/(tail.length*atr);
  const signedMove=direction*(prices.at(-1).c-prices[0].o)/atr;
  const strengthMean=strength.reduce((sum,x)=>sum+clamp(direction*x),0)/strength.length;
  const strengthSlope=clamp(.5+direction*(strength.at(-1)-strength[0])/2);
  return {atr,direction,features:[.5+Math.atan(signedMove/2)/Math.PI,progression/(prices.length-1),body,clamp(closePosition),clamp(rejection),strengthMean,strengthSlope]};
}
function distance(a,b){
  let total=0,weight=0;for(let i=0;i<weights.length;i++){total+=weights[i]*(a[i]-b[i])**2;weight+=weights[i];}
  return Math.sqrt(total/weight);
}
function nonOverlapping(candidates,limit,window){
  const selected=[];
  for(const candidate of candidates){if(selected.every(x=>Math.abs(x.end-candidate.end)>=window)){selected.push(candidate);if(selected.length===limit)break;}}
  return selected;
}

export function reversalZone(rows,priceSymbol,source,step,{window=REVERSAL_WINDOW,horizon=REVERSAL_HORIZON,neighbors=REVERSAL_NEIGHBORS,minMatches=REVERSAL_MIN_MATCHES,minEvents=REVERSAL_MIN_EVENTS}={}){
  if(!['SPYUSDT','QQQUSDT'].includes(priceSymbol)||!['SPYUSDT','QQQUSDT','COMPOSITE'].includes(source)||!Number.isFinite(step)||step<=0||!Number.isInteger(window)||window<3||!Number.isInteger(horizon)||horizon<1||!Number.isInteger(neighbors)||neighbors<minMatches||!Number.isInteger(minMatches)||minMatches<6||!Number.isInteger(minEvents)||minEvents<1)throw Error('Tham số vùng đảo chiều không hợp lệ');
  const price=rows[priceSymbol]??[],signalMap=new Map((rows[source]??[]).map(x=>[x.t,x]));
  const items=price.map(bar=>({price:bar,strength:signalMap.get(bar.t)})),currentEnd=items.length-1,currentStart=currentEnd-window+1;
  if(currentStart<0)return {ready:false,reason:'window',n:0};
  const currentSample=items.slice(currentStart,currentEnd+1),direction=sign(currentSample.at(-1)?.strength?.adjusted);
  if(!direction||!currentSample.every(x=>x.strength)||!continuous(currentSample,step))return {ready:false,reason:'window',n:0};
  const currentShape=shape(currentSample,direction);if(!currentShape)return {ready:false,reason:'window',n:0};
  const candidates=[];
  for(let end=window-1;end+horizon<currentStart;end++){
    const sample=items.slice(end-window+1,end+1),candidateDirection=sign(sample.at(-1)?.strength?.adjusted);
    if(candidateDirection!==direction||!sample.every(x=>x.strength)||!continuous(sample,step))continue;
    const future=items.slice(end+1,end+horizon+1);if(future.length<horizon||!future.every(x=>x.strength)||!continuous([items[end],...future],step))continue;
    const candidateShape=shape(sample,direction);if(!candidateShape)continue;
    const reverseOffset=future.findIndex(x=>sign(x.strength.adjusted)===-direction)+1,reversed=reverseOffset>0;
    let levelRatio=null;
    if(reversed){
      const turnBars=items.slice(end-window+1,end+reverseOffset+1).map(x=>x.price),turn=direction>0?Math.max(...turnBars.map(x=>x.h)):Math.min(...turnBars.map(x=>x.l));
      levelRatio=clamp(direction*(turn-items[end].price.c)/candidateShape.atr/6)*6;
    }
    candidates.push({end,reversed,levelRatio,distance:distance(currentShape.features,candidateShape.features)});
  }
  const chronological=nonOverlapping([...candidates].sort((a,b)=>a.end-b.end),Infinity,window),baselineEvents=chronological.reduce((sum,x)=>sum+x.reversed,0),baselineN=chronological.length,baselineRate=baselineN?baselineEvents/baselineN:null;
  const matched=nonOverlapping([...candidates].sort((a,b)=>a.distance-b.distance||b.end-a.end),neighbors,window),events=matched.filter(x=>x.reversed&&Number.isFinite(x.levelRatio)),n=matched.length,eventCount=events.length,rate=n?eventCount/n:null,lower=wilsonLower(eventCount,n),uplift=rate!==null&&baselineRate!==null?rate-baselineRate:null;
  const statisticallyReady=n>=minMatches&&eventCount>=minEvents&&baselineN>=minMatches&&uplift>=.08&&lower>baselineRate;
  const ratios=events.map(x=>x.levelRatio),q25=quantile(ratios,.25),median=quantile(ratios,.5),q75=quantile(ratios,.75),last=price.at(-1);
  if(!statisticallyReady||![q25,median,q75,last?.c].every(Number.isFinite))return {ready:false,reason:n<minMatches?'matches':eventCount<minEvents?'events':'confidence',direction,n,eventCount,rate,lower,baselineRate,baselineN,uplift,similarity:matched.length?1-matched.reduce((sum,x)=>sum+x.distance,0)/matched.length:null};
  const projected=[last.c+direction*q25*currentShape.atr,last.c+direction*median*currentShape.atr,last.c+direction*q75*currentShape.atr],low=Math.min(...projected),high=Math.max(...projected),level=projected[1];
  return {ready:true,direction,n,eventCount,rate,lower,baselineRate,baselineN,uplift,low,level,high,start:last.t,end:last.t+horizon*step,similarity:1-matched.reduce((sum,x)=>sum+x.distance,0)/matched.length};
}
