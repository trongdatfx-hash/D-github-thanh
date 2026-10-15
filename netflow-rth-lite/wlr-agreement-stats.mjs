export const WLR_HORIZONS=[1,3,6];
export const WLR_MIN_SAMPLES=20;
export const WLR_STATE_ROWS=[
  {key:'thick',label:'Dày · cùng dấu'},
  {key:'thin',label:'Mỏng · trái dấu'},
  {key:'thin_to_thick',label:'Mỏng→Dày'}
];
export const WLR_AGREEMENT_ROWS=[
  {key:'p0_25',label:'Agreement P0–25'},
  {key:'p25_50',label:'Agreement P25–50'},
  {key:'p50_75',label:'Agreement P50–75'},
  {key:'p75_90',label:'Agreement P75–90'},
  {key:'p90_100',label:'Agreement P90–100'}
];
const sign=x=>x>0?1:x<0?-1:0;
const median=values=>{if(!values.length)return null;const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
function percentile(history,value){
  if(history.length<20)return null;
  let less=0,equal=0;
  for(const x of history){if(x<value)less++;else if(x===value)equal++;}
  return (less+.5*equal)/history.length;
}
function percentileBucket(p){
  if(!Number.isFinite(p))return null;
  if(p<.25)return 'p0_25';if(p<.50)return 'p25_50';if(p<.75)return 'p50_75';if(p<.90)return 'p75_90';return 'p90_100';
}
function summarize(records,minSamples){
  const n=records.length,wins=records.filter(x=>x.ret>0).length,losses=records.filter(x=>x.ret<0).length;
  const grossProfit=records.reduce((s,x)=>s+Math.max(0,x.ret),0),grossLoss=-records.reduce((s,x)=>s+Math.min(0,x.ret),0);
  return {n,ready:n>=minSamples,winRate:n?100*wins/n:null,lossRate:n?100*losses/n:null,
    expectancy:n?records.reduce((s,x)=>s+x.ret,0)/n:null,medianReturn:n?median(records.map(x=>x.ret)):null,
    profitFactor:grossLoss>1e-12?grossProfit/grossLoss:grossProfit>1e-12?Infinity:null,
    medianMfe:n?median(records.map(x=>x.mfe)):null,medianMae:n?median(records.map(x=>x.mae)):null};
}
export function wlrAgreementStatistics(priceRows,compositeRows,volumeRows,step,{minSamples=WLR_MIN_SAMPLES}={}){
  if(!Array.isArray(priceRows)||!Array.isArray(compositeRows)||!Array.isArray(volumeRows)||!Number.isFinite(step)||step<=0||!Number.isInteger(minSamples)||minSamples<1)throw Error('Tham số thống kê WLR không hợp lệ');
  const composite=new Map(compositeRows.map(x=>[x.t,x])),volume=new Map(volumeRows.map(x=>[x.t,x]));
  const states=[],agreementHistory=[];let previous=null;
  for(const p of priceRows){
    const c=composite.get(p.t),v=volume.get(p.t),cs=c?.adjusted,vs=v?.adjusted;
    let state='neutral',direction=sign(cs),agreement=null,rank=null,bucket=null;
    if(Number.isFinite(cs)&&Number.isFinite(vs)){
      const a=sign(cs),b=sign(vs);
      state=a&&b?(a===b?'thick':'thin'):'neutral';
      agreement=Math.abs(cs)*Math.abs(vs);
      rank=percentile(agreementHistory,agreement);bucket=percentileBucket(rank);
      agreementHistory.push(agreement);if(agreementHistory.length>500)agreementHistory.shift();
    }
    const transition=previous&&previous.t===p.t-step&&previous.state==='thin'&&state==='thick'?'thin_to_thick':null;
    states.push({t:p.t,state,transition,direction,agreement,rank,bucket});
    previous={t:p.t,state};
  }
  const pools=Object.fromEntries(WLR_HORIZONS.map(h=>[h,Object.fromEntries([...WLR_STATE_ROWS,...WLR_AGREEMENT_ROWS].map(x=>[x.key,[]]))]));
  const lastExit=Object.fromEntries(WLR_HORIZONS.map(h=>[h,Object.fromEntries([...WLR_STATE_ROWS,...WLR_AGREEMENT_ROWS].map(x=>[x.key,-Infinity]))]));
  for(let i=0;i<priceRows.length;i++){
    const entry=priceRows[i],s=states[i];if(!s?.direction||!Number.isFinite(entry.c)||entry.c<=0)continue;
    for(const h of WLR_HORIZONS){
      const exitIndex=i+h;if(exitIndex>=priceRows.length)continue;
      let valid=true;
      for(let j=i+1;j<=exitIndex;j++)if(priceRows[j].t-priceRows[j-1].t!==step||priceRows[j].day!==entry.day){valid=false;break;}
      if(!valid)continue;
      const exit=priceRows[exitIndex],path=priceRows.slice(i+1,exitIndex+1);
      if(!Number.isFinite(exit.c)||path.some(x=>![x.h,x.l].every(Number.isFinite)))continue;
      const ret=s.direction*100*(exit.c/entry.c-1);
      const maxHigh=Math.max(...path.map(x=>x.h)),minLow=Math.min(...path.map(x=>x.l));
      const mfe=Math.max(0,s.direction>0?100*(maxHigh/entry.c-1):100*(1-minLow/entry.c));
      const mae=Math.max(0,s.direction>0?100*(1-minLow/entry.c):100*(maxHigh/entry.c-1));
      const record={entryTime:entry.t,exitTime:exit.t,ret,mfe,mae,direction:s.direction,agreement:s.agreement,rank:s.rank};
      const keys=[];if(s.state==='thick'||s.state==='thin')keys.push(s.state);if(s.transition)keys.push(s.transition);if(s.bucket)keys.push(s.bucket);
      for(const key of keys){
        if(entry.t<=lastExit[h][key])continue;
        pools[h][key].push(record);lastExit[h][key]=exit.t;
      }
    }
  }
  const summaries={};
  for(const h of WLR_HORIZONS)summaries[h]=Object.fromEntries(Object.entries(pools[h]).map(([k,v])=>[k,summarize(v,minSamples)]));
  return {states,summaries,minSamples,agreementHistory:agreementHistory.length};
}
