// Display-only Schmitt trigger. Forecast phase labels remain in the model engine.
export const WLR_COLOR_DEFAULTS=Object.freeze({enter:.15,exit:.07,positive:'#1ae0a3',negative:'#ff4d70',neutral:'#f6c85f'});
export function wlrDisplayColors(rows,composite,volume,{step,closedBefore=Infinity,...options}={}){
  const config={...WLR_COLOR_DEFAULTS,...options};
  if(!Array.isArray(rows)||!(composite instanceof Map)||!(volume instanceof Map)||!Number.isInteger(step)||step<=0||!(Number.isFinite(closedBefore)||closedBefore===Infinity)||!Number.isFinite(config.enter)||!Number.isFinite(config.exit)||config.exit<0||config.enter<=config.exit)throw Error('Invalid WLR display color settings');
  let direction=0,previous=null,referenceTime=null,referenceComposite=null,referenceVolume=null;
  return rows.map(row=>{
    if(!Number.isFinite(row?.t))throw Error('Invalid WLR display timestamp');
    if(previous!==null&&row.t-previous!==step){direction=0;referenceTime=null;referenceComposite=null;referenceVolume=null;}
    previous=row.t;
    const closed=row.t+step-1<closedBefore,valid=Number.isFinite(row.mid),c=composite.get(row.t)?.adjusted,v=volume.get(row.t)?.adjusted;
    if(!valid){direction=0;referenceTime=null;referenceComposite=null;referenceVolume=null;}
    else if(closed){
      referenceTime=row.t;referenceComposite=Number.isFinite(c)?c:null;referenceVolume=Number.isFinite(v)?v:null;
      if(!Number.isFinite(c)||!Number.isFinite(v))direction=0;
      else if(direction===1&&c>config.exit&&v>config.exit)direction=1;
      else if(direction===-1&&c< -config.exit&&v< -config.exit)direction=-1;
      else if(c>=config.enter&&v>=config.enter)direction=1;
      else if(c<=-config.enter&&v<=-config.enter)direction=-1;
      else direction=0;
    }
    return {t:row.t,referenceTime,referenceComposite,referenceVolume,reason:!valid?'missing_wlr':!closed?'live_hold':!Number.isFinite(c)||!Number.isFinite(v)?'missing_strength':direction?'confirmed_consensus':'neutral_zone',direction,color:direction>0?config.positive:direction<0?config.negative:config.neutral,closed};
  });
}
