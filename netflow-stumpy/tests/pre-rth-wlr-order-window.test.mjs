import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('incremental rank and quantile equal the original 4,000-sample window including ties and eviction',async()=>{
  const source=await readFile(new URL('../pre-rth-wlr-trend.mjs',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('function rollingOrderWindow('),source.indexOf('export function quantile'));
  const context={};vm.runInNewContext('const clamp01=value=>Math.max(0,Math.min(1,value));'+body+';this.window=rollingOrderWindow();',context);
  const window=context.window,reference=[];
  assert.equal(window.rank(0),0);assert.equal(window.quantile(.7),null);
  for(let i=0;i<8500;i++){
    const value=i%7===0?0:(i*7919%1009)/11-40;
    if(i%37===0){
      const sorted=[...reference].sort((a,b)=>a-b),pos=(sorted.length-1)*.7,lo=Math.floor(pos),hi=Math.ceil(pos);
      assert.equal(window.rank(value),reference.length?reference.filter(x=>x<=value).length/reference.length:0);
      assert.equal(window.quantile(.7),sorted.length?sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo):null);
      assert.equal(window.length,reference.length);
    }
    reference.push(value);if(reference.length>4000)reference.shift();window.push(value);
  }
});
