import {continuousH4Age} from './h4-trend-age.mjs?v=20261103-h4-age1';
import {aggregateHourlyRows} from './h1-h4-strip.mjs?v=20261101-h1h4-align1';
import {trendSessionAt,trendSessionRows} from './trend-session.mjs?v=20261029-price-delta1';
import {analyze,composite,calculateVolumeStrength,STEPS,sessionAt} from './engine.mjs?v=20261029-price-delta1';
import {analyzeGeometry,analyzeBreakoutRetest,recentCausalLineStates,backtestGeometry} from './geometry.mjs?v=20261108-price-break-only1';
import {stopLossZones} from './stop-loss-zones.mjs?v=20261114-sl1';
import {causalTrendChannels} from './causal-trend-channel.mjs?v=20261029-price-delta1';
import {channelStrengthBoxes} from './channel-strength-boxes.mjs?v=20261029-weekly-map1';
import {buildWeeklyDailyPackets,h1CandleColorStates} from './weekly-trend-map.mjs?v=20261103-day247-1';
import {chartFeatureRows} from './analogs-features.mjs?v=20261029-price-delta1';
import {analyzeMatrixGeometry} from './matrix-geometry.mjs?v=20261114-trend-oi8-50';

const H1_MS=STEPS['1h'];
function aggregateHourlySignals(rows=[],hourlyRows=[]){
  const byHour=new Map();
  for(const row of rows){const key=Math.floor(row.t/H1_MS)*H1_MS;if(!byHour.has(key))byHour.set(key,[]);if(Number.isFinite(row.adjusted))byHour.get(key).push(row.adjusted);}
  return hourlyRows.map(hour=>{const values=byHour.get(hour.t)??[];return {t:hour.t,end:hour.end,adjusted:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null};});
}

