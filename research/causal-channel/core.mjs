import {causalTrendChannels} from '../../netflow-stumpy/causal-trend-channel.mjs';
import {ny,tradingDay,closeMinute,STEP} from '../../netflow-stumpy/rth-structure.mjs';
export const CHANNEL_SPEC=Object.freeze({priorWindow:20,fastWindow:8,breakAtr:.15,warmStartSlopeAtr:.8,channelAtr:.45,channelSigma:2,flowDeadband:.15,flowFlipBars:2,adverseExitBars:2,volumeSlopeWindow:4,originLookback:4,minLegBars:8,minDisplayR2:.20,maxHistory:Infinity});
export const CHANNEL_MODELS=['FLAT','PRIOR','PAIR8','PAIR16','CHANNEL8','CHANNEL16','COMBINED8','COMBINED16','LINE_CENTER','LINE_SLOPE','CURRENT8','CURRENT16'];
const knownAtr=(rows,i)=>i<13?null:rows.slice(i-13,i+1).reduce((sum,r,j)=>{const prev=rows[i-14+j]?.c;return sum+Math.max(r.high-r.low,Number.isFinite(prev)?Math.abs(r.high-prev):0,Number.isFinite(prev)?Math.abs(r.low-prev):0);},0)/14;
function stateFromPrefix(price,volume,atr){
 const current=price.at(-1),state=causalTrendChannels(price,{...CHANNEL_SPEC,volumeRows:volume}),leg=state.episodes.find(t=>t.provisional&&t.insideEndTime===current.t&&t.confirmationTime<=current.t);
 if(!leg?.displayQualified)return {active:false,geometry:Array(7).fill(0),confirmedAt:null};
 const p=leg.renderPoints,last=p.at(-1),previous=p.at(-2),slope=previous?last.center-previous.center:0,width=(last.upper-last.lower)/2;
 return {active:true,direction:leg.direction,confirmedAt:leg.confirmationTime+STEP,startTime:leg.startTime,knownAt:current.t+STEP,center:last.center,slope,width,bars:leg.bars,r2:leg.adaptiveR2,geometry:[1,leg.direction,Math.tanh(slope*8/atr),leg.adaptiveR2,Math.tanh(width/atr),width>0?Math.tanh((current.c-last.center)/width):0,Math.min(64,leg.bars)/64]};
}
export function channelSnapshots(rows,{fullHistory=false}={}){
 const result=rows.map(r=>({...r,channel:{active:false,geometry:Array(7).fill(0),confirmedAt:null}})),price=[],volume=[];let day=null,dayStart=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],p=ny(r.t);if(!tradingDay(p.day)||p.minute<240||p.minute>=closeMinute(p.day))continue;
  if(p.day!==day){day=p.day;dayStart=price.length;}
  price.push({t:r.t,o:r.open,h:r.high,l:r.low,c:r.c,day:p.day,session:p.minute<570?'PRE':'RTH'});volume.push({t:r.t,adjusted:r.x?.[2]});
  const begin=fullHistory?0:Math.max(0,dayStart-20),atr=knownAtr(rows,i);if(!(atr>0))continue;
  result[i].channel=stateFromPrefix(price.slice(begin),volume.slice(begin),atr);
 }
 return result.map(r=>({...r,cf:[r.pv?.[0],r.pv?.[1],r.pv?.[2],r.pv?.[3],Number.isFinite(r.x?.[2])?Math.tanh(r.x[2]):null,Number.isFinite(r.x?.[1])?Math.tanh(r.x[1]):null,...r.channel.geometry]}));
}
export function channelDistance(a,b,variant){
 const common=[.35,.15,.15,.05],indices=variant==='PAIR'?[0,1,2,3,4,5]:variant==='CHANNEL'?[0,1,2,3,6,7,8,9,10,11,12]:[0,1,2,3,4,5,6,7,8,9,10,11,12],weights=[...common,...(variant==='PAIR'?[.15,.15]:variant==='CHANNEL'?Array(7).fill(.30/7):[.075,.075,...Array(7).fill(.15/7)])];
 const norm=v=>{const mean=v.reduce((s,x)=>s+x,0)/v.length,std=Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/v.length);return {flat:std<1e-8,z:v.map(x=>std<1e-8?0:(x-mean)/std)};};let total=0;
 indices.forEach((k,j)=>{let d;if(k===0){const x=norm(a.map(r=>r.cf[k])),y=norm(b.map(r=>r.cf[k]));d=x.flat&&y.flat?0:x.flat||y.flat?1:x.z.reduce((s,v,i)=>s+(v-y.z[i])**2,0)/a.length;}else{const scale=[2,4,5,7,8,11].includes(k)?.5:1;d=a.reduce((s,r,i)=>s+((r.cf[k]-b[i].cf[k])*scale)**2,0)/a.length;}total+=weights[j]*d;});return Math.sqrt(total);
}
export function linePrediction(q,channel,mode){if(!channel?.active)return Array(8).fill(0);return Array.from({length:8},(_,i)=>((mode==='LINE_CENTER'?channel.center:q.c0)+channel.slope*(i+1)-q.c0)/q.atr);}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
export function comparePaths(reference,trial,{alpha=.025}={}){
 if(reference.length!==trial.length||reference.some((r,i)=>r.issuedAt!==trial[i].issuedAt||r.day!==trial[i].day))throw Error('Unequal paired timestamps');const days=[...new Set(reference.map(r=>r.day))].sort();if(!days.length)return {status:'WAIT',n:0,days:0};
 const daily=days.map(day=>mean(reference.flatMap((r,i)=>r.day===day?[r.loss-trial[i].loss]:[])));let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},samples=[];
 for(let k=0;k<5000;k++){const p=[];while(p.length<days.length){const i=Math.floor(random()*days.length);for(let j=0;j<5;j++)p.push(daily[(i+j)%days.length]);}samples.push(mean(p.slice(0,days.length)));}samples.sort((a,b)=>a-b);const quantile=p=>{const at=p*(samples.length-1),a=Math.floor(at),b=Math.ceil(at);return samples[a]+(samples[b]-samples[a])*(at-a);},low=quantile(alpha/2),high=quantile(1-alpha/2);
 return {n:trial.length,days:days.length,gainPct:mean(daily),low,high,confidence:1-alpha,status:days.length>=30&&low>0?'PROMISING_REQUIRES_FORWARD_TEST':'NOT_ESTABLISHED'};
}
