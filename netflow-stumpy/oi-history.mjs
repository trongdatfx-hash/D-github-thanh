const STEPS={'5m':300000,'15m':900000,'30m':1800000,'1h':3600000};
const RETENTION=90*86400000;
const sameSamples=(a,b)=>a.length===b.length&&a.every((row,i)=>row.timestamp===b[i].timestamp&&row.sumOpenInterest===b[i].sumOpenInterest);
// Persist raw observations, so pin-filter changes can be replayed honestly.
// Interval and symbol are isolated; no sample fills a missing OI period.
export function mergeOiHistory(interval,groups,now){
  const step=STEPS[interval],byTime=new Map();if(!step||!Number.isFinite(now))return [];
  for(const group of groups)for(const row of Array.isArray(group)?group:[]){
    const timestamp=Number(row?.timestamp),sumOpenInterest=Number(row?.sumOpenInterest);
    if(row?.symbol&&row.symbol!=='SPYUSDT')continue;
    if(!Number.isSafeInteger(timestamp)||timestamp<=0||timestamp>now||timestamp<now-RETENTION-step||timestamp%step!==0||!Number.isFinite(sumOpenInterest)||sumOpenInterest<=0)continue;
    byTime.set(timestamp,{timestamp,sumOpenInterest,symbol:'SPYUSDT'});
  }
  return [...byTime.values()].sort((a,b)=>a.timestamp-b.timestamp);
}
let database;
function openDatabase(){
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const request=globalThis.indexedDB.open('netflow-oi-history',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('observations');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('OI history database blocked'));
  }).catch(error=>{database=null;throw error;});
  return database;
}
const key=interval=>'SPYUSDT:'+interval;
async function readDatabase(interval){
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('observations','readonly'),request=tx.objectStore('observations').get(key(interval));
    request.onsuccess=()=>resolve(request.result?.version===1?request.result.samples:[]);
    request.onerror=()=>reject(request.error);tx.onabort=()=>reject(tx.error);
  });
}
async function mergeDatabase(interval,samples,now){
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('observations','readwrite'),store=tx.objectStore('observations'),request=store.get(key(interval));let merged;
    request.onsuccess=()=>{merged=mergeOiHistory(interval,[request.result?.version===1?request.result.samples:[],samples],now);store.put({version:1,savedAt:now,samples:merged},key(interval));};
    tx.oncomplete=()=>resolve(merged);tx.onerror=tx.onabort=()=>reject(tx.error);
  });
}
// Small synchronous snapshot paints OI before IndexedDB or the network responds.
function readHot(interval){try{return JSON.parse(globalThis.localStorage?.getItem('netflow-oi-hot:SPYUSDT:'+interval)??'null')?.samples??[];}catch{return [];}}
function writeHot(interval,samples){try{globalThis.localStorage?.setItem('netflow-oi-hot:SPYUSDT:'+interval,JSON.stringify({version:1,samples:samples.slice(-500)}));}catch{}}
export class OiHistory {
  constructor({read=readDatabase,write=mergeDatabase,readSnapshot=readHot,writeSnapshot=writeHot}={}){this.read=read;this.write=write;this.readSnapshot=readSnapshot;this.writeSnapshot=writeSnapshot;this.hotLoaded=new Set();this.memory=new Map();this.loaded=new Set();this.saved=new Map();}
  peek(interval,now){if(!this.hotLoaded.has(interval)){this.hotLoaded.add(interval);try{this.memory.set(interval,mergeOiHistory(interval,[this.readSnapshot(interval),this.memory.get(interval)],now));}catch{}}return {samples:mergeOiHistory(interval,[this.memory.get(interval)],now),saved:this.saved.get(interval)===true};}
  stage(interval,incoming,now){
    this.peek(interval,now);
    const samples=mergeOiHistory(interval,[this.memory.get(interval),incoming],now);this.memory.set(interval,samples);this.saved.set(interval,false);try{this.writeSnapshot(interval,samples);}catch{}
    return {samples,saved:false};
  }
  async load(interval,now){
    this.peek(interval,now);
    if(!this.loaded.has(interval)){
      try{const disk=mergeOiHistory(interval,[await this.read(interval)],now),merged=mergeOiHistory(interval,[disk,this.memory.get(interval)],now);this.memory.set(interval,merged);this.saved.set(interval,sameSamples(disk,merged));this.loaded.add(interval);try{this.writeSnapshot(interval,merged);}catch{}}catch{this.saved.set(interval,false);}
    }
    return {samples:mergeOiHistory(interval,[this.memory.get(interval)],now),saved:this.saved.get(interval)===true};
  }
  async append(interval,incoming,now){
    this.stage(interval,incoming,now);await this.load(interval,now);
    const samples=mergeOiHistory(interval,[this.memory.get(interval)],now);
    try{const persisted=await this.write(interval,samples,now),merged=mergeOiHistory(interval,[persisted,this.memory.get(interval)],now);this.memory.set(interval,merged);this.saved.set(interval,sameSamples(persisted,merged));}
    catch{this.saved.set(interval,false);}
    return {samples:this.memory.get(interval),saved:this.saved.get(interval)};
  }
}
