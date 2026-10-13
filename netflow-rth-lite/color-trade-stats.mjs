// Causal PRE→RTH trade episodes driven by the displayed Strength candle color.
import {eligibleMarketBar} from './market-calendar.mjs';

export const COLOR_TRADE_MEMORY_H=-1;
export const COLOR_TRADE_LEVELS=[
  {key:'all',label:'Tất cả màu',minimum:null},
  {key:'45',label:'TREND6 ≥45',minimum:45},
  {key:'60',label:'TREND6 ≥60',minimum:60},
  {key:'75',label:'TREND6 ≥75',minimum:75}
];
const sign=x=>x>0?1:x<0?-1:0;
const median=values=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;};

function summarize(records,minSamples,tradeCost){
  const n=records.length,ready=n>=minSamples,net=records.map(x=>x.value-tradeCost),wins=net.filter(x=>x>1e-10).length;
  const profit=net.reduce((sum,x)=>sum+Math.max(0,x),0),loss=-net.reduce((sum,x)=>sum+Math.min(0,x),0);
  return {n,ready,tradeCost,winRate:ready?100*wins/n:null,expectancy:ready?net.reduce((a,b)=>a+b,0)/n:null,
    profitFactor:ready?(loss>1e-12?profit/loss:profit>1e-12?Infinity:null):null,
    medianMfe:ready?median(records.map(x=>x.mfe)):null,medianMae:ready?median(records.map(x=>x.mae)):null,
    averageBars:ready?records.reduce((sum,x)=>sum+x.holdBars,0)/n:null,
    colorExitRate:ready?100*records.filter(x=>x.exitReason==='color-change').length/n:null};
}

function generateTrades(price,signalMap,trendMap,step){
  const records=[];let position=null,previous=null;
  const start=bar=>{const direction=sign(signalMap.get(bar.t)?.adjusted);if(!direction)return null;const trend=trendMap.get(bar.t);return {entry:bar,direction,entryScore:Number.isFinite(trend?.stableScore)?trend.stableScore:Number.isFinite(trend?.score)?trend.score:null,maxHigh:bar.c,minLow:bar.c,holdBars:0};};
  const close=(bar,reason)=>{
    if(!position||!bar||position.holdBars<1)return;
    const entry=position.entry.c,value=position.direction*100*(bar.c/entry-1);
    const mfe=Math.max(0,position.direction>0?100*(position.maxHigh/entry-1):100*(1-position.minLow/entry));
    const mae=Math.max(0,position.direction>0?100*(1-position.minLow/entry):100*(position.maxHigh/entry-1));
    records.push({h:COLOR_TRADE_MEMORY_H,entryTime:position.entry.t,exitTime:bar.t,availableAt:bar.end,groupKey:'PRE-RTH-COLOR',detailKey:`TREND6|${position.entryScore??'NA'}`,baselineKey:'PRE-RTH',value,mfe,mae,holdBars:position.holdBars,entryScore:position.entryScore,entrySession:position.entry.session,direction:position.direction,exitReason:reason});
  };
  for(const bar of price){
    const direction=sign(signalMap.get(bar.t)?.adjusted),active=eligibleMarketBar(bar)&&['PRE','RTH'].includes(bar.session)&&direction;
    const broken=previous&&(bar.day!==previous.day||bar.t-previous.t!==step);
    if(broken){if(position&&bar.day!==previous.day&&previous.session==='RTH')close(previous,'rth-close');position=null;previous=null;}
    if(!active){if(position&&previous?.session==='RTH')close(previous,'rth-close');position=null;previous=null;continue;}
    if(!position)position=start(bar);
    else{
      position.holdBars++;position.maxHigh=Math.max(position.maxHigh,bar.h);position.minLow=Math.min(position.minLow,bar.l);
      if(direction!==position.direction){close(bar,'color-change');position=start(bar);}
    }
    previous=bar;
  }
  return records;
}

export function colorTradeStatistics(rows,priceSymbol,source,step,trendMap,{minSamples=20,memory=[],tradeCost=0}={}){
  if(!['SPYUSDT','QQQUSDT'].includes(priceSymbol)||!['SPYUSDT','QQQUSDT','COMPOSITE'].includes(source)||!Number.isFinite(step)||step<=0||!(trendMap instanceof Map)||!Number.isInteger(minSamples)||minSamples<1||!Array.isArray(memory)||!Number.isFinite(tradeCost)||tradeCost<0||tradeCost>5)throw Error('Tham số giao dịch màu nến không hợp lệ');
  const price=rows[priceSymbol]??[],signalMap=new Map((rows[source]??[]).map(x=>[x.t,x])),generated=generateTrades(price,signalMap,trendMap,step),firstTime=price[0]?.t??Infinity;
  const remembered=memory.filter(x=>x?.h===COLOR_TRADE_MEMORY_H&&x.entryTime<firstTime&&[x.entryTime,x.exitTime,x.availableAt,x.value,x.mfe,x.mae,x.holdBars].every(Number.isFinite)).sort((a,b)=>a.availableAt-b.availableAt);
  const pending=[...remembered,...generated].sort((a,b)=>a.availableAt-b.availableAt),buckets=Object.fromEntries(COLOR_TRADE_LEVELS.map(x=>[x.key,[]])),result=new Map();let cursor=0;
  const add=record=>{for(const level of COLOR_TRADE_LEVELS)if(level.minimum===null||Number.isFinite(record.entryScore)&&record.entryScore>=level.minimum)buckets[level.key].push(record);};
  for(const bar of price){while(cursor<pending.length&&pending[cursor].availableAt<bar.t)add(pending[cursor++]);const stats={};for(const level of COLOR_TRADE_LEVELS)stats[level.key]=summarize(buckets[level.key],minSamples,tradeCost);result.set(bar.t,{stats});}
  result.samples=generated;result.rememberedSamples=remembered.length;return result;
}
