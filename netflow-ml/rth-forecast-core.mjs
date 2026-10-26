import {shapeDistance,percentile,wilson} from './analogs-core.mjs?v=20261025-dcommon-all1';
import {caseAt,ny,closeMinute,selectCases,STEP} from './rth-structure.mjs?v=20261025-dcommon-all1';
import {choosePivotCohort} from './rth-pivot.mjs?v=20261025-dcommon-all1';
export const FORECAST_MODELS=['FLAT','PRIOR','STUMPY8','STUMPY16','PIVOT8','PIVOT16'];
export const MODEL_NAMES={FLAT:'Giữ giá hiện tại',PRIOR:'Trung vị cùng phút RTH',STUMPY8:'STUMPY · 8 nến',STUMPY16:'STUMPY · 16 nến',PIVOT8:'STUMPY + Pivot · 8 nến',PIVOT16:'STUMPY + Pivot · 16 nến'};
export function forecastQuery(rows,{now=Date.now()}={}){
 const last=rows.at(-1);if(!last||now-last.t-STEP<0||now-last.t-STEP>STEP+15000)return null;
 const q=caseAt(rows,rows.length-1,16,8);if(!q||q.h!==8||q.targetStart!==q.inputEnd||q.clockMinute<570||q.clockMinute+120>closeMinute(q.queryDay)||ny(now).day!==q.queryDay)return null;
 return {...q,c0:last.c};
}
export function forecastCandidates(cases,q){return cases.filter(c=>c.clockMinute===q.clockMinute&&c.targetEnd<=q.inputStart&&c.targetDay!==q.targetDay);}
export function forecastRanking(rows,q,candidates,m){const query=rows.slice(q.i-m+1,q.i+1);return candidates.map(c=>({index:c.startIndex,distance:shapeDistance(query,rows.slice(c.i-m+1,c.i+1),{technique:'price-volume'})})).sort((a,b)=>a.distance-b.distance||a.index-b.index);}
export function forecastPaths(candidates,picked,{flat=false}={}){
 const data=picked??candidates;if(!data.length)return null;
 const paths=data.map(c=>c.path),quant=p=>Array.from({length:8},(_,j)=>percentile(paths.map(a=>a[j]),p)),up=data.filter(c=>c.path[7]>0).length,down=data.filter(c=>c.path[7]<0).length;
 return {median:flat?Array(8).fill(0):quant(.5),low:quant(.1),high:quant(.9),n:data.length,up:(up+1)/(data.length+3),down:(down+1)/(data.length+3),flat:(data.length-up-down+1)/(data.length+3),upInterval:wilson(up,data.length)};
}
export function predictPath(q,candidates,model,rankings){
 let selected=candidates,level='PRIOR';
 if(!['FLAT','PRIOR'].includes(model)){const m=model.endsWith('16')?16:8,ranked=rankings[m];if(model.startsWith('PIVOT')){const c=choosePivotCohort(ranked,candidates,q);selected=c.picked;level=c.level;}else{selected=selectCases(ranked,candidates);level='STUMPY';}}
 const summary=forecastPaths(candidates,selected,{flat:model==='FLAT'});return summary?{...summary,level}:null;
}
export function projectPath(prediction,q){return {anchor:q.c0,issuedAt:q.inputEnd,anchorTime:q.queryTime,points:prediction.median.map((v,j)=>({time:(q.inputEnd+j*STEP)/1000,value:q.c0+q.atr*v,low:q.c0+q.atr*prediction.low[j],high:q.c0+q.atr*prediction.high[j]})),endChangePct:100*q.atr*prediction.median[7]/q.c0};}
export function pathLoss(prediction,q){return prediction.median.reduce((s,v,j)=>s+Math.abs(v-q.path[j]),0)/8*q.atr/q.c0*100;}
export function evaluatePaths(records){
 if(!records.length)return {n:0,days:0,status:'WAIT'};
 const days=[...new Set(records.map(r=>r.day))].sort(),mean=a=>a.reduce((s,v)=>s+v,0)/a.length,daily=days.map(day=>mean(records.filter(r=>r.day===day).map(r=>r.flatLoss-r.loss)));
 let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},samples=[];
 for(let b=0;b<1000;b++){const a=[];while(a.length<days.length){const at=Math.floor(random()*days.length);for(let j=0;j<5;j++)a.push(daily[(at+j)%days.length]);}samples.push(mean(a.slice(0,days.length)));}
 const low=percentile(samples,.025),high=percentile(samples,.975),gain=mean(daily);
 return {n:records.length,days:days.length,pathMaePct:mean(records.map(r=>r.loss)),endMaePct:mean(records.map(r=>r.endLoss)),flatMaePct:mean(records.map(r=>r.flatLoss)),gain,low,high,status:days.length>=30&&low>0?'PROMISING_REQUIRES_FORWARD_TEST':'NOT_ESTABLISHED',method:'paired day means; 1000 five-day moving-block bootstrap; pointwise path MAE in percent of query close'};
}
