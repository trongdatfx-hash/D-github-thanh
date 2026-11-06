import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFlowPrice,FlowPriceReaction} from '../flow-price-reaction.mjs';
const step=900000,start=100*step;
const baseline=Array.from({length:15},(_,i)=>({t:start-(15-i)*step,end:start-(14-i)*step-1,o:100,c:100,h:101,l:99,q:900000,net:0}));
const rows=(i,{direction=1,move=.02,quoteRate=3000,deltaRate=2000}={})=>[...baseline,{t:start,end:start+step-1,o:100,c:100+move*i,h:102,l:98,q:1000+quoteRate*i,net:direction*deltaRate*i}];
const opts=i=>({step,time:start+1000+3000*i,now:start+1000+3000*i,fresh:true});
const input={delta:20000,quote:30000,priceChange:.2,atr:2,typicalQuote:900000,span:30000,step};
test('buy and sell price pushing use signed flow, not absolute CVD level',()=>{
 assert.equal(classifyFlowPrice(input).label,'MUA ĐẨY GIÁ');
 assert.equal(classifyFlowPrice({...input,delta:-20000,priceChange:-.2}).label,'BÁN ĐẨY GIÁ');
});
test('strong flow with flat or adverse price is only an absorption indication',()=>{
 assert.equal(classifyFlowPrice({...input,priceChange:0}).label,'MUA HẤP THỤ');
 assert.equal(classifyFlowPrice({...input,delta:-20000,priceChange:.2}).label,'BÁN HẤP THỤ');
});
test('weak flow, sparse trading, missing baseline and impossible delta stay unknown',()=>{
 for(const change of [{delta:10},{quote:30,delta:20},{atr:0},{typicalQuote:0},{span:29000},{delta:40000}])assert.equal(classifyFlowPrice({...input,...change}).ready,false);
});
test('requires 30 seconds and two new real chart updates, not pointer or OI calls',()=>{
 const model=new FlowPriceReaction();let result;
 for(let i=0;i<=10;i++)result=model.update(rows(i),opts(i));
 assert.equal(result.ready,false);assert.equal(result.reason,'confirming');
 for(let i=0;i<5;i++)assert.equal(model.update(rows(10),{...opts(10),now:opts(10).now+1000}).ready,false);
 result=model.update(rows(11),opts(11));assert.equal(result.label,'MUA ĐẨY GIÁ');assert.equal(result.span,33000);
});
test('rolling window never carries more than 60 seconds',()=>{
 const model=new FlowPriceReaction();let result;
 for(let i=0;i<=50;i++)result=model.update(rows(i),opts(i));
 assert.equal(result.ready,true);assert.equal(result.span,60000);
 assert.equal(model.samples.length,21);
});
test('sell absorption works while cumulative delta is already negative',()=>{
 const model=new FlowPriceReaction();let result;
 for(let i=0;i<=11;i++)result=model.update(rows(i,{direction:-1,move:0}),opts(i));
 assert.equal(result.label,'BÁN HẤP THỤ');
 assert.equal(result.delta,-22000);
});
test('stale chart, historical data and old candle cannot show a current reaction',()=>{
 for(const mode of ['stale','historical','expired']){
  const model=new FlowPriceReaction();for(let i=0;i<=11;i++)model.update(rows(i),opts(i));
  const o=opts(11);
  if(mode==='stale')o.now+=11000;
  if(mode==='historical')o.fresh=false;
  if(mode==='expired')o.now=start+step;
  assert.equal(model.update(rows(11),o).ready,false);
 }
});
test('gap or volume revision resets accumulated evidence',()=>{
 for(const mode of ['gap','revision']){
  const model=new FlowPriceReaction();for(let i=0;i<=11;i++)model.update(rows(i),opts(i));
  const o=opts(12),data=rows(12);
  if(mode==='gap'){o.time+=15000;o.now=o.time;}else data.at(-1).q=1;
  assert.equal(model.update(data,o).ready,false);assert.equal(model.samples.length,1);
 }
});
test('candle or timeframe switch resets the short window',()=>{
 const model=new FlowPriceReaction();for(let i=0;i<=11;i++)model.update(rows(i),opts(i));
 const data=rows(0);data.at(-1).t+=step;data.at(-1).end+=step;
 assert.equal(model.update(data,{...opts(0),time:opts(0).time+step,now:opts(0).now+step}).ready,false);
 assert.equal(model.samples.length,1);
});
test('opposite new flow or price response cannot retain prior confirmed state',()=>{
 const model=new FlowPriceReaction();for(let i=0;i<=11;i++)model.update(rows(i),opts(i));
 const data=rows(12);data.at(-1).c=99;
 assert.equal(model.update(data,opts(12)).ready,false);
 assert.equal(model.update(rows(13,{move:0}),opts(13)).ready,true);
});
