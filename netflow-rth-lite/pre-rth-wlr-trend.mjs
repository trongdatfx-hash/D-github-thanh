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

const DIRECTIONS=[1,-1],START_SESSIONS=['PRE','RTH'],STRENGTH_CONTEXTS=['support','mixed','opposed'];
const RIDGE_MIN_TRAIN=60,RIDGE_MIN_OOS=60,RIDGE_OOS_WINDOW=500,RIDGE_LAMBDA=1,RIDGE_PARTIAL_MIN=.05;
function solveLinear(matrix,vector){
  const n=vector.length,a=matrix.map((row,index)=>[...row,vector[index]]);
  for(let column=0;column<n;column++){let pivot=column;for(let row=column+1;row<n;row++)if(Math.abs(a[row][column])>Math.abs(a[pivot][column]))pivot=row;if(Math.abs(a[pivot][column])<1e-10)return Array(n).fill(0);[a[column],a[pivot]]=[a[pivot],a[column]];const divisor=a[column][column];for(let j=column;j<=n;j++)a[column][j]/=divisor;for(let row=0;row<n;row++){if(row===column)continue;const factor=a[row][column];for(let j=column;j<=n;j++)a[row][j]-=factor*a[column][j];}}
  return a.map(row=>row[n]);
}
function createRegressionState(){return {n:0,xtx:Array.from({length:3},()=>Array(3).fill(0)),xty:Array(3).fill(0),sumY:0,oos:[]};}
function addRegressionSample(state,composite,volume,target){const x=[1,composite,volume];state.n++;state.sumY+=target;for(let i=0;i<3;i++){state.xty[i]+=x[i]*target;for(let j=0;j<3;j++)state.xtx[i][j]+=x[i]*x[j];}}
function ridgeCoefficients(state,indices=[0,1,2]){const matrix=indices.map(i=>indices.map(j=>state.xtx[i][j])),vector=indices.map(i=>state.xty[i]);for(let i=0;i<indices.length;i++)if(indices[i]!==0)matrix[i][i]+=RIDGE_LAMBDA;return solveLinear(matrix,vector);}
function regressionModel(state){
  if(state.n<RIDGE_MIN_TRAIN)return null;
  const full=ridgeCoefficients(state),noComposite=ridgeCoefficients(state,[0,2]),noVolume=ridgeCoefficients(state,[0,1]);
  return {full,noComposite,noVolume,mean:state.sumY/state.n,n:state.n};
}
function regressionMetrics(state){
  const sample=state.oos.slice(-RIDGE_OOS_WINDOW);if(sample.length<RIDGE_MIN_OOS)return {r2:null,partialComposite:null,partialVolume:null,oosN:sample.length};
  let full=0,noComposite=0,noVolume=0,baseline=0;for(const row of sample){full+=(row.y-row.full)**2;noComposite+=(row.y-row.noComposite)**2;noVolume+=(row.y-row.noVolume)**2;baseline+=(row.y-row.baseline)**2;}
  return {r2:baseline>1e-12?1-full/baseline:null,partialComposite:noComposite>1e-12?clamp01(1-full/noComposite):null,partialVolume:noVolume>1e-12?clamp01(1-full/noVolume):null,oosN:sample.length};
}
export function classifyStrengthRegression(direction,{r2,partialComposite,partialVolume,impactComposite,impactVolume}={}){
  const valid=Number.isFinite(r2)&&r2>0&&Number.isFinite(partialComposite)&&partialComposite>=RIDGE_PARTIAL_MIN&&Number.isFinite(partialVolume)&&partialVolume>=RIDGE_PARTIAL_MIN;
  if(!valid||![impactComposite,impactVolume].every(Number.isFinite)||!direction)return 'mixed';
  const compositeSide=Math.sign(impactComposite)*direction,volumeSide=Math.sign(impactVolume)*direction;
  if(compositeSide>0&&volumeSide>0)return 'support';if(compositeSide<0&&volumeSide<0)return 'opposed';return 'mixed';
}
function regressionSnapshot(state,composite,volume){
  const model=regressionModel(state),metrics=regressionMetrics(state);if(!model||![composite,volume].every(Number.isFinite))return {...metrics,sampleN:state.n,impactComposite:null,impactVolume:null};
  return {...metrics,sampleN:state.n,impactComposite:model.full[1]*composite,impactVolume:model.full[2]*volume,betaComposite:model.full[1],betaVolume:model.full[2]};
}
function updateStrengthRegression(state,previous,row,atr,strengthMap,volumeMap){
  if(!previous||!(atr>1e-12))return;
  const composite=strengthMap.get(previous.t)?.adjusted,volume=volumeMap.get(previous.t)?.adjusted;if(![composite,volume].every(Number.isFinite))return;
  const target=(row.c-previous.c)/atr,model=regressionModel(state);if(model){state.oos.push({y:target,full:model.full[0]+model.full[1]*composite+model.full[2]*volume,noComposite:model.noComposite[0]+model.noComposite[1]*volume,noVolume:model.noVolume[0]+model.noVolume[1]*composite,baseline:model.mean});if(state.oos.length>RIDGE_OOS_WINDOW)state.oos.shift();}
  addRegressionSample(state,composite,volume,target);
}
function finishEpisode(active,endBar,day,censored=false){
  if(!active||!endBar)return null;
  return {...active,day,endTime:endBar.t,duration:active.channelTotalBars??active.trendBars,elapsedDuration:active.elapsedBars,censored:censored||active.channelCensored===true};
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
function trendAgeGroup(bars){
  if(!(bars>0))return {key:'none',label:'CHƯA CÓ',min:0,max:0};
  if(bars<=4)return {key:'new',label:'MỚI 2–4',min:2,max:4};
  if(bars<=8)return {key:'developing',label:'PHÁT TRIỂN 5–8',min:5,max:8};
  if(bars<=12)return {key:'durable',label:'BỀN 9–12',min:9,max:12};
  return {key:'extended',label:'KÉO DÀI ≥13',min:13,max:null};
}

function daySignals(rows,strengthMap,volumeMap,channelMap,requireChannel,slopeHistory,scoreHistory,regressionStates,window){
  const signals=[];
  for(let i=0;i<rows.length;i++){
    const ranges=[];for(let k=Math.max(0,i-13);k<=i;k++)ranges.push(trueRange(rows,k));const atr=mean(ranges),regressionState=regressionStates[rows[i].session];updateStrengthRegression(regressionState,rows[i-1],rows[i],atr,strengthMap,volumeMap);if(i<window-1)continue;
    const sample=rows.slice(i-window+1,i+1),fit=weightedFit(sample),direction=Math.sign(fit.slope);
    const normalizedSlope=atr>1e-12?Math.abs(fit.slope)*window/atr:0;
    let path=0;for(let k=1;k<sample.length;k++)path+=Math.abs(sample[k].c-sample[k-1].c);
    const efficiency=path>1e-12?clamp01(Math.abs(sample.at(-1).c-sample[0].c)/path):0;
    const persistentBars=sample.reduce((count,bar)=>count+(Math.sign(bar.c-bar.o)===direction),0),persistence=persistentBars/window,slopePercentile=slopeHistory.length>=20?percentileRank(slopeHistory,normalizedSlope):clamp01(normalizedSlope/2);
    const composite=strengthMap.get(rows[i].t)?.adjusted,volume=volumeMap.get(rows[i].t)?.adjusted,compositeSide=Math.sign(composite)*direction,compositeScore=compositeSide>0?1:compositeSide<0?0:.5,volumeAligned=Number.isFinite(volume)&&Math.sign(volume)===direction,channel=channelMap.get(rows[i].t),channelAligned=!requireChannel||channel?.direction===direction,countAligned=requireChannel?channelAligned:volumeAligned;
    const score=100*(.38*slopePercentile+.28*fit.r2+.18*efficiency+.11*persistence+.05*compositeScore),threshold=scoreHistory.length>=30?quantile(scoreHistory,.70):60;
    const qualifies=direction!==0&&countAligned&&persistentBars>=Math.ceil(window*.75)&&score>=threshold;
    const strengthRegression=regressionSnapshot(regressionState,composite,volume),strengthContext=classifyStrengthRegression(direction,strengthRegression);
    signals.push({...rows[i],localIndex:i,direction,score,r2:fit.r2,efficiency,persistence,persistentBars,compositeScore,volumeAligned,channelAligned,channelAge:channelAligned?channel?.age:null,channelTotalBars:channelAligned?channel?.totalBars:null,channelKey:channelAligned?channel?.key:null,channelCensored:channelAligned?channel?.censored:false,countAligned,strengthContext,strengthRegression,normalizedSlope,threshold,qualifies});
    slopeHistory.push(normalizedSlope);scoreHistory.push(score);if(slopeHistory.length>4000)slopeHistory.shift();if(scoreHistory.length>4000)scoreHistory.shift();
  }
  return signals;
}

function detectEpisodes(signals,day,{leaveActive=false}={}){
  const completed=[];let active=null,candidate=null,previous=null;
  for(const bar of signals){
    if(active){
      if(bar.direction!==active.direction){const episode=finishEpisode(active,previous,day,false);if(episode)completed.push(episode);active=null;candidate=bar.qualifies?bar:null;}
      else if(bar.qualifies){active.elapsedBars++;active.trendBars=Number.isInteger(bar.channelTotalBars)?Math.max(active.trendBars,bar.channelTotalBars):active.trendBars+1;if(bar.volumeAligned)active.volumeBars++;if(bar.channelAligned)active.channelBars++;active.channelTotalBars=bar.channelTotalBars??active.channelTotalBars;active.channelKey=bar.channelKey??active.channelKey;active.channelCensored=bar.channelCensored??active.channelCensored;active.endTime=bar.t;active.peakScore=Math.max(active.peakScore,bar.score);active.latest=bar;active.weakBars=0;candidate=null;}
      else if(active.weakBars===0){active.elapsedBars++;if(bar.volumeAligned)active.volumeBars++;if(bar.channelAligned)active.channelBars++;if(bar.countAligned)active.trendBars=Number.isInteger(bar.channelTotalBars)?Math.max(active.trendBars,bar.channelTotalBars):active.trendBars+1;active.channelTotalBars=bar.channelTotalBars??active.channelTotalBars;active.channelKey=bar.channelKey??active.channelKey;active.channelCensored=bar.channelCensored??active.channelCensored;active.endTime=bar.t;active.latest=bar;active.weakBars=1;candidate=null;}
      else{const episode=finishEpisode(active,previous,day,false);if(episode)completed.push(episode);active=null;candidate=null;}
    }else if(bar.qualifies){
      if(candidate&&candidate.direction===bar.direction&&candidate.localIndex+1===bar.localIndex){
        active={direction:bar.direction,startIndex:candidate.localIndex,startTime:candidate.t,startSession:candidate.session,strengthContext:bar.strengthContext,strengthRegression:bar.strengthRegression,peakScore:Math.max(candidate.score,bar.score),latest:bar,trendBars:bar.channelTotalBars??2,channelTotalBars:bar.channelTotalBars??candidate.channelTotalBars??null,channelKey:bar.channelKey??candidate.channelKey??null,channelCensored:bar.channelCensored??candidate.channelCensored??false,volumeBars:Number(candidate.volumeAligned)+Number(bar.volumeAligned),channelBars:Number(candidate.channelAligned)+Number(bar.channelAligned),elapsedBars:2,weakBars:0};candidate=null;
      }else candidate=bar;
    }else candidate=null;
    previous=bar;
  }
  // The PRE→RTH boundary stops observation; it does not prove the trend died.
  if(active&&!leaveActive){const episode=finishEpisode(active,previous,day,true);if(episode)completed.push(episode);active=null;}
  return {completed,active};
}

function chooseCohort(episodes,active,currentBars,minCohort,minStrengthCohort=30){
  const filters=[
    {key:'direction-session-strength',minimum:minStrengthCohort,minAtRisk:10,test:item=>item.direction===active.direction&&item.startSession===active.startSession&&item.strengthContext===active.strengthContext},
    {key:'direction-session',test:item=>item.direction===active.direction&&item.startSession===active.startSession},
    {key:'direction',test:item=>item.direction===active.direction},
    {key:'all',test:()=>true}
  ];
  for(const filter of filters){const matches=episodes.filter(filter.test),atRisk=matches.reduce((count,item)=>count+(item.duration>=currentBars),0);if(matches.length>=(filter.minimum??minCohort)&&atRisk>=(filter.minAtRisk??0))return {key:filter.key,episodes:matches};}
  const fallback=filters.map(filter=>({key:filter.key,episodes:episodes.filter(filter.test)})).sort((a,b)=>b.episodes.length-a.episodes.length)[0];
  return fallback??{key:'none',episodes:[]};
}

function cohortSummary(episodes,currentBars,horizon,minSamples,minAtRisk){
  const curve=kaplanMeier(episodes),medianBars=survivalQuantile(curve,.5),censoredN=episodes.filter(item=>item.censored).length;
  if(!(currentBars>0))return {n:episodes.length,censoredN,medianBars,atRiskN:null,continuation:null,ready:false};
  const survivalNow=survivalAt(curve,currentBars),atRiskN=episodes.reduce((count,item)=>count+(item.duration>=currentBars),0),rawContinuation=episodes.length&&survivalNow>0?survivalAt(curve,currentBars+horizon)/survivalNow:null,ready=episodes.length>=minSamples&&atRiskN>=minAtRisk&&Number.isFinite(rawContinuation);
  return {n:episodes.length,censoredN,medianBars,atRiskN,continuation:ready?rawContinuation:null,ready};
}
function cohortGroups(episodes,currentBars=null,horizon=PRE_RTH_WLR_HORIZON,minCohort=12){
  return DIRECTIONS.flatMap(direction=>START_SESSIONS.map(startSession=>{
    const matches=episodes.filter(item=>item.direction===direction&&item.startSession===startSession),summary=cohortSummary(matches,currentBars,horizon,minCohort,5),rawCurve=kaplanMeier(matches.map(item=>({...item,duration:item.elapsedDuration??item.duration}))),rawMedianBars=survivalQuantile(rawCurve,.5),contexts={},metricMedian=key=>quantile(matches.map(item=>item.strengthRegression?.[key]).filter(Number.isFinite),.5),ridge={r2:metricMedian('r2'),partialComposite:metricMedian('partialComposite'),partialVolume:metricMedian('partialVolume')};
    for(const context of STRENGTH_CONTEXTS){const contextEpisodes=matches.filter(item=>item.strengthContext===context);contexts[context]={...cohortSummary(contextEpisodes,currentBars,horizon,30,10),share:matches.length?contextEpisodes.length/matches.length:0};}
    return {key:`${direction}|${startSession}`,direction,startSession,...summary,rawMedianBars,contexts,ridge};
  }));
}

export function preRthWlrTrend({priceRows=[],strengthRows=[],volumeRows=[],channelTrends=[],requireChannel=false,now=Date.now(),window=PRE_RTH_WLR_WINDOW,horizon=PRE_RTH_WLR_HORIZON,minCohort=12}={}){
  if(!Number.isInteger(window)||window<4||!Number.isInteger(horizon)||horizon<1||!Number.isInteger(minCohort)||minCohort<1)throw Error('Tham số PRE→RTH WLR không hợp lệ');
  const strengthMap=new Map(strengthRows.map(row=>[row.t,row])),volumeMap=new Map(volumeRows.map(row=>[row.t,row])),channelMap=new Map(),days=new Map();
  if(requireChannel)for(const trend of channelTrends){
    if(trend.volumeQualified===false)continue;const from=trend.confirmationTime,to=trend.insideEndTime??trend.endTime,start=Number.isFinite(trend.startTime)?trend.startTime:from;if(!Number.isFinite(from)||!Number.isFinite(to))continue;
    const legRows=priceRows.filter(row=>row.t>=start&&row.t<=to&&['PRE','RTH'].includes(row.session)).sort((a,b)=>a.t-b.t),ageByTime=new Map(legRows.map((row,index)=>[row.t,index+1])),totalBars=Number.isInteger(trend.bars)?trend.bars:legRows.length,key=`${start}|${trend.direction}`;
    for(const row of legRows)if(row.t>=from)channelMap.set(row.t,{direction:trend.direction,age:ageByTime.get(row.t),totalBars,key,censored:trend.provisional===true});
  }
  for(const row of priceRows){if((Number.isFinite(row.end)?row.end:row.t)>=now||!eligibleMarketBar(row)||!['PRE','RTH'].includes(row.session)||![row.t,row.o,row.h,row.l,row.c].every(Number.isFinite))continue;if(!days.has(row.day))days.set(row.day,[]);days.get(row.day).push(row);}
  const ordered=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,rows])=>[day,rows.sort((a,b)=>a.t-b.t)]),nowState=sessionAt(now),slopeHistory=[],scoreHistory=[],regressionStates={PRE:createRegressionState(),RTH:createRegressionState()},historical=[];let current=null,currentCompleted=[];
  for(const [day,rows] of ordered){
    const signals=daySignals(rows,strengthMap,volumeMap,channelMap,requireChannel,slopeHistory,scoreHistory,regressionStates,window),isCurrent=day===nowState.day&&['PRE','RTH'].includes(nowState.session)&&isUsMarketTradingDay(day),detected=detectEpisodes(signals,day,{leaveActive:isCurrent});
    if(isCurrent){current=detected.active;currentCompleted=detected.completed;}
    else historical.push(...detected.completed);
  }
  if(!current)return {label:'WAIT',direction:0,active:false,currentBars:0,ageGroup:trendAgeGroup(0),expectedBars:null,agePercentile:null,continuation:null,horizon,sampleN:historical.length,atRiskN:0,cohort:'none',cohortKey:null,strengthContext:null,groups:cohortGroups(historical,null,horizon,minCohort),reason:'Không có trend WLR giá đang hoạt động trong PRE→RTH'};
  const strongestCompleted=currentCompleted.reduce((best,item)=>Math.max(best,item.peakScore),-Infinity);
  if(current.peakScore<strongestCompleted){const currentBars=current.trendBars;return {label:'WAIT',direction:current.direction,active:false,currentBars,ageGroup:trendAgeGroup(currentBars),elapsedBars:current.elapsedBars,volumeAlignment:current.elapsedBars?current.volumeBars/current.elapsedBars:null,channelAlignment:current.elapsedBars?current.channelBars/current.elapsedBars:null,expectedBars:null,agePercentile:null,continuation:null,horizon,sampleN:historical.length,atRiskN:0,cohort:'none',cohortKey:`${current.direction}|${current.startSession}`,strengthContext:current.strengthContext,strengthRegression:current.strengthRegression,groups:cohortGroups(historical,currentBars,horizon,minCohort),reason:'Trend đang chạy không phải trend WLR giá mạnh nhất trong ngày'};}
  const currentBars=current.trendBars,cohort=chooseCohort(historical,current,currentBars,minCohort),curve=kaplanMeier(cohort.episodes),expectedBars=survivalQuantile(curve,.5),remainingBars=conditionalMedianRemaining(curve,currentBars),survivalNow=survivalAt(curve,currentBars),survivalForward=survivalAt(curve,currentBars+horizon),agePercentile=curve.length?Math.round(100*(1-survivalNow)):null,atRisk=cohort.episodes.reduce((count,item)=>count+(item.duration>=currentBars),0),continuation=survivalNow>0?survivalForward/survivalNow:null;
  const reliable=cohort.episodes.length>=minCohort&&atRisk>=5&&Number.isFinite(continuation),label=reliable&&continuation>=.55?(current.direction>0?'UP':'DOWN'):'WAIT';
  const ageGroup=trendAgeGroup(currentBars);
  return {label,direction:current.direction,active:true,currentBars,ageGroup,elapsedBars:current.elapsedBars,volumeAlignment:current.elapsedBars?current.volumeBars/current.elapsedBars:null,channelAlignment:current.elapsedBars?current.channelBars/current.elapsedBars:null,expectedBars,remainingBars,agePercentile,continuation,horizon,sampleN:cohort.episodes.length,atRiskN:atRisk,censoredN:cohort.episodes.filter(item=>item.censored).length,cohort:cohort.key,cohortKey:`${current.direction}|${current.startSession}`,strengthContext:current.strengthContext,strengthRegression:current.strengthRegression,groups:cohortGroups(historical,currentBars,horizon,minCohort),trendScore:Math.round(current.latest.score),r2:current.latest.r2,persistence:current.latest.persistence,compositeScore:current.latest.compositeScore,peakScore:current.peakScore,reliable,reason:reliable?`Nhóm ${ageGroup.label}; Kaplan–Meier từ ${cohort.episodes.length} trend lịch sử; ${atRisk} trend còn trong tập rủi ro ở tuổi hiện tại`:`Nhóm ${ageGroup.label}; chưa đủ mẫu sống ở tuổi hiện tại (${atRisk}/${cohort.episodes.length})`};
}

export function formatPreRthWlrTrend(state){
  if(!state)return 'WAIT · 0/— NẾN · TUỔI P— · CÒN ~— NẾN · TREND CÒN —%';
  const arrow=state.label==='UP'?'↑ ':state.label==='DOWN'?'↓ ':'',expected=state.expectedBars??'—',remaining=state.remainingBars??'—',age=state.agePercentile??'—',continuation=Number.isFinite(state.continuation)?Math.round(state.continuation*100):'—';
  return `${arrow}${state.label} · ${state.currentBars}/${expected} NẾN · TUỔI P${age} · CÒN ~${remaining} NẾN · TREND CÒN ${continuation}%`;
}
