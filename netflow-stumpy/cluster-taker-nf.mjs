// Display-only accumulation: raw COMPOSITE net remains unchanged for studies.
export function clusterTakerNf(bars,flowByTime,spyVByTime,step,now){
  if(!(step>0)||!Number.isFinite(now))return [];
  let total=0,phase=0,lastTime=null;
  return bars.map(bar=>{
    const point={time:bar.t/1000};
    const net=flowByTime.get(bar.t)?.net,spyV=spyVByTime.get(bar.t)?.adjusted;
    const sign=Number.isFinite(spyV)?Math.sign(spyV):0;
    if(!Number.isFinite(bar.end)||bar.end>=now||!Number.isFinite(net)||!sign){
      total=0;phase=0;lastTime=null;return point;
    }
    if(sign!==phase||lastTime!==bar.t-step)total=0;
    total+=net;phase=sign;lastTime=bar.t;
    return {...point,value:total,color:sign>0?'#08e8a9':'#ff4163'};
  });
}
