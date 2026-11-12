const STEP=900000;
const DEAD_ZONE=.15;
const TOP_TRADER_DEAD_ZONE=.002;
const WAIT={state:'wait',label:'ΔOI8 chờ dữ liệu'};

const OI_LABELS=['OI thu hẹp','OI trung tính','OI mở rộng'];
const OI_STATES=['contracting','neutral','expanding'];

export function matrixOi8Reading(bars, points, now, topTrader=new Map(), {window=8}={}){
  const count=window===6?6:8,required=count===6?5:6;
  let end=bars.length-1;
  while(end>=0&&bars[end].t+STEP>now)end--;
  const current=bars[end],first=end-count+1;
  if(first<0||current.t+2*STEP<=now)return WAIT;
  const sample=bars.slice(first,end+1);
  const values=[];
  for(const [i,bar] of sample.entries()){
    const point=points[first+i];
    if(bar.sourceComplete===false||bar.t!==current.t-(count-1-i)*STEP||
        point?.time!==bar.t/1000||!Number.isFinite(point.value))return WAIT;
    values.push(point.value);
  }
  const votes=[0,0,0],recent=[0,0,0];
  for(const [i,value] of values.entries()){
    const zone=value<=-DEAD_ZONE?0:value>=DEAD_ZONE?2:1;
    votes[zone]++;
    if(i>=count-3)recent[zone]++;
  }
  const zone=votes.findIndex(v=>v>=required);
  const ratio=zone<0?'':` ${votes[zone]}/${count}`;
  if(zone<0)return {state:'mixed',label:'OI hỗn hợp',values,votes};
  const next=recent.findIndex((v,i)=>i!==zone&&v>=2);
  if(next>=0)return {state:'pending',label:`OI chuyển tiếp: ${OI_LABELS[zone].slice(3)} → ${OI_LABELS[next].slice(3)}`,values,votes};
  const state=OI_STATES[zone],oiLabel=OI_LABELS[zone]+ratio;
  if(zone===1)return {state,label:oiLabel,values,votes};
  const direction=zone-1;
  const base=bars[first-1],hasBase=base&&base.t+STEP===sample[0].t&&base.sourceComplete!==false;
  const price=hasBase?Math.sign(current.c-base.c):0;
  const net=Math.sign(sample.reduce((total,bar)=>total+2*bar.buy-bar.q,0));
  const flow=price===net&&(price===1||price===-1)?price:0;
  const label=flow?(flow>0?'Giá tăng · ':'Giá giảm · ')+oiLabel:oiLabel;
  const shares=[topTrader.get(sample[0].t),...sample.map(bar=>topTrader.get(bar.t+STEP))];
  const topTraderDelta=shares.every(x=>Number.isFinite(x)&&x>=0&&x<=1)?shares.at(-1)-shares[0]:null;
  let context='';
  if(!flow)context='Giá–Taker chưa đồng thuận';
  else if(topTraderDelta===null)context='Chờ Top Trader';
  else if(Math.abs(topTraderDelta)<TOP_TRADER_DEAD_ZONE-1e-10)context='Top Trader trung tính';
  else if(Math.sign(topTraderDelta)!==flow)context='Lệch Top Trader';
  else if(direction>0)context=flow>0?'Nghi mở Long':'Nghi mở Short';
  else context=flow>0?'Nghi đóng Short':'Nghi đóng Long';
  return {state,label,flow,context,values,votes,topTraderDelta};
}
