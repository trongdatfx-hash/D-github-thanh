import {sessionAt} from './engine.mjs';
import {eligibleMarketBar,isUsMarketTradingDay} from './market-calendar.mjs';

export const PRE_RTH_WLR_WINDOW=8;
export const PRE_RTH_WLR_HORIZON=3;

const clamp01=value=>Math.max(0,Math.min(1,value));
const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
const percentileRank=(values,value)=>values.length?values.reduce((count,item)=>count+(item<=value),0)/values.length:0;
export function quantile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*clamp01(p),lower=Math.floor(position),upper=Math.ceil(position);
  return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
}

function weightedFit(sample){
  const n=sample.length,sw=n*(n+1)/2;
  let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=0;i<n;i++){const weight=i+1,value=sample[i].c;sx+=weight*i;sy+=weight*value;sxx+=weight*i*i;sxy+=weight*i*value;}
  const denominator=sw*sxx-sx*sx,slope=denominator?((sw*sxy-sx*sy)/denominator):0,intercept=(sy-slope*sx)/sw,weightedMean=sy/sw;
  let residual=0,total=0;
  for(let i=0;i<n;i++){const weight=i+1,value=sample[i].c;residual+=weight*(value-intercept-slope*i)**2;total+=weight*(value-weightedMean)**2;}
  return {slope,r2:total>1e-12?clamp01(1-residual/total):0};
}

function trueRange(rows,index){
  const row=rows[index],previous=rows[index-1];
  return previous?Math.max(row.h-row.l,Math.abs(row.h-previous.c),Math.abs(row.l-previous.c)):row.h-row.l;
}

function strengthBucket(score){return score>=85?'high':score>=75?'medium':'base';}
function finishEpisode(active,endBar,day,censored=false){
  if(!active||!endBar)return null;
  return {...active,day,endTime:endBar.t,duration:endBar.localIndex-active.startIndex+1,censored};
}

export function kaplanMeier(episodes){
  const clean=episodes.filter(item=>Number.isInteger(item?.duration)&&item.duration>0),times=[...new Set(clean.map(item=>item.duration))].sort((a,b)=>a-b);let survival=1;
  return times.map(time=>{
    const atRisk=clean.reduce((count,item)=>count+(item.duration>=time),0),events=clean.reduce((count,item)=>count+(item.duration===time&&!item.censored),0),censored=clean.reduce((count,item)=>count+(item.duration===time&&item.censored),0);
    if(events&&atRisk)survival*=1-events/atRisk;
    return {time,atRisk,events,censored,survival};
  });
}
export function survivalAt(curve,time){
  let survival=1;for(const step of curve){if(step.time>time)break;survival=step.survival;}return survival;
}
function survivalQuantile(curve,p){const step=curve.find(item=>item.survival<=1-p);return step?.time??null;}
function conditionalMedianRemaining(curve,currentBars,maxBars=48){
  const base=survivalAt(curve,currentBars);if(!(base>0))return null;
  for(let extra=1;extra<=Math.max(0,maxBars-currentBars);extra++)if(survivalAt(curve,currentBars+extra)/base<=.5)return extra;
  return null;
}

