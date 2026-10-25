import {trendSessionAt,trendSessionRows} from './trend-session.mjs?v=20261025-dcommon-all1';
import {chartWlrRows} from './wlr-aba-core.mjs?v=20261025-dcommon-all1';
import {analyze,composite,calculateVolumeStrength,STEPS,sessionAt} from './engine.mjs?v=20261025-dcommon-all1';
import {analyzeGeometry,analyzeBreakoutRetest,recentCausalLineStates,backtestGeometry} from './geometry.mjs?v=20261025-dcommon-all1';
import {pivotZones} from './pivot-zones.mjs?v=20261025-dcommon-all1';
import {causalTrendChannels} from './causal-trend-channel.mjs?v=20261025-dcommon-all1';
import {preRthWlrTrend,historicalTrendAgeStates} from './pre-rth-wlr-trend.mjs?v=20261025-trend-history1';
import {chartFeatureRows} from './analogs-features.mjs?v=20261025-dcommon-all1';

export function analyzeTrendSource(raw,now){
  const closed=Object.fromEntries(['SPYUSDT','QQQUSDT'].map(s=>[s,(raw[s]??[]).filter(r=>r.end<now)])),step=STEPS['15m'];
  const rows={SPYUSDT:analyze(closed.SPYUSDT,step),QQQUSDT:analyze(closed.QQQUSDT,step),COMPOSITE:analyze(composite(closed.SPYUSDT,closed.QQQUSDT),step)};
  return {rows,volume:analyze(closed.SPYUSDT,step,{strength:calculateVolumeStrength(closed.SPYUSDT,step)})};
}
export function computeStudies({rows,volumeRows,symbol,interval,options,now,trend=null}){
  const p=rows[symbol]??[],closedPrice=p.filter(r=>(r.end??r.t)<now),times=new Set(closedPrice.map(r=>r.t));
  const input={price:closedPrice,spy:(rows.SPYUSDT??[]).filter(r=>times.has(r.t)),qqq:(rows.QQQUSDT??[]).filter(r=>times.has(r.t)),flow:(rows.COMPOSITE??[]).filter(r=>times.has(r.t)),volume:volumeRows.filter(r=>times.has(r.t))};
  const geometry=analyzeGeometry(input,options),channels=causalTrendChannels(closedPrice,{volumeRows:input.volume,maxHistory:12});
  const breakout=analyzeBreakoutRetest(input,options),points=recentCausalLineStates(input,{...options,stateLookbackBars:600},4),backtest=backtestGeometry(closedPrice,geometry.events,{horizon:4,minMoveAtr:.35});
  const model=interval==='15m'&&trend?trend:{rows,volume:volumeRows},modelPrice=(model.rows[symbol]??p).filter(r=>(r.end??r.t)<now),modelTimes=new Set(modelPrice.map(r=>r.t));
  const pivot=pivotZones({price:modelPrice,composite:(model.rows.COMPOSITE??[]).filter(r=>modelTimes.has(r.t)),volume:model.volume.filter(r=>modelTimes.has(r.t))},STEPS[interval]);
  const tRows=trend?.rows[symbol]??[],closedTrend=trendSessionRows(tRows.filter(r=>(r.end??r.t)<now)),trendTimes=new Set(closedTrend.map(r=>r.t)),trendVolume=(trend?.volume??[]).filter(r=>trendTimes.has(r.t));
  const channelState=causalTrendChannels(closedTrend.map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),{volumeRows:trendVolume,maxHistory:Infinity});
  const rev63=preRthWlrTrend({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,channelTrends:channelState.episodes??channelState.trends,requireChannel:true,now});
  const trendAgeHistory=interval==='15m'&&symbol==='SPYUSDT'?historicalTrendAgeStates({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,channelTrends:channelState.episodes,now,fromTime:closedPrice[0]?.t??Infinity}):[];
  const historicalChannels=channelState.episodes.filter(c=>!trendSessionAt(now).active||new Date(c.startTime).toLocaleDateString('en-CA',{timeZone:'America/New_York'})!==new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'}));
  rev63.dataInfo={currentSession:trendSessionAt(now).session??'OFF',firstTime:closedTrend[0]?.t??null,lastTime:closedTrend.at(-1)?.t??null,bars:closedTrend.length,days:new Set(closedTrend.map(r=>r.day)).size,channels:historicalChannels.length,displayQualified:historicalChannels.filter(c=>c.displayQualified).length};
  const features=interval==='15m'?chartFeatureRows(model.rows[symbol]??[],model.rows.COMPOSITE??[],model.volume,{now}):[];
  const abaRows=interval==='15m'&&symbol==='SPYUSDT'?chartWlrRows(modelPrice,features):[];
  return {geometry,channels,breakout,points,backtest,pivot,rev63,abaRows,trendAgeHistory};
}
