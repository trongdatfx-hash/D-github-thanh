import {analyzeTrendSource,computeStudies} from './studies-core.mjs?v=20261021-age-audit1';
import {loadPersistentHistory} from './history-store.mjs?v=20261020-perf1';
let serial=0,trend=null,trendKey='',historyPending=null;
self.onmessage=async({data})=>{
  const token=++serial,started=performance.now();
  try{
    let history=null;
    try{
      if(!historyPending)historyPending=loadPersistentHistory({days:365}).finally(()=>{historyPending=null;});
      history=await historyPending;
    }catch{}
    if(token!==serial)return;
    const source=history?{...history,SPYUSDT:merge(history.SPYUSDT,data.raw.interval==='15m'?data.raw.SPYUSDT:[]),QQQUSDT:merge(history.QQQUSDT,data.raw.interval==='15m'?data.raw.QQQUSDT:[])}:data.raw.interval==='15m'?data.raw:null;
    if(source){
      const stamp=['SPYUSDT','QQQUSDT'].map(s=>{const a=source[s].filter(r=>r.end<data.now);return `${a[0]?.t}:${a.at(-1)?.t}:${a.length}`;}).join('|');
      if(stamp!==trendKey){trend=analyzeTrendSource(source,data.now);trendKey=stamp;}
    }else{trend=null;trendKey='';}
    const result=computeStudies({...data,trend});
    if(token===serial)self.postMessage({key:data.key,result,archive:history?.manifest??null,computeMs:performance.now()-started});
  }catch(error){if(token===serial)self.postMessage({key:data.key,error:error.message});}
};
function merge(a=[],b=[]){const map=new Map(a.map(r=>[r.t,r]));for(const row of b)map.set(row.t,row);return [...map.values()].sort((x,y)=>x.t-y.t);}