function daySignals(rows,strengthMap,volumeMap,slopeHistory,scoreHistory,window){
  const signals=[];
  for(let i=window-1;i<rows.length;i++){
    const sample=rows.slice(i-window+1,i+1),fit=weightedFit(sample),direction=Math.sign(fit.slope);
    const ranges=[];for(let k=Math.max(0,i-13);k<=i;k++)ranges.push(trueRange(rows,k));
    const atr=mean(ranges),normalizedSlope=atr>1e-12?Math.abs(fit.slope)*window/atr:0;
    let path=0;for(let k=1;k<sample.length;k++)path+=Math.abs(sample[k].c-sample[k-1].c);
    const efficiency=path>1e-12?clamp01(Math.abs(sample.at(-1).c-sample[0].c)/path):0;
    let aligned=0;
    for(const bar of sample){const composite=strengthMap.get(bar.t)?.adjusted,volume=volumeMap.get(bar.t)?.adjusted;if(direction&&Number.isFinite(composite)&&Number.isFinite(volume)&&Math.sign(composite)===direction&&Math.sign(volume)===direction)aligned++;}
    const phaseShare=aligned/window,slopePercentile=slopeHistory.length>=20?percentileRank(slopeHistory,normalizedSlope):clamp01(normalizedSlope/2);
    const score=100*(.35*slopePercentile+.25*fit.r2+.20*efficiency+.20*phaseShare),threshold=scoreHistory.length>=30?quantile(scoreHistory,.70):62;
    const qualifies=direction!==0&&aligned>=Math.ceil(window*.625)&&score>=threshold;
    signals.push({...rows[i],localIndex:i,direction,score,r2:fit.r2,efficiency,phaseShare,aligned,normalizedSlope,threshold,qualifies});
    slopeHistory.push(normalizedSlope);scoreHistory.push(score);if(slopeHistory.length>4000)slopeHistory.shift();if(scoreHistory.length>4000)scoreHistory.shift();
  }
  return signals;
}

function detectEpisodes(signals,day,{leaveActive=false}={}){
  const completed=[];let active=null,candidate=null,previous=null;
  for(const bar of signals){
    if(active){
      if(bar.direction!==active.direction){const episode=finishEpisode(active,previous,day,false);if(episode)completed.push(episode);active=null;candidate=bar.qualifies?bar:null;}
      else if(bar.qualifies){active.endTime=bar.t;active.peakScore=Math.max(active.peakScore,bar.score);active.latest=bar;active.weakBars=0;candidate=null;}
      else if(active.weakBars===0){active.endTime=bar.t;active.latest=bar;active.weakBars=1;candidate=null;}
      else{const episode=finishEpisode(active,previous,day,false);if(episode)completed.push(episode);active=null;candidate=null;}
    }else if(bar.qualifies){
      if(candidate&&candidate.direction===bar.direction&&candidate.localIndex+1===bar.localIndex){
        active={direction:bar.direction,startIndex:candidate.localIndex,startTime:candidate.t,startSession:candidate.session,peakScore:Math.max(candidate.score,bar.score),latest:bar,weakBars:0};candidate=null;
      }else candidate=bar;
    }else candidate=null;
    previous=bar;
  }
  // The PRE→RTH boundary stops observation; it does not prove the trend died.
  if(active&&!leaveActive){const episode=finishEpisode(active,previous,day,true);if(episode)completed.push(episode);active=null;}
  return {completed,active};
}

function chooseCohort(episodes,active,minCohort){
  const bucket=strengthBucket(active.peakScore),filters=[
    {key:'direction-session-strength',test:item=>item.direction===active.direction&&item.startSession===active.startSession&&strengthBucket(item.peakScore)===bucket},
    {key:'direction-session',test:item=>item.direction===active.direction&&item.startSession===active.startSession},
    {key:'direction',test:item=>item.direction===active.direction},
    {key:'all',test:()=>true}
  ];
  for(const filter of filters){const matches=episodes.filter(filter.test);if(matches.length>=minCohort)return {key:filter.key,episodes:matches};}
  const fallback=filters.map(filter=>({key:filter.key,episodes:episodes.filter(filter.test)})).sort((a,b)=>b.episodes.length-a.episodes.length)[0];
  return fallback??{key:'none',episodes:[]};
}

