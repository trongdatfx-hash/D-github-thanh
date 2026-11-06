// Experimental SPY-only taker-flow/price response, stabilized within price groups.
// A group is three 0.5-point price bins, matching spectrumPriceGroup by default.
const waiting=(reason,extra={})=>({ready:false,state:'WAIT',label:'CHƯA RÕ',reason,...extra});
export const REACTION_GROUP_DEFAULTS=Object.freeze({binStep:.5,levels:3,marginBins:.5,lookback:120000,confirmMs:9000,confirmUpdates:3,minHoldMs:15000,weakHoldMs:20000,groupConfirmMs:6000,groupConfirmUpdates:3});
export function reactionPriceGroup(price,{binStep=.5,levels=3}={}){
 if(!Number.isFinite(price)||!(binStep>0)||!Number.isInteger(levels)||levels<1)return null;
 const bucket=Math.floor(Math.round(price/binStep)/levels),low=bucket*levels*binStep-binStep/2;
 return {id:bucket,low,high:low+levels*binStep,binStep,levels};
}
export function classifyFlowPrice({delta,quote,priceChange,atr,typicalQuote,span,step,previousState=null,previousDirection=null}){
 if(![delta,quote,priceChange,atr,typicalQuote,span,step].every(Number.isFinite)||quote<=0||atr<=0||typicalQuote<=0||span<30000||span>120000||step<=0)return waiting('insufficient');
 if(Math.abs(delta)>quote+1e-6)return waiting('invalid_delta');
 const imbalance=delta/quote,activity=quote/(typicalQuote*span/step),direction=Math.sign(delta),same=direction===previousDirection;
 // Lower exit gates than entry gates prevent threshold chatter.
 if(Math.abs(imbalance)<(same ? .10 : .15)||activity<(same ? .15 : .25))return waiting('weak_flow',{imbalance,activity});
 const priceThreshold=Math.max(.01,atr*.05*Math.sqrt(span/step)),directedMove=priceChange*direction;
 const threshold=same&&previousState==='push'?priceThreshold*.5:same&&previousState==='absorption'?priceThreshold*1.5:priceThreshold;
 const state=directedMove>threshold?'push':'absorption',side=direction>0?'MUA':'BÁN';
 return {ready:true,state,direction,label:side+(state==='push'?' ĐẨY GIÁ':' HẤP THỤ'),delta,quote,priceChange,priceThreshold,imbalance,activity,span};
}
export class FlowPriceReaction {
 constructor(options={}){this.options={...REACTION_GROUP_DEFAULTS,...options};this.reset('warmup');}
 reset(reason){this.last=null;this.context=null;this.active=null;this.groupPending=null;this.groups=new Map();this.result=waiting(reason);return this.result;}
 selectGroup(price,time,config){
  const target=reactionPriceGroup(price,config),margin=config.binStep*config.marginBins;
  if(!this.active){this.active=target;return;}
  if(price>=this.active.low-margin&&price<this.active.high+margin){this.groupPending=null;return;}
  const pending=this.groupPending;
  this.groupPending=pending?.id===target.id?{...pending,count:pending.count+1}:{id:target.id,since:time,count:1};
  // A large jump must not keep reporting a state from a distant price group.
  const far=price<this.active.low-2*(this.active.high-this.active.low)||price>this.active.high+2*(this.active.high-this.active.low);
  if(far||(this.groupPending.count>=config.groupConfirmUpdates&&time-this.groupPending.since>=config.groupConfirmMs)){this.active=target;this.groupPending=null;}
 }
 resolve(record,candidate,time,config){
  const id=candidate.ready?candidate.direction+':'+candidate.state:null,stableId=record.stable?record.stable.direction+':'+record.stable.state:null;
  if(id&&id===stableId){
   record.stable={...candidate,confirmedAt:record.stable.confirmedAt,lastSupported:time};record.pending=null;record.weakSince=null;
  }else if(id){
   record.weakSince=null;
   record.pending=record.pending?.id===id?{...record.pending,count:record.pending.count+1}:{id,since:time,count:1};
   if(record.pending.count>=config.confirmUpdates&&time-record.pending.since>=config.confirmMs&&(!record.stable||time-record.stable.confirmedAt>=config.minHoldMs)){
    record.stable={...candidate,confirmedAt:time,lastSupported:time};record.pending=null;
   }
  }else{
   record.pending=null;record.weakSince??=time;
   if(time-record.weakSince>=config.weakHoldMs)record.stable=null;
  }
  // Expire a cached group's old state; revisiting it cannot revive stale evidence.
  if(record.stable&&time-record.stable.lastSupported>config.weakHoldMs)record.stable=null;
  return record.stable?{...record.stable,held:Boolean(record.pending||record.weakSince!==null),group:this.active}:waiting(candidate.reason??'confirming',{group:this.active});
 }
 update(bars,{step,time,now,fresh=false,binStep=this.options.binStep,levels=this.options.levels}={}){
  const row=bars?.at(-1),config={...this.options,binStep,levels};
  if(!fresh||![step,time,now].every(Number.isFinite)||step<=0||now-time>10000||time>now+2000)return this.reset('stale_chart');
  if(!row||![row.t,row.end,row.c,row.q,row.net].every(Number.isFinite)||row.c<=0||row.q<0||row.t>time||row.end<now||!reactionPriceGroup(row.c,config))return this.reset('no_running_bar');
  const context=[step,binStep,levels].join(':');
  if(this.context!==context){this.reset('warmup');this.context=context;}
  let previous=this.last;
  // Only distinct chart responses count; mouse/OI/resize events add no evidence.
  if(previous&&time===previous.time)return this.result;
  if(previous&&(time<previous.time||time-previous.time>12000)){this.reset('gap_or_revision');this.context=context;previous=null;}
  let quote=0,delta=0;
  if(previous){
   if(previous.barTime===row.t){quote=row.q-previous.quote;delta=row.net-previous.delta;}
   else if(row.t===previous.barTime+step){
    // Use the final previous candle so rollover never loses the last partial tail.
    const final=bars.find(r=>r.t===previous.barTime&&r.end<time);
    if(final&&[final.q,final.net].every(Number.isFinite)&&final.q>=previous.quote){quote=final.q-previous.quote+row.q;delta=final.net-previous.delta+row.net;}
    else {this.reset('missing_closed_tail');this.context=context;previous=null;}
   }else{this.reset('noncontiguous_bars');this.context=context;previous=null;}
   if(previous&&(quote<0||Math.abs(delta)>quote+1e-6)){this.reset('incompatible_flow');this.context=context;previous=null;}
  }
  this.selectGroup(row.c,time,config);
  this.last={time,price:row.c,quote:row.q,delta:row.net,barTime:row.t};
  const group=this.active,record=this.groups.get(group.id)??{segments:[],stable:null,pending:null,weakSince:null,lastSeen:time};
  if(time-record.lastSeen>config.weakHoldMs){record.stable=null;record.pending=null;record.weakSince=null;}
  record.lastSeen=time;
  const margin=binStep*config.marginBins,inside=price=>price>=group.low-margin&&price<group.high+margin;
  // Attribute only observed intervals whose two prices lie in this buffered group.
  if(previous&&inside(previous.price)&&inside(row.c))record.segments.push({from:previous.time,to:time,quote,delta,priceChange:row.c-previous.price});
  record.segments=record.segments.filter(s=>s.from>=time-config.lookback);
  this.groups.set(group.id,record);
  for(const [id,other] of this.groups)if(id!==group.id&&time-other.lastSeen>config.lookback)this.groups.delete(id);
  const segments=record.segments,span=segments.reduce((sum,s)=>sum+s.to-s.from,0);
  const closed=bars.slice(0,-1).filter(r=>r.end<time&&[r.h,r.l,r.c,r.q].every(Number.isFinite));
  let candidate=waiting('warmup');
  if(span>=30000&&segments.length>=6&&closed.length>=15){
   const prior=closed.slice(-15),ranges=prior.slice(1).map((r,i)=>Math.max(r.h-r.l,Math.abs(r.h-prior[i].c),Math.abs(r.l-prior[i].c)));
   const atr=ranges.reduce((a,b)=>a+b,0)/ranges.length,volumes=prior.slice(1).map(r=>r.q).sort((a,b)=>a-b),typicalQuote=(volumes[6]+volumes[7])/2;
   candidate=classifyFlowPrice({delta:segments.reduce((sum,s)=>sum+s.delta,0),quote:segments.reduce((sum,s)=>sum+s.quote,0),priceChange:segments.reduce((sum,s)=>sum+s.priceChange,0),atr,typicalQuote,span,step,previousState:record.stable?.state,previousDirection:record.stable?.direction});
  }else if(closed.length<15)candidate=waiting('missing_baseline');
  this.result=this.resolve(record,candidate,time,config);
  return this.result;
 }
}
