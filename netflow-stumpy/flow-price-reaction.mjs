// Experimental price response to SPY's own incremental taker delta.
// No spread/order-book reconstruction and no inference of long/short openings.
const waiting=(reason,extra={})=>({ready:false,state:'WAIT',label:'CHƯA RÕ',reason,...extra});
export function classifyFlowPrice({delta,quote,priceChange,atr,typicalQuote,span,step}){
 if(![delta,quote,priceChange,atr,typicalQuote,span,step].every(Number.isFinite)||quote<=0||atr<=0||typicalQuote<=0||span<30000||span>65000||step<=0)return waiting('insufficient');
 if(Math.abs(delta)>quote+1e-6)return waiting('invalid_delta');
 const imbalance=delta/quote,activity=quote/(typicalQuote*span/step);
 if(Math.abs(imbalance)<.15||activity<.25)return waiting('weak_flow',{imbalance,activity});
 const direction=Math.sign(delta),priceThreshold=Math.max(.01,atr*.05*Math.sqrt(span/step));
 const state=priceChange*direction>priceThreshold?'push':'absorption',side=direction>0?'MUA':'BÁN';
 return {ready:true,state,direction,label:side+(state==='push'?' ĐẨY GIÁ':' HẤP THỤ'),delta,quote,priceChange,priceThreshold,imbalance,activity,span};
}
export class FlowPriceReaction {
 constructor(){this.key=null;this.samples=[];this.candidate=null;this.count=0;this.result=waiting('warmup');}
 clear(reason){this.samples=[];this.candidate=null;this.count=0;this.result=waiting(reason);return this.result;}
 update(bars,{step,time,now,fresh=false}={}){
  const row=bars?.at(-1);
  if(!fresh||![step,time,now].every(Number.isFinite)||step<=0||now-time>10000||time>now+2000)return this.clear('stale_chart');
  if(!row||![row.t,row.end,row.c,row.q,row.net].every(Number.isFinite)||row.c<=0||row.q<0||row.t>time||row.end<now)return this.clear('no_running_bar');
  const key=step+':'+row.t;
  if(this.key!==key){this.key=key;this.clear('warmup');}
  const previous=this.samples.at(-1);
  // Pointer moves, resize and OI polling cannot add fictitious flow observations.
  if(previous&&time===previous.time)return this.result;
  if(previous&&(time<previous.time||time-previous.time>12000||row.q<previous.quote))this.clear('gap_or_revision');
  const last=this.samples.at(-1);
  if(last&&Math.abs(row.net-last.delta)>row.q-last.quote+1e-6){this.clear('incompatible_flow');return this.result;}
  this.samples.push({time,price:row.c,quote:row.q,delta:row.net});
  this.samples=this.samples.filter(s=>time-s.time<=60000);
  const base=this.samples.find(s=>time-s.time>=30000);
  if(!base||this.samples.length<6){this.result=waiting('warmup');return this.result;}
  const closed=bars.slice(0,-1).filter(r=>r.end<time&&[r.h,r.l,r.c,r.q].every(Number.isFinite));
  if(closed.length<15){this.result=waiting('missing_baseline');return this.result;}
  const prior=closed.slice(-15),ranges=prior.slice(1).map((r,i)=>Math.max(r.h-r.l,Math.abs(r.h-prior[i].c),Math.abs(r.l-prior[i].c)));
  const atr=ranges.reduce((a,b)=>a+b,0)/ranges.length,volumes=prior.slice(1).map(r=>r.q).sort((a,b)=>a-b),typicalQuote=(volumes[6]+volumes[7])/2;
  const candidate=classifyFlowPrice({delta:row.net-base.delta,quote:row.q-base.quote,priceChange:row.c-base.price,atr,typicalQuote,span:time-base.time,step});
  if(!candidate.ready){this.candidate=null;this.count=0;this.result=candidate;return this.result;}
  const id=candidate.direction+':'+candidate.state;
  this.count=id===this.candidate?this.count+1:1;this.candidate=id;
  this.result=this.count>=2?candidate:waiting('confirming',{candidate:candidate.label});
  return this.result;
 }
}
