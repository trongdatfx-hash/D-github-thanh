import {BOX_DEFAULTS,strengthBoxes,strengthBoxLabel,summarizeStrengthBox} from './strength-box-core.mjs?v=20261029-price-delta1';
import {encodeStrengthBox,earlyBoxRuleScore} from './strength-box-encoding.mjs?v=20261029-price-delta1';
function prefixR2(prices){const n=prices.length,xm=(n-1)/2,ym=prices.reduce((a,b)=>a+b,0)/n;let xx=0,xy=0,yy=0;for(let i=0;i<n;i++){xx+=(i-xm)**2;xy+=(i-xm)*(prices[i]-ym);yy+=(prices[i]-ym)**2;}return xx>0&&yy>0?Math.max(0,Math.min(1,xy*xy/(xx*yy))):0;}

// Display annotations of the channels currently drawn, not forecast snapshots.
// Closed-channel display qualification can be retrospective, just like its rails.
export function channelStrengthBoxes(rows,{channels=[],earlyChannels=[],showEarly=true,back=8,now=Infinity,step=900000,compositeRows=new Map(),volumeRows=new Map(),compositeMode='annotate',compositeThreshold=.15}={}){
 if(!Number.isInteger(back)||back<0||back>60)throw Error('Invalid channel box back bars');
 const closed=rows.filter(r=>r.end<now),raw=strengthBoxes(closed,{now,step}),byTime=new Map(),trs=[];let previous=null,rma=null;
 for(let i=0;i<closed.length;i++){
  const r=closed[i],tr=Math.max(r.h-r.l,previous?Math.abs(r.h-previous.c):0,previous?Math.abs(r.l-previous.c):0);
  if(previous&&r.t-previous.t!==step){trs.length=0;rma=null;}
  trs.push(tr);if(trs.length>14)trs.shift();rma=rma===null?(trs.length===14?trs.reduce((a,b)=>a+b,0)/14:null):(13*rma+tr)/14;
  byTime.set(r.t,{...r,tr,index:i,atr:rma});previous=r;
 }
 const boxes=[],snapshots=new Map();
 const confirmedIds=new Set(channels.map(c=>c.confirmationTime));
 const candidates=showEarly?earlyChannels.filter(c=>c.early===true&&!confirmedIds.has(c.confirmationTime)):[];
 for(const c of [...channels,...candidates].sort((a,b)=>a.confirmationTime-b.confirmationTime)){
  if(c.confirmed!==true||c.volumeQualified===false||c.displayQualified===false||![-1,1].includes(c.direction)||![c.startTime,c.confirmationTime,c.insideEndTime].every(Number.isFinite)||c.startTime>c.confirmationTime||c.confirmationTime>c.insideEndTime||c.confirmationTime+step>now)continue;
  const origin=byTime.get(c.startTime),last=byTime.get(c.insideEndTime),confirmation=byTime.get(c.confirmationTime);if(!origin||!last||!confirmation)continue;
  const channelBars=last.index-origin.index+1,isEarly=c.early===true;
  if(isEarly&&(!c.provisional||channelBars<4||channelBars>=8||last.t!==closed.at(-1)?.t))continue;
  const eligibleAt=Math.max(c.confirmationTime+step,origin.t+(isEarly?4:8)*step);let issuedAt=eligibleAt;
  if(eligibleAt>now||eligibleAt>last.t+step)continue;
  if(isEarly){
   // Reconstruct first rule-qualified appearance from prefixes, never from the
   // final channel fit. This timestamp stays fixed as the candidate grows.
   issuedAt=null;
   for(let j=Math.max(origin.index+3,confirmation.index);j<=last.index;j++){
    const r=closed[j],prices=closed.slice(origin.index,j+1).map(x=>x.c),score=earlyBoxRuleScore(prices,{r2:prefixR2(prices),direction:c.direction,composite:compositeRows.get(r.t)?.adjusted,volume:volumeRows.get(r.t)?.adjusted});
    if(score>=60){issuedAt=r.t+step;break;}
   }
   if(issuedAt===null)continue;
  }
  let first=origin;for(let j=0;j<back&&first.index>0;j++){const prior=byTime.get(closed[first.index-1].t);if(first.t-prior.t!==step)break;first=prior;}
  const entryComposite=compositeRows.get(c.confirmationTime)?.adjusted;
  if(compositeMode==='filter'&&!(Number.isFinite(entryComposite)&&entryComposite*c.direction>=compositeThreshold))continue;
  const makeBox=endRow=>{
   const seed=closed.slice(first.index,endRow.index+1).map(r=>byTime.get(r.t));if(seed.some((r,i)=>i&&r.t-seed[i-1].t!==step))return null;
   const bars=endRow.index-origin.index+1,b={id:c.confirmationTime,start:first.t,originTime:origin.t,backBars:origin.index-first.index,channelBars:bars,stage:isEarly?'EARLY':'CONFIRMED',startIndex:first.index,right:endRow.t,rightIndex:endRow.index,entryTime:c.confirmationTime,issuedAt,asOf:endRow.t,top:Math.max(...seed.map(r=>r.h)),bottom:Math.min(...seed.map(r=>r.l)),y0:first.c,direction:c.direction,phase:origin.session??'—',maxStrength:null,live:true,open:true,freeze:null,n:0,tr2:0,sx:0,sy:0,sxy:0,sxx:0,syy:0,compositeMode,source:'causal-channel'};
   for(const r of seed){const x=r.index-first.index,y=r.c-first.c;b.n++;b.tr2+=r.tr*r.tr;b.sx+=x;b.sy+=y;b.sxy+=x*y;b.sxx+=x*x;b.syy+=y*y;const s=raw.strength.get(r.t);if(Number.isFinite(s))b.maxStrength=Math.max(b.maxStrength??0,Math.abs(s));}
   const v=compositeRows.get(endRow.t)?.adjusted;b.compositeStrength=Number.isFinite(v)?v:null;b.compositeAlignment=!Number.isFinite(v)?'missing':v*c.direction>=compositeThreshold?'aligned':v*c.direction<=-compositeThreshold?'opposed':'neutral';
   const box=summarizeStrengthBox(b,endRow.atr,null,BOX_DEFAULTS);box.encoding=encodeStrengthBox(box,{channel:{...c,insideEndTime:endRow.t,provisional:true},rows:closed.slice(0,endRow.index+1),composite:v,volume:volumeRows.get(endRow.t)?.adjusted,step,previousAppearance:boxes.filter(x=>x.issuedAt<issuedAt).at(-1)?.issuedAt});
   box.label=(isEarly?`SỚM ${bars}/8 · `:'')+strengthBoxLabel(box);return box;
  };
  const box=makeBox(last);if(!box)continue;
  if(isEarly&&(box.encoding.ruleScore<60||!box.encoding.appearance.marketDay||!['PRE','RTH'].includes(box.encoding.appearance.session)))continue;
  box.live=c.provisional===true;box.open=c.provisional===true;boxes.push(box);
  const firstSnapshotIndex=Math.max(confirmation.index,origin.index+(isEarly?3:7));
  for(let index=firstSnapshotIndex;index<=last.index;index++){
   const row=closed[index];if(row.t+step<issuedAt)continue;const snapshot=makeBox(byTime.get(row.t));if(!snapshot)continue;
   if(isEarly&&(snapshot.encoding.ruleScore<60||!snapshot.encoding.appearance.marketDay||!['PRE','RTH'].includes(snapshot.encoding.appearance.session)))continue;
   snapshots.set(row.t,snapshot);
  }
 }
 return {version:'causal-channel-strength-box-v2',boxes,latest:boxes.at(-1)??null,snapshots,settings:{...BOX_DEFAULTS,back,showEarly,trigger:'causal-channel',compositeMode,compositeThreshold}};
}
