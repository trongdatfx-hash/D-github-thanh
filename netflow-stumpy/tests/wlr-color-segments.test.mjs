import test from 'node:test';import assert from 'node:assert/strict';import {wlrColorSegments} from '../wlr-color-segments.mjs';
test('new candle color cannot paint backward over the previous candle endpoint',()=>{
 const s=wlrColorSegments({x:0,y:20,color:'green'},{x:10,y:10,color:'red'});
 assert.deepEqual(s,[{x1:0,y1:20,x2:5,y2:15,color:'green'},{x1:5,y1:15,x2:10,y2:10,color:'red'}]);
});
test('same colors stay a single segment; a neutral transition belongs to its own side',()=>{
 assert.equal(wlrColorSegments({x:0,y:0,color:'green'},{x:10,y:10,color:'green'}).length,1);
 const s=wlrColorSegments({x:10,y:5,color:'red'},{x:20,y:15,color:'yellow'});assert.equal(s[0].color,'red');assert.equal(s[1].color,'yellow');assert.equal(s[0].x2,s[1].x1);
});
