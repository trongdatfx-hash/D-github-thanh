import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFlowPrice,FlowPriceReaction,reactionPriceGroup} from '../flow-price-reaction.mjs';
const step=900000,start=100*step;
const baseline=Array.from({length:15},(_,i)=>({t:start-(15-i)*step,end:start-(14-i)*step-1,o:100,c:100,h:100.25,l:99.75,q:900000,net:0}));
const rows=(i,{direction=1,move=.002,quoteRate=3000,deltaRate=2000}={})=>[...baseline,{t:start,end:start+step-1,o:100,c:100+move*i,h:101,l:99,q:1000+quoteRate*i,net:direction*deltaRate*i}];
const opts=i=>({step,time:start+1000+3000*i,now:start+1000+3000*i,fresh:true});
const input={delta:20000,quote:30000,priceChange:.2,atr:2,typicalQuote:900000,span:30000,step};
function warm(){const model=new FlowPriceReaction();for(let i=0;i<=13;i++)model.update(rows(i),opts(i));assert.equal(model.result.label,'MUA ĐẨY GIÁ');return model;}
test('pure classification keeps buy/sell push and absorption distinctions',()=>{
 assert.equal(classifyFlowPrice(input).label,'MUA ĐẨY GIÁ');
 assert.equal(classifyFlowPrice({...input,delta:-20000,priceChange:-.2}).label,'BÁN ĐẨY GIÁ');
 assert.equal(classifyFlowPrice({...input,priceChange:0}).label,'MUA HẤP THỤ');
 assert.equal(classifyFlowPrice({...input,delta:-20000,priceChange:.2}).label,'BÁN HẤP THỤ');
});
test('price groups match three half-point spectrum bins',()=>{
 assert.deepEqual(reactionPriceGroup(100),{id:66,low:98.75,high:100.25,binStep:.5,levels:3});
 assert.equal(reactionPriceGroup(100.25).low,100.25);
 assert.equal(reactionPriceGroup(NaN),null);
});
test('enter and exit thresholds differ to reject price and flow chatter',()=>{
 const base={...input,priceChange:.015};
 assert.equal(classifyFlowPrice(base).state,'absorption');
 assert.equal(classifyFlowPrice({...base,previousState:'push',previousDirection:1}).state,'push');
 const pushPrice={...input,priceChange:.02};
 assert.equal(classifyFlowPrice(pushPrice).state,'push');
 assert.equal(classifyFlowPrice({...pushPrice,previousState:'absorption',previousDirection:1}).state,'absorption');
 assert.equal(classifyFlowPrice({...input,delta:3600}).ready,false);
 assert.equal(classifyFlowPrice({...input,delta:3600,previousDirection:1,previousState:'push'}).ready,true);
});
test('weak, invalid and too-short observations remain unknown',()=>{
 for(const change of [{delta:10},{quote:30,delta:20},{atr:0},{typicalQuote:0},{span:29000},{delta:40000}])assert.equal(classifyFlowPrice({...input,...change}).ready,false);
});
test('requires at least 30 seconds plus 9 seconds of distinct chart confirmation',()=>{
 const model=new FlowPriceReaction();
 for(let i=0;i<=12;i++)assert.equal(model.update(rows(i),opts(i)).ready,false);
 assert.equal(model.update(rows(13),opts(13)).ready,true);
 const before=model.groups.get(model.active.id).segments.length;
 for(let i=0;i<10;i++)model.update(rows(13),{...opts(13),now:opts(13).now+1000});
 assert.equal(model.groups.get(model.active.id).segments.length,before);
});
test('groups accumulate no more than 120 seconds of observed flow',()=>{
 const model=warm();for(let i=14;i<=60;i++)model.update(rows(i),opts(i));
 const record=model.groups.get(model.active.id);
 assert.equal(record.segments.length,40);assert.equal(model.result.span,120000);
});
test('a candidate change retains confirmed text until time and count gates pass',()=>{
 const model=warm(),config=model.options,record=model.groups.get(model.active.id),old=record.stable.confirmedAt;
 const opposite={...record.stable,state:'absorption',label:'MUA HẤP THỤ'};
 for(const elapsed of [3000,6000,9000,12000])assert.equal(model.resolve(record,opposite,old+elapsed,config).label,'MUA ĐẨY GIÁ');
 assert.equal(model.resolve(record,opposite,old+15000,config).label,'MUA HẤP THỤ');
});
test('one weak update does not flash unknown; persistent weakness expires',()=>{
 const model=warm(),record=model.groups.get(model.active.id),at=record.stable.lastSupported;
 const weak={ready:false,reason:'weak_flow'};
 assert.equal(model.resolve(record,weak,at+3000,model.options).label,'MUA ĐẨY GIÁ');
 assert.equal(model.resolve(record,weak,at+15000,model.options).ready,true);
 assert.equal(model.resolve(record,weak,at+24000,model.options).ready,false);
});
test('new weak/contrary candidates cannot keep an unsupported old state indefinitely',()=>{
 const model=warm(),record=model.groups.get(model.active.id),at=record.stable.lastSupported;
 const opposite={...record.stable,direction:-1,state:'push',label:'BÁN ĐẨY GIÁ'};
 assert.equal(model.resolve(record,opposite,at+3000,model.options).held,true);
 assert.equal(model.resolve(record,{ready:false,reason:'weak_flow'},at+21000,model.options).ready,false);
});
test('oscillation near a group edge stays in the latched group',()=>{
 const model=new FlowPriceReaction(),first=rows(0);first.at(-1).c=100.24;model.update(first,opts(0));const id=model.active.id;
 for(let i=1;i<=12;i++){const data=rows(i);data.at(-1).c=i%2?100.51:100.49;model.update(data,opts(i));assert.equal(model.active.id,id);}
});
test('group switch needs three exterior observations spanning six seconds',()=>{
 const model=new FlowPriceReaction(),first=rows(0);first.at(-1).c=100.24;model.update(first,opts(0));
 const id=model.active.id;
 for(let i=1;i<=3;i++){const data=rows(i);data.at(-1).c=100.55;model.update(data,opts(i));assert.equal(model.active.id===id,i<3);}
 assert.equal(model.result.ready,false);
});
test('a distant price jump leaves the old group immediately',()=>{
 const model=warm(),old=model.active.id,data=rows(14);data.at(-1).c=105;model.update(data,opts(14));
 assert.notEqual(model.active.id,old);assert.equal(model.result.ready,false);
});
test('stale chart, price expiry, missing live data and gaps clear state immediately',()=>{
 for(const mode of ['stale','historical','expired','gap']){
  const model=warm(),o=opts(14),data=rows(14);
  if(mode==='stale')o.now+=11000;
  if(mode==='historical')o.fresh=false;
  if(mode==='expired')o.now=start+step;
  if(mode==='gap'){o.time+=15000;o.now=o.time;}
  assert.equal(model.update(data,o).ready,false);
 }
});
test('volume revisions or impossible incremental delta discard all prior evidence',()=>{
 for(const mode of ['quote','delta']){
  const model=warm(),data=rows(14);
  if(mode==='quote')data.at(-1).q=1;else data.at(-1).net+=100000;
  assert.equal(model.update(data,opts(14)).ready,false);
  assert.equal(model.groups.get(model.active.id).segments.length,0);
 }
});
test('adjacent candle rollover uses final closed tail and preserves group state',()=>{
 const model=new FlowPriceReaction();
 for(let i=0;i<=13;i++){const o=opts(i);o.time=start+step-43000+3000*i;o.now=o.time;model.update(rows(i),o);}
 assert.equal(model.result.ready,true);
 const final={...rows(13).at(-1),q:41000,net:27000,end:start+step-1};
 const next={t:start+step,end:start+2*step-1,o:100.026,c:100.03,h:101,l:99,q:4000,net:2000};
 const result=model.update([...baseline,final,next],{step,time:start+step+2000,now:start+step+2000,fresh:true});
 assert.equal(result.ready,true);assert.equal(result.label,'MUA ĐẨY GIÁ');
 assert.equal(model.groups.get(model.active.id).segments.at(-1).quote,5000);
});
test('missing final tail or timeframe change cannot reuse old group state',()=>{
 const model=warm(),data=rows(0);data.at(-1).t+=step;data.at(-1).end+=step;
 assert.equal(model.update(data,{step,time:start+step+1000,now:start+step+1000,fresh:true}).ready,false);
 assert.equal(model.update(rows(0),{...opts(0),step:300000}).ready,false);
});
test('revisiting an old group does not resurrect its confirmed text',()=>{
 const model=warm(),record=model.groups.get(model.active.id),old=record.stable.lastSupported;
 const result=model.resolve(record,{ready:false,reason:'warmup'},old+30000,model.options);
 assert.equal(result.ready,false);
});
