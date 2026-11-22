// Run the production web engine against the checked-in M15 archives.
// Usage: node research/tk-v2-web-audit.mjs [output.json]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sessionAt,analyze,calculateVolumeStrength} from '../netflow-stumpy/engine.mjs';
import {bodyReversalHistory} from '../netflow-stumpy/spy-body-reversal.mjs';
import {backtestReversalTrades,summarizeReversalTrades} from '../netflow-stumpy/spy-body-reversal-trades.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'netflow-stumpy/data/binance/m15'),step=900000;
const months=fs.readdirSync(dir).filter(name=>/^\d{4}-\d{2}\.json$/.test(name)).sort();
const bars=[...new Map(months.flatMap(name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')).SPYUSDT??[]).map(r=>{
  const [t,o,h,l,c,v,end,q,buy]=r;
  return [t,{t,o,h,l,c,v,end,q,buy,...sessionAt(t)}];
})).values()].sort((a,b)=>a.t-b.t);
if(!bars.length)throw Error('No archived SPYUSDT candles');
const now=bars.at(-1).end+1,bodyBars=bars.map(b=>({...b,v:Math.abs(b.c-b.o)}));
const bodyRows=analyze(bodyBars,step,{strength:calculateVolumeStrength(bodyBars,step,{halfLife:2})});
const points=bodyReversalHistory(bars,new Map(),{now,adaptive:false}).points;
const clock=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'});
const monthAt=t=>{const p=Object.fromEntries(clock.formatToParts(t).map(x=>[x.type,x.value]));return p.year+'-'+p.month;};
const variants=[];
for(const trendFilter of [false,true])for(const roundTripBps of [0,10]){
  const report=backtestReversalTrades({bars,bodyRows,points,now,roundTripBps,trendFilter,holdStrongTrend:true});
  variants.push({trendFilter,holdStrongTrend:true,roundTripBps,summary:report.summary,
    monthly:months.map(name=>{const month=name.slice(0,7),trades=report.trades.filter(t=>monthAt(t.entryTime)===month);return {month,...summarizeReversalTrades(trades)};}),
    censored:report.censored.length,open:report.open?{entryTime:report.open.entryTime,direction:report.open.direction}:null});
}
const result={source:'checked-in SPYUSDT M15 archive, production web EWMA fixed alpha',
  from:new Date(bars[0].t).toISOString(),through:new Date(now).toISOString(),bars:bars.length,
  gapCount:bars.slice(1).filter((b,i)=>b.t!==bars[i].t+step).length,
  monthTimeZone:'Asia/Ho_Chi_Minh',attribution:'entry month; only observed closed exits included; pre-month data warms indicators',
  limitations:['Archived data only; not a live run.','A trade censored by a data gap is excluded, never assigned a synthetic exit.','Funding and slippage are not included.','Results are not the TakeProfit strategy report.'],variants};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({from:result.from,through:result.through,bars:result.bars,gaps:result.gapCount,
  variants:variants.map(v=>({trendFilter:v.trendFilter,roundTripBps:v.roundTripBps,censored:v.censored,open:v.open,monthly:v.monthly.map(m=>({month:m.month,count:m.count,netPoints:Number(m.netPoints.toFixed(2)),winRate:m.winRate,profitFactor:m.profitFactor}))}))},null,2));
