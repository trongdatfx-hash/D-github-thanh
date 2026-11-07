import {continuousH4Age} from './h4-trend-age.mjs?v=20261103-h4-age1';
import {aggregateHourlyRows} from './h1-h4-strip.mjs?v=20261101-h1h4-align1';
import {trendSessionAt,trendSessionRows} from './trend-session.mjs?v=20261029-price-delta1';
import {analyze,composite,calculateVolumeStrength,STEPS,sessionAt} from './engine.mjs?v=20261029-price-delta1';
import {analyzeGeometry,analyzeBreakoutRetest,recentCausalLineStates,backtestGeometry} from './geometry.mjs?v=20261103-pivot-wedge1';
import {pivotZones} from './pivot-zones.mjs?v=20261029-price-delta1';
import {causalTrendChannels} from './causal-trend-channel.mjs?v=20261029-price-delta1';
import {channelStrengthBoxes} from './channel-strength-boxes.mjs?v=20261029-weekly-map1';
import {weeklyTrendForecast,h1CandleColorStates} from './weekly-trend-map.mjs?v=20261103-day247-1';
import {preRthWlrTrend,historicalTrendAgeStates} from './pre-rth-wlr-trend.mjs?v=20261103-spy-restore1';
import {chartFeatureRows} from './analogs-features.mjs?v=20261029-price-delta1';
import {h1AdaptiveVolumeRows} from './spy-volume-h1.mjs?v=20261105-spyv-h1-1';
import {analyzeMatrixGeometry} from './matrix-geometry.mjs?v=20261107-matrix-2m15-1';

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
export function trendAgeVolumeRows(trend,h1CandleColors,{useH1Smooth=false,now=Date.now()}={}){
  if(!useH1Smooth||!trend?.rawSpy?.length)return {rows:trend?.volume??[],source:'SPY_V_ORIGINAL'};
  const states=new Map((h1CandleColors??[]).map(state=>[state.t,state]));
  return {rows:h1AdaptiveVolumeRows(trend.rawSpy,states,{step:STEPS['15m'],now}),source:'SPY_V_H1_SMOOTH'};
}
export function computeStudies({rows,volumeRows,symbol,interval,options,now,trend=null,onH1Ready=null,useH1Smooth=false,geometryOi=new Map(),matrixReplayState=null}){
  const p=rows[symbol]??[],closedPrice=p.filter(r=>(r.end??r.t)<now),times=new Set(closedPrice.map(r=>r.t));
  const input={price:closedPrice,spy:(rows.SPYUSDT??[]).filter(r=>times.has(r.t)),qqq:(rows.QQQUSDT??[]).filter(r=>times.has(r.t)),flow:(rows.COMPOSITE??[]).filter(r=>times.has(r.t)),volume:volumeRows.filter(r=>times.has(r.t))};
  const tRows=trend?.rows[symbol]??[],closedTrend=trendSessionRows(tRows.filter(r=>(r.end??r.t)<now)),trendTimes=new Set(closedTrend.map(r=>r.t)),trendVolume=(trend?.volume??[]).filter(r=>trendTimes.has(r.t));
  const channelState=causalTrendChannels(closedTrend.map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),{volumeRows:trendVolume,maxHistory:Infinity});
  const allTrendAgeHistory=interval==='15m'&&symbol==='SPYUSDT'?historicalTrendAgeStates({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,channelTrends:channelState.episodes,now,fromTime:-Infinity}):[];
  const weeklyBoxes=interval==='15m'&&symbol==='SPYUSDT'?channelStrengthBoxes(tRows,{channels:channelState.episodes,showEarly:false,back:8,now,step:STEPS['15m'],compositeRows:new Map((trend?.rows.COMPOSITE??[]).map(x=>[x.t,x])),volumeRows:new Map(trendVolume.map(x=>[x.t,x])),compositeMode:'annotate'}):{snapshots:new Map()};
  let h1CandleColors=[],h1H4CandleColors=[];
  if(symbol==='SPYUSDT'&&interval==='15m'){
    h1CandleColors=h1CandleColorStates({priceRows:tRows,boxSnapshots:weeklyBoxes.snapshots,trendStates:allTrendAgeHistory,volumeRows:trend?.volume??[],now,sourceStep:STEPS['15m'],boxHours:1});
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
  // H1 colors are the causal seed for the experimental smoothing schedule.
  // Only the age model is recomputed with the smoothed SPY V, avoiding a
  // circular dependency between H1 colors and their own smoothed input.
  const ageVolumeState=trendAgeVolumeRows(trend,h1CandleColors,{useH1Smooth,now}),ageVolume=ageVolumeState.rows;
  const ageChannelState=useH1Smooth?causalTrendChannels(closedTrend.map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),{volumeRows:ageVolume,maxHistory:Infinity}):channelState;
  const ageTrendHistory=interval==='15m'&&symbol==='SPYUSDT'?historicalTrendAgeStates({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:ageVolume,channelTrends:ageChannelState.episodes,now,fromTime:-Infinity}):allTrendAgeHistory;
  const matrixEnabled=options.matrixGeometry===true&&symbol==='SPYUSDT'&&interval==='15m';
  const geometry=matrixEnabled?analyzeMatrixGeometry({...input,h1CandleColors,oiByTime:geometryOi},{...options,replayState:matrixReplayState}):analyzeGeometry({...input,h1CandleColors},options),channels=causalTrendChannels(closedPrice,{volumeRows:input.volume,maxHistory:12});
  const breakout=matrixEnabled?geometry.breakout:analyzeBreakoutRetest(input,options),points=matrixEnabled?geometry.points:recentCausalLineStates(input,{...options,stateLookbackBars:600},4),backtest=backtestGeometry(closedPrice,geometry.events,{horizon:4,minMoveAtr:.35});
  const model=interval==='15m'&&trend?trend:{rows,volume:volumeRows},modelPrice=(model.rows[symbol]??p).filter(r=>(r.end??r.t)<now),modelTimes=new Set(modelPrice.map(r=>r.t));
  const pivot=pivotZones({price:modelPrice,composite:(model.rows.COMPOSITE??[]).filter(r=>modelTimes.has(r.t)),volume:model.volume.filter(r=>modelTimes.has(r.t))},STEPS[interval]);
  const rev63=preRthWlrTrend({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:ageVolume,channelTrends:ageChannelState.episodes??ageChannelState.trends,requireChannel:true,now});
  const trendAgeHistory=ageTrendHistory.filter(state=>state.t>=(closedPrice[0]?.t??Infinity));
  const weekly=interval==='15m'&&symbol==='SPYUSDT'?weeklyTrendForecast({priceRows:[...tRows,...p.filter(r=>r.t<=now&&(r.end??r.t+899999)>=now&&r.t>(tRows.at(-1)?.t??-Infinity))],strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,boxSnapshots:weeklyBoxes.snapshots,trendStates:allTrendAgeHistory,now}):{ready:false,label:'WAIT',reason:'Weekly Trend Map chỉ chạy trên SPYUSDT M15'};
  weekly.h4Age=continuousH4Age(h1H4CandleColors,now);
  const running=p.at(-1),runningEnd=running?.end??running?.t+899999,runningClock=Number.isFinite(running?.t)?trendSessionAt(running.t):null,nowClock=trendSessionAt(now);
  const hasLivePreview=interval==='15m'&&symbol==='SPYUSDT'&&rev63.active&&rev63.livePreview&&Number.isFinite(running?.t)&&running.t<=now&&runningEnd>=now&&running.t>(closedTrend.at(-1)?.t??-Infinity)&&runningClock?.active&&runningClock.day===nowClock.day;
  if(hasLivePreview)trendAgeHistory.push({t:running.t,...rev63.livePreview,reason:'Nến đang chạy · xem trước từ trend xác nhận ở nến đóng trước; chưa ghi vào cohort hoặc kết quả forward'});
  const displayRev63=hasLivePreview?{...rev63,...rev63.livePreview,groups:rev63.groups,livePreview:rev63.livePreview}:rev63;
  const historicalChannels=channelState.episodes.filter(c=>!trendSessionAt(now).active||new Date(c.startTime).toLocaleDateString('en-CA',{timeZone:'America/New_York'})!==new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'}));
  const dataInfo={currentSession:trendSessionAt(now).session??'OFF',firstTime:closedTrend[0]?.t??null,lastTime:closedTrend.at(-1)?.t??null,bars:closedTrend.length,days:new Set(closedTrend.map(r=>r.day)).size,channels:historicalChannels.length,displayQualified:historicalChannels.filter(c=>c.displayQualified).length};
  rev63.dataInfo=dataInfo;displayRev63.dataInfo=dataInfo;
  return {geometry,channels,breakout,points,backtest,pivot,rev63:displayRev63,trendAgeHistory,h1CandleColors,h1H4CandleColors,weekly,trendAgeVolumeSource:ageVolumeState.source};
}


