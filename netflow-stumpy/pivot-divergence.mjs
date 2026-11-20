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

export function h1ColorPivots(bars,states=[],atr=causalAtr(bars)){
  const rowsByTime=new Map(bars.map((bar,index)=>[bar.t,{bar,index}])),groups=new Map();
  for(const state of states){if(state.preview||!Number.isFinite(state.blockStart))continue;let group=groups.get(state.blockStart);if(!group){group={direction:state.direction,rows:[]};groups.set(state.blockStart,group);}if(group.direction!==state.direction)continue;const found=rowsByTime.get(state.t);if(found)group.rows.push(found);}
  const blocks=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([blockStart,g])=>({...g,rows:g.rows.sort((a,b)=>a.index-b.index)})).filter(g=>g.direction!==0&&g.rows.length===4&&g.rows.every((x,i)=>!i||x.index===g.rows[i-1].index+1));
  const pivots=[];let run=null;
  for(const block of blocks){
    if(!run){run={direction:block.direction,blocks:[block]};continue;}
    if(block.direction===run.direction){run.blocks.push(block);continue;}
    const points=run.blocks.flatMap(x=>x.rows),type=run.direction>0?'high':'low',extreme=points.reduce((best,x)=>!best||(type==='high'?x.bar.h>best.bar.h:x.bar.l<best.bar.l)?x:best,null),confirm=block.rows.at(-1);
    if(extreme&&confirm){
      const value=type==='high'?extreme.bar.h:extreme.bar.l,scale=atr[extreme.index]??atr[confirm.index];
      pivots.push({type,index:extreme.index,t:extreme.bar.t,value,confirmedIndex:confirm.index,confirmedAt:confirm.bar.t,atr:scale,prominenceAtr:finite(scale)&&scale>0?(Math.max(...points.map(x=>x.bar.h))-Math.min(...points.map(x=>x.bar.l)))/scale:0,source:'h1-box-color',h1Start:run.blocks[0].rows[0].bar.t,h1End:run.blocks.at(-1).rows.at(-1).bar.t});
    }
    run={direction:block.direction,blocks:[block]};
  }
  return pivots.sort((a,b)=>a.confirmedIndex-b.confirmedIndex||a.index-b.index);
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


export function analyzePivotDivergences({price,spy=[],qqq=[],flow=[],volume=[],h1CandleColors=[]},options={}){
  const config={...GEOMETRY_DEFAULTS,...options};
  const atr=causalAtr(price,{period:config.atrPeriod}),pricePivots=confirmedPricePivots(price,{...config,atr}),h1Pivots=h1ColorPivots(price,h1CandleColors,atr);
  const useH1=h1Pivots.filter(p=>p.type==='high').length>=2&&h1Pivots.filter(p=>p.type==='low').length>=2;
  const pivots=useH1?h1Pivots:pricePivots,events=confirmedDivergences(pivots,contextAt(price,spy,qqq,flow,volume),config);
  return {pivots,h1Pivots,pivotSource:useH1?'H1_BOX_COLOR':'M15_PRICE',events,lines:[],provisionalLines:[],patterns:[],referenceLines:[],selectionBudget:{classic:0,pattern:0},
    summary:{support:0,resistance:0,divergences:events.filter(e=>e.type==='regular-divergence').length,rotations:events.filter(e=>e.detail?.pairSplit||e.pairSplit).length},atr};
}
