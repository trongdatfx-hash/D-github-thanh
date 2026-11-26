// Snapshot calibration: source and target must refer to the same instant.
// The reference is deliberately fixed, never re-anchored to the latest price.
const finite=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value));
export function gexMapping(config={}){
  const mode=config.mode??'BASIS',scale=Number(config.scale??10);
  if(!['BASIS','PAIR_RATIO','PAIR_SHIFT'].includes(mode))throw Error('Kiểu hiệu chỉnh GEX không hợp lệ.');
  if(!finite(scale)||scale<=0)throw Error('Thang strike phải lớn hơn 0.');
  if(mode==='BASIS'){
    if(!finite(config.basis))throw Error('Basis không hợp lệ.');
    return {mode,ratio:1/scale,offset:-Number(config.basis)/scale,scale,basis:Number(config.basis)};
  }
  if(!finite(config.source)||Number(config.source)<=0||!finite(config.target)||Number(config.target)<=0)throw Error('Cần hai giá tham chiếu dương, tại cùng thời điểm.');
  if(!finite(config.referenceTime)||Number(config.referenceTime)<=0)throw Error('Chọn mốc thời gian chung cho hai giá.');
  const source=Number(config.source),target=Number(config.target),ratio=mode==='PAIR_RATIO'?target/source:1/scale;
  return {mode,source,target,scale,referenceTime:Number(config.referenceTime),ratio,offset:target-source*ratio};
}
export function projectGexStrike(strike,mapping){return strike*mapping.ratio+mapping.offset;}
export function closedGexReference(bars,{time=null,step,now}={}){
  if(!Number.isFinite(step)||step<=0||!Number.isFinite(now))return null;
  // Match the exact close boundary. Do not substitute a nearby or live candle.
  const rows=bars.filter(b=>Number.isFinite(b.t)&&Number.isFinite(b.c)&&b.c>0&&b.t+step<=now);
  const row=time===null?rows.at(-1):rows.find(b=>Math.abs(b.t+step-time)<1);
  return row?{price:row.c,time:row.t+step}:null;
}
export function gexReferenceTime(value){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value??''))return NaN;
  return Date.parse(value+':00+07:00');
}
export function gexReferenceInput(time){
  if(!Number.isFinite(time))return '';
  return new Date(time+7*3600000).toISOString().slice(0,16);
}
