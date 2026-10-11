// Descriptive, causal statistics. The score uses fixed rules; no trained model.
export const HORIZONS=[1,3,6];
export const MIN_SAMPLES=20;
export const TREND_WINDOW=6;
export const TREND_MIN_HISTORY=10;
const keys=['SPYUSDT','QQQUSDT','COMPOSITE'];
const clamp=x=>Math.max(0,Math.min(1,x));
const sign=x=>x>0?1:x<0?-1:0;
const flowSign=x=>x>5?1:x< -5?-1:0;

export function strengthState(bars,alignment,source){
  const signal=bars[source];
  if(!signal||!keys.every(k=>Number.isFinite(bars[k]?.adjusted))||!alignment||
    ![signal.q,signal.buy,signal.sell,alignment.smoothSpyNf,alignment.smoothQqqNf].every(Number.isFinite)||signal.q<=0)return null;
  const signs=keys.map(k=>sign(bars[k].adjusted)),direction=sign(signal.adjusted);
  const buyShare=clamp(signal.buy/signal.q),sellShare=clamp(signal.sell/signal.q);
  const taker=50*(direction>0?buyShare:direction<0?sellShare:.5);
  const pair=30*(clamp((1+direction*alignment.smoothSpyNf/100)/2)+clamp((1+direction*alignment.smoothQqqNf/100)/2))/2;
  const strength=20*clamp(Math.abs(signal.adjusted));
  const score=direction?Math.round(taker+pair+strength):null;
  const pairSigns=[flowSign(alignment.smoothSpyNf),flowSign(alignment.smoothQqqNf)];
  const groupKey=[signal.session,...signs].join('|');
  // Fine cohorts distinguish confirmation, pair regime, score tier and extremes.
  // Fallback to the same sign group/session is based on count alone, not returns.
  const detailKey=[groupKey,Math.floor((score??0)/25),...pairSigns,Math.abs(signal.adjusted)>.95?'extreme':'normal'].join('|');
  return {signs,direction,score,taker,pair,strength,buyShare,sellShare,groupKey,detailKey,
    baselineKey:`${signal.session}|${direction}`,session:signal.session,value:signal.adjusted,
    extreme:Math.abs(signal.adjusted)>.95,marker:signal.adjusted>.95,
    flowDirection:flowSign(signal.nf),pairSigns,alignment};
}

function add(pools,key,entryIndex,exitIndex,value){
  const pool=pools.get(key)??{n:0,positive:0,flat:0,sum:0,lastExit:-1};
  // Each cohort contains disjoint outcome windows (shared endpoints excluded).
  if(entryIndex<=pool.lastExit)return;
  pool.n++;pool.positive+=value>1e-10?1:0;pool.flat+=Math.abs(value)<=1e-10?1:0;pool.sum+=value;pool.lastExit=exitIndex;pools.set(key,pool);
}
function summary(pool,minSamples){
  const n=pool?.n??0,ready=n>=minSamples;
  return {n,ready,flat:pool?.flat??0,rate:ready?100*pool.positive/n:null,mean:ready?pool.sum/n:null};
}

export function strengthStatistics(rows,priceSymbol,source,step,{minSamples=MIN_SAMPLES}={}){
  if(!keys.includes(source)||!keys.slice(0,2).includes(priceSymbol)||!Number.isFinite(step)||step<=0||!Number.isInteger(minSamples)||minSamples<1)throw Error('Tham số thống kê Strength không hợp lệ');
  const price=rows[priceSymbol]??[],maps=Object.fromEntries(keys.map(k=>[k,new Map((rows[k]??[]).map(b=>[b.t,b]))]));
  const alignments=rows.alignment??[];
  const alignmentMap=new Map(alignments.map(b=>[b.t,b]));
  const states=price.map(b=>strengthState(Object.fromEntries(keys.map(k=>[k,maps[k].get(b.t)])),alignmentMap.get(b.t),source));
  const pools=HORIZONS.map(()=>({group:new Map(),detail:new Map(),baseline:new Map()})),result=new Map();
  for(let i=0;i<price.length;i++){
    const stats={};
    for(let k=0;k<HORIZONS.length;k++){
      const h=HORIZONS[k],j=i-h-1,exit=i-1,pool=pools[k];
      if(j>=0&&states[j]?.direction&&price[j].c>0&&price[exit].c>0&&price[exit].end<price[i].t){
        const candidate=states[j];let valid=true;
        for(let n=j+1;n<=exit;n++)if(price[n].t-price[n-1].t!==step||price[n].day!==price[j].day||price[n].session!==price[j].session){valid=false;break;}
        if(valid){
          const value=candidate.direction*100*(price[exit].c/price[j].c-1);
          add(pool.group,candidate.groupKey,j,exit,value);add(pool.detail,candidate.detailKey,j,exit,value);add(pool.baseline,candidate.baselineKey,j,exit,value);
        }
      }
      const state=states[i];
      const exact=state?.direction?pool.detail.get(state.detailKey):null;
      const broad=state?.direction?pool.group.get(state.groupKey):null;
      const detailed=(exact?.n??0)>=minSamples;
      const cohort=summary(detailed?exact:broad,minSamples),baseline=summary(state?.direction?pool.baseline.get(state.baselineKey):null,minSamples);
      stats[h]={...cohort,scope:detailed?'detail':'group',exactN:exact?.n??0,baseline,
        lift:cohort.ready&&baseline.ready?cohort.rate-baseline.rate:null};
    }
    result.set(price[i].t,{state:states[i],stats});
  }
  return result;
}

