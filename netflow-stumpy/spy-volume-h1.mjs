// Display experiment: H1 changes the EWMA speed before Gaussian normalization.
import {calculateVolumeStrength,analyze} from './engine.mjs?v=20261105-spyv-h1-1';
const HOUR=3600000;
export function h1VolumeAlphaSchedule(bars,states,{step=900000,now=Date.now()}={}){
  const blocks=new Map();
  for(const state of states.values()){
    if(!Number.isFinite(state.blockStart)||!Number.isFinite(state.blockEnd))continue;
    const old=blocks.get(state.blockStart);
    if(!old||state.t>old.t)blocks.set(state.blockStart,state);
  }
  const confirmed=[...blocks.values()].filter(s=>!s.preview).sort((a,b)=>a.blockEnd-b.blockEnd);
  const preview=[...blocks.values()].find(s=>s.preview&&s.blockStart<=now&&s.blockEnd>=now-step);
  let cursor=0,last=null;
  return new Map(bars.map((bar,index)=>{
    const knownAt=Math.min(now,(bar.end??bar.t+step-1)+1);
    while(cursor<confirmed.length&&confirmed[cursor].blockEnd<knownAt)last=confirmed[cursor++];
    let state=last&&knownAt-last.blockEnd<=HOUR?last:null;
    // A preview may affect only the current open point, never earlier M15s.
    if(index===bars.length-1&&bar.t<=now&&bar.t+step>now&&preview&&preview.blockStart<=bar.t)state=preview;
    return [bar.t,state];
  }));
}
export function h1AdaptiveVolumeRows(bars,states,{step=900000,now=Date.now()}={}){
  const schedule=h1VolumeAlphaSchedule(bars,states,{step,now});
  const strength=calculateVolumeStrength(bars,step,{alphaForBar:({t,r,previous})=>{
    const state=schedule.get(t);
    if(!state)return 1-2**(-1/2); // original speed until H1 is available
    if(!state.direction||state.quality<.35)return .16;
    const aligned=Math.sign(r)===state.direction;
    const reversing=Number.isFinite(previous)&&Math.sign(r)!==Math.sign(previous);
    const alpha=aligned?.65:reversing?.48:.30;
    return state.preview?Math.min(.38,alpha):alpha;
  }});
  return analyze(bars,step,{strength});
}
