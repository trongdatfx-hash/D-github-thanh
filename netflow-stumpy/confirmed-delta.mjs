import {normalizedTakerVolumeDelta,calculateDeltaVolumeStrength} from './engine.mjs?v=20261026-history-perf3';

// SPY quote taker delta gated by the direction of the same candle body.
export function confirmedDeltaStrength(bars,step){
  const normalized=normalizedTakerVolumeDelta(bars,step);
  const impulses=normalized.map((x,i)=>{
    const body=bars[i].c-bars[i].o;
    return {t:x.t,value:body*x.net>0?x.value:0};
  });
  const strength=calculateDeltaVolumeStrength(impulses,step);
  return impulses.map((x,i)=>({t:x.t,value:strength[i],impulse:x.value}));
}
