import {trendSessionAt} from './trend-session.mjs?v=20261025-dcommon-all1';
const STEP=900000,sum=a=>a.reduce((s,x)=>s+x,0);
export function fourBarTrendEarly(rows,{now=Infinity}={}){
 const closed=rows.filter(r=>r.end<now),states=new Map(),frames=new Map(closed.map(r=>[r.t,trendSessionAt(r.t)])),closeFrames=new Map(closed.map(r=>[r.t,trendSessionAt(r.end+1)]));let live=null,bad=0,cooldown=-1;
 for(let i=0;i<closed.length;i++){
  const r=closed[i],frame=frames.get(r.t),prior=closed[i-1];
  if(!frame.active||!closeFrames.get(r.t).active||prior&&(r.t-prior.t!==STEP||frame.day!==frames.get(prior.t).day)){live=null;bad=0;}
  if(!frame.active||!closeFrames.get(r.t).active)continue;
  if(live){const oppose=live.direction*(r.c-prior.c)<0||live.direction*(2*r.buy-r.q)<0;bad=oppose?bad+1:0;if(bad>=2||i-live.originIndex+1>8){live=null;bad=0;cooldown=i+3;}}
  let trigger=null;
  if(!live&&i>=16&&i>cooldown){const sample=closed.slice(i-16,i+1);
   if(sample.every((b,j)=>[b.c,b.o,b.v,b.q,b.buy].every(Number.isFinite)&&b.q>0&&b.v>=0&&b.buy>=0&&b.buy<=b.q&&(!j||b.t-sample[j-1].t===STEP)&&frames.get(b.t).active&&frames.get(b.t).day===frame.day)){
    const blocks=[];for(let k=0;k<4;k++){const e=i-4*k,b=closed.slice(e-3,e+1);blocks.push({price:b.at(-1).c-closed[e-4].c,volume:sum(b.map(x=>Math.sign(x.c-x.o)*x.v)),nf:sum(b.map(x=>2*x.buy-x.q))});}
    const d=Math.sign(blocks[0].price),keys=['price','volume','nf'];if(d&&keys.every(k=>blocks[0][k]*d>0&&blocks[0][k]*d>blocks[1][k]*d&&blocks[0][k]*d>sum(blocks.slice(1).map(b=>b[k]*d))/3))trigger={direction:d,blocks};
   }
  }
  if(trigger){live={direction:trigger.direction,originIndex:i-3,startTime:closed[i-3].t,signalTime:r.t,issuedAt:r.end+1,blocks:trigger.blocks};bad=0;}
  if(live)states.set(r.t,{t:r.t,label:live.direction>0?'UP':'DOWN',early:true,active:true,direction:live.direction,currentBars:i-live.originIndex+1,startTime:live.startTime,signalTime:live.signalTime,issuedAt:live.issuedAt,continuation:null,remainingBars:null,reliable:false,reason:'4 nen: gia, volume theo than nen va taker NF cung huong, manh hon cum truoc va trung binh 3 cum truoc; du kien, chua co xac suat tuoi trend'});
 }
 return states;
}
export function mergeEarlyTrendAge(states,early){return states.map(s=>s.label==='WAIT'&&early.has(s.t)?{...s,...early.get(s.t)}:s);}
