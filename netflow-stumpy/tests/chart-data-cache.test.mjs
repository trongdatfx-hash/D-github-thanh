import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeriesWriter} from '../chart-data-cache.mjs';
test('intrabar update uses latest item; close, history shift and mode changes reset data',()=>{
 const calls=[],series={setData:data=>calls.push(['set',data]),update:data=>calls.push(['update',data])},write=createSeriesWriter();
 write('p',series,[{time:1,value:1},{time:2,value:2}],'a');
 write('p',series,[{time:1,value:1},{time:2,value:3}],'a');
 write('p',series,[{time:1,value:1},{time:2,value:3},{time:3,value:4}],'a');
 write('p',series,[{time:2,value:3},{time:3,value:4},{time:4,value:5}],'a');
 write('p',series,[{time:2,value:3},{time:3,value:4},{time:4,value:5}],'b');
 write('p',series,[],'b');
 assert.deepEqual(calls.map(x=>x[0]),['set','update','set','set','set','set']);assert.equal(calls[1][1].value,3);
});
