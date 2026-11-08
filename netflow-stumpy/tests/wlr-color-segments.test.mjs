import test from 'node:test';import assert from 'node:assert/strict';import {wlrColorSegments} from '../wlr-color-segments.mjs';
import {h1StripCell} from '../h1-h4-strip.mjs';
test('new candle color cannot paint backward over the previous candle endpoint',()=>{
 const s=wlrColorSegments({x:0,y:20,color:'green'},{x:10,y:10,color:'red'});
 assert.deepEqual(s,[{x1:0,y1:20,x2:5,y2:15,color:'green'},{x1:5,y1:15,x2:10,y2:10,color:'red'}]);
});
test('H1 transitions match the strip cell edge in both color and width',()=>{
 const M=900000,H=3600000,times=Array.from({length:8},(_,i)=>i*M),coord=t=>t*1000/M*10;
 const cell=h1StripCell(H,times,coord,10);
 const s=wlrColorSegments({x:30,y:10,color:'green',width:7},{x:40,y:20,color:'yellow',width:2});
 assert.equal(s[0].x2,cell.x);assert.equal(s[1].x1,cell.x);assert.equal(s[0].width,7);assert.equal(s[1].width,2);
 const same=wlrColorSegments({x:0,y:0,color:'red',width:2},{x:10,y:10,color:'red',width:6});assert.equal(same.length,2);assert.equal(same[0].width,2);assert.equal(same[1].width,6);
});
test('same colors stay a single segment; a neutral transition belongs to its own side',()=>{
 assert.equal(wlrColorSegments({x:0,y:0,color:'green'},{x:10,y:10,color:'green'}).length,1);
 const s=wlrColorSegments({x:10,y:5,color:'red'},{x:20,y:15,color:'yellow'});assert.equal(s[0].color,'red');assert.equal(s[1].color,'yellow');assert.equal(s[0].x2,s[1].x1);
});

