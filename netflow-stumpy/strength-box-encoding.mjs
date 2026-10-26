import {ny,stamp,closeMinute,tradingDay} from './rth-structure.mjs?v=20261025-dcommon-all1';
export const BOX_ENCODING_VERSION='strength-box-code-v1';
export const BOX_ENCODING_FEATURES=Object.freeze(['direction','backBars','channelBars','widthATR','rwEfficiency','slopeATR','priceR2','compositeAlongTrend','volumeAlongTrend','priceEfficiency','appearanceClockSin','appearanceClockCos','weekdaySin','weekdayCos','barsFromSessionOpen','barsSincePreviousAppearance','ageAtEncodingBars','minutesSincePreviousAppearance']);
const clamp=x=>Math.max(0,Math.min(1,x));
const signCode=x=>!Number.isFinite(x)?'?':x>.15?'+':x<-.15?'-':'0';
export function earlyBoxRuleScore(prices,{r2,direction,composite,volume}){
 const path=prices.slice(1).reduce((s,x,i)=>s+Math.abs(x-prices[i]),0),eff=path?Math.abs(prices.at(-1)-prices[0])/path:0,c=Number.isFinite(composite)?composite*direction:null,v=Number.isFinite(volume)?volume*direction:null;
 return Math.round(30*clamp(r2)+20*clamp(eff)+20*(v===null?0:clamp(v/.5))+20*(c===null?0:clamp(c/.5))+10*clamp(prices.length/8));
}

// An observable feature vector and a rule score, not a fitted probability model.
export function encodeStrengthBox(box,{channel,rows,composite,volume,step=900000,previousAppearance=null}){
 const prices=rows.filter(r=>r.t>=box.originTime&&r.t<=box.right).map(r=>r.c),n=prices.length,path=prices.slice(1).reduce((s,x,i)=>s+Math.abs(x-prices[i]),0),eff=path?Math.abs(prices.at(-1)-prices[0])/path:0;
 const c=Number.isFinite(composite)?composite*box.direction:null,v=Number.isFinite(volume)?volume*box.direction:null,r2=Number.isFinite(channel.adaptiveR2)?channel.adaptiveR2:0,slope=Number.isFinite(channel.slopeAtr)?channel.slopeAtr:0;
 // Use the signal close, never the retrospective left edge. Boundary close at
 // 09:30 still belongs to the PRE bar which has just closed.
 const t=box.issuedAt,clock=ny(t),barClock=ny(t-1),session=barClock.minute<240?'NIGHT':barClock.minute<570?'PRE':barClock.minute<closeMinute(barClock.day)?'RTH':'POST',openMinute={NIGHT:0,PRE:240,RTH:570,POST:closeMinute(barClock.day)}[session],weekday=new Date(clock.day+'T12:00:00Z').getUTCDay();
 const prior=Number.isFinite(previousAppearance)&&previousAppearance<t?previousAppearance:null;
 const appearance={signalAt:t,encodedAt:box.right+step,formationAgeBars:n,timeBasis:'closed-bar-rule-eligibility',liveLedgerVerified:false,originTime:box.originTime,leftEdge:box.start,dayNY:clock.day,minuteNY:clock.minute,session,weekday,barsFromSessionOpen:(t-stamp(barClock.day,openMinute))/step,barsSincePrevious:prior===null?null:(t-prior)/step,ageAtEncodingBars:Math.max(0,(box.right+step-t)/step),timeBucketNY:`${session}-${String(Math.floor(clock.minute/60)).padStart(2,'0')}${String(15*Math.floor(clock.minute%60/15)).padStart(2,'0')}`,marketDay:tradingDay(clock.day)};
 appearance.minutesSincePrevious=prior===null?null:(t-prior)/60000;
 appearance.barsSincePrevious=prior===null?null:rows.filter(r=>r.t+step>prior&&r.t+step<=t).length;
 const features=[box.direction,box.backBars,n,box.atr>0?box.width/box.atr:0,Number.isFinite(box.efficiency)?box.efficiency:0,slope,r2,c??0,v??0,eff,Math.sin(2*Math.PI*clock.minute/1440),Math.cos(2*Math.PI*clock.minute/1440),Math.sin(2*Math.PI*weekday/7),Math.cos(2*Math.PI*weekday/7),appearance.barsFromSessionOpen,appearance.barsSincePrevious??0,appearance.ageAtEncodingBars,appearance.minutesSincePrevious??0];
 const score=earlyBoxRuleScore(prices,{r2,direction:box.direction,composite,volume});
 const code=['SB1',box.direction>0?'U':'D',{COMPRESSED:'NEN',PAID:'TRA',NEUTRAL:'MID'}[box.type]??'?',`C${signCode(c)}`,`V${signCode(v)}`,box.stage==='EARLY'?'E':'C',appearance.timeBucketNY].join('-');
 return {version:BOX_ENCODING_VERSION,code,appearance,cohortKey:[box.direction,box.type,appearance.timeBucketNY,weekday].join('|'),asOf:box.right+step,issuedAt:box.issuedAt,featureNames:BOX_ENCODING_FEATURES,features,missing:{composite:c===null,volume:v===null,atr:!(box.atr>0),previousAppearance:prior===null},ruleScore:score,scoreIsProbability:false,
  forecast:box.stage==='EARLY'?{event:'channel-box-reaches-8-bars',remainingMinBars:Math.max(0,8-n),earliestClose:box.right+(Math.max(0,8-n)+1)*step,method:'rules-unvalidated',probability:null}:null};
}