function trendCluster(sample,source){
  const direction=sign(sample.at(-1).bars[source].adjusted);
  if(!direction)return null;
  const alignedShare=sample.reduce((sum,x)=>sum+(direction>0?x.bars[source].buy:x.bars[source].sell)/x.bars[source].q,0)/sample.length;
  const persistence=sample.reduce((sum,x)=>sum+(sign(x.bars[source].adjusted)===direction?1:0),0)/sample.length;
  const magnitude=sample.reduce((sum,x)=>sum+clamp(direction*x.bars[source].adjusted),0)/sample.length;
  const slope=clamp(.5+direction*(sample.at(-1).bars[source].adjusted-sample[0].bars[source].adjusted)/2);
  const pair=sample.reduce((sum,x)=>sum+(clamp((1+direction*x.alignment.smoothSpyNf/50)/2)+clamp((1+direction*x.alignment.smoothQqqNf/50)/2))/2,0)/sample.length;
  const consensus=sample.reduce((sum,x)=>sum+keys.reduce((n,k)=>n+(sign(x.bars[k].adjusted)===direction?1:0),0)/(keys.length*sample.length),0);
  const components={persistence:25*persistence,magnitude:20*magnitude,slope:10*slope,taker:25*clamp((alignedShare-.4)/.3),pair:10*pair,consensus:10*consensus};
  const raw=Math.round(Object.values(components).reduce((a,b)=>a+b,0));
  return {direction,raw,components,alignedShare,persistence,magnitude,slope,pair,consensus};
}

function trendLabel(score,direction){
  const strength=score>=75?'RẤT MẠNH':score>=60?'MẠNH':score>=45?'KHÁ':score>=30?'YẾU':'SUY YẾU';
  return `${direction>0?'↑':'↓'} ${strength}`;
}

// Compare every trailing six-bar cluster with completed six-bar clusters that
// started when the selected Strength source changed sign. Reference clusters
// must end before the current cluster begins, so the comparison is causal.
export function trendStrength6(rows,source,step,{window=TREND_WINDOW,minHistory=TREND_MIN_HISTORY}={}){
  if(!keys.includes(source)||!Number.isFinite(step)||step<=0||!Number.isInteger(window)||window<2||!Number.isInteger(minHistory)||minHistory<1)throw Error('Tham số Trend Strength không hợp lệ');
  const signal=rows[source]??[],maps=Object.fromEntries(keys.map(k=>[k,new Map((rows[k]??[]).map(b=>[b.t,b]))])),alignmentMap=new Map((rows.alignment??[]).map(x=>[x.t,x]));
  const items=signal.map(b=>({t:b.t,bars:Object.fromEntries(keys.map(k=>[k,maps[k].get(b.t)])),alignment:alignmentMap.get(b.t)}));
  const valid=x=>x?.alignment&&keys.every(k=>Number.isFinite(x.bars[k]?.adjusted))&&[x.bars[source]?.q,x.bars[source]?.buy,x.bars[source]?.sell,x.alignment.smoothSpyNf,x.alignment.smoothQqqNf].every(Number.isFinite)&&x.bars[source].q>0;
  const clusterAt=end=>{
    if(end<window-1)return null;const sample=items.slice(end-window+1,end+1);
    if(!sample.every(valid))return null;
    for(let i=1;i<sample.length;i++)if(sample[i].t-sample[i-1].t!==step)return null;
    return trendCluster(sample,source);
  };
  const events=[];
  for(let start=1;start+window<=items.length;start++){
    const before=items[start-1]?.bars[source]?.adjusted,current=items[start]?.bars[source]?.adjusted;
    if(sign(before)&&sign(current)&&sign(before)!==sign(current)){
      const end=start+window-1,cluster=clusterAt(end);if(cluster)events.push({start,end,...cluster});
    }
  }
  const result=new Map(),history=[],byDirection={1:[],'-1':[]};let next=0;
  for(let i=0;i<items.length;i++){
    const currentStart=i-window+1;
    while(next<events.length&&events[next].end<currentStart){const e=events[next++];history.push(e.raw);byDirection[e.direction].push(e.raw);}
    const cluster=clusterAt(i);if(!cluster){result.set(items[i].t,null);continue;}
    const same=byDirection[cluster.direction],reference=same.length>=minHistory?same:history,n=reference.length;
    let percentile=null,score=cluster.raw;
    if(n){const less=reference.filter(x=>x<cluster.raw).length,equal=reference.filter(x=>x===cluster.raw).length;percentile=100*(less+.5*equal)/n;if(n>=minHistory)score=Math.round((cluster.raw+percentile)/2);}
    result.set(items[i].t,{...cluster,score,percentile,n,scope:same.length>=minHistory?'same-sign':'all-signs',ready:n>=minHistory,label:trendLabel(score,cluster.direction)});
  }
  return result;
}
