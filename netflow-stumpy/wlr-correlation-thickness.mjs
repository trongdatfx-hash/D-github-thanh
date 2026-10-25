// Descriptive display metric; independent of model features and frozen policies.
export const WLR_CORRELATION_DEFAULTS=Object.freeze({window:34,minPairs:20,alignmentWindow:8,deadband:.07,minWidth:1,maxWidth:6,alpha:.35});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function pearsonCorrelation(a,b){
  if(a.length!==b.length||a.length<2||!a.every(Number.isFinite)||!b.every(Number.isFinite))return null;
  const ma=a.reduce((s,x)=>s+x,0)/a.length,mb=b.reduce((s,x)=>s+x,0)/b.length;
  let aa=0,bb=0,ab=0;
  for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;aa+=x*x;bb+=y*y;ab+=x*y;}
  if(aa<=Number.EPSILON*Math.max(...a.map(x=>Math.abs(x)),Number.MIN_VALUE)**2||bb<=Number.EPSILON*Math.max(...b.map(x=>Math.abs(x)),Number.MIN_VALUE)**2)return null;
  return clamp(ab/Math.sqrt(aa*bb),-1,1);
}
export function wlrCorrelationThickness(rows,composite,volume,{step,closedBefore=Infinity,...options}={}){
  const c={...WLR_CORRELATION_DEFAULTS,...options};
  if(!Array.isArray(rows)||!(composite instanceof Map)||!(volume instanceof Map)||!Number.isInteger(step)||step<=0||!(Number.isFinite(closedBefore)||closedBefore===Infinity)||![c.window,c.minPairs,c.alignmentWindow].every(n=>Number.isInteger(n)&&n>=2)||c.minPairs>c.window||![c.deadband,c.minWidth,c.maxWidth,c.alpha].every(Number.isFinite)||c.deadband<0||c.minWidth<=0||c.maxWidth<c.minWidth||c.alpha<=0||c.alpha>1)throw Error('Invalid WLR correlation thickness settings');
  let history=[],previous=null,smoothed=c.minWidth;
  return rows.map(row=>{
    if(!Number.isFinite(row?.t))throw Error('Invalid WLR thickness timestamp');
    if(previous!==null&&row.t-previous!==step){history=[];smoothed=c.minWidth;}previous=row.t;
    // The displayed width at t uses strictly earlier CLOSED observations.
    const sample=history.slice(-c.window),pairs=sample.length;
    let corrVolumeComposite=null,corrSigmaVolume=null,corrSigmaComposite=null,alignment=0,quality=0,ready=false,sigmaRelation='unknown';
    if(pairs>=c.minPairs){
      const s=sample.map(x=>x.sigma),v=sample.map(x=>x.v),k=sample.map(x=>x.c);
      corrVolumeComposite=pearsonCorrelation(v,k);
      corrSigmaVolume=pearsonCorrelation(s,v.map(Math.abs));
      corrSigmaComposite=pearsonCorrelation(s,k.map(Math.abs));
      ready=[corrVolumeComposite,corrSigmaVolume,corrSigmaComposite].every(Number.isFinite);
      if(ready){
        const recent=sample.slice(-c.alignmentWindow);
        alignment=recent.filter(x=>Math.abs(x.v)>c.deadband&&Math.abs(x.c)>c.deadband&&Math.sign(x.v)===Math.sign(x.c)).length/recent.length;
        const coherent=corrSigmaVolume*corrSigmaComposite>0;
        sigmaRelation=coherent?(corrSigmaVolume>0?'direct':'inverse'):'mixed';
        quality=coherent?Math.cbrt(Math.max(0,corrVolumeComposite)*Math.abs(corrSigmaVolume)*Math.abs(corrSigmaComposite))*alignment:0;
      }
    }
    const targetWidth=c.minWidth+(c.maxWidth-c.minWidth)*clamp(quality);
    smoothed=ready?smoothed+c.alpha*(targetWidth-smoothed):c.minWidth;
    const result={t:row.t,width:clamp(smoothed,c.minWidth,c.maxWidth),targetWidth,quality,pairs,ready,corrVolumeComposite,corrSigmaVolume,corrSigmaComposite,alignment,sigmaRelation};
    const v=volume.get(row.t)?.adjusted,k=composite.get(row.t)?.adjusted;
    if(row.t+step-1<closedBefore){
      if(Number.isFinite(row.mid)&&Number.isFinite(row.sigma)&&row.sigma>=0&&Number.isFinite(v)&&Number.isFinite(k)){
        history.push({sigma:row.sigma,v,c:k});if(history.length>c.window)history.shift();
      }else{history=[];smoothed=c.minWidth;}
    }
    return result;
  });
}
