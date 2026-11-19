import {normCDF,sessionAt} from './engine.mjs?v=20261118-wlr-band-slope';
import {h1VolumeAlphaSchedule} from './spy-volume-h1.mjs?v=20261105-spyv-h1-1';

const STEP=900000,BASE_ALPHA=1-2**(-.5);
const sum=a=>a.reduce((s,x)=>s+x,0);
const push=(a,x,n)=>{a.push(x);if(a.length>n)a.shift();};
const rawState=()=>({volumes:[],impulses:[],magnitudes:[],ew:null});
const poolsState=()=>Object.fromEntries(['NIGHT','PRE','RTH','POST'].map(s=>[s,[]]));
const cloneRaw=s=>({...s,volumes:[...s.volumes],impulses:[...s.impulses],magnitudes:[...s.magnitudes]});
const clonePools=p=>Object.fromEntries(Object.entries(p).map(([k,a])=>[k,[...a]]));
function alpha(state,r,previous){
  if(!state)return BASE_ALPHA;
  if(!state.direction||state.quality<.35)return .16;
  const aligned=Math.sign(r)===state.direction;
  const reversing=Number.isFinite(previous)&&Math.sign(r)!==Math.sign(previous);
  const value=aligned?.65:reversing?.48:.30;
  return state.preview?Math.min(.38,value):value;
}
function moments(a){const mean=sum(a)/a.length;return {mean,sd:Math.sqrt(sum(a.map(x=>(x-mean)**2))/a.length)};}
// Same body-volume -> SMA20 -> sum8 -> EWMA -> Gaussian500 -> session mapping
// as the candle-color source. Only its finite state is copied for each trial.
export function advanceBodyState(s,pools,bar,h1=null){
  const body=bar.c-bar.o;push(s.volumes,Math.abs(body),20);
  const mean=sum(s.volumes)/s.volumes.length;
  push(s.impulses,mean>0?body/mean:0,8);
  let raw=null;
  if(s.impulses.length===8){
    const r=sum(s.impulses),a=alpha(h1,r,s.ew);
    s.ew=s.ew===null?r:s.ew+a*(r-s.ew);
    push(s.magnitudes,Math.abs(s.ew),500);
    if(s.magnitudes.length===500){const sigma=sum(s.magnitudes)/500*Math.sqrt(Math.PI/2);raw=sigma>0?2*normCDF(s.ew/sigma)-1:0;}
  }
  const src=pools[bar.session],dst=pools.RTH;
  let adjusted=raw;
  if(raw!==null&&src?.length>=26&&dst.length>=26&&bar.session!=='RTH'){
    const a=moments(src),b=moments(dst);
    if(a.sd>1e-9&&b.sd>1e-9)adjusted=(raw-a.mean)/a.sd*b.sd+b.mean;
  }
  if(raw!==null&&src)push(src,raw,500);
  return {raw,adjusted};
}
export function createBodyState(){return {raw:rawState(),pools:poolsState()};}

// Two equal adverse bodies measured from the candle's wick extreme: red SPY V
// starts at High and green SPY V at Low. Future H1 states remain unknown.
export function solveBodyReversal(snapshot,bar,direction,{h1=null,maxDistance,step=STEP}={}){
  if(!direction||!Number.isFinite(maxDistance)||maxDistance<=0)return null;
  const anchor=direction<0?bar.h:bar.l;
  if(!Number.isFinite(anchor)||anchor<=0)return null;
  if(direction>0)maxDistance=Math.min(maxDistance,anchor*.99);
  const sessions=[sessionAt(bar.t+step).session,sessionAt(bar.t+2*step).session];
  function trial(distance){
    const s=cloneRaw(snapshot.raw),p=clonePools(snapshot.pools);let close=anchor,first=null,last=null;
    for(let k=1;k<=2;k++){
      const t=bar.t+k*step,next=close-direction*distance/2;
      const known=h1&&t+step-h1.blockEnd<=3600000?h1:null;
      last=advanceBodyState(s,p,{t,o:close,c:next,session:sessions[k-1]},known).adjusted;
      if(k===1)first=last;close=next;
    }
    return {first,last};
  }
  const reversed=r=>Number.isFinite(r.last)&&r.last*direction<0;
  let low=0,high=0,result=trial(0);
  if(!reversed(result)){
    high=Math.min(maxDistance,Math.max(maxDistance/65536,bar.c*1e-9));
    while(true){result=trial(high);if(reversed(result))break;if(high>=maxDistance)return null;low=high;high=Math.min(maxDistance,high*2);}
    for(let i=0;i<26;i++){const mid=(low+high)/2;if(reversed(trial(mid)))high=mid;else low=mid;}
    result=trial(high);
  }
  return {value:anchor-direction*high,anchor,reference:direction<0?'high':'low',distance:high,direction,first:result.first,second:result.last};
}

