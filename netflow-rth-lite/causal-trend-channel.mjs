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

function normalizedNetDeltas(rows,window=20){
  const result=new Map(),history=[];
  for(const row of rows){
    const delta=Number.isFinite(row.net)?row.net:null;
    if(delta===null){result.set(row.t,null);continue;}
    history.push(Math.abs(delta));if(history.length>window)history.shift();
    const scale=mean(history);result.set(row.t,scale>0?delta/scale:0);
  }
  return result;
}

function dynamicLegWidth(total,reference,{floor=2,ceiling=5,saturation=2}={}){
  if(!(reference>0)||!Number.isFinite(total))return floor;
  return Math.max(floor,Math.min(ceiling,Math.round(floor+(ceiling-floor)*Math.min(1,Math.abs(total)/(reference*saturation)))));
}

function flowLegOrigin(rows,signs,index,direction,lookback){
  let origin=index;
  while(origin>0&&index-origin<lookback&&rows[origin-1].day===rows[index].day&&signs.get(rows[origin-1].t)===direction)origin--;
  return origin;
}

// SPY V only opens/confirms a leg. A Schmitt latch keeps its sign through the
// dead-band, so small oscillations around zero cannot fragment an active trend.
// Once confirmed, price owns membership. Neutral SPY V candles and one short
// opposite pulse stay in the leg; only flowFlipBars consecutive values beyond
// the opposite dead-band confirm a flow reversal.
export function causalTrendChannels(rows,{volumeRows=[],priorWindow=20,fastWindow=8,breakAtr=.15,channelAtr=.45,channelSigma=2,flowDeadband=.15,flowFlipBars=2,adverseExitBars=2,volumeSlopeWindow=4,originLookback=4,minLegBars=8,minDisplayR2=.20,maxBars=Infinity,maxHistory=12}={}){
  if(!Number.isInteger(priorWindow)||priorWindow<12||!Number.isInteger(fastWindow)||fastWindow<4||!(channelSigma>0)||flowDeadband<0||flowDeadband>=1||!Number.isInteger(flowFlipBars)||flowFlipBars<1||!Number.isInteger(adverseExitBars)||adverseExitBars<1||!Number.isInteger(volumeSlopeWindow)||volumeSlopeWindow<2||!Number.isInteger(originLookback)||originLookback<0||!Number.isInteger(minLegBars)||minLegBars<3||minDisplayR2<0||minDisplayR2>1)throw Error('Tham số Kênh trend causal không hợp lệ');
  const clean=rows.filter(row=>['PRE','RTH'].includes(row.session)&&[row.t,row.o,row.h,row.l,row.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t),volumeMap=new Map(volumeRows.map(row=>[row.t,row.adjusted])),flowSigns=schmittFlowSigns(clean,volumeMap,flowDeadband),netDeltas=normalizedNetDeltas(clean),trends=[],episodes=[];let legWidthReference=null;
  for(let i=priorWindow;i<clean.length-1;i++){
    const candidate=clean[i];
    const prior=clean.slice(i-priorWindow,i);if(prior.some(row=>row.day!==candidate.day))continue;
    const priorFit=linearFit(prior),atr=atrAt(clean,i);if(!(atr>1e-12))continue;
    const width=Math.max(priorFit.sigma*1.65,atr*.35),center0=priorFit.valueAt(priorWindow),upperBreak=center0+width+atr*breakAtr,lowerBreak=center0-width-atr*breakAtr,direction=candidate.c>upperBreak?1:candidate.c<lowerBreak?-1:0;
    if(!direction)continue;
    let startIndex=flowSigns.get(candidate.t)===direction?flowLegOrigin(clean,flowSigns,i,direction,originLookback):-1,confirmationIndex=-1,confirmFast=null,confirmVolumeSlope=0;for(let j=i+1;j<Math.min(clean.length,i+4);j++){const row=clean[j];if(row.day!==candidate.day)break;const projected=priorFit.valueAt(priorWindow+j-i)+direction*width,rolling=linearFit(clean.slice(j-fastWindow+1,j+1));if(!outside(row.c,projected,direction)||Math.sign(rolling.slope)!==direction)continue;if(startIndex<0&&flowSigns.get(row.t)===direction)startIndex=flowLegOrigin(clean,flowSigns,j,direction,originLookback);const volumeValues=clean.slice(Math.max(0,j-volumeSlopeWindow+1),j+1).filter(item=>item.day===row.day).map(item=>volumeMap.get(item.t)).filter(Number.isFinite),volumeSlope=volumeValues.length>=2?valueSlope(volumeValues):0,volumeSignAligned=flowSigns.get(row.t)===direction,volumeSlopeAligned=Math.sign(volumeSlope)===direction||Math.sign(volumeSlope)===0;if(startIndex>=0&&volumeSignAligned&&volumeSlopeAligned){confirmationIndex=j;confirmFast=rolling;confirmVolumeSlope=volumeSlope;break;}}
    if(startIndex<0||confirmationIndex<0)continue;
    const start=clean[startIndex],confirmation=clean[confirmationIndex],seedRows=clean.slice(startIndex,confirmationIndex+1),hasOriginFit=seedRows.length>=4,seedFit=hasOriginFit?linearFit(seedRows):confirmFast,seedSlope=seedFit.slope,seedWidth=Math.max(channelAtr*atr,seedFit.sigma*channelSigma),anchor=hasOriginFit?seedFit.intercept:start.c,points=[];let insideEndIndex=confirmationIndex,exitIndex=-1,exitReason=null,latestFit=seedFit,oppositeFlowBars=0,adversePriceBars=0;
    for(let j=startIndex;j<=confirmationIndex;j++){const center=anchor+seedSlope*(j-startIndex);points.push({time:clean[j].t,center,upper:center+seedWidth,lower:center-seedWidth,r2:seedFit.r2,sigma:seedFit.sigma,inside:true,preBreak:j<i});}
    for(let j=confirmationIndex+1;j<clean.length&&j-confirmationIndex<maxBars;j++){
      const row=clean[j];if(row.day!==candidate.day||!['PRE','RTH'].includes(row.session))break;
      const accepted=clean.slice(startIndex,insideEndIndex+1),fit=accepted.length>=4?linearFit(accepted):confirmFast,center=accepted.length>=4?fit.valueAt(accepted.length):anchor+seedSlope*(j-startIndex),width=Math.max(channelAtr*atrAt(clean,j-1),fit.sigma*channelSigma),volumeValue=volumeMap.get(row.t),oppositeFlow=Number.isFinite(volumeValue)&&(direction>0?volumeValue< -flowDeadband:volumeValue>flowDeadband);oppositeFlowBars=oppositeFlow?oppositeFlowBars+1:0;const flowFlipped=oppositeFlowBars>=flowFlipBars,adversePrice=direction>0?row.c<center-width:row.c>center+width;adversePriceBars=adversePrice?adversePriceBars+1:0;const adversePriceExit=adversePriceBars>=adverseExitBars,favorableExpansion=direction>0?row.c>center+width:row.c<center-width;
      if(flowFlipped||adversePriceExit){exitIndex=j;exitReason=flowFlipped?'flow-flip':'adverse-price-exit';points.push({time:row.t,center,upper:center+width,lower:center-width,r2:fit.r2,sigma:fit.sigma,inside:false,exitReason,adversePriceBars});break;}
      insideEndIndex=j;const updated=clean.slice(startIndex,j+1),updatedFit=updated.length>=4?linearFit(updated):confirmFast,updatedCenter=updated.length>=4?updatedFit.valueAt(updated.length-1):center,updatedWidth=Math.max(channelAtr*atrAt(clean,j),updatedFit.sigma*channelSigma);latestFit=updatedFit;points.push({time:row.t,center:updatedCenter,upper:updatedCenter+updatedWidth,lower:updatedCenter-updatedWidth,r2:updatedFit.r2,sigma:updatedFit.sigma,inside:true});
      if(favorableExpansion)points.at(-1).favorableExpansion=true;
    }
    const drawEndIndex=exitIndex>=0?exitIndex:insideEndIndex,end=clean[drawEndIndex],insideBars=insideEndIndex-startIndex+1,finalRows=clean.slice(startIndex,insideEndIndex+1),finalFit=finalRows.length>=4?linearFit(finalRows):latestFit,finalWidth=Math.max(channelAtr*atrAt(clean,insideEndIndex),finalFit.sigma*channelSigma),renderPoints=finalRows.map((row,index)=>{const center=finalFit.valueAt(index);return {time:row.t,center,upper:center+finalWidth,lower:center-finalWidth,inside:true,preBreak:startIndex+index<i};}),firstPoint=renderPoints[0],lastPoint=renderPoints.at(-1);latestFit=finalFit;
    const slopeAtr=latestFit.slope/atrAt(clean,insideEndIndex),absorbing=Math.sign(latestFit.slope)!==direction;
    const provisional=exitIndex<0,displayQualified=insideBars>=minLegBars&&(provisional||latestFit.r2>=minDisplayR2),legDeltas=clean.slice(startIndex,insideEndIndex+1).map(row=>netDeltas.get(row.t)).filter(Number.isFinite),netDeltaTotal=legDeltas.length?legDeltas.reduce((sum,value)=>sum+value,0):null,netDeltaMetric=Number.isFinite(netDeltaTotal)?Math.abs(netDeltaTotal):null,lineWidth=dynamicLegWidth(netDeltaMetric,legWidthReference);
    const trend={direction,breakoutTime:candidate.t,startTime:start.t,originBars:i-startIndex,confirmationTime:confirmation.t,insideEndTime:clean[insideEndIndex].t,exitTime:exitIndex>=0?clean[exitIndex].t:null,exitReason,endTime:end.t,bars:insideBars,priorR2:priorFit.r2,adaptiveR2:latestFit.r2,qualityOpacity:.28+.72*Math.max(0,Math.min(1,latestFit.r2)),breakDistanceAtr:Math.abs(candidate.c-(center0+direction*width))/atr,slopeAtr,startVolumeStrength:volumeMap.get(start.t),confirmationVolumeStrength:volumeMap.get(confirmation.t),volumeSlope:confirmVolumeSlope,flowDeadband,flowFlipBars,adverseExitBars,originLookback,minLegBars,minDisplayR2,netDeltaTotal,netDeltaMetric,netDeltaReference:legWidthReference,lineWidth,volumeQualified:true,confirmed:true,absorbing,provisional,displayQualified,points,renderPoints,upperStart:firstPoint.upper,lowerStart:firstPoint.lower,upperEnd:lastPoint.upper,lowerEnd:lastPoint.lower};episodes.push(trend);if(displayQualified)trends.push(trend);
    if(!provisional&&Number.isFinite(netDeltaMetric))legWidthReference=legWidthReference===null?netDeltaMetric:legWidthReference+.20*(netDeltaMetric-legWidthReference);
    i=Math.max(i+1,drawEndIndex);
  }
  return {trends:Number.isFinite(maxHistory)?trends.slice(-maxHistory):trends,episodes:Number.isFinite(maxHistory)?episodes.slice(-maxHistory):episodes,total:trends.length,totalEpisodes:episodes.length};
}
