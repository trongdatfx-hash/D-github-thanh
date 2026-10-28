import {analyze,composite,calculateStrength,normalizedTakerVolumeDelta,commonTakerDeltaValue,calculateDeltaVolumeStrength,COMPOSITE_STRENGTH_VERSION} from './engine.mjs?v=20261029-price-delta1';
export {normalizedTakerVolumeDelta,commonTakerDeltaValue,calculateDeltaVolumeStrength} from './engine.mjs?v=20261029-price-delta1';

// Compatibility facade for callers that formerly requested D common. It now
// returns the same price-confirmed SPY taker Strength used by Composite.
export function calculateCommonTakerVolumeStrength(spyBars,qqqBars,step,{spyWeight=.7,...strengthOptions}={}){
  if(spyWeight!==.7)throw Error('Custom D common weights are no longer supported');
  const bars=composite(spyBars,qqqBars,step),deltas=bars.map(row=>({t:row.t,value:row.strengthImpulse}));
  return {strengthVersion:COMPOSITE_STRENGTH_VERSION,rows:analyze(bars,step,{strength:calculateStrength(bars,step,strengthOptions)}),deltas};
}
