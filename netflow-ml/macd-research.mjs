export const MACD_SPEC=Object.freeze({fast:12,slow:26,signal:9,commonWeights:[.35,.15,.15,.05],pairWeights:[.15,.15],combinedWeights:[.075,.075,.075,.075],normalization:'tanh on both indicator pairs; MACD line/histogram first divide by causal SMA14 true range; raw state retained, only log price z-normalized',source:'SPYUSDT close, original-volume SPY V and Composite Strength from SPY+QQQ taker NetFlow'});
export const MACD_MODELS=['FLAT','PRIOR','PRICE8','PRICE16','PAIR8','PAIR16','MACD8','MACD16','COMBINED8','COMBINED16','ORIGINAL8','ORIGINAL16'];
export function ema(values,period){
 let seed=[],value=null;const alpha=2/(period+1);
 return values.map(x=>{if(!Number.isFinite(x)){seed=[];value=null;return null;}if(value===null){seed.push(x);if(seed.length<period)return null;value=seed.reduce((s,v)=>s+v,0)/period;return value;}value=alpha*x+(1-alpha)*value;return value;});
}
export function macdFeatures(rows){
 const closes=rows.map(r=>r.c),fast=ema(closes,12),slow=ema(closes,26),line=closes.map((_,i)=>Number.isFinite(fast[i])&&Number.isFinite(slow[i])?fast[i]-slow[i]:null),signal=ema(line,9),tr=rows.map((r,i)=>Math.max(r.high-r.low,i?Math.abs(r.high-rows[i-1].c):0,i?Math.abs(r.low-rows[i-1].c):0));
 return rows.map((r,i)=>{
  const atr=i>=13?tr.slice(i-13,i+1).reduce((s,v)=>s+v,0)/14:null,histogram=Number.isFinite(line[i])&&Number.isFinite(signal[i])?line[i]-signal[i]:null;
  const vector=[r.pv?.[0],r.pv?.[1],r.pv?.[2],r.pv?.[3],Number.isFinite(r.x?.[2])?Math.tanh(r.x[2]):null,Number.isFinite(r.x?.[1])?Math.tanh(r.x[1]):null,Number.isFinite(histogram)&&atr>0?Math.tanh(line[i]/atr):null,Number.isFinite(histogram)&&atr>0?Math.tanh(histogram/atr):null];
  return {...r,macd:{line:line[i],signal:signal[i],histogram,atr},mf:vector};
 });
}
export function readyMacdWindow(rows,c,m=16){return c.i>=m-1&&rows.slice(c.i-m+1,c.i+1).every(r=>r.mf?.length===8&&r.mf.every(Number.isFinite));}
export function macdDistance(a,b,variant){
 const weights=variant==='PRICE'?MACD_SPEC.commonWeights.map(v=>v/.7):[...MACD_SPEC.commonWeights,...(variant==='COMBINED'?MACD_SPEC.combinedWeights:MACD_SPEC.pairWeights)],indices=variant==='PRICE'?[0,1,2,3]:variant==='PAIR'?[0,1,2,3,4,5]:variant==='MACD'?[0,1,2,3,6,7]:[0,1,2,3,4,5,6,7];
 const normalized=v=>{const mean=v.reduce((s,x)=>s+x,0)/v.length,std=Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/v.length);return {flat:std<1e-8,z:v.map(x=>std<1e-8?0:(x-mean)/std)};};let total=0;
 indices.forEach((k,j)=>{let d;if(k===0){const x=normalized(a.map(r=>r.mf[k])),y=normalized(b.map(r=>r.mf[k]));d=x.flat&&y.flat?0:x.flat||y.flat?1:x.z.reduce((s,v,i)=>s+(v-y.z[i])**2,0)/a.length;}else{const scale=[2,4,5,6,7].includes(k)?.5:1;d=a.reduce((s,r,i)=>s+((r.mf[k]-b[i].mf[k])*scale)**2,0)/a.length;}total+=weights[j]*d;});return Math.sqrt(total);
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
export function pairedMacd(reference,trial,{alpha=.05,draws=5000}={}){
 if(reference.length!==trial.length||reference.some((r,i)=>r.issuedAt!==trial[i].issuedAt||r.day!==trial[i].day))throw Error('MACD comparison requires identical query timestamps');
 const days=[...new Set(reference.map(r=>r.day))].sort(),daily=days.map(day=>{const indices=reference.flatMap((r,i)=>r.day===day?[i]:[]);return {path:mean(indices.map(i=>reference[i].loss-trial[i].loss)),brier:mean(indices.map(i=>reference[i].brier-trial[i].brier))};});
 if(!days.length)return {status:'WAIT',n:0,days:0};let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},path=[],brier=[];
 for(let k=0;k<draws;k++){const picks=[];while(picks.length<days.length){const i=Math.floor(random()*days.length);for(let j=0;j<5;j++)picks.push(daily[(i+j)%days.length]);}path.push(mean(picks.slice(0,days.length).map(r=>r.path)));brier.push(mean(picks.slice(0,days.length).map(r=>r.brier)));}
 const interval=values=>{values.sort((a,b)=>a-b);const q=p=>{const at=(values.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return values[lo]+(values[hi]-values[lo])*(at-lo);};return [q(alpha/2),q(1-alpha/2)];},pathInterval=interval(path),brierInterval=interval(brier);
 return {n:trial.length,days:days.length,pathGainPct:mean(daily.map(r=>r.path)),pathInterval,brierGain:mean(daily.map(r=>r.brier)),brierInterval,confidence:1-alpha,status:days.length>=30&&pathInterval[0]>0?'PROMISING_REQUIRES_FORWARD_TEST':'NOT_ESTABLISHED',method:'paired target-day means; 5000 five-day moving-block bootstrap draws; positive favors trial'};
}