function closedReversalHistory(bars,states=new Map(),{now=Date.now(),adaptive=false,step=STEP}={}){
  const closed=bars.filter(b=>b.t+step<=now),schedule=adaptive?h1VolumeAlphaSchedule(closed,states,{step,now}):new Map();
  const confirmed=adaptive?[...states.values()].filter(s=>!s.preview&&Number.isFinite(s.blockEnd)).sort((a,b)=>a.blockEnd-b.blockEnd):[];
  const points=[],ranges=[],snapshot=createBodyState();
  let previous=null,lastSign=0,segment=0,cursor=0,known=null;
  for(const bar of closed){
    if(previous!==null&&bar.t!==previous.t+step){snapshot.raw=rawState();ranges.length=0;lastSign=0;segment++;}
    if(bar.sourceComplete===false||![bar.o,bar.c,bar.h,bar.l].every(Number.isFinite)||bar.c<=0){snapshot.raw=rawState();lastSign=0;previous=null;segment++;continue;}
    while(cursor<confirmed.length&&confirmed[cursor].blockEnd<bar.t+step)known=confirmed[cursor++];
    const reading=advanceBodyState(snapshot.raw,snapshot.pools,bar,schedule.get(bar.t)),direction=Math.sign(reading.adjusted??0);
    push(ranges,Math.max(bar.h-bar.l,previous?Math.abs(bar.h-previous.c):0,previous?Math.abs(bar.l-previous.c):0),14);
    const atr=sum(ranges)/ranges.length,scale=Math.max(atr,Math.abs(bar.c-bar.o),bar.c*1e-6);
    const result=direction?solveBodyReversal(snapshot,bar,direction,{step,h1:known,maxDistance:Math.min(bar.c*.9,16*scale)}):null;
    const flip=Boolean(direction&&lastSign&&direction!==lastSign);
    if(direction)lastSign=direction;
    if(result)points.push({time:bar.t/1000,...result,segment,flip,knownAt:bar.t+step,preview:false});
    else segment++; // never join over missing / unsolved thresholds
    previous=bar;
  }
  const value={points,last:points.at(-1)?.knownAt===closed.at(-1)?.t+step?points.at(-1):null,preview:null};
  Object.defineProperty(value,'context',{value:{snapshot,ranges,previous,lastSign,segment}});
  return value;
}

function withLivePreview(value,bars,states,{now=Date.now(),adaptive=false,step=STEP}={}){
  const bar=bars.findLast(b=>b.t<=now&&b.t+step>now);
  if(!bar)return value;
  const noPreview=()=>({points:value.points,last:null,preview:null});
  if(bar.sourceComplete===false||![bar.o,bar.c,bar.h,bar.l].every(Number.isFinite)||bar.c<=0)return noPreview();
  const context=value.context,snapshot={raw:cloneRaw(context.snapshot.raw),pools:clonePools(context.snapshot.pools)};
  let ranges=[...context.ranges],segment=context.segment,lastSign=context.lastSign,previous=context.previous;
  if(previous&&bar.t!==previous.t+step){snapshot.raw=rawState();ranges=[];previous=null;lastSign=0;segment++;}
  const currentH1=adaptive?h1VolumeAlphaSchedule([bar],states,{step,now}).get(bar.t):null;
  const reading=advanceBodyState(snapshot.raw,snapshot.pools,bar,currentH1),direction=Math.sign(reading.adjusted??0);
  if(!direction)return noPreview();
  push(ranges,Math.max(bar.h-bar.l,previous?Math.abs(bar.h-previous.c):0,previous?Math.abs(bar.l-previous.c):0),14);
  const scale=Math.max(sum(ranges)/ranges.length,Math.abs(bar.c-bar.o),bar.c*1e-6);
  // A current H1 preview may color this live candle; it cannot be assumed
  // confirmed for either of the two hypothetical future candles.
  const known=adaptive?[...states.values()].filter(s=>!s.preview&&Number.isFinite(s.blockEnd)&&s.blockEnd<now).sort((a,b)=>a.blockEnd-b.blockEnd||a.t-b.t).at(-1):null;
  const result=solveBodyReversal(snapshot,bar,direction,{step,h1:known,maxDistance:Math.min(bar.c*.9,16*scale)});
  if(!result)return noPreview();
  const preview={time:bar.t/1000,...result,segment,flip:Boolean(lastSign&&direction!==lastSign),knownAt:now,preview:true};
  return {points:value.points,last:preview,preview};
}

export function bodyReversalHistory(bars,states=new Map(),options={}){
  return withLivePreview(closedReversalHistory(bars,states,options),bars,states,options);
}

// Cache the locked history, then clone its tail once for the changing live
// candle. Intrabar updates never advance or contaminate the closed state.
export function bodyReversalCache(){
  let key='',value=null;
  return {get(bars,states,options){
    const closed=bars.filter(b=>b.t+STEP<=options.now);
    const next=JSON.stringify([options.adaptive,closed.map(b=>[b.t,b.o,b.h,b.l,b.c,b.session,b.sourceComplete]),options.adaptive?[...states.values()].filter(s=>!s.preview).map(s=>[s.t,s.blockStart,s.blockEnd,s.direction,s.quality]):[]]);
    if(next!==key||!value){value=closedReversalHistory(closed,states,options);key=next;}
    return withLivePreview(value,bars,states,options);
  },clear(){key='';value=null;}};
}
