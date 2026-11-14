import {confirmedPricePivots,causalAtr} from './geometry.mjs?v=20261029-price-delta1';

const STEP=900000;
const sign=value=>value>.10?1:value<-.10?-1:0;

export function oi8PivotLevels(bars,points,now){
  const values=new Map(points.filter(point=>Number.isFinite(point.value)).map(point=>[point.time*1000,point.value]));
  if(!values.size)return [];
  const closed=bars.filter(bar=>bar.t+STEP<=now);
  const atr=causalAtr(closed);
  return confirmedPricePivots(closed,{atr}).flatMap(pivot=>{
    const {index,confirmedIndex,type}=pivot;
    const confirmed=closed[confirmedIndex];
    if(!['PRE','RTH'].includes(confirmed.session))return [];
    const window=closed.slice(index-3,confirmedIndex+1);
    if(window.length!==6||window.some((bar,k)=>bar.sourceComplete===false||
      bar.day!==confirmed.day||!['PRE','RTH'].includes(bar.session)||
      bar.t!==window[0].t+k*STEP||!values.has(bar.t)))return [];
    const signs=window.map(bar=>sign(values.get(bar.t)));
    const before=signs.slice(0,3).findLast(Boolean);
    if(!before||!signs.slice(3).includes(-before))return [];
    const flows=window.slice(3).map(bar=>bar.net);
    const aligned=flows.every(Number.isFinite)&&flows.reduce((sum,net)=>sum+net,0)*(type==='low'?1:-1)>0;
    return [{type,level:pivot.value,start:confirmed.t/1000,pivotTime:pivot.t,knownAt:confirmed.t+STEP,aligned}];
  });
}
