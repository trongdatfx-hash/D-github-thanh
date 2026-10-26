import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeriesWriter} from '../chart-data-cache.mjs';
test('skips identical data, updates intrabar and appended bars, replaces corrected history',()=>{
 const calls=[],series={setData:data=>calls.push(['set',data]),update:data=>calls.push(['update',data])},write=createSeriesWriter();
 const data=[{time:1,value:1,color:'green'},{time:2,value:2}];
 write('p',series,data,'a');write('p',series,data.map(x=>({...x})),'a');assert.equal(calls.length,1);
 write('p',series,[data[0],{time:2,value:3}],'a');assert.equal(calls.at(-1)[0],'update');
 write('p',series,[data[0],{time:2,value:3},{time:3,value:4}],'a');assert.equal(calls.at(-1)[1].time,3);
 write('p',series,[{...data[0],color:'red'},{time:2,value:3},{time:3,value:4}],'a');assert.equal(calls.at(-1)[0],'set');
 write('p',series,[{time:2,value:3},{time:3,value:4},{time:4,value:5}],'a');assert.equal(calls.at(-1)[0],'set');
 write('p',series,[],'a');const n=calls.length;write('p',series,[],'a');assert.equal(calls.length,n);
});
test('display mode and series replacement invalidate cached data',()=>{
 const calls=[],make=()=>({setData:d=>calls.push('set'),update:d=>calls.push('update')}),write=createSeriesWriter(),data=[{time:1,value:1}];
 const series=make();write('p',series,data,'a');write('p',series,data,'b');write('p',make(),data,'b');assert.deepEqual(calls,['set','set','set']);
});
