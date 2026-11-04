import {oiDeltaGates} from './oi-delta-gate.mjs?v=20261104-oi-ten1';
import {oiSpectrumDay} from './oi-spectrum.mjs?v=20261104-oi-smooth1';

export const OI_GROUP_LABELS={
  'up-oi-increase':'TĂNG · MUA CHỦ ĐỘNG · OI TĂNG',
  'up-oi-decrease':'TĂNG · MUA CHỦ ĐỘNG · OI GIẢM',
  'down-oi-increase':'GIẢM · BÁN CHỦ ĐỘNG · OI TĂNG',
  'down-oi-decrease':'GIẢM · BÁN CHỦ ĐỘNG · OI GIẢM'
};

// Only a clearly dominant rejection wick overrides the OHLC body direction.
// The actual SPY V histogram is never rewritten to manufacture agreement.
export function oiCandleDirection(row, filterPin=true){
  const {o,h,l,c}=row;
  if(![o,h,l,c].every(Number.isFinite)||h<=l||h<Math.max(o,c)||l>Math.min(o,c))return 0;
  const body=Math.abs(c-o),span=h-l,upper=h-Math.max(o,c),lower=Math.min(o,c)-l;
  if(body===0)return 0;
  if(filterPin&&body/span<=.35){
    if(lower/span>=.6&&lower>=2*upper)return 1;
    if(upper/span>=.6&&upper>=2*lower)return -1;
  }
  return Math.sign(c-o);
}

export function oiCandleBars(priceRows,spyHistogram,flowRows,oiByTime,step,now,{filterPin=true,history=false,minOiMultiplier=0}={}){
  const result={data:[],points:new Map(),eligible:0,matched:0,downOiIncrease:0,gateReady:0,groups:{},day:null};
  if(!(step>0)||!Number.isFinite(now)||now<=0)return result;
  result.day=oiSpectrumDay(now);
  const gates=minOiMultiplier>0?oiDeltaGates(oiByTime,step,now,{multiplier:minOiMultiplier}):null;
  const volume=new Map(spyHistogram.map(x=>[x.t,x.value])),flow=new Map(flowRows.map(x=>[x.t,x.net]));
  for(const row of priceRows){
    const point={time:row.t/1000};result.data.push(point);
    // Cheap bound before timezone formatting; a NY day is at most 25 hours.
    if(!Number.isFinite(row.end)||row.end>=now)continue;
    if(!history&&(row.t<now-26*3600000||oiSpectrumDay(row.t)!==result.day))continue;
    const current=oiByTime.get(row.t),previous=oiByTime.get(row.t-step);
    if(!current||!previous||![current.oi,previous.oi].every(x=>Number.isFinite(x)&&x>0))continue;
    const delta=current.oi-previous.oi,v=volume.get(row.t),nf=flow.get(row.t);
    if(!Number.isFinite(v)||!Number.isFinite(nf))continue;
    result.eligible++;
    const direction=oiCandleDirection(row,filterPin),agreement=direction!==0&&[v,nf,row.c-row.o].every(x=>Math.sign(x)===direction)&&delta!==0;
    const kind=agreement?`${direction>0?'up':'down'}-oi-${delta>0?'increase':'decrease'}`:null;
    const gate=gates?.get(row.t),gateReady=!gates||gate?.ready===true,gatePassed=!gates||gate?.passed===true;
    if(gateReady)result.gateReady++;
    const matched=Boolean(kind)&&gatePassed;
    const info={delta,direction,spyV:v,net:nf,matched,kind,gateReady,gatePassed,threshold:gate?.threshold??null,baseline:gate?.baseline??null,pinAdjusted:direction!==Math.sign(row.c-row.o)};
    result.points.set(row.t,info);
    if(!matched)continue;
    result.matched++;result.groups[kind]=(result.groups[kind]??0)+1;if(kind==='down-oi-increase')result.downOiIncrease++;
    point.value=Math.abs(delta);point.color=direction>0?'rgba(26,224,163,.72)':'rgba(255,77,112,.72)';
  }
  return result;
}
