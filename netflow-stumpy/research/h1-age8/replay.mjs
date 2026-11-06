import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {sessionAt,analyze,composite,calculateVolumeStrength,weightedPriceBands,directionalVolumeDelta} from '../../engine.mjs';
import {trendSessionRows} from '../../trend-session.mjs';
import {causalTrendChannels} from '../../causal-trend-channel.mjs';
import {channelStrengthBoxes} from '../../channel-strength-boxes.mjs';
import {h1CandleColorStates} from '../../weekly-trend-map.mjs';
import {historicalTrendAgeStates} from '../../pre-rth-wlr-trend.mjs';
import {scoreH1Box,H1_SCORE_VERSION} from '../../h1-box-score.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),workspace=path.dirname(root),S=900000,H=3600000;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sources=[];let spy=[],qqq=[];
for(const month of ['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']){
  const p=path.resolve(root,'../../data/binance/m15',month+'.json'),d=read(p),text=fs.readFileSync(p);
  sources.push({month,sha256:crypto.createHash('sha256').update(text).digest('hex')});spy.push(...d.SPYUSDT);qqq.push(...d.QQQUSDT);
}
const convert=r=>{const [t,o,h,l,c,v,end,q,buy]=r;return {t,o,h,l,c,v,end,q,buy,net:2*buy-q,...sessionAt(t)};};
const unique=rows=>[...new Map(rows.map(convert).map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
spy=unique(spy);qqq=unique(qqq);const now=spy.at(-1).end+1;
console.log(JSON.stringify({phase:'source',bars:spy.length,first:new Date(spy[0].t).toISOString(),last:new Date(spy.at(-1).t).toISOString()}));
const volume=analyze(spy,S,{strength:calculateVolumeStrength(spy,S)}),flow=analyze(composite(spy,qqq,S),S),price=analyze(spy,S),volumeMap=new Map(volume.map(r=>[r.t,r])),flowMap=new Map(flow.map(r=>[r.t,r]));
const active=trendSessionRows(price).map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),activeMap=new Map(active.map(r=>[r.t,r]));
const bands=new Map(weightedPriceBands(spy,S).map(r=>[r.t,r])),deltas=new Map(directionalVolumeDelta(spy,S).map(r=>[r.t,r]));
const groups=new Map();for(let i=0;i<spy.length;i++){const b=spy[i],start=Math.floor(b.t/H)*H;if(!groups.has(start))groups.set(start,[]);groups.get(start).push(i);}
function trendPoints(channels,sample){const map=new Map();for(const c of channels){if(c.volumeQualified===false)continue;for(const b of sample)if(activeMap.has(b.t)&&b.t>=c.startTime&&b.t>=c.confirmationTime&&b.t<=c.insideEndTime)map.set(b.t,{t:b.t,active:true,direction:c.direction,continuation:null});}return [...map.values()];}
function stateAt(indices,{fullPrefix=false,audit=false}={}){
  const sample=indices.map(i=>spy[i]),end=sample.at(-1).end+1,start=sample[0].t,day=sample[0].day;
  const before=active.filter(b=>b.t<end),first=before.findIndex(b=>b.day===day),market=fullPrefix?before:before.slice(Math.max(0,first-20));
  const raw=fullPrefix?price.slice(0,indices.at(-1)+1):price.slice(Math.max(0,indices.at(-1)-199),indices.at(-1)+1);
  const channels=causalTrendChannels(market,{volumeRows:volume,maxHistory:Infinity}).episodes;
  const boxes=channelStrengthBoxes(raw,{channels,showEarly:false,back:8,now:end,step:S,compositeRows:flowMap,volumeRows:volumeMap,compositeMode:'annotate'});
  const trend=audit?historicalTrendAgeStates({priceRows:raw,strengthRows:flow,volumeRows:volume,channelTrends:channels,now:end,fromTime:start}):trendPoints(channels,sample);
  return h1CandleColorStates({priceRows:sample,boxSnapshots:boxes.snapshots,trendStates:trend,volumeRows:volume,now:end,sourceStep:S,boxHours:1}).at(-1);
}
const eligible=[...groups.values()].filter(ids=>ids.length===4&&ids[0]>=520&&ids.every((idx,j)=>spy[idx].t===spy[ids[0]].t+j*S)&&spy[ids[0]].session!=='WEEKEND');
const limit=Number(process.env.AGE8_REPLAY_LIMIT)||Infinity,records=[],audits=[];
for(let n=0;n<Math.min(eligible.length,limit);n++){
  const ids=eligible[n],state=stateAt(ids);if(!state||state.preview)continue;
  if(n%Math.max(1,Math.floor(eligible.length/18))===0){const direct=stateAt(ids,{fullPrefix:true,audit:true});audits.push({t:state.blockStart,fast:state.direction,full:direct?.direction??null,match:state.direction===direct?.direction});}
  const upto=spy.slice(0,ids.at(-1)+1),r=scoreH1Box(state,{bars:upto,bands,deltas,flows:flowMap,now:state.blockEnd+1});
  if(!r||r.score===null||r.missing.some(x=>x!=='OI_P62'))continue;
  records.push({t:state.blockStart,end:state.blockEnd+1,day:state.dayKey,direction:state.direction,quality:state.quality,score:r.score,parts:r.parts,missing:r.missing,basis:'NO_OI_4_COMPONENTS'});
  if(n%200===0)console.log(JSON.stringify({phase:'replay',done:n,total:eligible.length,records:records.length,audits:audits.length,matched:audits.every(a=>a.match)}));
}
const result={schema:'h1-score-age8-replay-v1',scoreVersion:H1_SCORE_VERSION,sources,priceBars:spy.length,first:spy[0].t,last:spy.at(-1).t,oiCoverage:0,method:'Causal hour-by-hour replay. Original channel and H1 color functions; only current NY day plus 20 prior market bars needed for current-day channel direction. Color direction audited against full-prefix original historicalTrendAgeStates. Price and Strength precomputed causally. OI is missing, not zero.',audit:audits,records};
fs.writeFileSync(path.join(root,'replay.json'),JSON.stringify(result));console.log(JSON.stringify({phase:'done',records:records.length,audits:audits.length,auditMatches:audits.filter(x=>x.match).length}));
