import {weightedPriceBands} from './engine.mjs?v=20261118-wlr-band-slope';

// Fixed causal gates, evaluated only at a closed candle. WLR excludes that
// candle; no final H1 score, future pivot or full-phase extreme is consulted.
export function reversalTrendReadings(bars,bodyRows,{step=900000}={}){
  const body=new Map(bodyRows.map(r=>[r.t,r.adjusted]));
  const wlr=new Map(weightedPriceBands(bars,step,{window:8}).map(r=>[r.t,r]));
  const result=new Map();let ranges=[],previous=null;
  for(const bar of bars){
    if(previous&&bar.t!==previous.t+step){ranges=[];previous=null;}
    if(bar.sourceComplete===false||![bar.o,bar.h,bar.l,bar.c].every(Number.isFinite)){
      ranges=[];previous=null;result.set(bar.t,{ready:false});continue;
    }
    const atr=ranges.length===14?ranges.reduce((a,b)=>a+b,0)/14:null;
    const value=body.get(bar.t),prior=previous?body.get(previous.t):null,direction=Number.isFinite(value)?Math.sign(value):0,band=wlr.get(bar.t);
    const strength=direction&&Number.isFinite(prior)&&Math.sign(prior)===direction&&Math.abs(value)>=.15&&direction*(value-prior)>=0;
    const wlrAligned=atr>0&&Number.isFinite(band?.mid)&&Number.isFinite(band?.slope)&&direction*(bar.c-band.mid)>0&&direction*band.slope/atr>=.02;
    result.set(bar.t,{ready:Boolean(direction&&strength&&wlrAligned),direction,strength:Boolean(strength),wlrAligned:Boolean(wlrAligned),spyV:value,slopeAtr:atr>0&&Number.isFinite(band?.slope)?band.slope/atr:null});
    ranges.push(Math.max(bar.h-bar.l,previous?Math.abs(bar.h-previous.c):0,previous?Math.abs(bar.l-previous.c):0));if(ranges.length>14)ranges.shift();
    previous=bar;
  }
  return result;
}
