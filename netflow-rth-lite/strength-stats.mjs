// Descriptive, causal statistics. The score uses fixed rules; no trained model.
export const HORIZONS=[1,3,6];
export const MIN_SAMPLES=20;
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

function add(pools,key,entryTime,exitTime,value,mfe=null,mae=null){
  const pool=pools.get(key)??{n:0,positive:0,flat:0,sum:0,lastExit:-Infinity,values:[],excursions:[]};
  // Each cohort contains disjoint outcome windows (shared endpoints excluded).
  if(entryTime<=pool.lastExit)return;
  pool.n++;pool.positive+=value>1e-10?1:0;pool.flat+=Math.abs(value)<=1e-10?1:0;pool.sum+=value;pool.values.push(value);
  if(Number.isFinite(mfe)&&Number.isFinite(mae))pool.excursions.push({mfe,mae});
  pool.lastExit=exitTime;pools.set(key,pool);
}
function median(values){
  if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function summary(pool,minSamples,tradeCost){
  const n=pool?.n??0,ready=n>=minSamples;
  const net=(pool?.values??[]).map(value=>value-tradeCost),wins=net.filter(value=>value>1e-10).length;
  const grossProfit=net.reduce((sum,value)=>sum+Math.max(0,value),0),grossLoss=-net.reduce((sum,value)=>sum+Math.min(0,value),0);
  const excursionN=pool?.excursions?.length??0,excursionReady=excursionN>=minSamples;
  return {n,ready,flat:pool?.flat??0,rate:ready?100*pool.positive/n:null,mean:ready?pool.sum/n:null,
    tradeCost,winRate:ready?100*wins/n:null,expectancy:ready?net.reduce((a,b)=>a+b,0)/n:null,
    medianReturn:ready?median(net):null,profitFactor:ready?(grossLoss>1e-12?grossProfit/grossLoss:grossProfit>1e-12?Infinity:null):null,
    excursionN,excursionReady,medianMfe:excursionReady?median(pool.excursions.map(x=>x.mfe)):null,medianMae:excursionReady?median(pool.excursions.map(x=>x.mae)):null};
}

export function strengthStatistics(rows,priceSymbol,source,step,{minSamples=MIN_SAMPLES,memory=[],tradeCost=0}={}){
  if(!keys.includes(source)||!keys.slice(0,2).includes(priceSymbol)||!Number.isFinite(step)||step<=0||!Number.isInteger(minSamples)||minSamples<1||!Array.isArray(memory)||!Number.isFinite(tradeCost)||tradeCost<0||tradeCost>5)throw Error('Tham số thống kê Strength không hợp lệ');
  const price=rows[priceSymbol]??[],maps=Object.fromEntries(keys.map(k=>[k,new Map((rows[k]??[]).map(b=>[b.t,b]))]));
  const alignments=rows.alignment??[];
  const alignmentMap=new Map(alignments.map(b=>[b.t,b]));
  const states=price.map(b=>strengthState(Object.fromEntries(keys.map(k=>[k,maps[k].get(b.t)])),alignmentMap.get(b.t),source));
  const pools=HORIZONS.map(()=>({group:new Map(),detail:new Map(),baseline:new Map()})),result=new Map(),generated=[];
  const firstTime=price[0]?.t??Infinity,oldMemory=memory.filter(x=>HORIZONS.includes(x?.h)&&Number.isFinite(x.entryTime)&&Number.isFinite(x.exitTime)&&Number.isFinite(x.availableAt)&&Number.isFinite(x.value)&&typeof x.groupKey==='string'&&typeof x.detailKey==='string'&&typeof x.baselineKey==='string'&&x.entryTime<firstTime).sort((a,b)=>a.availableAt-b.availableAt);
  const remembered=HORIZONS.map(h=>oldMemory.filter(x=>x.h===h)),memoryCursor=HORIZONS.map(()=>0);
  const addRecord=(pool,record)=>{add(pool.group,record.groupKey,record.entryTime,record.exitTime,record.value,record.mfe,record.mae);add(pool.detail,record.detailKey,record.entryTime,record.exitTime,record.value,record.mfe,record.mae);add(pool.baseline,record.baselineKey,record.entryTime,record.exitTime,record.value,record.mfe,record.mae);};
  for(let i=0;i<price.length;i++){
    const stats={};
    for(let k=0;k<HORIZONS.length;k++){
      const h=HORIZONS[k],j=i-h-1,exit=i-1,pool=pools[k];
      while(memoryCursor[k]<remembered[k].length&&remembered[k][memoryCursor[k]].availableAt<price[i].t)addRecord(pool,remembered[k][memoryCursor[k]++]);
      if(j>=0&&states[j]?.direction&&price[j].c>0&&price[exit].c>0&&price[exit].end<price[i].t){
        const candidate=states[j];let valid=true;
        for(let n=j+1;n<=exit;n++)if(price[n].t-price[n-1].t!==step||price[n].day!==price[j].day||price[n].session!==price[j].session){valid=false;break;}
        if(valid){
          const value=candidate.direction*100*(price[exit].c/price[j].c-1);
          const path=price.slice(j+1,exit+1),entry=price[j].c,maxHigh=Math.max(...path.map(x=>x.h)),minLow=Math.min(...path.map(x=>x.l));
          const mfe=Math.max(0,candidate.direction>0?100*(maxHigh/entry-1):100*(1-minLow/entry));
          const mae=Math.max(0,candidate.direction>0?100*(1-minLow/entry):100*(maxHigh/entry-1));
          const record={h,entryTime:price[j].t,exitTime:price[exit].t,availableAt:price[exit].end,groupKey:candidate.groupKey,detailKey:candidate.detailKey,baselineKey:candidate.baselineKey,value,mfe,mae};
          generated.push(record);addRecord(pool,record);
        }
      }
      const state=states[i];
      const exact=state?.direction?pool.detail.get(state.detailKey):null;
      const broad=state?.direction?pool.group.get(state.groupKey):null;
      const detailed=(exact?.n??0)>=minSamples;
      const cohort=summary(detailed?exact:broad,minSamples,tradeCost),baseline=summary(state?.direction?pool.baseline.get(state.baselineKey):null,minSamples,tradeCost);
      stats[h]={...cohort,scope:detailed?'detail':'group',exactN:exact?.n??0,baseline,
        lift:cohort.ready&&baseline.ready?cohort.rate-baseline.rate:null};
    }
    result.set(price[i].t,{state:states[i],stats});
  }
  result.samples=generated;result.rememberedSamples=oldMemory.length;
  return result;
}
