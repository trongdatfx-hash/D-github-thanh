const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;

function linearFit(rows){
  const n=rows.length,xMean=(n-1)/2,yMean=mean(rows.map(row=>row.c));let covariance=0,variance=0,residual=0,total=0;
  for(let i=0;i<n;i++){covariance+=(i-xMean)*(rows[i].c-yMean);variance+=(i-xMean)**2;}
  const slope=variance>1e-12?covariance/variance:0,intercept=yMean-slope*xMean;
  for(let i=0;i<n;i++){residual+=(rows[i].c-intercept-slope*i)**2;total+=(rows[i].c-yMean)**2;}
  return {slope,intercept,r2:total>1e-12?Math.max(0,Math.min(1,1-residual/total)):0,sigma:n>2?Math.sqrt(residual/(n-2)):0,valueAt:index=>intercept+slope*index};
}

function trueRange(rows,index){
  const row=rows[index],previous=rows[index-1];
  return previous?Math.max(row.h-row.l,Math.abs(row.h-previous.c),Math.abs(row.l-previous.c)):row.h-row.l;
}
function atrAt(rows,index,period=14){const values=[];for(let i=Math.max(0,index-period+1);i<=index;i++)values.push(trueRange(rows,i));return values.length?mean(values):0;}
const outside=(value,boundary,direction,margin=0)=>direction>0?value>boundary+margin:value<boundary-margin;

// The start is the first breakout-side candle whose SPY V sign agrees. A later
// closed candle confirms the channel; historical rendering keeps both times.
export function causalTrendChannels(rows,{volumeRows=[],priorWindow=20,fastWindow=8,minPriorR2=.35,breakAtr=.15,channelAtr=.45,channelSigma=2,maxBars=Infinity,maxHistory=5}={}){
  if(!Number.isInteger(priorWindow)||priorWindow<12||!Number.isInteger(fastWindow)||fastWindow<4||!(channelSigma>0))throw Error('Tham số Kênh trend causal không hợp lệ');
  const clean=rows.filter(row=>['PRE','RTH'].includes(row.session)&&[row.t,row.o,row.h,row.l,row.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t),volumeMap=new Map(volumeRows.map(row=>[row.t,row.adjusted])),trends=[];
  for(let i=priorWindow;i<clean.length-1;i++){
    const candidate=clean[i];
    const prior=clean.slice(i-priorWindow,i);if(prior.some(row=>row.day!==candidate.day))continue;
    const priorFit=linearFit(prior),atr=atrAt(clean,i);if(!(atr>1e-12)||priorFit.r2<minPriorR2)continue;
    const width=Math.max(priorFit.sigma*1.65,atr*.35),center0=priorFit.valueAt(priorWindow),upperBreak=center0+width+atr*breakAtr,lowerBreak=center0-width-atr*breakAtr,direction=candidate.c>upperBreak?1:candidate.c<lowerBreak?-1:0;
    if(!direction)continue;
    let startIndex=Math.sign(volumeMap.get(candidate.t))===direction?i:-1,confirmationIndex=-1,confirmFast=null;for(let j=i+1;j<Math.min(clean.length,i+4);j++){const row=clean[j];if(row.day!==candidate.day)break;const projected=priorFit.valueAt(priorWindow+j-i)+direction*width,rolling=linearFit(clean.slice(j-fastWindow+1,j+1));if(!outside(row.c,projected,direction)||Math.sign(rolling.slope)!==direction)continue;if(startIndex<0&&Math.sign(volumeMap.get(row.t))===direction)startIndex=j;if(startIndex>=0){confirmationIndex=j;confirmFast=rolling;break;}}
    if(startIndex<0||confirmationIndex<0)continue;
    const start=clean[startIndex],confirmation=clean[confirmationIndex],seedSlope=confirmFast.slope,seedWidth=Math.max(channelAtr*atr,confirmFast.sigma*channelSigma),anchor=start.c,points=[];let insideEndIndex=confirmationIndex,exitIndex=-1,latestFit=confirmFast;
    for(let j=startIndex;j<=confirmationIndex;j++){const center=anchor+seedSlope*(j-startIndex);points.push({time:clean[j].t,center,upper:center+seedWidth,lower:center-seedWidth,r2:confirmFast.r2,sigma:confirmFast.sigma,inside:true});}
    for(let j=confirmationIndex+1;j<clean.length&&j-confirmationIndex<maxBars;j++){
      const row=clean[j];if(row.day!==candidate.day||!['PRE','RTH'].includes(row.session))break;
      const accepted=clean.slice(startIndex,insideEndIndex+1),fit=accepted.length>=4?linearFit(accepted):confirmFast,center=accepted.length>=4?fit.valueAt(accepted.length):anchor+seedSlope*(j-startIndex),width=Math.max(channelAtr*atrAt(clean,j-1),fit.sigma*channelSigma);
      if(row.c>center+width||row.c<center-width){exitIndex=j;points.push({time:row.t,center,upper:center+width,lower:center-width,r2:fit.r2,sigma:fit.sigma,inside:false});break;}
      insideEndIndex=j;const updated=clean.slice(startIndex,j+1),updatedFit=updated.length>=4?linearFit(updated):confirmFast,updatedCenter=updated.length>=4?updatedFit.valueAt(updated.length-1):center,updatedWidth=Math.max(channelAtr*atrAt(clean,j),updatedFit.sigma*channelSigma);latestFit=updatedFit;points.push({time:row.t,center:updatedCenter,upper:updatedCenter+updatedWidth,lower:updatedCenter-updatedWidth,r2:updatedFit.r2,sigma:updatedFit.sigma,inside:true});
    }
    const drawEndIndex=exitIndex>=0?exitIndex:insideEndIndex,end=clean[drawEndIndex],insideBars=insideEndIndex-startIndex+1,firstPoint=points[0],lastPoint=points.at(-1);
    trends.push({direction,breakoutTime:candidate.t,startTime:start.t,confirmationTime:confirmation.t,insideEndTime:clean[insideEndIndex].t,exitTime:exitIndex>=0?clean[exitIndex].t:null,endTime:end.t,bars:insideBars,priorR2:priorFit.r2,adaptiveR2:latestFit.r2,breakDistanceAtr:Math.abs(candidate.c-(center0+direction*width))/atr,slopeAtr:latestFit.slope/atrAt(clean,insideEndIndex),startVolumeStrength:volumeMap.get(start.t),confirmed:true,provisional:exitIndex<0,points,upperStart:firstPoint.upper,lowerStart:firstPoint.lower,upperEnd:lastPoint.upper,lowerEnd:lastPoint.lower});
    i=Math.max(i+1,drawEndIndex);
  }
  return {trends:Number.isFinite(maxHistory)?trends.slice(-maxHistory):trends,total:trends.length};
}
