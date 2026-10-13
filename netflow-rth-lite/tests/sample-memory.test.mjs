import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSampleMemory,saveSampleMemory,sampleMemoryKey} from '../sample-memory.mjs';

class MemoryStorage{
  constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}
}
const record=(entryTime,h=3)=>({h,entryTime,exitTime:entryTime+h,availableAt:entryTime+h+1,groupKey:'RTH|1|1|1',detailKey:'d',baselineKey:'RTH|1',value:1,mfe:2,mae:.5});

test('sample memory persists, deduplicates and caps causal outcome records',()=>{
  const storage=new MemoryStorage(),key=sampleMemoryKey('SPYUSDT','COMPOSITE','15m');
  assert.equal(saveSampleMemory(key,[record(1),record(2)],storage).count,2);
  assert.equal(saveSampleMemory(key,[{...record(2),value:2,mfe:3},record(3)],storage,{maxSamples:2}).count,2);
  const loaded=loadSampleMemory(key,storage);assert.deepEqual(loaded.samples.map(x=>x.entryTime),[2,3]);assert.equal(loaded.samples[0].value,2);assert.equal(loaded.samples[0].mfe,3);
});
