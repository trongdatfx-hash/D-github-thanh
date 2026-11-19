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

// Two equal adverse bodies, no gaps. Future H1 states are unknown: hold only
// the latest H1 already confirmed at this anchor, with the existing 1h expiry.
export function solveBodyReversal(snapshot,bar,direction,{h1=null,maxDistance,step=STEP}={}){
  if(!direction||!Number.isFinite(maxDistance)||maxDistance<=0)return null;
  const sessions=[sessionAt(bar.t+step).session,sessionAt(bar.t+2*step).session];
  function trial(distance){
    const s=cloneRaw(snapshot.raw),p=clonePools(snapshot.pools);let close=bar.c,first=null,last=null;
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
  return {value:bar.c-direction*high,distance:high,direction,first:result.first,second:result.last};
}

export function bodyReversalHistory(bars,states=new Map(),{now=Date.now(),adaptive=false,step=STEP}={}){
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
    if(result)points.push({time:bar.t/1000,...result,segment,flip,knownAt:bar.t+step});
    else segment++; // never join over missing / unsolved thresholds
    previous=bar;
  }
  return {points,last:points.at(-1)?.knownAt===closed.at(-1)?.t+step?points.at(-1):null};
}

// Historical thresholds are stable while only the open candle changes.
export function bodyReversalCache(){
  let key='',value={points:[],last:null};
  return {get(bars,states,options){
    const closed=bars.filter(b=>b.t+STEP<=options.now);
    const next=JSON.stringify([options.adaptive,closed.map(b=>[b.t,b.o,b.h,b.l,b.c,b.session,b.sourceComplete]),options.adaptive?[...states.values()].filter(s=>!s.preview).map(s=>[s.t,s.blockStart,s.blockEnd,s.direction,s.quality]):[]]);
    if(next!==key){value=bodyReversalHistory(closed,states,options);key=next;}return value;
  },clear(){key='';value={points:[],last:null};}};
}
