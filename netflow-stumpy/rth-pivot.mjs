import {causalAtr,confirmedPricePivots,confirmedDivergences,GEOMETRY_DEFAULTS} from './geometry.mjs?v=20261029-price-delta1';
import {ny,tradingDay,postEnd,selectCases,SHAPES,SHAPE_NAMES,probabilities,STEP} from './rth-structure.mjs?v=20261029-price-delta1';

export const PIVOT_PROTOCOL=Object.freeze({left:3,right:2,minAnchorGap:6,maxAnchorGap:160,minPriceSwingAtr:.15,minStrengthSwing:.06,activeBars:8,minimumMatches:12,maxMatches:20});
export const STRUCTURE_NAMES={UP:'HH + HL · tăng',DOWN:'LH + LL · giảm',EXPANDING:'HH + LL · mở rộng',CONTRACTING:'LH + HL · co hẹp',UNRESOLVED:'Chưa rõ / thiếu pivot'};
export const DIVERGENCE_NAMES={bullish:'Phân kỳ tăng',bearish:'Phân kỳ giảm',mixed:'Hai nguồn trái chiều',none:'Không có phân kỳ còn hiệu lực'};
const direction=(v,threshold)=>v>threshold?1:v< -threshold?-1:0;

// Geometry stays on SPY prices. Chart's existing pivot functions are reused;
// each indicator is evaluated separately so no QQQ price/Strength is substituted.
export function pivotState(pivots,events,index,bar,atr){
 const known=pivots.filter(p=>p.confirmedIndex<=index),pair=type=>{
  const same=known.filter(p=>p.type===type),second=same.at(-1);
  const first=second?same.slice(0,-1).reverse().find(p=>second.index-p.index>=PIVOT_PROTOCOL.minAnchorGap&&second.index-p.index<=PIVOT_PROTOCOL.maxAnchorGap):null;
  return first&&second?{first,second,moveAtr:(second.value-first.value)/atr}:null;
 },high=pair('high'),low=pair('low'),hd=high?direction(high.moveAtr,PIVOT_PROTOCOL.minPriceSwingAtr):0,ld=low?direction(low.moveAtr,PIVOT_PROTOCOL.minPriceSwingAtr):0;
 const structure=hd&&ld?(hd>0?(ld>0?'UP':'EXPANDING'):(ld<0?'DOWN':'CONTRACTING')):'UNRESOLVED';
 const active=source=>events.filter(e=>e.source===source&&e.atIndex<=index&&index-e.atIndex<PIVOT_PROTOCOL.activeBars).at(-1)??null;
 const spyV=active('spyV'),composite=active('composite'),signals=[spyV,composite].filter(Boolean),directions=[...new Set(signals.map(e=>e.direction))];
 const divergence=directions.length>1?'mixed':directions[0]??'none',latest=known.at(-1);
 const signal=e=>e?{direction:e.direction,confirmedAt:e.at+STEP,ageBars:index-e.atIndex,priceMoveAtr:e.priceDeltaAtr,strengthDelta:e.source==='spyV'?e.volumeDelta:e.spyDelta}:null;
 return {structure,divergence,key:structure+':'+divergence,highMoveAtr:high?.moveAtr??null,lowMoveAtr:low?.moveAtr??null,pivotCount:known.length,spyV:signal(spyV),composite:signal(composite),latestPivot:latest?{type:latest.type,value:latest.value,pivotAt:latest.t,confirmedAt:latest.confirmedAt+STEP,ageBars:index-latest.confirmedIndex}:null};
}

export function attachPivotStates(rows){
 const price=rows.map(r=>({t:r.t,h:r.high,l:r.low,c:r.c})),atr=causalAtr(price),out=rows.map(r=>({...r,pivot:null}));
 let segment=[];
 const flush=()=>{
  if(!segment.length)return;
  const bars=segment.map(i=>price[i]),scales=segment.map(i=>atr[i]),pivots=confirmedPricePivots(bars,{...PIVOT_PROTOCOL,atr:scales}),events=[];
  for(const source of ['spyV','composite']){
   const context=segment.map(i=>source==='spyV'?{volume:rows[i].x?.[2]}:{spy:rows[i].x?.[1]});
   const candidates=confirmedDivergences(pivots,context,{...PIVOT_PROTOCOL});
   for(const e of candidates){const delta=source==='spyV'?e.volumeDelta:e.spyDelta;
    if(e.type==='regular-divergence'&&['bullish','bearish'].includes(e.direction)&&Number.isFinite(delta)&&Math.abs(delta)>=GEOMETRY_DEFAULTS.minStrengthSwing)events.push({...e,source});
   }
  }
  events.sort((a,b)=>a.atIndex-b.atIndex||a.source.localeCompare(b.source));
  for(let j=0;j<segment.length;j++){const i=segment[j];if(atr[i]>0)out[i].pivot=pivotState(pivots,events,j,bars[j],atr[i]);}
  segment=[];
 };
 for(let i=0;i<rows.length;i++){
  const p=ny(rows[i].t),valid=tradingDay(p.day)&&p.minute>=240&&p.minute<postEnd(p.day);
  if(!valid){flush();continue;}
  if(segment.length&&(rows[i].t-rows[segment.at(-1)].t!==STEP||ny(rows[segment.at(-1)].t).day!==p.day))flush();
  segment.push(i);
 }
 flush();return out;
}

export function choosePivotCohort(ranked,candidates,query){
 const state=query.pivot,structure=state?.structure??'UNRESOLVED',divergence=state?.divergence??'none';
 const structural=candidates.filter(c=>c.pivot?.structure===structure),exact=structural.filter(c=>c.pivot?.divergence===divergence);
 const divergenceOnly=candidates.filter(c=>c.pivot?.divergence===divergence),pools=[['EXACT',exact],['STRUCTURE',structural],['DIVERGENCE',divergenceOnly],['BASE',candidates]];
 for(const [level,pool]of pools){if(['EXACT','STRUCTURE'].includes(level)&&structure==='UNRESOLVED')continue;
  if(level==='DIVERGENCE'&&divergence==='none')continue;
  const picked=selectCases(ranked,pool,PIVOT_PROTOCOL.maxMatches);
  if(picked.length>=PIVOT_PROTOCOL.minimumMatches||level==='BASE')return {picked,pool,level,poolSizes:{exact:exact.length,structure:structural.length,divergence:divergenceOnly.length,base:candidates.length}};
 }
}

export function pivotGroups(candidates,query){
 const groups=new Map();for(const c of candidates){const p=c.pivot;if(!p)continue;if(!groups.has(p.key))groups.set(p.key,[]);groups.get(p.key).push(c);}
 return [...groups].map(([key,cases])=>({key,structure:cases[0].pivot.structure,divergence:cases[0].pivot.divergence,n:cases.length,days:new Set(cases.map(c=>c.targetDay)).size,current:key===query.pivot?.key,labels:SHAPES.map((label,i)=>({label,name:SHAPE_NAMES[label],n:cases.filter(c=>c.outcome.label===label).length,probability:probabilities(cases)[i]}))})).sort((a,b)=>Number(b.current)-Number(a.current)||b.n-a.n||a.key.localeCompare(b.key));
}
