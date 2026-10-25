import test from 'node:test';
import assert from 'node:assert/strict';
import {pivotNetflowLine,pivotNetflowLineData} from '../pivot-netflow-line.mjs';
import {pivotFlowBetween,pivotFlowRealtime} from '../pivot-zones.mjs';
const step=900000,start=Date.parse('2026-10-20T08:00:00Z');
function fixture(){const price=Array.from({length:160},(_,i)=>{const c=100+5*Math.sin(i/3)+i*.01,t=start+i*step;return {t,end:t+step-1,o:c-.1,c,h:c+.3,l:c-.3};}),flow=price.map((r,i)=>({t:r.t,net:Math.sin(i/9)*1000,q:2000+i*10}));return {price,flow};}
test('each historical point matches REV6 realtime percent at that prefix',()=>{
 const {price,flow}=fixture(),actual=pivotNetflowLine(price,flow,{now:price.at(-1).end+1});
 assert(actual.some(x=>x.mode==='pivot'));assert(actual.some(x=>x.mode==='rolling'));
 for(let i=3;i<price.length;i++){
  const prefix=price.slice(0,i+1),anchor=prefix.length>=40?pivotFlowBetween(prefix,flow):null;
  const expected=pivotFlowRealtime(anchor,prefix,flow,price[i].end+1);
  assert(Math.abs(actual[i].pct-expected.pct)<1e-10,'index '+i);
 }
});
test('open candle updates flow without confirming an open pivot; later prices do not change history',()=>{
 const {price,flow}=fixture(),cut=price[100].t+1000,prefix=price.filter(r=>r.t<=cut);
 const past=pivotNetflowLine(prefix,flow,{now:cut});
 const full=pivotNetflowLine(price,flow,{now:cut});
 assert.deepEqual(full,past);assert(Number.isFinite(past.at(-1).pct));
 const closed=pivotNetflowLine(price,flow,{now:price.at(-1).end+1});
 assert.deepEqual(closed.slice(0,100),past.slice(0,100));
});
test('missing flow, small histories, exact percent units and authoritative current readout',()=>{
 const {price,flow}=fixture();
 assert(pivotNetflowLine(price,[]).every(x=>x.pct===null));
 const short=pivotNetflowLine(price.slice(0,3),flow,{now:price[2].end+1});assert(short.every(x=>x.pct===null));
 const fromTime=price.at(-4).t,latestFlow={latestTime:price.at(-1).t,pct:-12.34};
 const data=pivotNetflowLine(price,flow,{now:price.at(-1).end+1,fromTime,latestFlow});
 assert.equal(data.length,4);assert.equal(data.at(-1).pct,-12.34);assert.equal(pivotNetflowLineData(data).at(-1).value,-12.34);assert.equal(pivotNetflowLineData(data).at(-1).color,'#ff4d70');
});