export function preRthWlrTrend({priceRows=[],strengthRows=[],volumeRows=[],now=Date.now(),window=PRE_RTH_WLR_WINDOW,horizon=PRE_RTH_WLR_HORIZON,minCohort=12}={}){
  if(!Number.isInteger(window)||window<4||!Number.isInteger(horizon)||horizon<1||!Number.isInteger(minCohort)||minCohort<1)throw Error('Tham số PRE→RTH WLR không hợp lệ');
  const strengthMap=new Map(strengthRows.map(row=>[row.t,row])),volumeMap=new Map(volumeRows.map(row=>[row.t,row])),days=new Map();
  for(const row of priceRows){if((Number.isFinite(row.end)?row.end:row.t)>=now||!eligibleMarketBar(row)||!['PRE','RTH'].includes(row.session)||![row.t,row.o,row.h,row.l,row.c].every(Number.isFinite))continue;if(!days.has(row.day))days.set(row.day,[]);days.get(row.day).push(row);}
  const ordered=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,rows])=>[day,rows.sort((a,b)=>a.t-b.t)]),nowState=sessionAt(now),slopeHistory=[],scoreHistory=[],historical=[];let current=null,currentCompleted=[];
  for(const [day,rows] of ordered){
    const signals=daySignals(rows,strengthMap,volumeMap,slopeHistory,scoreHistory,window),isCurrent=day===nowState.day&&['PRE','RTH'].includes(nowState.session)&&isUsMarketTradingDay(day),detected=detectEpisodes(signals,day,{leaveActive:isCurrent});
    if(isCurrent){current=detected.active;currentCompleted=detected.completed;}
    else historical.push(...detected.completed);
  }
  if(!current)return {label:'WAIT',direction:0,active:false,currentBars:0,expectedBars:null,agePercentile:null,continuation:null,horizon,sampleN:historical.length,atRiskN:0,cohort:'none',reason:'Không có trend WLR đồng pha đang hoạt động trong PRE→RTH'};
  const strongestCompleted=currentCompleted.reduce((best,item)=>Math.max(best,item.peakScore),-Infinity);
  if(current.peakScore<strongestCompleted)return {label:'WAIT',direction:current.direction,active:false,currentBars:current.latest.localIndex-current.startIndex+1,expectedBars:null,agePercentile:null,continuation:null,horizon,sampleN:historical.length,atRiskN:0,cohort:'none',reason:'Trend đang chạy không phải trend đồng pha mạnh nhất trong ngày'};
  const currentBars=current.latest.localIndex-current.startIndex+1,cohort=chooseCohort(historical,current,minCohort),curve=kaplanMeier(cohort.episodes),expectedBars=survivalQuantile(curve,.5),remainingBars=conditionalMedianRemaining(curve,currentBars),survivalNow=survivalAt(curve,currentBars),survivalForward=survivalAt(curve,currentBars+horizon),agePercentile=curve.length?Math.round(100*(1-survivalNow)):null,atRisk=cohort.episodes.reduce((count,item)=>count+(item.duration>=currentBars),0),continuation=survivalNow>0?survivalForward/survivalNow:null;
  const reliable=cohort.episodes.length>=minCohort&&atRisk>=5&&Number.isFinite(continuation),label=reliable&&continuation>=.55?(current.direction>0?'UP':'DOWN'):'WAIT';
  return {label,direction:current.direction,active:true,currentBars,expectedBars,remainingBars,agePercentile,continuation,horizon,sampleN:cohort.episodes.length,atRiskN:atRisk,censoredN:cohort.episodes.filter(item=>item.censored).length,cohort:cohort.key,trendScore:Math.round(current.latest.score),r2:current.latest.r2,phaseShare:current.latest.phaseShare,peakScore:current.peakScore,reliable,reason:reliable?`Kaplan–Meier từ ${cohort.episodes.length} trend lịch sử; ${atRisk} trend còn trong tập rủi ro ở tuổi hiện tại`:`Chưa đủ mẫu sống ở tuổi hiện tại (${atRisk}/${cohort.episodes.length})`};
}

export function formatPreRthWlrTrend(state){
  if(!state)return 'WAIT · 0/— NẾN · TUỔI P— · CÒN ~— NẾN · TREND CÒN —%';
  const arrow=state.label==='UP'?'↑ ':state.label==='DOWN'?'↓ ':'',expected=state.expectedBars??'—',remaining=state.remainingBars??'—',age=state.agePercentile??'—',continuation=Number.isFinite(state.continuation)?Math.round(state.continuation*100):'—';
  return `${arrow}${state.label} · ${state.currentBars}/${expected} NẾN · TUỔI P${age} · CÒN ~${remaining} NẾN · TREND CÒN ${continuation}%`;
}