export function analyzeTrendSource(raw,now){
  const closed=Object.fromEntries(['SPYUSDT','QQQUSDT'].map(s=>[s,(raw[s]??[]).filter(r=>r.end<now)])),step=STEPS['15m'];
  const rows={SPYUSDT:analyze(closed.SPYUSDT,step),QQQUSDT:analyze(closed.QQQUSDT,step),COMPOSITE:analyze(composite(closed.SPYUSDT,closed.QQQUSDT),step)};
  return {rows,rawSpy:closed.SPYUSDT,volume:analyze(closed.SPYUSDT,step,{strength:calculateVolumeStrength(closed.SPYUSDT,step)})};
}
export function computeStudies({rows,volumeRows,symbol,interval,options,now,trend=null,onH1Ready=null,useH1Smooth=false,geometryOi=new Map(),matrixReplayState=null,geometryOiSamples=[]}){
  const p=rows[symbol]??[],closedPrice=p.filter(r=>(r.end??r.t)<now),times=new Set(closedPrice.map(r=>r.t));
  const input={price:closedPrice,spy:(rows.SPYUSDT??[]).filter(r=>times.has(r.t)),qqq:(rows.QQQUSDT??[]).filter(r=>times.has(r.t)),flow:(rows.COMPOSITE??[]).filter(r=>times.has(r.t)),volume:volumeRows.filter(r=>times.has(r.t))};
  const tRows=trend?.rows[symbol]??[],closedTrend=trendSessionRows(tRows.filter(r=>(r.end??r.t)<now)),trendTimes=new Set(closedTrend.map(r=>r.t)),trendVolume=(trend?.volume??[]).filter(r=>trendTimes.has(r.t));
  const channelState=causalTrendChannels(closedTrend.map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),{volumeRows:trendVolume,maxHistory:Infinity});
  const channelStates=channelState.episodes.flatMap(c=>(c.points??[]).filter(p=>p.time>=c.confirmationTime).map(p=>({t:p.time,active:true,direction:c.direction})));
  const weeklyBoxes=interval==='15m'&&symbol==='SPYUSDT'?channelStrengthBoxes(tRows,{channels:channelState.episodes,showEarly:false,back:8,now,step:STEPS['15m'],compositeRows:new Map((trend?.rows.COMPOSITE??[]).map(x=>[x.t,x])),volumeRows:new Map(trendVolume.map(x=>[x.t,x])),compositeMode:'annotate'}):{snapshots:new Map()};
  let h1CandleColors=[],h1H4CandleColors=[];
  if(symbol==='SPYUSDT'&&interval==='15m'){
    h1CandleColors=h1CandleColorStates({priceRows:tRows,boxSnapshots:weeklyBoxes.snapshots,trendStates:channelStates,volumeRows:trend?.volume??[],now,sourceStep:STEPS['15m'],boxHours:1});
    const h1Rows=aggregateHourlyRows(tRows,now),h1Closed=h1Rows.filter(row=>row.sourceComplete&&row.end<now),h1Volume=aggregateHourlySignals(trend?.volume??[],h1Rows),h1Composite=aggregateHourlySignals(trend?.rows.COMPOSITE??[],h1Rows);
    const h1Channels=causalTrendChannels(h1Closed,{volumeRows:h1Volume,maxHistory:64});
    const h4Boxes=channelStrengthBoxes(h1Closed,{channels:h1Channels.episodes,showEarly:false,back:8,now,step:H1_MS,compositeRows:new Map(h1Composite.map(row=>[row.t,row])),volumeRows:new Map(h1Volume.map(row=>[row.t,row])),compositeMode:'annotate'});
    h1H4CandleColors=h1CandleColorStates({priceRows:h1Rows,boxSnapshots:h4Boxes.snapshots,volumeRows:h1Volume,now,sourceStep:H1_MS,boxHours:4});
  }else if(symbol==='SPYUSDT'&&interval==='1h'){
    const h1Channels=causalTrendChannels(closedPrice,{volumeRows:input.volume,maxHistory:64});
    const h4Boxes=channelStrengthBoxes(closedPrice,{channels:h1Channels.episodes,showEarly:false,back:8,now,step:H1_MS,compositeRows:new Map(input.flow.map(x=>[x.t,x])),volumeRows:new Map(input.volume.map(x=>[x.t,x])),compositeMode:'annotate'});
    h1CandleColors=h1CandleColorStates({priceRows:p,boxSnapshots:h4Boxes.snapshots,volumeRows:input.volume,now,sourceStep:H1_MS,boxHours:4});
    h1H4CandleColors=h1CandleColors;
  }
  if(typeof onH1Ready==='function')onH1Ready(h1CandleColors,h1H4CandleColors);
  const matrixEnabled=options.matrixGeometry===true&&symbol==='SPYUSDT'&&interval==='15m';
  const geometry=matrixEnabled?analyzeMatrixGeometry({...input,h1CandleColors,oiByTime:geometryOi,oiSamples:geometryOiSamples},{...options,replayState:matrixReplayState}):analyzeGeometry({...input,h1CandleColors},options),channels=causalTrendChannels(closedPrice,{volumeRows:input.volume,maxHistory:12});
  const breakout=matrixEnabled?geometry.breakout:analyzeBreakoutRetest(input,options),points=matrixEnabled?geometry.points:recentCausalLineStates(input,{...options,stateLookbackBars:600},4),backtest=backtestGeometry(closedPrice,geometry.events,{horizon:4,minMoveAtr:.35});
  const model=interval==='15m'&&trend?trend:{rows,volume:volumeRows},modelPrice=(model.rows[symbol]??p).filter(r=>(r.end??r.t)<now),modelTimes=new Set(modelPrice.map(r=>r.t));
  const pivot=stopLossZones({price:modelPrice,oiSamples:geometryOiSamples,h1CandleColors,volume:model.volume.filter(r=>modelTimes.has(r.t))},STEPS[interval]);
  const packets=interval==='15m'&&symbol==='SPYUSDT'?buildWeeklyDailyPackets({priceRows:[...tRows,...p.filter(r=>r.t<=now&&(r.end??r.t+899999)>=now&&r.t>(tRows.at(-1)?.t??-Infinity))],strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,boxSnapshots:weeklyBoxes.snapshots,trendStates:channelStates,now}):[];
  const latestDay=packets.at(-1)?.week,weekly={label:'WAIT',cells:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(name=>({name,packet:packets.filter(p=>p.week===latestDay).find(p=>p.weekday===name)??null}))};
  weekly.h4Age=continuousH4Age(h1H4CandleColors,now);
  return {geometry,channels,breakout,points,backtest,pivot,h1CandleColors,h1H4CandleColors,weekly};
}
