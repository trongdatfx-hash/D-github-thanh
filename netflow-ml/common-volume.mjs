import {analyze,normalizedTakerVolumeDelta,commonTakerDeltaValue,calculateDeltaVolumeStrength,COMPOSITE_STRENGTH_VERSION} from './engine.mjs?v=20261025-dcommon-all1';
export {normalizedTakerVolumeDelta,commonTakerDeltaValue,calculateDeltaVolumeStrength} from './engine.mjs?v=20261025-dcommon-all1';

// Compatibility facade: D common and every Composite consumer share the engine.
export function calculateCommonTakerVolumeStrength(spyBars,qqqBars,step,{spyWeight=.7,...strengthOptions}={}){
  const spyDelta=normalizedTakerVolumeDelta(spyBars,step),qqqDelta=normalizedTakerVolumeDelta(qqqBars,step),qqqMap=new Map(qqqDelta.map(row=>[row.t,row])),deltas=spyDelta.flatMap(row=>{
    const value=commonTakerDeltaValue(row.value,qqqMap.get(row.t)?.value,{spyWeight});
    return Number.isFinite(value)?[{t:row.t,value}]:[];
  }),times=new Set(deltas.map(row=>row.t)),bars=spyBars.filter(row=>times.has(row.t));
  return {strengthVersion:COMPOSITE_STRENGTH_VERSION,rows:analyze(bars,step,{strength:calculateDeltaVolumeStrength(deltas,step,strengthOptions)}),deltas,spyDelta,qqqDelta};
}
