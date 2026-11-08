// Display experiment: actual SPY + QQQ quote taker flow; no price/H1/OI gates.
import {normCDF} from './engine.mjs?v=20261105-spyv-h1-1';
export const NF_SMOOTH_VERSION='composite-nf-self-ewma-v1';
const M=900000,finite=Number.isFinite;
export function compositeNfSmooth(spy,qqq,{step=M,now=Date.now(),normLen=20,strLen=4,lookback=500}={}){
  if(!Array.isArray(spy)||!Array.isArray(qqq)||step!==M||!finite(now)||![normLen,strLen,lookback].every(x=>Number.isInteger(x)&&x>0)||![4,8].includes(strLen))throw Error('Invalid C Taker smoothing inputs');
  const other=new Map(qqq.map(b=>[b.t,b]));let quotes=[],impulses=[],magnitudes=[],ew=null,previous=null;
  const reset=()=>{quotes=[];impulses=[];magnitudes=[];ew=null;};
  const net=b=>finite(b?.buy)&&finite(b?.q)?2*b.buy-b.q:b?.net;
  const valid=b=>b&&finite(b.q)&&b.q>=0&&finite(net(b))&&Math.abs(net(b))<=b.q+1e-8;
  return spy.map(a=>{
    if(!finite(a?.t)||(previous!==null&&a.t<=previous))throw Error('C Taker timestamps must increase');
    if(previous!==null&&a.t-previous!==step)reset();previous=a.t;
    const b=other.get(a.t),base={t:a.t,end:a.t+step-1,knownAt:a.t+step,value:null,strLen,version:NF_SMOOTH_VERSION};
    if(a.t+step>now)return {...base,reason:'forming_excluded'};
    if(!valid(a)||!valid(b)||a.sourceComplete===false||b.sourceComplete===false){reset();return {...base,reason:'missing_pair'};}
    const quote=a.q+b.q,nf=net(a)+net(b);quotes.push(quote);if(quotes.length>normLen)quotes.shift();
    const paired={...base,net:nf,spyNet:net(a),qqqNet:net(b),quoteVolume:quote};
    if(quotes.length<normLen)return {...paired,reason:'warmup_quote'};
    const mean=quotes.reduce((s,x)=>s+x,0)/normLen,x=mean>0?nf/mean:0;
    impulses.push(x);if(impulses.length>strLen)impulses.shift();
    if(impulses.length<strLen)return {...paired,normalized:x,reason:'warmup_sum'};
    const r=impulses.reduce((s,x)=>s+x,0),gross=impulses.reduce((s,x)=>s+Math.abs(x),0),efficiency=gross>0?Math.abs(r)/gross:0;
    let alpha=.18+.42*efficiency;
    const reversing=ew!==null&&r*ew<0&&Math.abs(r)>=.5*Math.abs(ew);
    if(reversing)alpha=Math.max(alpha,.48);
    ew=ew===null?r:ew+alpha*(r-ew);
    magnitudes.push(Math.abs(ew));if(magnitudes.length>lookback)magnitudes.shift();
    const result={...paired,normalized:x,sum:r,smoothed:ew,alpha,efficiency,reversing};
    if(magnitudes.length<lookback)return {...result,reason:'warmup_scale'};
    const sigma=magnitudes.reduce((s,x)=>s+x,0)/lookback*Math.sqrt(Math.PI/2),value=sigma>0?Math.max(-1,Math.min(1,2*normCDF(ew/sigma)-1)):0;
    return {...result,value,sigma,reason:'closed'};
  });
}
