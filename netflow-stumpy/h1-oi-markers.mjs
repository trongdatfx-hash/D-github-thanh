import {HOUR,SCORE_STEP} from './h1-box-score.mjs?v=20261107-outside-fast1';

const LOOKBACK=36;
const BASE_PARTS=['position','slope','randomWalk','deltaNF'];

export function scoreH1OiMarkers({boxes,bars,oi,now}){
  const byTime=new Map(bars.map(bar=>[bar.t,bar]));
  const history=[],markers=[];
  for(const box of boxes){
    const start=box.blockStart;
    if(box.status==='PREVIEW'||box.closedBars!==4||start+HOUR>now)continue;
    const group=Array.from({length:4},(_,i)=>byTime.get(start+i*SCORE_STEP));
    if(group.some((bar,i)=>bar?.end!==start+(i+1)*SCORE_STEP-1))continue;
    // OI entries are keyed by the open of the candle that ends at each observation.
    const levels=Array.from({length:5},(_,i)=>oi.get(start+(i-1)*SCORE_STEP)?.oi);
    if(levels.some(level=>!Number.isFinite(level)||level<=0))continue;

    const changes=levels.slice(1).map((level,i)=>level-levels[i]);
    const net=levels[4]-levels[0],pct=100*net/levels[0],magnitude=Math.abs(pct);
    const direction=Math.sign(net),gross=changes.reduce((sum,value)=>sum+Math.abs(value),0);
    const coherence=gross?Math.abs(net)/gross:0;
    const sameDirection=changes.filter(value=>Math.sign(value)===direction).length;
    const baseParts=BASE_PARTS.map(key=>box.parts?.[key]);
    const base=baseParts.every(Number.isFinite)?baseParts.reduce((sum,value)=>sum+value,0):null;
    const aligned=base!==null&&Math.abs(base)>=2&&Math.sign(base)===box.boxDirection;
    if(history.length===LOOKBACK){
      const sorted=[...history].sort((a,b)=>a-b);
      const index=(LOOKBACK-1)*.75,lower=Math.floor(index);
      const p75=sorted[lower]+(sorted[lower+1]-sorted[lower])*(index-lower);
      const exceeds=magnitude>p75;
      const steady=coherence>=.60;
      const points=2*Number(exceeds)+Number(steady)+Number(aligned)+Number(sameDirection>=3);
      if(exceeds&&steady&&aligned){
        const takers=group.map(bar=>bar.net);
        const taker=takers.every(Number.isFinite)?takers.reduce((sum,value)=>sum+value,0):null;
        markers.push({start,direction,points,base,pct,p75,coherence,sameDirection,taker,filled:taker!==null&&Math.sign(taker)===box.boxDirection});
      }
    }
    history.push(magnitude);
    if(history.length>LOOKBACK)history.shift();
  }
  return markers;
}
