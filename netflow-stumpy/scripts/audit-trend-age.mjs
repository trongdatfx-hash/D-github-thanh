import {trendSessionRows,trendSessionAt} from '../trend-session.mjs';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
import {analyze,composite,calculateVolumeStrength,sessionAt} from '../engine.mjs';
import {causalTrendChannels} from '../causal-trend-channel.mjs';
import {preRthWlrTrend,formatPreRthWlrTrend} from '../pre-rth-wlr-trend.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/binance/m15'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),raw={SPYUSDT:[],QQQUSDT:[]};
for(const month of manifest.months){const doc=JSON.parse(fs.readFileSync(path.join(dir,month+'.json')));for(const symbol of Object.keys(raw))raw[symbol].push(...doc[symbol].map(([t,o,h,l,c,v,end,q,buy])=>({t,o,h,l,c,v,end,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)})));}
for(const symbol of Object.keys(raw))raw[symbol]=[...new Map(raw[symbol].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
const last=raw.SPYUSDT.at(-1),previousDay=new Date(last.t).toISOString().slice(0,10),days=[...new Set(raw.SPYUSDT.filter(r=>trendSessionAt(r.t).active&&r.day<previousDay).map(r=>r.day))],day=days.at(-1),lastDay=raw.SPYUSDT.filter(r=>r.day===day&&trendSessionAt(r.t).active),indices=[Math.min(2,lastDay.length-1),Math.min(15,lastDay.length-1),Math.min(30,lastDay.length-1),lastDay.length-1],result=[];
for(const i of [...new Set(indices)]){
 const now=lastDay[i].end+1,closed=Object.fromEntries(Object.entries(raw).map(([s,rows])=>[s,rows.filter(r=>r.end<now)])),priceRows=analyze(closed.SPYUSDT,900000),strengthRows=analyze(composite(closed.SPYUSDT,closed.QQQUSDT),900000),volumeRows=analyze(closed.SPYUSDT,900000,{strength:calculateVolumeStrength(closed.SPYUSDT,900000)}),channels=causalTrendChannels(trendSessionRows(priceRows).map(r=>r.session==='EURO'?{...r,session:'PRE'}:r),{volumeRows,maxHistory:Infinity}),state=preRthWlrTrend({priceRows,strengthRows,volumeRows,channelTrends:channels.episodes,requireChannel:true,now});
 assert.ok(!state.active||state.currentBars>0);assert.ok(state.groups.every(g=>g.contexts.support.n+g.contexts.mixed.n+g.contexts.opposed.n===g.n));assert.ok(state.continuation===null||state.reliable);
 if(state.active){const active=channels.episodes.find(c=>c.provisional&&c.insideEndTime===lastDay[i].t);assert.ok(active,'Active label must belong to the current provisional channel');assert.equal(state.currentBars,active.bars);}
 const future=lastDay[i].t+900000*20,mutated=preRthWlrTrend({priceRows:[...priceRows,{t:future,end:future+899999,o:1,h:9999,l:1,c:9999,...sessionAt(future)}],strengthRows:[...strengthRows,{t:future,adjusted:-1}],volumeRows:[...volumeRows,{t:future,adjusted:-1}],channelTrends:channels.episodes,requireChannel:true,now});assert.deepEqual(mutated,state);
 result.push({at:new Date(now).toISOString(),label:formatPreRthWlrTrend(state),active:state.active,currentBars:state.currentBars,cohort:state.cohort,historicalEpisodes:state.groups.reduce((n,g)=>n+g.n,0),sampleN:state.sampleN,atRiskN:state.atRiskN,resolvedHorizonN:state.resolvedHorizonN??0});
}
console.log(JSON.stringify({audit:'PASS',sourceBars:raw.SPYUSDT.length,replay:result},null,2));
