import {strengthBoxes,BOX_VERSION} from './strength-box-core.mjs?v=20261026-box1';
import {channelStrengthBoxes} from './channel-strength-boxes.mjs?v=20261026-channel-qr1';
import {causalTrendChannels} from './causal-trend-channel.mjs?v=20261025-dcommon-all1';
import {calculateVolumeStrength,sessionAt} from './engine.mjs?v=20261026-history-perf3';
import {ny,tradingDay,postEnd} from './rth-structure.mjs?v=20261025-dcommon-all1';
import {europeOpen} from './market-clock.mjs?v=20261026-boxqr1';
export const QR_VERSION='box-price-quantiles-m15-v1';
export const QR_STEP=900000;
export const QR_FEATURES=['intercept','spyReturn1','spyReturn4','qqqReturn4','spyNF','qqqNF','spyNF4','relativeQuoteVolume','signedEfficiency8','rangeATR','clockSin','clockCos','boxWidth','boxPosition','boxStrength','boxDirection','boxAge','boxEfficiency'];
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const valid=r=>r&&[r.t,r.end,r.o,r.h,r.l,r.c,r.q,r.buy].every(Number.isFinite)&&r.c>0&&r.q>0&&r.buy>=0&&r.buy<=r.q&&r.end===r.t+QR_STEP-1&&r.h>=Math.max(r.o,r.c)&&r.l<=Math.min(r.o,r.c);
export function quantileFrame(t){const p=ny(t);return {...p,eligible:tradingDay(p.day)&&t>=europeOpen(p.day)&&p.minute<postEnd(p.day)};}
function atr(rows){return mean(rows.slice(-14).map((r,i)=>{const prev=rows[rows.length-14+i-1];return Math.max(r.h-r.l,prev?Math.abs(r.h-prev.c):0,prev?Math.abs(r.l-prev.c):0);}));}
export function quantileFeature(sample,qqqMap,box){
 if(sample.length!==20||sample.some((r,i)=>!valid(r)||(i&&r.t-sample[i-1].t!==QR_STEP)))return null;
 if(!box||(!box.live&&!box.open)||box.asOf!==sample.at(-1).t||box.issuedAt>sample.at(-1).end+1)return null;
 const other=sample.map(r=>qqqMap.get(r.t));if(other.some(r=>!valid(r)))return null;
 const r=sample.at(-1),q=other.at(-1),a=atr(sample),qa=atr(other),f=quantileFrame(r.t);if(!f.eligible||!(a>0)||!(qa>0))return null;
 const nf=b=>2*b.buy/b.q-1,close=sample.slice(-8).map(r=>r.c),path=close.slice(1).reduce((s,c,i)=>s+Math.abs(c-close[i]),0),qMean=mean(sample.slice(0,-1).map(r=>r.q));
 const x=[1,Math.tanh((r.c-sample.at(-2).c)/a),Math.tanh((r.c-sample.at(-5).c)/(2*a)),Math.tanh((q.c-other.at(-5).c)/(2*qa)),nf(r),nf(q),mean(sample.slice(-4).map(nf)),Math.tanh(Math.log(r.q/qMean)),path?(close.at(-1)-close[0])/path:0,Math.tanh((r.h-r.l)/a-1),Math.sin(2*Math.PI*f.minute/1440),Math.cos(2*Math.PI*f.minute/1440)];
 const anchor=(box.top+box.bottom)/2,boxStrength=Number.isFinite(box.maxStrength)?box.maxStrength:0;x.push(Math.tanh(box.width/a/4),Math.tanh((r.c-anchor)/a),boxStrength,box.direction,Math.tanh(box.n/20),Math.tanh(box.efficiency-1));
 return {source:box.source==='causal-channel'?'causalChannel':'strength',t:r.t,issuedAt:r.end+1,day:f.day,price:r.c,anchor,boxId:box.id,boxIssuedAt:box.issuedAt,boxType:box.type,atr:a,x};
}
export function quantileDataset(spy,qqq,now=Infinity,{source='strength'}={}){
 const rows=spy.filter(r=>r.end<now).map(r=>r.session? r:{...r,...sessionAt(r.t)}),map=new Map(qqq.filter(r=>r.end<now).map(r=>[r.t,r])),data=[];
 let boxes;
 if(source==='causalChannel'){
  const volumeValues=calculateVolumeStrength(rows,QR_STEP),volumeRows=rows.map((r,i)=>({t:r.t,adjusted:volumeValues[i]})),volumeMap=new Map(volumeRows.map(r=>[r.t,r]));
  const channels=causalTrendChannels(rows,{volumeRows,maxHistory:Infinity}).episodes.map(c=>({...c,displayQualified:true}));
  boxes=channelStrengthBoxes(rows,{channels,volumeRows:volumeMap,showEarly:false,back:8,now,step:QR_STEP});
 }else if(source==='strength')boxes=strengthBoxes(rows,{now});
 else throw Error('Nguồn hộp phân vị không hợp lệ');
 for(let i=19;i<rows.length;i++){const f=quantileFeature(rows.slice(i-19,i+1),map,boxes.snapshots.get(rows[i].t));if(!f)continue;
  const targets={};for(const h of [3,6]){const future=rows.slice(i+1,i+h+1);if(future.length===h&&future.every((r,j)=>valid(r)&&r.t===f.t+(j+1)*QR_STEP&&quantileFrame(r.t).eligible&&ny(r.t).day===f.day))targets[h]={y:(future.at(-1).c-f.anchor)/f.atr,end:future.at(-1).end,price:future.at(-1).c};}
  data.push({...f,targets});
 }return data;
}
export function forecastQuantiles(feature,report,horizon,source=feature?.source??'strength'){
 if(!feature||report?.version!==QR_VERSION||JSON.stringify(report.features)!==JSON.stringify(QR_FEATURES))return {status:'WAIT_MODEL'};
 const m=source==='strength'?(report.models?.[horizon]??report.sources?.strength?.models?.[horizon]):report.sources?.[source]?.models?.[horizon];if(!m)return {status:'WAIT_MODEL'};if(!Number.isFinite(m.trainEnd)||m.trainEnd>=feature.issuedAt)return {status:'WAIT_TRAINING_CUTOFF'};
 if(feature.issuedAt-m.trainEnd>10*86400000)return {status:'WAIT_MODEL_STALE'};
 const target=feature.t+horizon*QR_STEP,frame=quantileFrame(target);if(!frame.eligible||frame.day!==feature.day)return {status:'WAIT_SESSION_END'};
 if(!Array.isArray(m.coefficients)||m.coefficients.length!==3||m.coefficients.some(b=>b.length!==QR_FEATURES.length||!b.every(Number.isFinite)))return {status:'WAIT_MODEL'};
 const raw=m.coefficients.map(b=>b.reduce((sum,v,i)=>sum+v*feature.x[i],0)),values=raw.slice().sort((a,b)=>a-b).map(v=>feature.anchor+feature.atr*v);
 if(!values.every(v=>Number.isFinite(v)&&v>0))return {status:'WAIT_MODEL'};
 return {status:'RESEARCH',horizon,t:feature.t,target,issuedAt:feature.issuedAt,anchor:feature.anchor,referenceClose:feature.price,boxType:feature.boxType,p10:values[0],p50:values[1],p90:values[2],reordered:raw.some((v,i)=>i&&v<raw[i-1]),trainN:m.trainN,trainDays:m.trainDays,validation:m.validation};
}
