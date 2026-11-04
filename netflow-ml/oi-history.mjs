const STEPS={'5m':300000,'15m':900000,'30m':1800000,'1h':3600000};
const RETENTION=90*86400000;
const sameSamples=(a,b)=>a.length===b.length&&a.every((row,i)=>row.timestamp===b[i].timestamp&&row.sumOpenInterest===b[i].sumOpenInterest);
// Persist raw observations, so pin-filter changes can be replayed honestly.
// Interval and symbol are isolated; no sample fills a missing OI period.
export function mergeOiHistory(interval,groups,now,symbol='XAUUSDT'){
  const step=STEPS[interval],byTime=new Map();if(!step||!Number.isFinite(now))return [];
  for(const group of groups)for(const row of Array.isArray(group)?group:[]){
    const timestamp=Number(row?.timestamp),sumOpenInterest=Number(row?.sumOpenInterest);
    if(row?.symbol&&row.symbol!==symbol)continue;
    if(!Number.isSafeInteger(timestamp)||timestamp<=0||timestamp>now||timestamp<now-RETENTION-step||timestamp%step!==0||!Number.isFinite(sumOpenInterest)||sumOpenInterest<=0)continue;
    byTime.set(timestamp,{timestamp,sumOpenInterest,symbol});
  }
  return [...byTime.values()].sort((a,b)=>a.timestamp-b.timestamp);
}
let database;
function openDatabase(){
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const request=globalThis.indexedDB.open('netflow-ml-oi-history',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('observations');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('OI history database blocked'));
  }).catch(error=>{database=null;throw error;});
  return database;
}
const key=(interval,symbol)=>symbol+':'+interval;
async function readDatabase(interval,symbol){
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('observations','readonly'),request=tx.objectStore('observations').get(key(interval,symbol));
    request.onsuccess=()=>resolve(request.result?.version===1?request.result.samples:[]);
    request.onerror=()=>reject(request.error);tx.onabort=()=>reject(tx.error);
  });
}
async function mergeDatabase(interval,samples,now,symbol){
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('observations','readwrite'),store=tx.objectStore('observations'),request=store.get(key(interval,symbol));let merged;
    request.onsuccess=()=>{merged=mergeOiHistory(interval,[request.result?.version===1?request.result.samples:[],samples],now,symbol);store.put({version:1,savedAt:now,samples:merged},key(interval,symbol));};
    tx.oncomplete=()=>resolve(merged);tx.onerror=tx.onabort=()=>reject(tx.error);
  });
}
// Small synchronous snapshot paints OI before IndexedDB or the network responds.
function readHot(interval,symbol){try{return JSON.parse(globalThis.localStorage?.getItem('netflow-ml-oi-hot:'+symbol+':'+interval)??'null')?.samples??[];}catch{return [];}}
function writeHot(interval,samples,symbol){try{globalThis.localStorage?.setItem('netflow-ml-oi-hot:'+symbol+':'+interval,JSON.stringify({version:1,samples:samples.slice(-500)}));}catch{}}
export class OiHistory {
  constructor({symbol='XAUUSDT',read=(i)=>readDatabase(i,symbol),write=(i,s,n)=>mergeDatabase(i,s,n,symbol),readSnapshot=(i)=>readHot(i,symbol),writeSnapshot=(i,s)=>writeHot(i,s,symbol)}={}){if(!['XAUUSDT','EURUSDT'].includes(symbol))throw Error('Unsupported OI symbol');this.symbol=symbol;this.read=read;this.write=write;this.readSnapshot=readSnapshot;this.writeSnapshot=writeSnapshot;this.hotLoaded=new Set();this.memory=new Map();this.loaded=new Set();this.saved=new Map();}
  peek(interval,now){if(!this.hotLoaded.has(interval)){this.hotLoaded.add(interval);try{this.memory.set(interval,mergeOiHistory(interval,[this.readSnapshot(interval),this.memory.get(interval)],now,this.symbol));}catch{}}return {samples:mergeOiHistory(interval,[this.memory.get(interval)],now,this.symbol),saved:this.saved.get(interval)===true};}
  stage(interval,incoming,now){
    this.peek(interval,now);
    const samples=mergeOiHistory(interval,[this.memory.get(interval),incoming],now,this.symbol);this.memory.set(interval,samples);this.saved.set(interval,false);try{this.writeSnapshot(interval,samples);}catch{}
    return {samples,saved:false};
  }
  async load(interval,now){
    this.peek(interval,now);
    if(!this.loaded.has(interval)){
      try{const disk=mergeOiHistory(interval,[await this.read(interval)],now,this.symbol),merged=mergeOiHistory(interval,[disk,this.memory.get(interval)],now,this.symbol);this.memory.set(interval,merged);this.saved.set(interval,sameSamples(disk,merged));this.loaded.add(interval);try{this.writeSnapshot(interval,merged);}catch{}}catch{this.saved.set(interval,false);}
    }
    return {samples:mergeOiHistory(interval,[this.memory.get(interval)],now,this.symbol),saved:this.saved.get(interval)===true};
  }
  async append(interval,incoming,now){
    this.stage(interval,incoming,now);await this.load(interval,now);
    const samples=mergeOiHistory(interval,[this.memory.get(interval)],now,this.symbol);
    try{const persisted=await this.write(interval,samples,now),merged=mergeOiHistory(interval,[persisted,this.memory.get(interval)],now,this.symbol);this.memory.set(interval,merged);this.saved.set(interval,sameSamples(persisted,merged));}
    catch{this.saved.set(interval,false);}
    return {samples:this.memory.get(interval),saved:this.saved.get(interval)};
  }
}
