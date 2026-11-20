import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {h1CandleColorStates,buildWeeklyDailyPackets} from '../netflow-stumpy/weekly-trend-map.mjs';
const M=900000;
function fixture(start){
 const priceRows=Array.from({length:400},(_,i)=>{const t=start+i*M,c=100+Math.sin(i/7);return {t,end:t+M-1,o:c-.1,h:c+.2,l:c-.3,c,sourceComplete:true};});
 return {priceRows,volumeRows:priceRows.map(b=>({t:b.t,adjusted:.4})),now:priceRows.at(-1).t+M};
}

// Frozen outputs from the uncached implementation, including spring/fall DST
// and a live partial hour. Both a cold and warm cache must preserve them.
const references=[
[1772841600000,'014a102741166c29604e0aafbea6f18c6a105c6a9cc063ef0384d0706537d374'],
[1793404800000,'fe628991fecf575f239642d2559178c40d111c09e45f3d135b083d2e2815194b'],
[1795046400000,'8b95199b8679f2681232a8455035be1973c9ec288cae1b3cbdc3f235f8aad01e']
];
for(const [start,hash] of references)test('H1/H4/Daily clock cache preserves DST and preview at '+start,()=>{
 const input=fixture(start);
 for(let pass=0;pass<2;pass++){
  const output=[h1CandleColorStates(input),h1CandleColorStates({...input,boxHours:4}),buildWeeklyDailyPackets(input),h1CandleColorStates({...input,now:input.now-M/2})];
  assert.equal(createHash('sha256').update(JSON.stringify(output)).digest('hex'),hash);
 }
});
