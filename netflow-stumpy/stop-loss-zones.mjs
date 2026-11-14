import {causalAtr,confirmedPricePivots} from './geometry.mjs?v=20261108-price-break-only1';
import {strengthOi8} from './strength-oi8.mjs?v=20261111-oi8';
const clamp=x=>Math.max(0,Math.min(1,x));
const quantile=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)*p)]:0;};
// Scores rank observed support. They are not probabilities of stop survival.
export function stopLossZones({price=[],oiSamples=[],h1CandleColors=[],volume=[]},step){
  const empty={support:null,resistance:null,ready:false,version:'SL-v1'};
  if(price.length<40||step!==900000)return empty;
  const atr=causalAtr(price),last=price.at(-1),scale=atr.at(-1);
  if(!(scale>0))return empty;
  const oi=new Map(oiSamples.map(s=>[Number(s.timestamp),Number(s.sumOpenInterest)]));
  const strength=new Map(strengthOi8(price,oiSamples,last.t+step).map(p=>[p.time*1000,p.value]));
  const h1=new Map(h1CandleColors.filter(s=>!s.preview).map(s=>[s.t,s.direction]));
  const vol=new Map(volume.map(v=>[v.t,v.adjusted]));
  const pivots=confirmedPricePivots(price).filter(p=>p.index>=price.length-480);
  const result={...empty,asOf:last.t};
  for(const [type,kind,direction] of [['low','support',1],['high','resistance',-1]]){
    const groups=[];
    for(const p of pivots.filter(p=>p.type===type)){
      let group=groups.find(g=>Math.abs(g[0].value-p.value)<=.3*scale);
      if(!group){group=[];groups.push(group);}group.push(p);
    }
    const candidates=[];
    for(const group of groups){
      const low=Math.min(...group.map(p=>p.value))-.08*scale;
      const high=Math.max(...group.map(p=>p.value))+.08*scale;
      if(direction>0?high>=last.c:low<=last.c)continue;
      const latest=group.at(-1),after=price.slice(latest.confirmedIndex+1);
      if(after.some(b=>direction>0?b.c<low:b.c>high))continue;
      const window=price.slice(latest.index,latest.confirmedIndex+1);
      if(window.some((b,i)=>b.sourceComplete===false||(i&&b.t-window[i-1].t!==step)))continue;
      const reaction=direction*(window.at(-1).c-latest.value)/scale;
      if(reaction<.35)continue;
      const structure=.65*clamp(reaction/1.2)+.35*clamp(group.length/3);
      const total=window.reduce((s,b)=>s+(b.q??0),0),net=window.reduce((s,b)=>s+(b.net??0),0);
      const taker=total>0?clamp(.5+direction*net/total):0;
      const changes=window.flatMap(b=>{const a=oi.get(b.t),z=oi.get(b.t+step);return a>0&&z>0?[Math.abs(z/a-1)]:[];});
      const baseline=price.slice(Math.max(0,latest.index-96),latest.index).flatMap(b=>{const a=oi.get(b.t),z=oi.get(b.t+step);return a>0&&z>0?[Math.abs(z/a-1)]:[];});
      const oiReady=changes.length===window.length&&baseline.length>=20;
      const significant=oiReady&&Math.max(...changes)>=quantile(baseline,.62);
      const before=strength.get(price[latest.index-1]?.t),current=strength.get(window.at(-1).t);
      const flip=Number.isFinite(before)&&Number.isFinite(current)&&before*current<0&&Math.abs(current)>.1;
      const flow=taker*(oiReady?(.6+.25*Number(significant)+.15*Number(flip)):.6);
      const context=window.reduce((sum,b)=>sum+(h1.get(b.t)===direction? .5:0)+(Number.isFinite(vol.get(b.t))&&Math.sign(vol.get(b.t))===direction?.5:0),0)/window.length;
      const score=Math.round(50*structure+30*flow+20*context);
      if(score<60)continue;
      const wicks=price.slice(-96).map(b=>(direction>0?Math.min(b.o,b.c)-b.l:b.h-Math.max(b.o,b.c))/scale).filter(Number.isFinite);
      const buffer=Math.max(.15*scale,quantile(wicks,.75)*scale);
      const stop=direction>0?low-buffer:high+buffer;
      candidates.push({kind,low,high,level:stop,score,oiReady,start:price[latest.confirmedIndex].t,end:last.t+4*step,distanceAtr:Math.abs(last.c-stop)/scale,distancePct:100*Math.abs(last.c-stop)/last.c});
    }
    candidates.sort((a,b)=>a.distanceAtr-b.distanceAtr||b.score-a.score);
    result[kind]=candidates[0]??null;
  }
  result.ready=Boolean(result.support||result.resistance);return result;
}
