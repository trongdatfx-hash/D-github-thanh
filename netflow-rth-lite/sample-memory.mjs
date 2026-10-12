const PREFIX='netflow-rth-samples-v1:';
const valid=x=>x&&[x.h,x.entryTime,x.exitTime,x.availableAt,x.value].every(Number.isFinite)&&['groupKey','detailKey','baselineKey'].every(k=>typeof x[k]==='string');
const id=x=>`${x.h}|${x.entryTime}`;

const defaultStorage=()=>{try{return globalThis.localStorage;}catch{return null;}};

export function loadSampleMemory(key,storage=defaultStorage()){
  try{
    const payload=JSON.parse(storage?.getItem(PREFIX+key)??'null'),samples=Array.isArray(payload?.samples)?payload.samples.filter(valid):[];
    return {samples,updated:Number.isFinite(payload?.updated)?payload.updated:0,available:Boolean(storage)};
  }catch{return {samples:[],updated:0,available:false};}
}

export function saveSampleMemory(key,newSamples,storage=defaultStorage(),{maxSamples=20000}={}){
  if(!storage||!Array.isArray(newSamples))return {count:0,available:false};
  const old=loadSampleMemory(key,storage).samples,merged=new Map(old.map(x=>[id(x),x]));
  let changed=false;
  for(const sample of newSamples)if(valid(sample)){const previous=merged.get(id(sample));if(!previous||previous.value!==sample.value||previous.groupKey!==sample.groupKey||previous.detailKey!==sample.detailKey||previous.baselineKey!==sample.baselineKey){merged.set(id(sample),sample);changed=true;}}
  let samples=[...merged.values()].sort((a,b)=>a.entryTime-b.entryTime).slice(-maxSamples);
  if(!changed&&samples.length===old.length)return {count:old.length,available:true};
  const write=()=>storage.setItem(PREFIX+key,JSON.stringify({updated:Date.now(),samples}));
  try{write();return {count:samples.length,available:true};}catch{}
  // If the origin quota is full, discard the least recently used memories for
  // other chart configurations before reducing this active configuration.
  try{
    const others=[];for(let i=0;i<storage.length;i++){const itemKey=storage.key(i);if(!itemKey?.startsWith(PREFIX)||itemKey===PREFIX+key)continue;try{const payload=JSON.parse(storage.getItem(itemKey));others.push({itemKey,updated:payload?.updated??0});}catch{others.push({itemKey,updated:0});}}
    others.sort((a,b)=>a.updated-b.updated);for(const other of others){storage.removeItem(other.itemKey);try{write();return {count:samples.length,available:true};}catch{}}
    while(samples.length>1000){samples=samples.slice(Math.floor(samples.length/2));try{write();return {count:samples.length,available:true};}catch{}}
  }catch{}
  return {count:old.length,available:false};
}

export const sampleMemoryKey=(priceSymbol,source,interval)=>`${priceSymbol}|${source}|${interval}`;
