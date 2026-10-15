export const REV63_VERSION='REV6-3 V1';
export const REV63_HORIZON=3;
export const REV63_WEIGHTS=Object.freeze({rev6:.40,wlr:.25,agreement:.15,netflow:.10,geometry:.10});
const clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
const sign=x=>x>0?1:x<0?-1:0;
const bayesRate=(summary,prior=20)=>{
  const n=summary?.n??0,rate=Number.isFinite(summary?.winRate)?summary.winRate/100:.5;
  return (rate*n+.5*prior)/(n+prior);
};
function rowEvidence(summary,direction,prior=20){
  if(!direction||!(summary?.n>0))return 0;
  return direction*clamp(2*(bayesRate(summary,prior)-.5));
}
function agreementKey(rank){
  if(!Number.isFinite(rank))return null;
  if(rank<.25)return 'p0_25';if(rank<.5)return 'p25_50';if(rank<.75)return 'p50_75';if(rank<.9)return 'p75_90';return 'p90_100';
}
export function rev63Forecast({reversal,wlrStats,alignment,geometryEvents=[],priceRows=[],horizon=REV63_HORIZON,prior=20}={}){
  const states=wlrStats?.states??[],latest=states.at(-1),h=wlrStats?.summaries?.[horizon]??{},compositeDirection=latest?.direction??0;
  let rev6=0;
  if(reversal?.ready&&Number.isFinite(reversal.rate)&&Number.isFinite(reversal.baselineRate)&&reversal.direction){
    const uplift=Math.max(0,reversal.rate-reversal.baselineRate),quality=clamp(uplift/.25,0,1)*(Number.isFinite(reversal.similarity)?clamp(reversal.similarity,0,1):1);
    rev6=-sign(reversal.direction)*quality;
  }
  const stateKey=latest?.transition==='thin_to_thick'?'thin_to_thick':latest?.state;
  const wlr=rowEvidence(h?.[stateKey],compositeDirection,prior);
  const aKey=agreementKey(latest?.rank),agreement=rowEvidence(h?.[aKey],compositeDirection,prior);
  const nf=Number.isFinite(alignment?.commonNf)?Math.tanh(alignment.commonNf/25):0;
  let geometry=0,geometryEvent=null;
  if(priceRows.length&&geometryEvents.length){
    const index=new Map(priceRows.map((x,i)=>[x.t,i])),lastIndex=priceRows.length-1;
    for(let i=geometryEvents.length-1;i>=0;i--){
      const e=geometryEvents[i],idx=index.get(e.at);if(idx===undefined||lastIndex-idx>6)continue;
      const d=e.direction==='bullish'?1:e.direction==='bearish'?-1:0;
      if(d){geometry=d*clamp((e.score??0)/100,0,1);geometryEvent=e;break;}
    }
  }
  const components={rev6,wlr,agreement,netflow:nf,geometry};
  const evidence=Object.entries(REV63_WEIGHTS).reduce((sum,[key,w])=>sum+w*components[key],0);
  const pUp=clamp(.5+.45*evidence,.05,.95),pDown=1-pUp,confidence=Math.round(100*Math.abs(pUp-.5)*2);
  const label=pUp>=.65?'UP':pUp<=.35?'DOWN':'WAIT';
  return {version:REV63_VERSION,horizon,pUp,pDown,confidence,label,evidence,components,stateKey,agreementKey:aKey,agreementRank:latest?.rank??null,geometryEvent,compositeDirection};
}
export function scoreForecastHistory(priceRows,records,horizon=REV63_HORIZON){
  const map=new Map(priceRows.map((x,i)=>[x.t,i])),scored=[];
  for(const r of records){
    const i=map.get(r.entryTime);if(i===undefined||i+horizon>=priceRows.length){scored.push(r);continue;}
    const entry=priceRows[i],exit=priceRows[i+horizon];let continuous=entry.day===exit.day;
    for(let j=i+1;j<=i+horizon&&continuous;j++)continuous=priceRows[j].t-priceRows[j-1].t===r.step;
    if(!continuous){scored.push({...r,void:true});continue;}
    const up=exit.c>entry.c?1:0,predUp=r.pUp>=.5,brier=(r.pUp-up)**2,correct=(predUp&&up===1)||(!predUp&&up===0);
    scored.push({...r,scored:true,outcomeUp:up,brier,correct,exitTime:exit.t,returnPct:100*(exit.c/entry.c-1)});
  }
  return scored;
}
export function calibrationSummary(records){
  const done=records.filter(x=>x.scored&&!x.void),bins=[[.5,.6],[.6,.7],[.7,.8],[.8,1.000001]].map(([lo,hi])=>{
    const rows=done.filter(x=>{const c=Math.max(x.pUp,1-x.pUp);return c>=lo&&c<hi;});
    return {label:hi>1?'≥80%':`${Math.round(lo*100)}–${Math.round(hi*100)}%`,n:rows.length,accuracy:rows.length?100*rows.filter(x=>x.correct).length/rows.length:null,brier:rows.length?rows.reduce((s,x)=>s+x.brier,0)/rows.length:null};
  });
  return {n:done.length,accuracy:done.length?100*done.filter(x=>x.correct).length/done.length:null,brier:done.length?done.reduce((s,x)=>s+x.brier,0)/done.length:null,bins};
}
