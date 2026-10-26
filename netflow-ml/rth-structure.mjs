import {isUsMarketTradingDay} from './market-calendar.mjs?v=20261025-dcommon-all1';
import {shapeDistance,percentile,wilson} from './analogs-core.mjs?v=20261025-dcommon-all1';
export const STEP=900000;
export const SHAPES=['UP_TREND','DOWN_TREND','RANGE','UP_THEN_DOWN','DOWN_THEN_UP','MIXED'];
export const SHAPE_NAMES={UP_TREND:'Trend tăng',DOWN_TREND:'Trend giảm',RANGE:'Đi ngang / co hẹp',UP_THEN_DOWN:'Tăng rồi đảo giảm',DOWN_THEN_UP:'Giảm rồi đảo tăng',MIXED:'Mở rộng / hỗn hợp'};
const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const early=new Set(['2025-07-03','2025-11-28','2025-12-24','2026-11-27','2026-12-24','2027-11-26','2028-07-03','2028-11-24']);
export function ny(t){const p=Object.fromEntries(clock.formatToParts(t).map(v=>[v.type,v.value]));return {day:`${p.year}-${p.month}-${p.day}`,minute:+p.hour*60+ +p.minute};}
export function tradingDay(day){return +day.slice(0,4)>=2025&&+day.slice(0,4)<=2028&&day!=='2025-01-09'&&(day==='2027-12-31'||isUsMarketTradingDay(day));}
export function closeMinute(day){return early.has(day)?780:960;}
export function postEnd(day){return early.has(day)?1020:1200;}
export function stamp(day,minute){const noon=Date.parse(day+'T12:00:00Z');return noon+(minute-ny(noon).minute)*60000;}
export function nextTradingDay(day){let t=Date.parse(day+'T12:00:00Z');for(let i=0;i<10;i++){t+=86400000;const d=new Date(t).toISOString().slice(0,10);if(tradingDay(d))return d;}return null;}
export function shapeDescriptor(bars,atr){
  if(bars.length<4||!(atr>0))return null;
  const base=bars[0].open;if(!(base>0))return null;
  const path=[0,...bars.map(r=>(r.c-base)/atr)],net=path.at(-1),variation=path.slice(1).reduce((s,v,i)=>s+Math.abs(v-path[i]),0),efficiency=variation?Math.abs(net)/variation:0,peak=Math.max(...path),trough=Math.min(...path),peakAt=path.indexOf(peak),troughAt=path.indexOf(trough),drop=peak-net,bounce=net-trough;
  const n=path.length,xm=(n-1)/2,ym=path.reduce((s,v)=>s+v,0)/n;let cov=0,xx=0,total=0,error=0;
  for(let i=0;i<n;i++){cov+=(i-xm)*(path[i]-ym);xx+=(i-xm)**2;}const slope=cov/xx;
  for(let i=0;i<n;i++){total+=(path[i]-ym)**2;error+=(path[i]-ym-slope*(i-xm))**2;}
  const r2=total>1e-12?Math.max(0,1-error/total):0,up=(Math.max(...bars.map(r=>r.high))-base)/atr,down=(base-Math.min(...bars.map(r=>r.low)))/atr,range=up+down;
  const reverseDown=peak>=.8&&drop>=.75&&peakAt>0&&peakAt<n-1&&net<=peak*.4,reverseUp=trough<=-.8&&bounce>=.75&&troughAt>0&&troughAt<n-1&&net>=trough*.4;
  let label='MIXED';
  if(reverseDown||reverseUp)label=reverseDown&&(!reverseUp||drop>=bounce)?'UP_THEN_DOWN':'DOWN_THEN_UP';
  else if(efficiency>=.45&&Math.abs(net)>=.6)label=net>0?'UP_TREND':'DOWN_TREND';
  else if(range<=1.5&&efficiency<.35)label='RANGE';
  return {label,path,netAtr:net,upAtr:up,downAtr:down,rangeAtr:range,efficiency,r2,slopeAtr:slope,returnPct:100*(bars.at(-1).c/base-1)};
}
export function caseAt(rows,index,m,h,lookup=new Map(rows.map(r=>[r.t,r]))){
  if(index<m-1||![8,16].includes(m)||![4,8,26].includes(h))return null;
  const last=rows[index],p=ny(last.t),asOf=last.t+STEP,minute=p.minute+15;
  if(!tradingDay(p.day)||p.minute<240||minute>postEnd(p.day))return null;
  const window=rows.slice(index-m+1,index+1);
  if(window.some((r,j)=>ny(r.t).day!==p.day||ny(r.t).minute<240||ny(r.t).minute>=postEnd(p.day)||r.pv?.length!==10||!r.pv.every(Number.isFinite)||!Number.isFinite(r.c)||(j&&r.t-window[j-1].t!==STEP)))return null;
  const phase=minute<=570?'PRE':minute<closeMinute(p.day)?'RTH':'POST';
  const targetDay=phase==='POST'?nextTradingDay(p.day):p.day;if(!targetDay)return null;
  const targetMinute=phase==='RTH'?minute:570,start=stamp(targetDay,targetMinute),remaining=(closeMinute(targetDay)-targetMinute)/15,effectiveH=Math.min(h,remaining);
  if(effectiveH<4)return null;
  const history=rows.slice(Math.max(0,index-13),index+1);if(history.length<14||history.some((r,j)=>j&&r.t-history[j-1].t!==STEP))return null;
  const atr=history.reduce((sum,r,j)=>{const prev=rows[Math.max(0,index-13)+j-1]?.c;return sum+Math.max(r.high-r.low,Number.isFinite(prev)?Math.abs(r.high-prev):0,Number.isFinite(prev)?Math.abs(r.low-prev):0);},0)/14;if(!(atr>1e-10))return null;
  const future=Array.from({length:effectiveH},(_,j)=>lookup.get(start+j*STEP)),complete=future.every(r=>r&&Number.isFinite(r.open)&&Number.isFinite(r.high)&&Number.isFinite(r.low));
  const end=start+effectiveH*STEP,outcome=complete?shapeDescriptor(future,atr):null;
  return {i:index,startIndex:index-m+1,inputStart:window[0].t,inputEnd:asOf,queryTime:last.t,queryDay:p.day,clockMinute:minute,phase,targetDay,targetStart:start,targetEnd:end,h:effectiveH,requestedH:h,m,atr,pivot:last.pivot??null,outcome};
}
export function candidatesFor(cases,query){return cases.filter(c=>c.outcome&&c.phase===query.phase&&c.clockMinute===query.clockMinute&&c.h===query.h&&c.targetEnd<=query.inputStart&&c.inputEnd<=query.inputStart);}
export function selectCases(ranked,cases,limit=20){const map=new Map(cases.map(c=>[c.startIndex,c])),picked=[],days=new Set();for(const r of ranked){const c=map.get(r.index);if(!c||days.has(c.targetDay)||picked.some(p=>!(c.inputStart>=p.targetEnd||p.inputStart>=c.targetEnd)))continue;days.add(c.targetDay);picked.push({...c,distance:r.distance});if(picked.length===limit)break;}return picked;}
export function probabilities(cases){const counts=SHAPES.map(k=>cases.filter(c=>c.outcome.label===k).length);return counts.map(n=>(n+1)/(cases.length+SHAPES.length));}
export function summarizeCases(query,picked,baseline){
  const n=picked.length,bp=probabilities(baseline),counts=SHAPES.map(k=>picked.filter(c=>c.outcome.label===k).length),probs=probabilities(picked),q=key=>[.25,.5,.75].map(p=>percentile(picked.map(c=>c.outcome[key]),p));
  const labels=SHAPES.map((label,i)=>({label,name:SHAPE_NAMES[label],n:counts[i],frequency:n?counts[i]/n:null,probability:probs[i],interval:wilson(counts[i],n),baseline:bp[i],lift:probs[i]-bp[i]}));
  const paths=picked.map(c=>c.outcome.path),medianPath=Array.from({length:query.h+1},(_,i)=>percentile(paths.map(p=>p[i]),.5));
  return {status:n>=12?'EXPLORATORY':'WAIT',query:Object.fromEntries(Object.entries(query).filter(([k])=>k!=='outcome')),n,days:new Set(picked.map(c=>c.targetDay)).size,baselineN:baseline.length,labels,distribution:{returnPct:q('returnPct'),rangeAtr:q('rangeAtr'),upAtr:q('upAtr'),downAtr:q('downAtr'),efficiency:q('efficiency'),r2:q('r2')},medianPath,matches:picked.map(c=>({inputStart:c.inputStart,inputEnd:c.inputEnd,targetDay:c.targetDay,targetStart:c.targetStart,targetEnd:c.targetEnd,distance:c.distance,...c.outcome}))};
}
export function rankCases(rows,query,candidates){const a=rows.slice(query.startIndex,query.i+1);return candidates.map(c=>({index:c.startIndex,distance:shapeDistance(a,rows.slice(c.startIndex,c.i+1),{technique:'price-volume'})})).sort((a,b)=>a.distance-b.distance||a.index-b.index);}
export function scoreForecasts(records){
  if(!records.length)return {status:'WAIT',n:0,days:0,reason:'Chưa có dự báo lịch sử đủ mẫu để chấm ngoài mẫu'};
  const loss=(r,key)=>r[key].reduce((sum,p,j)=>sum+(p-Number(j===r.y))**2,0),mean=a=>a.reduce((s,v)=>s+v,0)/a.length,days=[...new Set(records.map(r=>r.day))].sort(),daily=days.map(day=>mean(records.filter(r=>r.day===day).map(r=>loss(r,'base')-loss(r,'pred'))));
  let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},samples=[];
  for(let b=0;b<1000;b++){const a=[];while(a.length<days.length){const at=Math.floor(random()*days.length);for(let j=0;j<Math.min(5,days.length);j++)a.push(daily[(at+j)%days.length]);}samples.push(mean(a.slice(0,days.length)));}
  const gain=mean(daily),low=percentile(samples,.025),high=percentile(samples,.975);
  return {status:days.length>=30&&low>0?'PROMISING_REQUIRES_FORWARD_TEST':'NOT_ESTABLISHED',n:records.length,days:days.length,accuracy:mean(records.map(r=>Number(r.pred.indexOf(Math.max(...r.pred))===r.y))),baselineAccuracy:mean(records.map(r=>Number(r.base.indexOf(Math.max(...r.base))===r.y))),brier:mean(records.map(r=>loss(r,'pred'))),baselineBrier:mean(records.map(r=>loss(r,'base'))),gain,low,high,method:'paired 5-day moving-block bootstrap; positive favors conditional analogs',records};
}
