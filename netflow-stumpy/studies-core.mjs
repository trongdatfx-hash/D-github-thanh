import {analyze,composite,calculateVolumeStrength,STEPS,sessionAt} from './engine.mjs';
import {analyzeGeometry,analyzeBreakoutRetest,recentCausalLineStates,backtestGeometry} from './geometry.mjs';
import {pivotZones} from './pivot-zones.mjs';
import {causalTrendChannels} from './causal-trend-channel.mjs';
import {preRthWlrTrend} from './pre-rth-wlr-trend.mjs?v=20261020-aeon1';
import {chartFeatureRows} from './analogs-features.mjs?v=20261020-ensemble1';

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
  const tRows=trend?.rows[symbol]??[],closedTrend=tRows.filter(r=>(r.end??r.t)<now),trendTimes=new Set(closedTrend.map(r=>r.t)),trendVolume=(trend?.volume??[]).filter(r=>trendTimes.has(r.t));
  const channelState=causalTrendChannels(closedTrend,{volumeRows:trendVolume,maxHistory:Infinity});
  const rev63=preRthWlrTrend({priceRows:tRows,strengthRows:trend?.rows.COMPOSITE??[],volumeRows:trendVolume,channelTrends:channelState.episodes??channelState.trends,requireChannel:true,now});
  const historicalChannels=channelState.episodes.filter(c=>new Date(c.startTime).toLocaleDateString('en-CA',{timeZone:'America/New_York'})!==new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'}));
  rev63.dataInfo={currentSession:sessionAt(now).session,firstTime:closedTrend[0]?.t??null,lastTime:closedTrend.at(-1)?.t??null,bars:closedTrend.length,days:new Set(closedTrend.filter(r=>['PRE','RTH'].includes(r.session)).map(r=>r.day)).size,channels:historicalChannels.length,displayQualified:historicalChannels.filter(c=>c.displayQualified).length};
  const features=interval==='15m'?chartFeatureRows(model.rows[symbol]??[],model.rows.COMPOSITE??[],model.volume,{now}):[];
  return {geometry,channels,breakout,points,backtest,pivot,rev63,features};
}
