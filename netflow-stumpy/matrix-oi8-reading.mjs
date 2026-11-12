const STEP=900000;
const DEAD_ZONE=.15;
const TOP_TRADER_DEAD_ZONE=.002;
const WAIT={state:'wait',label:'ΔOI8 chờ dữ liệu'};
const STATES={
  openLong:{label:'Nghi mở Long',flow:1},
  openShort:{label:'Nghi mở Short',flow:-1},
  closeLong:{label:'Nghi đóng Long',flow:-1},
  closeShort:{label:'Nghi đóng Short',flow:1},
  neutral:{label:'OI trung tính',flow:0}
};

export function matrixOi8Reading(bars, points, now, topTrader=new Map(), {window=4}={}){
  const count=window===6?6:4,required=count===6?5:3;
  let end=bars.length-1;
  while(end>=0&&bars[end].t+STEP>now)end--;
  const current=bars[end],first=end-count+1;
  if(first<0||current.t+2*STEP<=now)return WAIT;
  const sample=bars.slice(first,end+1);
  const values=[],votes={openLong:0,openShort:0,closeLong:0,closeShort:0,neutral:0,unclear:0};
  for(const [i,bar] of sample.entries()){
    const point=points[first+i];
    if(bar.sourceComplete===false||bar.t!==current.t-(count-1-i)*STEP||
        point?.time!==bar.t/1000||!Number.isFinite(point.value))return WAIT;
    const oi=point.value;
    values.push(oi);
    if(Math.abs(oi)<DEAD_ZONE){votes.neutral++;continue;}
    if(![bar.o,bar.c,bar.buy,bar.q].every(Number.isFinite)){votes.unclear++;continue;}
    const price=Math.sign(bar.c-bar.o),net=Math.sign(2*bar.buy-bar.q);
    if(price!==net||!price){votes.unclear++;continue;}
    if(oi>0)votes[price>0?'openLong':'openShort']++;
    else votes[price>0?'closeShort':'closeLong']++;
  }
  const winner=Object.keys(STATES).find(key=>votes[key]>=required);
  if(!winner)return {state:'mixed',label:'Vị thế hỗn hợp',values,votes};
  const {label,flow}=STATES[winner];
  const reading={state:winner,label:`${label} ${votes[winner]}/${count}`,values,votes};
  if(!flow)return reading;
  const shares=[topTrader.get(sample[0].t),...sample.map(bar=>topTrader.get(bar.t+STEP))];
  const topTraderDelta=shares.every(x=>Number.isFinite(x)&&x>=0&&x<=1)?shares.at(-1)-shares[0]:null;
  const topTraderContext=topTraderDelta===null?'Chờ Top Trader':
    Math.abs(topTraderDelta)<TOP_TRADER_DEAD_ZONE-1e-10?'Top Trader trung tính':
    Math.sign(topTraderDelta)===flow?'Top Trader cùng hướng':'Lệch Top Trader';
  return {...reading,topTraderDelta,topTraderContext};
}
