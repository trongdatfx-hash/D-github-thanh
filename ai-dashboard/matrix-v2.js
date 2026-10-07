/* Signal Matrix V2: pure, causal scoring core; browser + Node tests. */
(function(root){
 'use strict';
 const H=4,THR=.15,FEE=4,STEP=900000;
 const clip=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const phase=v=>v>=THR?'BULL':v<=-THR?'BEAR':'NEUTRAL';
 const defs=[
  ['Taker Strength','strength',v=>v],['Price Response','priceResponse',v=>v],
  ['Top Trader Position','topLS',v=>Math.tanh(Math.log(Math.max(.05,v))*1.7)],
  ['Top Trader Account','topAcctLS',v=>Math.tanh(Math.log(Math.max(.05,v))*1.5)],
  ['Global Account L/S','globalLS',v=>Math.tanh(Math.log(Math.max(.05,v))*1.2)],
  ['Taker Buy/Sell Ratio','takerRatio',v=>Math.tanh(Math.log(Math.max(.05,v))*1.4)],
  ['OI Regime','oiZ',(v,r)=>Math.sign(r.r4)*Math.sign(r.oiDelta)*Math.tanh(Math.abs(v)/2)],
  ['Funding','fundingZ',v=>-Math.tanh(v/2)],
  ['NetFlow SPY+QQQ','netflowClusterSignal',v=>v],
  ['Liquidation','liqNetZ',v=>Math.tanh(v/2)],['Basis','bz',v=>Math.tanh(v/2)],
  ['Flow/Price Divergence','flowPriceDiv',v=>v]
 ];
 function value(r,d){
  if(!r||r.v2Available?.[d[1]]===false||!Number.isFinite(r[d[1]]))return NaN;
  const v=d[2](r[d[1]],r);return Number.isFinite(v)?clip(v,-1,1):NaN;
 }
 function stats(data,d,asOf,dir){
  let n=0,w=0,sum=0,up=0,down=0,baseN=0,next=-Infinity;
  // Every outcome must be closed AND available before this decision time.
  for(let i=0;i+H<data.length;i++){
   const a=data[i],b=data[i+H];
   if(b.closeTime>=asOf||b.time-a.time!==H*STEP)continue;
   const ret=b.last/a.last-1;if(!Number.isFinite(ret)||a.last<=0)continue;
   baseN++;if(ret>0)up++;if(ret<0)down++;
   const v=value(a,d);if(!Number.isFinite(v)||Math.abs(v)<THR||Math.sign(v)!==dir||a.time<next)continue;
   n++;if(dir*ret>0)w++;sum+=dir*ret*1e4-FEE;next=a.time+H*STEP;
  }
  const hit=n?w/n:NaN,base=baseN?(dir>0?up:down)/baseN:NaN,edge=hit-base,bps=n?sum/n:NaN;
  // Conservative one-sided normal margin + shrinkage. Confidence is a heuristic, not P(win).
  const margin=n?1.645*Math.sqrt(Math.max(hit*(1-hit),.25)/n):Infinity;
  const support=clip((edge-margin)/.10),economic=clip(bps/10),sample=n/(n+50);
  const confidence=n?sample*support*economic:0;
  return {n,hit,edge,bps,confidence};
 }
 function score(v,s){return Number.isFinite(v)&&Math.abs(v)>=THR?100*v*(.25+.75*s.confidence):0}
 function evaluate(data,current,asOf){
  const factors=defs.map(d=>{const v=value(current,d),dir=v<0?-1:1,s=stats(data,d,asOf,dir);return {name:d[0],key:d[1],value:v,phase:phase(Number.isFinite(v)?v:0),...s,score:score(v,s)}});
  // Fixed denominator: missing factors contribute zero instead of amplifying remaining factors.
  const composite=factors.reduce((s,f)=>s+f.score,0)/defs.length;
  return {factors,composite,phase:phase(composite/100),coverage:factors.filter(f=>Number.isFinite(f.value)).length};
 }
 const api={H,THR,FEE,defs,phase,value,stats,score,evaluate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SignalMatrixV2=api;
})(typeof window!=='undefined'?window:globalThis);
