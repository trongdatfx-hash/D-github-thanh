const STEP=900000,HOUR=4*STEP;
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

export function matrixOi8Reading(bars, points, now, topTrader=new Map(), {window=4,h1Scores=[],h1Colors=new Map()}={}){
  const count=window===6?6:4,required=count===6?5:3;
  let end=bars.length-1;
  while(end>=0&&bars[end].t+STEP>now)end--;
  const current=bars[end],first=end-count+1;
  if(first<0||current.t+2*STEP<=now)return WAIT;
  const sample=bars.slice(first,end+1);
  const values=[],states=[],votes={openLong:0,openShort:0,closeLong:0,closeShort:0,neutral:0,unclear:0};
  for(const [i,bar] of sample.entries()){
    const point=points[first+i];
    if(bar.sourceComplete===false||bar.t!==current.t-(count-1-i)*STEP||
        point?.time!==bar.t/1000||!Number.isFinite(point.value))return WAIT;
    const oi=point.value;
    values.push(oi);
    if(Math.abs(oi)<DEAD_ZONE){states.push('neutral');votes.neutral++;continue;}
    if(![bar.o,bar.c,bar.buy,bar.q].every(Number.isFinite)){states.push('unclear');votes.unclear++;continue;}
    const price=Math.sign(bar.c-bar.o),net=Math.sign(2*bar.buy-bar.q);
    if(price!==net||!price){states.push('unclear');votes.unclear++;continue;}
    const key=oi>0?(price>0?'openLong':'openShort'):(price>0?'closeShort':'closeLong');
    states.push(key);
    votes[key]++;
  }
  let winner=Object.keys(STATES).find(key=>votes[key]>=required);
  let h1Support=null;
  const recent=states.at(-1),flowHint=STATES[recent]?.flow;
  if(!winner&&count===4&&flowHint&&recent===states.at(-2)){
    const close=current.t+STEP,lockedEnd=Math.floor(close/HOUR)*HOUR,start=lockedEnd-HOUR;
    const color=h1Colors.get(start);
    const score=h1Scores.findLast(row=>row.blockStart===start&&row.status==='LOCKED'&&
      row.lockedAt===lockedEnd&&row.asOf===lockedEnd);
    if(color?.preview===false&&color.blockStart===start&&color.blockEnd===lockedEnd-1&&
        color.direction===flowHint&&Number.isFinite(score?.score)&&score.score*flowHint>=2){
      winner=recent;
      h1Support={score:score.score,direction:flowHint,lockedAt:lockedEnd};
    }
  }
  if(!winner)return {state:'mixed',label:'Vị thế hỗn hợp',values,votes};
  const {label,flow}=STATES[winner];
  const reading={state:winner,label:`${label} ${votes[winner]}/${count}${h1Support?' · H1':''}`,values,votes,h1Support};
  if(!flow)return reading;
  const shares=[topTrader.get(sample[0].t),...sample.map(bar=>topTrader.get(bar.t+STEP))];
  const topTraderDelta=shares.every(x=>Number.isFinite(x)&&x>=0&&x<=1)?shares.at(-1)-shares[0]:null;
  const topTraderContext=topTraderDelta===null?'Chờ Top Trader':
    Math.abs(topTraderDelta)<TOP_TRADER_DEAD_ZONE-1e-10?'Top Trader trung tính':
    Math.sign(topTraderDelta)===flow?'Top Trader cùng hướng':'Lệch Top Trader';
  return {...reading,topTraderDelta,topTraderContext};
}

const POSITION_CACHE_KEY='netflow:spyusdt:m15:last-position:v1';
const POSITION_LABEL=/^Nghi (?:mở|đóng) (?:Long|Short) (?:[34]\/4|2\/4 · H1)$/u;

export function createM15PositionMemory(storage){
  let label;
  return reading=>{
    if(label===undefined){
      try{label=storage?.getItem(POSITION_CACHE_KEY)??'';}catch{label='';}
      if(!POSITION_LABEL.test(label))label='';
    }
    if(reading.state==='wait'&&label)return {state:'stale',label:label+' · cũ'};
    if(POSITION_LABEL.test(reading.label)&&reading.label!==label){
      label=reading.label;
      try{storage?.setItem(POSITION_CACHE_KEY,label);}catch{/* Retain in memory. */}
    }
    return reading;
  };
}
