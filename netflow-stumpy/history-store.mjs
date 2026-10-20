import {sessionAt,STEPS} from './engine.mjs';

const ROOT='./data/binance/m15/';
const MONTH_RE=/^\d{4}-\d{2}$/;
const CACHE_TTL=5*60*1000;
let cache=null,cacheAt=0;

function compactToBar(r){
  if(!Array.isArray(r)||r.length<9)throw Error('Shard lịch sử M15 không hợp lệ');
  const [t,o,h,l,c,v,end,q,buy]=r.map(Number);
  if(![t,o,h,l,c,v,end,q,buy].every(Number.isFinite)||end!==t+STEPS['15m']-1||v<0||q<0||buy<0||buy>q)throw Error('Bar lịch sử M15 không hợp lệ');
  return {t,o,h,l,c,v,end,q,buy,sell:q-buy,net:2*buy-q,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)};
}
function mergeBars(a,b){
  const map=new Map();
  for(const row of [...a,...b])map.set(row.t,row);
  return [...map.values()].sort((x,y)=>x.t-y.t);
}
export async function loadPersistentHistory({days=365,signal,live=null}={}){
  if(!cache||Date.now()-cacheAt>CACHE_TTL){
    const response=await fetch(ROOT+'manifest.json?ts='+Date.now(),{signal,cache:'no-store'});
    if(!response.ok)throw Error('History manifest chưa sẵn sàng');
    const manifest=await response.json();
    if(manifest?.interval!=='15m'||!Array.isArray(manifest.months))throw Error('History manifest không hợp lệ');
    const cutoff=(manifest.lastTime??Date.now())-days*86400000;
    const months=manifest.months.filter(x=>MONTH_RE.test(x)).filter(key=>{
      const [y,m]=key.split('-').map(Number),end=Date.UTC(y,m,1)-1;return end>=cutoff;
    });
    const docs=await Promise.all(months.map(async key=>{
      const r=await fetch(ROOT+key+'.json?ts='+(manifest.updatedAt??''),{signal,cache:'no-store'});
      if(!r.ok)throw Error('Thiếu shard '+key);return r.json();
    }));
    const archived={manifest,SPYUSDT:[],QQQUSDT:[]};
    for(const symbol of ['SPYUSDT','QQQUSDT'])archived[symbol]=docs.flatMap(doc=>(doc[symbol]??[]).map(compactToBar)).filter(x=>x.t>=cutoff);
    cache=archived;cacheAt=Date.now();
  }
  return {manifest:cache.manifest,SPYUSDT:mergeBars(cache.SPYUSDT,live?.SPYUSDT??[]),QQQUSDT:mergeBars(cache.QQQUSDT,live?.QQQUSDT??[])};
}
