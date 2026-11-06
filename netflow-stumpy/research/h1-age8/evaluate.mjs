import fs from 'node:fs';
import {trendAgeStatistics} from '../../pre-rth-wlr-trend.mjs';
const H=3600000;
export function encode(window,direction){
  if(window.length!==8||window.some((r,i)=>!Number.isFinite(r.score)||(i&&r.t-window[i-1].t!==H)))return null;
  if(new Set(window.map(r=>r.basis)).size!==1)return null;
  return window.map(r=>r.score*direction/4);
}
export function distance(a,b){return Math.sqrt(a.reduce((s,x,i)=>s+(i+1)*(x-b[i])**2,0)/36);}
export function prepare(records){
  const episodes=[],queries=[];let current=null,invalidDay=records[0]?.day;
  records.forEach((r,i)=>{
    const previous=records[i-1],contiguous=previous&&r.t-previous.t===H&&r.day===previous.day;
    if(current&&(!contiguous||r.direction!==current.direction)){
      current.censored=!contiguous;current.resolvedAt=r.end;current.duration=current.members.length;episodes.push(current);current=null;
    }
    if(previous&&r.day===previous.day&&r.t-previous.t!==H)invalidDay=r.day;
    if(!r.direction||r.day===invalidDay)return;
    if(!current)current={id:r.t,day:r.day,direction:r.direction,members:[]};
    const age=current.members.length+1,window=records.slice(Math.max(0,i-7),i+1),vector=encode(window,r.direction);
    const q={...r,age,episode:current,vector,windowStart:window[0].t};
    current.members.push(q);if(vector)queries.push(q);
  });
  if(current){current.censored=true;current.resolvedAt=Infinity;current.duration=current.members.length;episodes.push(current);}
  return {episodes,queries};
}
export function candidates(query,episodes){
  return episodes.filter(e=>e.id!==query.episode.id&&e.direction===query.direction&&e.day<query.day&&e.resolvedAt<=query.windowStart&&e.duration>=query.age)
    .map(e=>({episode:e,member:e.members[query.age-1]})).filter(x=>x.member.vector)
    .map(x=>({...x,distance:distance(query.vector,x.member.vector)}));
}
function forecast(pool,age,horizon){return trendAgeStatistics(pool.map(x=>x.episode),age,horizon,20,8);}
function truth(q,h){const e=q.episode;return e.duration>=q.age+h?1:e.censored?null:0;}
function run(queries,episodes,k){
  return queries.map(q=>{
    const pool=candidates(q,episodes),near=pool.filter(x=>x.distance<=.75).sort((a,b)=>a.distance-b.distance||a.episode.id-b.episode.id).slice(0,k);
    const row={day:q.day,t:q.t,age:q.age,episode:q.episode.id,n:near.length,exact:pool.filter(x=>x.distance===0).length};
    for(const h of [1,3]){const b=forecast(pool,q.age,h),m=forecast(near,q.age,h),y=truth(q,h);if(b.ready&&m.ready&&y!==null){row['b'+h]=(b.continuation-y)**2;row['m'+h]=(m.continuation-y)**2;}}
    const b=forecast(pool,q.age,1),m=forecast(near,q.age,1);
    if(!q.episode.censored&&b.ready&&m.ready&&b.remainingBars!==null&&m.remainingBars!==null){const remaining=q.episode.duration-q.age;row.bMAE=Math.abs(b.remainingBars-remaining);row.mMAE=Math.abs(m.remainingBars-remaining);}
    return row;
  });
}
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
function summary(rows){const out={queries:rows.length,days:new Set(rows.map(r=>r.day)).size,episodes:new Set(rows.map(r=>r.episode)).size};for(const metric of ['1','3','MAE']){const valid=rows.filter(r=>Number.isFinite(r['b'+metric])&&Number.isFinite(r['m'+metric]));out[metric]={n:valid.length,baseline:mean(valid.map(r=>r['b'+metric])),encoded8:mean(valid.map(r=>r['m'+metric]))};}out.exactCodeSupportMedian=rows.map(r=>r.exact).sort((a,b)=>a-b)[Math.floor(rows.length/2)];return out;}
function bootstrap(rows,metric){const groups=new Map();for(const r of rows)if(Number.isFinite(r['b'+metric])){if(!groups.has(r.day))groups.set(r.day,[]);groups.get(r.day).push(r['b'+metric]-r['m'+metric]);}const days=[...groups.values()],draws=[];if(!days.length)return null;let state=19062026;const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};for(let k=0;k<2000;k++){const values=[];for(let i=0;i<days.length;i++)values.push(...days[Math.floor(rand()*days.length)]);draws.push(mean(values));}draws.sort((a,b)=>a-b);return {days:days.length,baselineMinusEncoded95:[draws[50],draws[1949]]};}
if(process.argv[1]?.endsWith('evaluate.mjs')){
  const input=JSON.parse(fs.readFileSync(new URL('./replay.json',import.meta.url)));
  if(input.audit.some(a=>!a.match))throw Error('Causal audit mismatch');
  const {episodes,queries}=prepare(input.records),days=[...new Set(input.records.map(r=>r.day))].sort(),validationStart=days[Math.floor(days.length*.6)],testStart=days[Math.floor(days.length*.8)];
  const validation=queries.filter(q=>q.day>=validationStart&&q.day<testStart),test=queries.filter(q=>q.day>=testStart);
  const variants=[24,40,64].map(k=>{const rows=run(validation,episodes,k);return {k,summary:summary(rows),objective:mean(rows.flatMap(r=>[r.m1,r.m3].filter(Number.isFinite)))};});
  const best=variants.filter(v=>v.objective!==null).sort((a,b)=>a.objective-b.objective)[0];
  const testRows=best?run(test,episodes,best.k):[],result={schema:'h1-age8-evaluation-v1',basis:'NO_OI_4_COMPONENTS',target:'Remaining consecutive same-color locked H1 boxes, reset at NY day or gap; day/gap endings censored.',records:input.records.length,days:days.length,episodes:episodes.length,queries:queries.length,causalAudit:input.audit,split:{validationStart,testStart},variants,selectedK:best?.k??null,test:summary(testRows),confidence:{h1:bootstrap(testRows,'1'),h3:bootstrap(testRows,'3'),MAE:bootstrap(testRows,'MAE')},limitations:['No historical OI; scores use four available components, not validated full -5..+5.','Research KM same-age/direction baseline, not a claim of beating the deployed M15 forecast.','H1 color is recomputed at each hourly close, not a final-history repaint.','Bootstrap by NY day; overlapping windows still reduce effective sample size.']};
  fs.writeFileSync(new URL('./evaluation.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
