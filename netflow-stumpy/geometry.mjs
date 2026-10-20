const finite=Number.isFinite;

export const GEOMETRY_DEFAULTS=Object.freeze({
  left:3,right:2,atrPeriod:14,minProminenceAtr:.12,minAnchorGap:6,maxAnchorGap:160,
  touchToleranceAtr:.28,breakToleranceAtr:.5,maxPivotsPerSide:18,minScore:64,maxLines:4,
  minPriceSwingAtr:.15,minStrengthSwing:.06,minFlowSwing:3,provisionalLookback:8
});

function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}
function mean(values){return values.reduce((sum,value)=>sum+value,0)/values.length;}
function median(values){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function sign(value,epsilon=1e-9){return value>epsilon?1:value< -epsilon?-1:0;}

export function causalAtr(bars,{period=14}={}){
  if(!Array.isArray(bars)||!Number.isInteger(period)||period<2)throw Error('Tham số ATR hình học không hợp lệ');
  let previousClose=null,wilder=null;
  return bars.map((bar,index)=>{
    if(![bar?.h,bar?.l,bar?.c].every(finite)||bar.l>bar.h)return null;
    const tr=previousClose===null?bar.h-bar.l:Math.max(bar.h-bar.l,Math.abs(bar.h-previousClose),Math.abs(bar.l-previousClose));
    previousClose=bar.c;
    if(index<period-1){wilder=wilder===null?tr:wilder+tr;return null;}
    if(index===period-1){wilder=(wilder+tr)/period;return wilder;}
    wilder=((period-1)*wilder+tr)/period;return wilder;
  });
}

export function confirmedPricePivots(bars,options={}){
  const config={...GEOMETRY_DEFAULTS,...options},atr=options.atr??causalAtr(bars,{period:config.atrPeriod});
  if(!Array.isArray(bars)||atr.length!==bars.length||!Number.isInteger(config.left)||config.left<1||!Number.isInteger(config.right)||config.right<1||!finite(config.minProminenceAtr)||config.minProminenceAtr<0)throw Error('Tham số pivot hình học không hợp lệ');
  const pivots=[];
  for(let index=config.left;index+config.right<bars.length;index++){
    const current=bars[index],scale=atr[index+config.right]??atr[index];
    if(!finite(scale)||scale<=0)continue;
    const left=bars.slice(index-config.left,index),right=bars.slice(index+1,index+config.right+1);
    if(!left.concat(right).every(bar=>finite(bar?.h)&&finite(bar?.l)))continue;
    const leftHigh=Math.max(...left.map(bar=>bar.h)),rightHigh=Math.max(...right.map(bar=>bar.h));
    const leftLow=Math.min(...left.map(bar=>bar.l)),rightLow=Math.min(...right.map(bar=>bar.l));
    const highProminence=Math.min(current.h-leftHigh,current.h-rightHigh)/scale;
    const lowProminence=Math.min(leftLow-current.l,rightLow-current.l)/scale;
    // Strict on the left and non-strict on the right makes equal highs/lows deterministic.
    if(current.h>leftHigh&&current.h>=rightHigh&&highProminence>=config.minProminenceAtr)pivots.push({type:'high',index,t:current.t,value:current.h,confirmedIndex:index+config.right,confirmedAt:bars[index+config.right].t,atr:scale,prominenceAtr:highProminence});
    if(current.l<leftLow&&current.l<=rightLow&&lowProminence>=config.minProminenceAtr)pivots.push({type:'low',index,t:current.t,value:current.l,confirmedIndex:index+config.right,confirmedAt:bars[index+config.right].t,atr:scale,prominenceAtr:lowProminence});
  }
  return pivots.sort((a,b)=>a.confirmedIndex-b.confirmedIndex||a.index-b.index||a.type.localeCompare(b.type));
}

function contextAt(bars,spy,qqq,flow,volume){
  const spyMap=new Map(spy.map(row=>[row.t,row])),qqqMap=new Map(qqq.map(row=>[row.t,row])),flowMap=new Map(flow.map(row=>[row.t,row])),volumeMap=new Map(volume.map(row=>[row.t,row]));
  return bars.map(bar=>({spy:spyMap.get(bar.t)?.adjusted,qqq:qqqMap.get(bar.t)?.adjusted,flow:flowMap.get(bar.t)?.nf,volume:volumeMap.get(bar.t)?.adjusted}));
}

function swingContext(first,second,context,config){
  const priceDeltaAtr=(second.value-first.value)/(second.atr||first.atr||1),a=context[first.index]??{},b=context[second.index]??{};
  const spyDelta=finite(a.spy)&&finite(b.spy)?b.spy-a.spy:null,qqqDelta=finite(a.qqq)&&finite(b.qqq)?b.qqq-a.qqq:null,flowDelta=finite(a.flow)&&finite(b.flow)?b.flow-a.flow:null,volumeDelta=finite(a.volume)&&finite(b.volume)?b.volume-a.volume:null;
  const expected=second.type==='low'?1:-1,priceExtreme=second.type==='low'?priceDeltaAtr<=-config.minPriceSwingAtr:priceDeltaAtr>=config.minPriceSwingAtr;
  const strengthVotes=[spyDelta,qqqDelta,volumeDelta].filter(finite).map(delta=>clamp(expected*delta/config.minStrengthSwing)),strengthVote=strengthVotes.reduce((sum,value)=>sum+value,0)/(strengthVotes.length||1);
  const flowVote=finite(flowDelta)?clamp(expected*flowDelta/config.minFlowSwing):0;
  const divergence=priceExtreme?clamp(.8*strengthVote+.2*flowVote):0;
  const pairSplit=finite(spyDelta)&&finite(qqqDelta)&&sign(spyDelta,config.minStrengthSwing/2)*sign(qqqDelta,config.minStrengthSwing/2)===-1;
  const priceDirection=sign(priceDeltaAtr,config.minPriceSwingAtr/2),spyDirection=sign(spyDelta??0,config.minStrengthSwing/2),qqqDirection=sign(qqqDelta??0,config.minStrengthSwing/2);
  const leader=pairSplit?(priceDirection===spyDirection?'SPY':priceDirection===qqqDirection?'QQQ':'MIXED'):null;
  const confirmation=clamp(strengthVote*.7+flowVote*.3);
  return {priceDeltaAtr,spyDelta,qqqDelta,flowDelta,volumeDelta,divergence,pairSplit,leader,confirmation};
}

export function confirmedDivergences(pivots,context,options={}){
  const config={...GEOMETRY_DEFAULTS,...options},events=[];
  for(const type of ['low','high']){
    const same=pivots.filter(pivot=>pivot.type===type);
    for(let index=1;index<same.length;index++){
      const second=same[index];let best=null;
      for(let previous=index-1;previous>=0;previous--){
        const first=same[previous],gap=second.index-first.index;if(gap>config.maxAnchorGap)break;if(gap<config.minAnchorGap)continue;
        const detail=swingContext(first,second,context,config),quality=Math.max(detail.divergence,detail.pairSplit?.55:0)+.05*Math.min(1,(first.prominenceAtr+second.prominenceAtr)/2);
        if((detail.divergence>0||detail.pairSplit)&&(!best||quality>best.quality))best={first,second,detail,quality};
      }
      if(best){const direction=best.detail.divergence>0?(type==='low'?'bullish':'bearish'):'rotation';events.push({type:best.detail.pairSplit&&best.detail.divergence===0?'pair-rotation':'regular-divergence',direction,atIndex:second.confirmedIndex,at:second.confirmedAt,pivotIndex:second.index,pivotTime:second.t,score:Math.round(100*clamp(best.quality)),...best.detail,firstPivot:best.first,secondPivot:best.second});}
    }
  }
  return events.sort((a,b)=>a.atIndex-b.atIndex||a.pivotIndex-b.pivotIndex);
}

function ols(points){
  const xm=mean(points.map(point=>point.index)),ym=mean(points.map(point=>point.value));let xx=0,xy=0;
  for(const point of points){xx+=(point.index-xm)**2;xy+=(point.index-xm)*(point.value-ym);}
  const slope=xx?xy/xx:0,intercept=ym-slope*xm;return {slope,intercept};
}

function lineCandidate(first,second,same,bars,atr,context,config){
  let slope=(second.value-first.value)/(second.index-first.index),intercept=first.value-slope*first.index;
  const initialTouches=same.filter(pivot=>pivot.index>=first.index&&pivot.index<=bars.length-1&&Math.abs(pivot.value-(intercept+slope*pivot.index))/(atr[pivot.index]||pivot.atr||1)<=config.touchToleranceAtr);
  const anchors=initialTouches.length>2?[first,...initialTouches.filter(pivot=>pivot!==first&&pivot!==second).sort((a,b)=>Math.abs(a.value-(intercept+slope*a.index))/(atr[a.index]||1)-Math.abs(b.value-(intercept+slope*b.index))/(atr[b.index]||1)).slice(0,1),second].sort((a,b)=>a.index-b.index):[first,second];
  ({slope,intercept}=ols(anchors));
  const touches=same.filter(pivot=>pivot.index>=first.index&&Math.abs(pivot.value-(intercept+slope*pivot.index))/(atr[pivot.index]||pivot.atr||1)<=config.touchToleranceAtr);
  const startCheck=Math.max(second.confirmedIndex,second.index),last=bars.length-1;
  let violations=0;
  for(let index=startCheck;index<=last;index++){
    const scale=atr[index];if(!finite(scale)||scale<=0)continue;const line=intercept+slope*index;
    if(first.type==='low'&&bars[index].l<line-config.breakToleranceAtr*scale)violations++;
    if(first.type==='high'&&bars[index].h>line+config.breakToleranceAtr*scale)violations++;
  }
  if(violations>Math.max(1,Math.floor((last-startCheck+1)*.025)))return null;
  const residuals=anchors.map(point=>Math.abs(point.value-(intercept+slope*point.index))/(atr[point.index]||point.atr||1)),rmseAtr=Math.sqrt(mean(residuals.map(value=>value*value)));
  const typicalAtr=median(anchors.map(point=>atr[point.index]??point.atr).filter(finite))||second.atr||1,slopeAtr=slope/typicalAtr,ageBars=Math.max(0,last-second.confirmedIndex);
  const detail=swingContext(first,second,context,config),touchScore=clamp((touches.length-1)/2),ageScore=Math.sqrt(clamp(ageBars/80)),slopeScore=Math.exp(-Math.max(0,Math.abs(slopeAtr)-.18)*7),residualScore=Math.exp(-4*rmseAtr),salience=clamp((first.prominenceAtr+second.prominenceAtr)/1.4),confluence=Math.max(detail.divergence,detail.confirmation*.7,detail.pairSplit?.58:0);
  const score=Math.round(100*clamp(.26*touchScore+.12*ageScore+.14*slopeScore+.18*residualScore+.22*confluence+.08*salience));
  return {kind:first.type==='low'?'support':'resistance',score,startIndex:first.index,startTime:first.t,knownAt:second.confirmedAt,endIndex:last,endTime:bars[last].t,startValue:intercept+slope*first.index,endValue:intercept+slope*last,slope,slopeAtr,rmseAtr,touches:touches.length,ageBars,anchors:anchors.map(point=>({index:point.index,t:point.t,value:point.value,confirmedAt:point.confirmedAt})),confluence,detail};
}

export function buildTrendlines(bars,pivots,context,options={}){
  const config={...GEOMETRY_DEFAULTS,...options},atr=options.atr??causalAtr(bars,{period:config.atrPeriod}),candidates=[];
  for(const type of ['low','high']){
    const same=pivots.filter(pivot=>pivot.type===type).slice(-config.maxPivotsPerSide);
    for(let secondIndex=1;secondIndex<same.length;secondIndex++)for(let firstIndex=0;firstIndex<secondIndex;firstIndex++){
      const first=same[firstIndex],second=same[secondIndex],gap=second.index-first.index;if(gap<config.minAnchorGap||gap>config.maxAnchorGap)continue;
      const candidate=lineCandidate(first,second,same,bars,atr,context,config);if(candidate&&candidate.score>=config.minScore)candidates.push(candidate);
    }
  }
  const deduped=[];
  for(const candidate of candidates.sort((a,b)=>b.score-a.score||b.touches-a.touches||b.ageBars-a.ageBars)){
    const duplicate=deduped.some(line=>line.kind===candidate.kind&&Math.abs(line.endValue-candidate.endValue)/(atr.at(-1)||1)<config.touchToleranceAtr&&Math.abs(line.slopeAtr-candidate.slopeAtr)<.04);
    if(!duplicate)deduped.push(candidate);
  }
  const selected=[];
  for(const kind of ['support','resistance']){const leader=deduped.find(line=>line.kind===kind);if(leader)selected.push(leader);}
  for(const candidate of deduped){if(selected.includes(candidate))continue;selected.push(candidate);if(selected.length>=config.maxLines)break;}
  return selected.slice(0,config.maxLines).sort((a,b)=>b.score-a.score);
}

export function provisionalTrendlines(bars,pivots,options={}){
  const config={...GEOMETRY_DEFAULTS,...options},atr=options.atr??causalAtr(bars,{period:config.atrPeriod}),last=bars.length-1,lines=[];
  if(last<config.left+config.right+config.minAnchorGap||!Number.isInteger(config.provisionalLookback)||config.provisionalLookback<config.right)return lines;
  for(const type of ['low','high']){
    let candidate=null;
    for(let index=Math.max(config.left,last-config.provisionalLookback+1);index<=last;index++){
      const bar=bars[index],left=bars.slice(index-config.left,index),scale=atr[index];
      if(!finite(scale)||scale<=0||!left.every(row=>finite(row?.h)&&finite(row?.l)))continue;
      const value=type==='low'?bar.l:bar.h,previous=type==='low'?Math.min(...left.map(row=>row.l)):Math.max(...left.map(row=>row.h));
      const prominence=(type==='low'?previous-value:value-previous)/scale;
      if(prominence<config.minProminenceAtr)continue;
      if(!candidate||index>candidate.index)candidate={index,t:bar.t,value};
    }
    if(!candidate)continue;
    const first=[...pivots].reverse().find(pivot=>pivot.type===type&&candidate.index-pivot.index>=config.minAnchorGap&&candidate.index-pivot.index<=config.maxAnchorGap);
    if(!first)continue;
    const slope=(candidate.value-first.value)/(candidate.index-first.index),endValue=candidate.value+slope*(last-candidate.index),scale=atr[candidate.index]||first.atr||1;
    lines.push({kind:type==='low'?'support':'resistance',provisional:true,startIndex:first.index,startTime:first.t,startValue:first.value,endIndex:last,endTime:bars[last].t,endValue,slope,slopeAtr:slope/scale,knownAt:bars[last].t,candidateIndex:candidate.index,candidateTime:candidate.t,lookbackBars:last-candidate.index+1});
  }
  return lines;
}

export function analyzeGeometry({price,spy=[],qqq=[],flow=[],volume=[]},options={}){
  if(!Array.isArray(price)||!Array.isArray(spy)||!Array.isArray(qqq)||!Array.isArray(flow)||!Array.isArray(volume))throw Error('Nguồn hình học không hợp lệ');
  if(!price.length)return {pivots:[],events:[],lines:[],summary:{support:0,resistance:0,divergences:0,rotations:0}};
  const config={...GEOMETRY_DEFAULTS,...options},atr=causalAtr(price,{period:config.atrPeriod}),pivots=confirmedPricePivots(price,{...config,atr}),context=contextAt(price,spy,qqq,flow,volume),events=confirmedDivergences(pivots,context,config),lines=buildTrendlines(price,pivots,context,{...config,atr}),provisionalLines=provisionalTrendlines(price,pivots,{...config,atr});
  return {pivots,events,lines,provisionalLines,summary:{support:lines.filter(line=>line.kind==='support').length,resistance:lines.filter(line=>line.kind==='resistance').length,divergences:events.filter(event=>event.type==='regular-divergence').length,rotations:events.filter(event=>event.detail?.pairSplit||event.pairSplit).length},atr};
}

const lineAt=(line,index)=>line.startValue+line.slope*(index-line.startIndex);
const rowAt=(rows,time)=>rows.findLast?.(row=>row.t===time)??[...rows].reverse().find(row=>row.t===time);

export function classifyBreakoutRetest(price,lines,{strengthDirection=0,flowDirection=0,volumeDirection=0,touchToleranceAtr=.28,breakToleranceAtr=.35}={}){
  if(!Array.isArray(price)||!Array.isArray(lines)||price.length<2)return null;
  const atr=causalAtr(price),currentIndex=price.length-1,previousIndex=currentIndex-1,current=price[currentIndex],previous=price[previousIndex],scale=atr[currentIndex],previousScale=atr[previousIndex];
  if(!finite(scale)||scale<=0||!finite(previousScale)||previousScale<=0)return null;
  const candidates=[];
  for(const line of lines){
    if(!['support','resistance'].includes(line?.kind)||line.knownAt>previous.t)continue;
    const previousLine=lineAt(line,previousIndex),currentLine=lineAt(line,currentIndex),isSupport=line.kind==='support',breakDirection=isSupport?-1:1,holdDirection=-breakDirection;
    const previousBeyond=isSupport?previous.c<previousLine-breakToleranceAtr*previousScale:previous.c>previousLine+breakToleranceAtr*previousScale;
    const currentBeyond=isSupport?current.c<currentLine-breakToleranceAtr*scale:current.c>currentLine+breakToleranceAtr*scale;
    const reclaimed=isSupport?current.c>=currentLine-.08*scale:current.c<=currentLine+.08*scale;
    const touched=isSupport?current.l<=currentLine+touchToleranceAtr*scale&&current.h>=currentLine-touchToleranceAtr*scale:current.h>=currentLine-touchToleranceAtr*scale&&current.l<=currentLine+touchToleranceAtr*scale;
    const held=touched&&(isSupport?current.c>=currentLine:current.c<=currentLine),flowAligned=sign(strengthDirection)===breakDirection&&sign(flowDirection)===breakDirection&&sign(volumeDirection)===breakDirection;
    let key=null,direction=0,priority=0;
    if(previousBeyond&&reclaimed){key='false_break';direction=holdDirection;priority=3;}
    else if(previousBeyond&&currentBeyond&&flowAligned){key='true_break';direction=breakDirection;priority=2;}
    else if(held){key=isSupport?'hold_support':'hold_resistance';direction=holdDirection;priority=1;}
    if(!key)continue;
    const distanceAtr=Math.abs(current.c-currentLine)/scale,structure=Math.max(.45,Math.min(1,(line.score??64)/100)),confirmation=key==='true_break'?1:key==='false_break' ? .88 : .65;
    candidates.push({key,label:key==='hold_support'?'Giữ hỗ trợ':key==='hold_resistance'?'Giữ kháng cự':key==='true_break'?'Phá thật':'Phá giả',direction,breakDirection,at:current.t,index:currentIndex,lineKind:line.kind,lineScore:line.score??null,lineValue:currentLine,distanceAtr,flowAligned,confidence:clamp(structure*confirmation),priority,line});
  }
  return candidates.sort((a,b)=>b.priority-a.priority||b.confidence-a.confidence||a.distanceAtr-b.distanceAtr)[0]??null;
}

export function analyzeBreakoutRetest({price,spy=[],qqq=[],flow=[],volume=[]},options={}){
  if(!Array.isArray(price)||price.length<18)return null;
  const referenceLength=price.length-2,prefix={price:price.slice(0,referenceLength),spy:spy.filter(row=>row.t<=price[referenceLength-1].t),qqq:qqq.filter(row=>row.t<=price[referenceLength-1].t),flow:flow.filter(row=>row.t<=price[referenceLength-1].t),volume:volume.filter(row=>row.t<=price[referenceLength-1].t)};
  const geometry=analyzeGeometry(prefix,options),latest=price.at(-1),strength=rowAt(flow,latest.t)?.adjusted,netFlow=rowAt(flow,latest.t)?.nf,volumeStrength=rowAt(volume,latest.t)?.adjusted;
  return classifyBreakoutRetest(price,geometry.lines,{strengthDirection:sign(strength??0),flowDirection:sign(netFlow??0),volumeDirection:sign(volumeStrength??0),touchToleranceAtr:options.touchToleranceAtr??GEOMETRY_DEFAULTS.touchToleranceAtr,breakToleranceAtr:options.breakoutToleranceAtr??.35});
}

export function recentCausalLineStates({price,spy=[],qqq=[],flow=[],volume=[]},options={},limit=4){
  if(!Array.isArray(price)||!Array.isArray(spy)||!Array.isArray(qqq)||!Array.isArray(flow)||!Array.isArray(volume)||!Number.isInteger(limit)||limit<1||limit>20)throw Error('Nguồn trạng thái line gần nhất không hợp lệ');
  const found=[],lookback=Math.max(limit,Math.min(price.length,Number.isInteger(options.stateLookbackBars)?options.stateLookbackBars:600)),first=Math.max(18,price.length-lookback+1);
  for(let end=price.length;end>=first&&found.length<limit;end--){
    const at=price[end-1].t,prefix={price:price.slice(0,end),spy:spy.filter(row=>row?.t<=at),qqq:qqq.filter(row=>row?.t<=at),flow:flow.filter(row=>row?.t<=at),volume:volume.filter(row=>row?.t<=at)},state=analyzeBreakoutRetest(prefix,options);
    if(!state||!['true_break','false_break'].includes(state.key))continue;
    found.push({at,index:end-1,key:state.key,label:state.label,direction:state.direction,breakDirection:state.breakDirection,lineValue:state.lineValue,lineKind:state.lineKind,lineScore:state.lineScore,distanceAtr:state.distanceAtr});
  }
  return found.reverse();
}

export function backtestGeometry(price,events,{horizon=4,minMoveAtr=.35,atrPeriod=14}={}){
  if(!Array.isArray(price)||!Array.isArray(events)||!Number.isInteger(horizon)||horizon<1||!finite(minMoveAtr)||minMoveAtr<0)throw Error('Tham số backtest hình học không hợp lệ');
  const atr=causalAtr(price,{period:atrPeriod}),samples=[];
  for(const event of events){
    if(!['bullish','bearish'].includes(event.direction)||event.atIndex+horizon>=price.length)continue;
    const entry=price[event.atIndex]?.c,scale=atr[event.atIndex];if(!finite(entry)||!finite(scale)||scale<=0)continue;
    const direction=event.direction==='bullish'?1:-1,path=price.slice(event.atIndex+1,event.atIndex+horizon+1).map(bar=>direction*(bar.c-entry)/scale),moveAtr=path.at(-1),mfeAtr=Math.max(...path),maeAtr=Math.min(...path);
    samples.push({at:event.at,entryIndex:event.atIndex,exitIndex:event.atIndex+horizon,direction:event.direction,moveAtr,mfeAtr,maeAtr,win:moveAtr>=minMoveAtr});
  }
  const wins=samples.filter(sample=>sample.win).length;
  return {horizon,minMoveAtr,n:samples.length,wins,winRate:samples.length?100*wins/samples.length:null,meanMoveAtr:samples.length?mean(samples.map(sample=>sample.moveAtr)):null,samples};
}
