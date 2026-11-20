import {reversalTrendReadings} from './spy-body-reversal-trend.mjs?v=20261120-v2-hold2';
import {sessionAt} from './engine.mjs?v=20261118-wlr-band-slope';

const STEP=900000,EPS=1e-9;
const validBar=b=>b.sourceComplete!==false&&[b.t,b.o,b.h,b.l,b.c].every(Number.isFinite)&&b.l>0&&b.l<=Math.min(b.o,b.c)&&b.h>=Math.max(b.o,b.c);

export function reversalEntryAllowed(time,entryWindow='PRE_POST'){
  if(entryWindow==='ALL')return true;
  return ['PRE','RTH','POST'].includes(sessionAt(time).session);
}

export function summarizeReversalTrades(trades){
  let gains=0,losses=0,equity=0,peak=0,drawdownPoints=0;
  for(const t of trades){
    if(t.netPoints>EPS)gains+=t.netPoints;else if(t.netPoints< -EPS)losses-=t.netPoints;
    equity+=t.netPoints;peak=Math.max(peak,equity);drawdownPoints=Math.max(drawdownPoints,peak-equity);
  }
  const wins=trades.filter(t=>t.netPoints>EPS).length,losing=trades.filter(t=>t.netPoints< -EPS).length;
  return {count:trades.length,wins,losses:losing,flat:trades.length-wins-losing,
    winRate:trades.length?100*wins/trades.length:null,
    tp:trades.filter(t=>t.reason==='TP_SIGNAL').length,flip:trades.filter(t=>t.reason==='SPY_FLIP').length,
    grossPoints:trades.reduce((s,t)=>s+t.grossPoints,0),netPoints:equity,
    meanPoints:trades.length?equity/trades.length:null,
    profitFactor:losses>EPS?gains/losses:gains>EPS?Infinity:null,drawdownPoints,
    meanBars:trades.length?trades.reduce((s,t)=>s+t.heldBars,0)/trades.length:null};
}

