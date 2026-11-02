import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTrendSource,computeStudies,previewBoxColors} from '../studies-core.mjs';
import {channelStrengthBoxes} from '../channel-strength-boxes.mjs';
const T=Date.parse('2026-10-29T14:00:00Z'),Q=900000;
const make=i=>({t:T+i*Q,end:T+(i+1)*Q-1,o:100,h:103,l:99,c:102,v:10,q:1000,buy:600,net:200,sell:400,day:'2026-10-29',session:'RTH'});
function calculate(prices,now){const raw={SPYUSDT:prices,QQQUSDT:prices},trend=analyzeTrendSource(raw,now);let context,result;const stop={};try{computeStudies({rows:{...trend.rows,SPYUSDT:prices,QQQUSDT:prices},volumeRows:trend.volume,symbol:'SPYUSDT',interval:'15m',options:{minScore:55,maxLines:8},now,trend,onH1Context:c=>context=c,onH1Ready:(h1,h4)=>{result={h1,h4};throw stop;}})}catch(e){if(e!==stop)throw e;}return {context,result,trend};}
test('running candle has H1 state; price changes update preview without training again',()=>{
 const p=Array.from({length:4},(_,i)=>make(i)),now=T+3.5*Q,a=calculate(p,now);
 assert(a.result.h1.some(s=>s.t===p[3].t&&s.preview));
 const down=structuredClone(p);down[3].c=90;down[3].l=89;
 const preview=previewBoxColors(a.context,down,a.trend.volume,now),full=calculate(down,now);
 assert.equal(preview.h1CandleColors.at(-1).direction,-1);assert.deepEqual(preview.h1CandleColors,full.result.h1);
 assert.deepEqual(a.context.priceRows,a.trend.rows.SPYUSDT);assert.equal(a.context.priceRows.length,3);
 const locked=calculate(down,T+4*Q).result.h1;assert(locked.every(s=>!s.preview&&s.direction===-1));
});
test('prefix snapshots ignore final display qualification and final-fit metrics',()=>{
 const p=Array.from({length:12},(_,i)=>({...make(i),c:100+i*.1,h:103+i*.1}));
 const c={startTime:p[0].t,confirmationTime:p[2].t,insideEndTime:p[11].t,direction:1,confirmed:true,volumeQualified:true,displayQualified:true,adaptiveR2:.99,slopeAtr:1,provisional:true};
 const run=(channel,rows=p)=>channelStrengthBoxes(rows,{channels:[channel],now:T+12*Q,step:Q,showEarly:false,causalSnapshots:true}).snapshots;
 const a=run(c),b=run({...c,displayQualified:false,adaptiveR2:.01,slopeAtr:-90,provisional:false});assert(a.size>0);assert.deepEqual(a,b);
 const short=run({...c,insideEndTime:p[8].t},p.slice(0,9));for(const [t,snapshot] of short)assert.deepEqual(snapshot,a.get(t));
});
