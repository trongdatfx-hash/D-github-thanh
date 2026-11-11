const STEP=900000;
const DEAD_ZONE=.15;
const WAIT={state:'wait',label:'ΔOI8 chờ dữ liệu'};

export function matrixOi8Reading(bars, points, now){
  let end=bars.length-1;
  while(end>=0&&bars[end].t+STEP>now)end--;
  const current=bars[end],previous=bars[end-1],base=bars[end-2];
  if(!current||!previous||!base||current.t+2*STEP<=now||
      current.t-previous.t!==STEP||previous.t-base.t!==STEP||
      [base,previous,current].some(b=>b.sourceComplete===false))return WAIT;
  const latest=points[end],prior=points[end-1];
  if(latest?.time!==current.t/1000||prior?.time!==previous.t/1000||
      !Number.isFinite(latest.value)||!Number.isFinite(prior.value))return WAIT;
  const sign=v=>Math.abs(v)<DEAD_ZONE?0:Math.sign(v);
  const direction=sign(latest.value);
  const values=[prior.value,latest.value];
  if(direction!==sign(prior.value))return {state:'pending',label:'ΔOI8 chờ xác nhận',values};
  if(!direction)return {state:'neutral',label:'OI trung tính',values};
  const price=Math.sign(current.c-base.c);
  const net=Math.sign(2*(current.buy+previous.buy)-(current.q+previous.q));
  const flow=price===net&&(price===1||price===-1)?price:0;
  const state=direction>0?'expanding':'contracting';
  const oiLabel=direction>0?'OI mở rộng':'OI thu hẹp';
  const label=flow?(flow>0?'Giá tăng · ':'Giá giảm · ')+oiLabel:oiLabel;
  const context=direction<0?(flow>0?'Nghi đóng Short':flow<0?'Nghi đóng Long':'Chưa rõ Long/Short'):'';
  return {state,label,flow,context,values};
}
