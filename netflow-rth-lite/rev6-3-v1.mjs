export const REV63_VERSION='REV6-3 Trend V2';
export const REV63_HORIZON=3;
export const REV63_WEIGHTS=Object.freeze({line:.35,pivot:.25,candle:.20,regime:.20});
export const REV63_COLOR_ROWS=Object.freeze([
  {key:'agreement_up',label:'Đồng thuận tăng'},
  {key:'agreement_down',label:'Đồng thuận giảm'},
  {key:'neutral',label:'Trung tính / trái dấu'},
  {key:'neutral_to_agreement',label:'Xám → đồng thuận'}
]);
export const REV63_GEOMETRY_ROWS=Object.freeze([
  {key:'hold_support',label:'Giữ hỗ trợ'},
  {key:'hold_resistance',label:'Giữ kháng cự'},
  {key:'true_break',label:'Phá thật'},
  {key:'false_break',label:'Phá giả'}
]);
const clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
const sign=x=>x>0?1:x<0?-1:0;
export function rev63Forecast({geometryLines=[],geometryEvents=[],geometryRegime=null,priceRows=[],horizon=REV63_HORIZON}={}){
  const latest=priceRows.at(-1),lastIndex=priceRows.length-1,scale=Math.max(1e-9,latest?.h-latest?.l||0);
  const usableLines=geometryLines.filter(line=>!line.provisional&&line.knownAt<=latest?.t&&Number.isFinite(line.endValue)&&Number.isFinite(line.score));
  const nearest=usableLines.map(line=>({line,distance:Math.abs(latest.c-line.endValue)/scale})).sort((a,b)=>a.distance-b.distance)[0];
  const line=nearest&&nearest.distance<=2?(nearest.line.kind==='support'?1:-1)*clamp(nearest.line.score/100)*clamp(1-nearest.distance/2):0;
  let pivot=0,geometryEvent=null;
  if(priceRows.length&&geometryEvents.length){
    const index=new Map(priceRows.map((x,i)=>[x.t,i])),lastIndex=priceRows.length-1;
    for(let i=geometryEvents.length-1;i>=0;i--){
      const e=geometryEvents[i],idx=index.get(e.at);if(idx===undefined||lastIndex-idx>6)continue;
      const d=e.direction==='bullish'?1:e.direction==='bearish'?-1:0;
      if(d){pivot=d*clamp((e.score??0)/100,0,1)*clamp(1-(lastIndex-idx)/7);geometryEvent=e;break;}
    }
  }
  const recent=priceRows.slice(-4),first=recent[0],validCandle=recent.length>=3&&[first?.c,latest?.o,latest?.h,latest?.l,latest?.c].every(Number.isFinite);
  const candle=validCandle?clamp(.5*clamp((latest.c-first.c)/(Math.max(scale,Math.abs(latest.c)*.001)*2))+.3*clamp((latest.c-latest.o)/scale)+.2*clamp(2*(latest.c-latest.l)/scale-1)):0;
  const regime=geometryRegime&&latest&&geometryRegime.at===latest.t?sign(geometryRegime.direction)*clamp(geometryRegime.confidence??0):0;
  const components={line,pivot,candle,regime};
  const available={line:usableLines.length>0,pivot:!!geometryEvent,candle:validCandle,regime:regime!==0};
  const votes=Object.values(components).filter(value=>Math.abs(value)>=.12),upVotes=votes.filter(value=>value>0).length,downVotes=votes.filter(value=>value<0).length;
  const consensus=Math.max(upVotes,downVotes),conflict=Math.min(upVotes,downVotes),weighted=Object.entries(REV63_WEIGHTS).reduce((sum,[key,w])=>sum+w*components[key],0);
  const evidence=weighted*(consensus>=2?1+.2*(consensus-1):.55)/(1+.55*conflict);
  const pUp=clamp(.5+.45*evidence,.05,.95),pDown=1-pUp,confidence=Math.round(100*Math.abs(pUp-.5)*2);
  const label=pUp>=.65?'UP':pUp<=.35?'DOWN':'WAIT';
  return {version:REV63_VERSION,horizon,pUp,pDown,confidence,label,evidence,trendScore:Math.round(clamp(50+50*evidence,0,100)),confluence:consensus,conflict,components,available,geometryEvent,geometryRegime,activeLine:nearest?.line??null};
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
export function rev63ColorRegime(signal,previousSignal=null){
  const direction=signal?.direction>0?1:signal?.direction<0?-1:0,previousDirection=previousSignal?.direction>0?1:previousSignal?.direction<0?-1:0;
  return {colorRegime:direction>0?'agreement_up':direction<0?'agreement_down':'neutral',colorTransition:direction!==0&&previousDirection===0?'neutral_to_agreement':null,colorAgreement:Number.isFinite(signal?.agreement)?signal.agreement:null};
}
const colorQuality=row=>{
  const direction=row.pUp>=.5?1:-1;
  return {...row,directionalReturn:Number.isFinite(row.returnPct)?direction*row.returnPct:null};
};
const summarizeColorRows=rows=>({
  n:rows.length,
  accuracy:rows.length?100*rows.filter(x=>x.correct).length/rows.length:null,
  brier:rows.length?rows.reduce((sum,x)=>sum+x.brier,0)/rows.length:null,
  expectancy:rows.length?rows.reduce((sum,x)=>sum+(x.directionalReturn??0),0)/rows.length:null
});
export function rev63ColorQualitySummary(records){
  const done=records.filter(x=>x.scored&&!x.void&&['agreement_up','agreement_down','neutral'].includes(x.colorRegime)).map(colorQuality),summaries={};
  for(const row of REV63_COLOR_ROWS){const sample=row.key==='neutral_to_agreement'?done.filter(x=>x.colorTransition===row.key):done.filter(x=>x.colorRegime===row.key);summaries[row.key]=summarizeColorRows(sample);}
  return {n:done.length,summaries};
}
export function rev63GeometryQualitySummary(records){
  const done=records.filter(x=>x.scored&&!x.void&&REV63_GEOMETRY_ROWS.some(row=>row.key===x.geometryRegime)).map(colorQuality),summaries={};
  for(const row of REV63_GEOMETRY_ROWS){const sample=done.filter(x=>x.geometryRegime===row.key);summaries[row.key]=summarizeColorRows(sample);}
  return {n:done.length,summaries};
}
