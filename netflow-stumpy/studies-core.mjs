import {trendSessionAt,trendSessionRows} from './trend-session.mjs?v=20261029-price-delta1';
import {analyze,composite,calculateVolumeStrength,STEPS,sessionAt} from './engine.mjs?v=20261029-price-delta1';
import {analyzeGeometry,analyzeBreakoutRetest,recentCausalLineStates,backtestGeometry} from './geometry.mjs?v=20261029-price-delta1';
import {pivotZones} from './pivot-zones.mjs?v=20261029-price-delta1';
import {causalTrendChannels} from './causal-trend-channel.mjs?v=20261029-price-delta1';
import {channelStrengthBoxes} from './channel-strength-boxes.mjs?v=20261029-weekly-map1';
import {weeklyTrendForecast,h1CandleColorStates} from './weekly-trend-map.mjs?v=20261031-h1-candle1';
import {preRthWlrTrend,historicalTrendAgeStates} from './pre-rth-wlr-trend.mjs?v=20261029-price-delta1';
import {chartFeatureRows} from './analogs-features.mjs?v=20261029-price-delta1';

export function analyzeTrendSource(raw,now){
  const closed=Object.fromEntries(['SPYUSDT','QQQUSDT'].map(s=>[s,(raw[s]??[]).filter(r=>r.end<now)])),step=STEPS['15m'];
  const rows={SPYUSDT:analyze(closed.SPYUSDT,step),QQQUSDT:analyze(closed.QQQUSDT,step),COMPOSITE:analyze(composite(closed.SPYUSDT,closed.QQQUSDT),step)};
  return {rows,volume:analyze(closed.SPYUSDT,step,{strength:calculateVolumeStrength(closed.SPYUSDT,step)})};
}
export function computeStudies({rows,volumeRows,symbol,interval,options,now,trend=null}){
  const p=rows[symbol]??[],closedPrice=p.filter(r=>(r.end??r.t)<now),times=new Set(closedPrice.map(r=>r.t));
  const input={price:closedPrice,spy:(rows.SPYUSDT??[]).filter(r=>times.has(r.t)),qqq:(rows.QQQUSDT??[]).filter(r=>times.has(r.t)),flow:(rows.COMPOSITE??[]).filter(r=>times.has(r.t)),volume:volumeRows.filter(r=>times.has(r.t))};
  const geometry=analyzeGeometry(input,options),channels=causalTrendChannels(closedPrice,{volumeRows:input.volume,maxHistory:12});
  // Same causal leg rules, lower display age only. Preview predicts whether a
  // 4–7 bar live candidate will survive to the normal eight-bar display age.
  const early=causalTrendChannels(closedPrice,{volumeRows:input.volume,minLegBars:4,maxHistory:12});
  channels.early=early.episodes.filter(c=>c.provisional&&c.bars>=4&&c.bars<8&&c.insideEndTime===closedPrice.at(-1)?.t).map(c=>({...c,early:true,targetMinBars:8}));
  const breakout=analyzeBreakoutRetest(input,options),points=recentCausalLineStates(input,{...options,stateLookbackBars:600},4),backtest=backtestGeometry(closedPrice,geometry.events,{horizon:4,minMoveAtr:.35});
  const model=interval==='15m'&&trend?trend:{rows,volume:volumeRows},modelPrice=(model.rows[symbol]??p).filter(r=>(r.end??r.t)<now),modelTimes=new Set(modelPrice.map(r=>r.t));
  const pivot=pivotZones({price:modelPrice,composite:(model.rows.COMPOSITE??[]).filter(r=>modelTimes.has(r.t)),volume:model.volume.filter(r=>modelTimes.has(r.t))},STEPS[interval]);
  const tRows=trend?.rows[symbol]??[],closedTrend=trendSessionRows(tRows.filter(r=>(r.end??r.t)<now)),trendTimes=new Set(closedTrend.map(r=>r.t)),trendVolume=(trend?.volume??[]).filter(r=>trendTimes.has(r.t));
  const channelState=causalTrendChannels(closedTrend.map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),{volumeRows:trendVolume,maxHistory:Infinity});
  const rev63=preRthWlrTrend({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,channelTrends:channelState.episodes??channelState.trends,requireChannel:true,now});
  const allTrendAgeHistory=interval==='15m'&&symbol==='SPYUSDT'?historicalTrendAgeStates({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,channelTrends:channelState.episodes,now,fromTime:-Infinity}):[];
  const trendAgeHistory=allTrendAgeHistory.filter(state=>state.t>=(closedPrice[0]?.t??Infinity));
  const weeklyBoxes=interval==='15m'&&symbol==='SPYUSDT'?channelStrengthBoxes(tRows,{channels:channelState.episodes,showEarly:false,back:8,now,step:STEPS['15m'],compositeRows:new Map((trend?.rows.COMPOSITE??[]).map(x=>[x.t,x])),volumeRows:new Map(trendVolume.map(x=>[x.t,x])),compositeMode:'annotate'}):{snapshots:new Map()};
  const weekly=interval==='15m'&&symbol==='SPYUSDT'?weeklyTrendForecast({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,boxSnapshots:weeklyBoxes.snapshots,trendStates:allTrendAgeHistory,now}):{ready:false,label:'WAIT',reason:'Weekly Trend Map chỉ chạy trên SPYUSDT M15'};
  const h1CandleColors=interval==='15m'&&symbol==='SPYUSDT'?h1CandleColorStates({priceRows:tRows,boxSnapshots:weeklyBoxes.snapshots,trendStates:allTrendAgeHistory,now}):[];
  const running=p.at(-1),runningEnd=running?.end??running?.t+899999,runningClock=Number.isFinite(running?.t)?trendSessionAt(running.t):null,nowClock=trendSessionAt(now);
  const hasLivePreview=interval==='15m'&&symbol==='SPYUSDT'&&rev63.active&&rev63.livePreview&&Number.isFinite(running?.t)&&running.t<=now&&runningEnd>=now&&running.t>(closedTrend.at(-1)?.t??-Infinity)&&runningClock?.active&&runningClock.day===nowClock.day;
  if(hasLivePreview)trendAgeHistory.push({t:running.t,...rev63.livePreview,reason:'Nến đang chạy · xem trước từ trend xác nhận ở nến đóng trước; chưa ghi vào cohort hoặc kết quả forward'});
  const displayRev63=hasLivePreview?{...rev63,...rev63.livePreview,groups:rev63.groups,livePreview:rev63.livePreview}:rev63;
  const historicalChannels=channelState.episodes.filter(c=>!trendSessionAt(now).active||new Date(c.startTime).toLocaleDateString('en-CA',{timeZone:'America/New_York'})!==new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'}));
  const dataInfo={currentSession:trendSessionAt(now).session??'OFF',firstTime:closedTrend[0]?.t??null,lastTime:closedTrend.at(-1)?.t??null,bars:closedTrend.length,days:new Set(closedTrend.map(r=>r.day)).size,channels:historicalChannels.length,displayQualified:historicalChannels.filter(c=>c.displayQualified).length};
  rev63.dataInfo=dataInfo;displayRev63.dataInfo=dataInfo;
  return {geometry,channels,breakout,points,backtest,pivot,rev63:displayRev63,trendAgeHistory,h1CandleColors,weekly};
}

