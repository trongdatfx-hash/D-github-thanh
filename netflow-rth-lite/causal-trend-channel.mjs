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
function valueSlope(values){const n=values.length,xMean=(n-1)/2,yMean=mean(values);let covariance=0,variance=0;for(let i=0;i<n;i++){covariance+=(i-xMean)*(values[i]-yMean);variance+=(i-xMean)**2;}return variance>1e-12?covariance/variance:0;}

function schmittFlowSigns(rows,volumeMap,threshold){
  const signs=new Map();let latched=0,day=null;
  for(const row of rows){
    if(row.day!==day){day=row.day;latched=0;}
    const value=volumeMap.get(row.t);
    if(Number.isFinite(value)){if(value>threshold)latched=1;else if(value< -threshold)latched=-1;}
    signs.set(row.t,latched);
  }
  return signs;
}

// SPY V only opens/confirms a leg. A Schmitt latch keeps its sign through the
// dead-band, so small oscillations around zero cannot fragment an active trend.
// Once confirmed, price owns membership: every close is accepted until the
// first close outside ±channelSigma or a confirmed SPY V sign reversal.
export function causalTrendChannels(rows,{volumeRows=[],priorWindow=20,fastWindow=8,minPriorR2:_legacyMinPriorR2=.35,breakAtr=.15,channelAtr=.45,channelSigma=2,flowDeadband=.12,volumeSlopeWindow=4,maxBars=Infinity,maxHistory=5}={}){
  if(!Number.isInteger(priorWindow)||priorWindow<12||!Number.isInteger(fastWindow)||fastWindow<4||!(channelSigma>0)||flowDeadband<0||flowDeadband>=1||!Number.isInteger(volumeSlopeWindow)||volumeSlopeWindow<2)throw Error('Tham số Kênh trend causal không hợp lệ');
  void _legacyMinPriorR2; // Kept for saved callers; R² now controls visibility, never admission.
  const clean=rows.filter(row=>['PRE','RTH'].includes(row.session)&&[row.t,row.o,row.h,row.l,row.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t),volumeMap=new Map(volumeRows.map(row=>[row.t,row.adjusted])),flowSigns=schmittFlowSigns(clean,volumeMap,flowDeadband),trends=[];
  for(let i=priorWindow;i<clean.length-1;i++){
    const candidate=clean[i];
    const prior=clean.slice(i-priorWindow,i);if(prior.some(row=>row.day!==candidate.day))continue;
    const priorFit=linearFit(prior),atr=atrAt(clean,i);if(!(atr>1e-12))continue;
    const width=Math.max(priorFit.sigma*1.65,atr*.35),center0=priorFit.valueAt(priorWindow),upperBreak=center0+width+atr*breakAtr,lowerBreak=center0-width-atr*breakAtr,direction=candidate.c>upperBreak?1:candidate.c<lowerBreak?-1:0;
    if(!direction)continue;
    let startIndex=flowSigns.get(candidate.t)===direction?i:-1,confirmationIndex=-1,confirmFast=null,confirmVolumeSlope=0;for(let j=i+1;j<Math.min(clean.length,i+4);j++){const row=clean[j];if(row.day!==candidate.day)break;const projected=priorFit.valueAt(priorWindow+j-i)+direction*width,rolling=linearFit(clean.slice(j-fastWindow+1,j+1));if(!outside(row.c,projected,direction)||Math.sign(rolling.slope)!==direction)continue;if(startIndex<0&&flowSigns.get(row.t)===direction)startIndex=j;const volumeValues=clean.slice(Math.max(0,j-volumeSlopeWindow+1),j+1).filter(item=>item.day===row.day).map(item=>volumeMap.get(item.t)).filter(Number.isFinite),volumeSlope=volumeValues.length>=2?valueSlope(volumeValues):0,volumeSignAligned=flowSigns.get(row.t)===direction,volumeSlopeAligned=Math.sign(volumeSlope)===direction||Math.sign(volumeSlope)===0;if(startIndex>=0&&volumeSignAligned&&volumeSlopeAligned){confirmationIndex=j;confirmFast=rolling;confirmVolumeSlope=volumeSlope;break;}}
    if(startIndex<0||confirmationIndex<0)continue;
    const start=clean[startIndex],confirmation=clean[confirmationIndex],seedSlope=confirmFast.slope,seedWidth=Math.max(channelAtr*atr,confirmFast.sigma*channelSigma),anchor=start.c,points=[];let insideEndIndex=confirmationIndex,exitIndex=-1,exitReason=null,latestFit=confirmFast;
    for(let j=startIndex;j<=confirmationIndex;j++){const center=anchor+seedSlope*(j-startIndex);points.push({time:clean[j].t,center,upper:center+seedWidth,lower:center-seedWidth,r2:confirmFast.r2,sigma:confirmFast.sigma,inside:true});}
    for(let j=confirmationIndex+1;j<clean.length&&j-confirmationIndex<maxBars;j++){
      const row=clean[j];if(row.day!==candidate.day||!['PRE','RTH'].includes(row.session))break;
      const accepted=clean.slice(startIndex,insideEndIndex+1),fit=accepted.length>=4?linearFit(accepted):confirmFast,center=accepted.length>=4?fit.valueAt(accepted.length):anchor+seedSlope*(j-startIndex),width=Math.max(channelAtr*atrAt(clean,j-1),fit.sigma*channelSigma),flowFlipped=flowSigns.get(row.t)===-direction,priceExited=row.c>center+width||row.c<center-width;
      if(flowFlipped||priceExited){exitIndex=j;exitReason=flowFlipped?'flow-flip':'price-exit';points.push({time:row.t,center,upper:center+width,lower:center-width,r2:fit.r2,sigma:fit.sigma,inside:false,exitReason});break;}
      insideEndIndex=j;const updated=clean.slice(startIndex,j+1),updatedFit=updated.length>=4?linearFit(updated):confirmFast,updatedCenter=updated.length>=4?updatedFit.valueAt(updated.length-1):center,updatedWidth=Math.max(channelAtr*atrAt(clean,j),updatedFit.sigma*channelSigma);latestFit=updatedFit;points.push({time:row.t,center:updatedCenter,upper:updatedCenter+updatedWidth,lower:updatedCenter-updatedWidth,r2:updatedFit.r2,sigma:updatedFit.sigma,inside:true});
    }
    const drawEndIndex=exitIndex>=0?exitIndex:insideEndIndex,end=clean[drawEndIndex],insideBars=insideEndIndex-startIndex+1,firstPoint=points[0],lastPoint=points.at(-1);
    const slopeAtr=latestFit.slope/atrAt(clean,insideEndIndex),absorbing=Math.sign(latestFit.slope)!==direction;
    trends.push({direction,breakoutTime:candidate.t,startTime:start.t,confirmationTime:confirmation.t,insideEndTime:clean[insideEndIndex].t,exitTime:exitIndex>=0?clean[exitIndex].t:null,exitReason,endTime:end.t,bars:insideBars,priorR2:priorFit.r2,adaptiveR2:latestFit.r2,qualityOpacity:.28+.72*Math.max(0,Math.min(1,latestFit.r2)),breakDistanceAtr:Math.abs(candidate.c-(center0+direction*width))/atr,slopeAtr,startVolumeStrength:volumeMap.get(start.t),confirmationVolumeStrength:volumeMap.get(confirmation.t),volumeSlope:confirmVolumeSlope,flowDeadband,volumeQualified:true,confirmed:true,absorbing,provisional:exitIndex<0,points,upperStart:firstPoint.upper,lowerStart:firstPoint.lower,upperEnd:lastPoint.upper,lowerEnd:lastPoint.lower});
    i=Math.max(i+1,drawEndIndex);
  }
  return {trends:Number.isFinite(maxHistory)?trends.slice(-maxHistory):trends,total:trends.length};
}