// One position at a time. Signals require a closed SPY-body sign flip and a
// valid first V2 level on that candle. Entry is the next observed candle open.
// Optional trend filter waits at most 3 more closed candles for two aligned
// SPY signs, strength >= .15 growing, and a causal WLR-8 slope/price agreement.
// The second same-phase V2 point may take TP only after minHoldBars complete
// candles since entry. If it arrives early, wait for a closed SPY-body flip
// instead, even if later same-phase levels appear. Optional holdStrongTrend
// defers an eligible V2 exit while closed SPY sign, causal WLR-8 slope and
// price group remain aligned; releases next open after two weak closes.
// There is no stop-loss exit.
export function backtestReversalTrades({bars=[],bodyRows=[],points=[],now=Date.now(),step=STEP,roundTripBps=0,entryWindow='PRE_POST',minHoldBars=4,trendFilter=false,holdStrongTrend=false}={}){
  if(!Number.isFinite(now)||!Number.isFinite(step)||step<=0||!Number.isFinite(roundTripBps)||roundTripBps<0||!['PRE_POST','ALL'].includes(entryWindow)||typeof trendFilter!=='boolean'||typeof holdStrongTrend!=='boolean'||!Number.isInteger(minHoldBars)||minHoldBars<0)throw Error('Invalid reversal backtest parameters');
  const ordered=[...new Map(bars.filter(b=>Number.isFinite(b.t)&&b.t<=now).map(b=>[b.t,b])).values()].sort((a,b)=>a.t-b.t);
  const trendReadings=trendFilter||holdStrongTrend?reversalTrendReadings(ordered,bodyRows,{step}):new Map();
  const readings=new Map(bodyRows.map(r=>[r.t,r.adjusted]));
  const levels=new Map(points.filter(p=>!p.preview&&Number.isFinite(p.time)&&Number.isFinite(p.value)&&p.value>0).map(p=>[p.time*1000,p]));
  const trades=[],censored=[],skipped={noFirstLine:0,overlap:0,gapEntry:0,invalidData:0,outsideSession:0,weakTrend:0,confirmedTrend:0};
  let position=null,entryPlan=null,setup=null,previous=null,lastSign=0,phase=0,signals=0,inSessionSignals=0,closedBars=0;
  function finish(bar,value,reason){
    const p=position,grossPoints=p.direction*(value-p.entry),costPoints=(p.entry+value)*roundTripBps/20000;
    trades.push({...p,exit:value,exitTime:bar.t,exitKnownAt:bar.t,reason,
      grossPoints,costPoints,netPoints:grossPoints-costPoints,
      heldBars:Math.max(0,(bar.t-p.entryTime)/step),intrabar:false});
    position=null;
  }
  function breakData(reason){
    if(position)censored.push({...position,reason,lastObservedTime:previous?.t??null});
    if(entryPlan)skipped.gapEntry++;
    position=null;entryPlan=null;setup=null;lastSign=0;phase++;previous=null;
  }
  for(const bar of ordered){
    const closed=bar.t+step<=now;
    if(previous&&bar.t!==previous.t+step)breakData('DATA_GAP');
    if(!validBar(bar)){skipped.invalidData++;breakData('INVALID_DATA');continue;}

    // Only a confirmed sign flip or eligible second V2 point can queue an exit.
    if(position?.tpDue===bar.t)finish(bar,bar.o,position.pendingReason);
    if(entryPlan){
      const plan=entryPlan;entryPlan=null;
      if(plan.due!==bar.t)skipped.gapEntry++;
      else if(!reversalEntryAllowed(bar.t,entryWindow))skipped.outsideSession++;
      else if(position)skipped.overlap++;
      else position={...plan,entry:bar.o,entryTime:bar.t,tpDue:null,tpSignalTime:null,tpExpired:false,waitForFlip:false,holdingTrend:false,weakTrendBars:0,deferredTpTime:null,pendingReason:null};
    }
    // The live OPEN is already observable. Its evolving high/low and sign
    // never generate closed statistics or a second TP point.
    if(!closed)break;
    closedBars++;

    const value=readings.get(bar.t),sign=Number.isFinite(value)?Math.sign(value):null;
    const flipped=Boolean(sign&&lastSign&&sign!==lastSign);
    if(sign===null){lastSign=0;phase++;if(position)position.tpExpired=true;}
    else if(sign){if(!lastSign||flipped)phase++;lastSign=sign;}
    if(position&&phase!==position.phase)position.tpExpired=true;

    // A confirmed opposite SPY sign closes an existing position, with or
    // without an early TP point. This is not subject to the TP minimum or
    // the entry-session window. Live color changes cannot close a trade.
    if(position&&flipped&&sign===-position.direction){
      position.tpDue=bar.t+step;position.pendingReason='SPY_FLIP';position.flipSignalTime=bar.t;
    }

    const level=levels.get(bar.t),known=level&&(!Number.isFinite(level.knownAt)||level.knownAt<=bar.t+step)?level:null;
    if(position&&known&&!position.holdingTrend&&!position.tpExpired&&!position.waitForFlip&&phase===position.phase&&sign===position.direction&&known.direction===position.direction&&bar.t>position.signalTime){
      const heldAtExit=(bar.t+step-position.entryTime)/step;
      position.secondLine=known.value;position.tpSignalTime=bar.t;
      if(heldAtExit>=minHoldBars){
        const trend=trendReadings.get(bar.t);
        if(holdStrongTrend&&trend?.holdReady&&trend.direction===position.direction){
          position.holdingTrend=true;position.deferredTpTime??=bar.t;
        }else{position.tpDue=bar.t+step;position.pendingReason='TP_SIGNAL';}
      }
      else{position.waitForFlip=true;position.earlyTpHeldBars=heldAtExit;}
    }
    // Once an eligible V2 exit is deferred, evaluate every subsequent closed
    // candle. A fresh V2 point is not required to exit when the trend weakens.
    // Opposite SPY sign above always takes precedence; missing phase data
    // cannot become a synthetic TP. There is still no stop-loss.
    if(position?.holdingTrend&&!position.tpDue&&!position.tpExpired&&!position.waitForFlip&&phase===position.phase&&sign===position.direction){
      const trend=trendReadings.get(bar.t);
      position.weakTrendBars=trend?.holdReady&&trend.direction===position.direction?0:position.weakTrendBars+1;
      if(position.weakTrendBars>=2){
        position.tpDue=bar.t+step;position.pendingReason='TP_SIGNAL';position.tpSignalTime=bar.t;
      }
    }
    if(flipped){
      if(setup){skipped.weakTrend++;setup=null;}
      signals++;
      // Filter at signal confirmation / intended entry OPEN. A 03:45 NY
      // candle confirmed at 04:00 is eligible; a 19:45 candle at 20:00 is not.
      // Keep the sign phase and all indicators continuous outside this window.
      if(!reversalEntryAllowed(bar.t+step,entryWindow))skipped.outsideSession++;
      else{
        inSessionSignals++;
        if(position)skipped.overlap++;
        else if(!known||known.direction!==sign)skipped.noFirstLine++;
        else {
          const plan={signalTime:bar.t,signalKnownAt:bar.t+step,due:bar.t+step,direction:sign,phase,firstLine:known.value,firstLineTime:bar.t};
          if(trendFilter)setup={...plan,expires:bar.t+3*step};else entryPlan=plan;
        }
      }
    }
    if(trendFilter&&setup){
      if(phase!==setup.phase||bar.t>setup.expires||!reversalEntryAllowed(bar.t+step,entryWindow)){
        skipped.weakTrend++;setup=null;
      }else if(!position&&trendReadings.get(bar.t)?.ready){
        entryPlan={...setup,flipTime:setup.signalTime,signalTime:bar.t,signalKnownAt:bar.t+step,due:bar.t+step,firstLine:setup.firstLine,firstLineTime:setup.firstLineTime,trend:trendReadings.get(bar.t)};
        skipped.confirmedTrend++;setup=null;
      }
    }
    previous=bar;
  }
  return {trades,summary:summarizeReversalTrades(trades),buy:summarizeReversalTrades(trades.filter(t=>t.direction>0)),sell:summarizeReversalTrades(trades.filter(t=>t.direction<0)),
    open:position,pending:entryPlan,watching:setup,censored,skipped,signals,inSessionSignals,closedBars,roundTripBps,entryWindow,minHoldBars,trendFilter,holdStrongTrend,
    from:ordered.find(validBar)?.t??null,to:previous?previous.t+step:null};
}
