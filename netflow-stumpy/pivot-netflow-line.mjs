import {confirmedPricePivots} from './geometry.mjs?v=20261025-dcommon-all1';
const decay=Math.exp(Math.log(.5)/32);
const valid=row=>Number.isFinite(row?.net)&&Number.isFinite(row?.q)&&row.q>0;
// Replay each timestamp with only pivots confirmed by that close. The open bar
// can update flow, but cannot confirm a new anchor.
export function pivotNetflowLine(price=[],composite=[],{now=Date.now(),fromTime=-Infinity,latestFlow=null}={}){
 const bars=price.filter(r=>r.t<=now).sort((a,b)=>a.t-b.t),source=new Map(composite.filter(r=>r.t<=now).map(r=>[r.t,r]));
 const pivots=confirmedPricePivots(bars).filter(p=>(bars[p.confirmedIndex].end??bars[p.confirmedIndex].t)<now);
 const seen=[],result=[];let cursor=0;
 const lastShared=bars.findLastIndex(r=>source.has(r.t));
 for(let i=0;i<bars.length;i++){
  const bar=bars[i];while(cursor<pivots.length&&pivots[cursor].confirmedIndex<=i)seen.push(pivots[cursor++]);
  if(bar.t<fromTime)continue;
  if(i>lastShared){result.push({t:bar.t,pct:null,mode:'missing'});continue;}
  const second=seen.at(-1),first=seen.findLast(p=>second&&p.index<second.index&&p.type!==second.type);
  const closedCount=i+1-((bar.end??bar.t)>=now?1:0);
  let anchored=Boolean(closedCount>=40&&first&&second&&second.index-first.index>=4&&second.index-first.index<=160);
  if(anchored){
   let covered=0,quote=0;for(let j=first.index;j<=second.index;j++){const row=source.get(bars[j].t);if(valid(row)){covered++;quote+=row.q;}}
   anchored=covered/(second.index-first.index+1)>=.8&&quote>0;
  }
  const start=anchored?first.index:Math.max(0,i-95),length=i-start+1;
  let net=0,quote=0,covered=0;
  for(let j=start;j<=i;j++){net*=decay;quote*=decay;const row=source.get(bars[j].t);if(valid(row)){net+=row.net;quote+=row.q;covered++;}}
  let pct=length>=4&&covered/length>=.8&&quote>0?100*net/quote:null;
  // The UI's REV6 readout is authoritative for its current archived anchor.
  if(latestFlow?.latestTime===bar.t)pct=Number.isFinite(latestFlow.pct)?latestFlow.pct:null;
  result.push({t:bar.t,pct,mode:anchored?'pivot':'rolling',firstPivotTime:anchored?first.t:null});
 }
 return result;
}
export function pivotNetflowLineData(rows){
 return rows.map(row=>Number.isFinite(row.pct)?{time:row.t/1000,value:row.pct,color:row.pct>0?'#1ae0a3':row.pct<0?'#ff4d70':'#a4b2c4'}:{time:row.t/1000});
}
