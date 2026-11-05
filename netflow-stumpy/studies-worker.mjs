import {analyzeTrendSource,computeStudies} from './studies-core.mjs?v=20261105-trend-spyv-h1-1';
import {loadPersistentHistory} from './history-store.mjs?v=20261029-price-delta1';
let serial=0,trend=null,trendKey='',historyPending=null;
function historyTask(){
  if(!historyPending)historyPending=loadPersistentHistory({days:365}).finally(()=>{historyPending=null;});
  return historyPending;
}
self.onmessage=async({data})=>{
  if(data.type==='prefetch'){
    try{const history=await historyTask();self.postMessage({type:'history-ready',archive:history.manifest});}
    catch{self.postMessage({type:'history-ready',archive:null});}
    return;
  }
  const token=++serial,started=performance.now();
  try{
    let history=null;
    try{
      history=await historyTask();
    }catch{}
    if(token!==serial)return;
    const source=history?{...history,SPYUSDT:merge(history.SPYUSDT,data.raw.interval==='15m'?data.raw.SPYUSDT:[]),QQQUSDT:merge(history.QQQUSDT,data.raw.interval==='15m'?data.raw.QQQUSDT:[])}:data.raw.interval==='15m'?data.raw:null;
    if(source){
      const stamp=['SPYUSDT','QQQUSDT'].map(s=>{const a=source[s].filter(r=>r.end<data.now);return `${a[0]?.t}:${a.at(-1)?.t}:${a.length}`;}).join('|')+'|'+JSON.stringify(history?.manifest??null)+'|'+(data.sourceKey??'');
      if(stamp!==trendKey){trend=analyzeTrendSource(source,data.now);trendKey=stamp;}
    }else{trend=null;trendKey='';}
    const result=computeStudies({...data,trend,onH1Ready:(h1CandleColors,h1H4CandleColors)=>{if(token===serial)self.postMessage({key:data.key,partial:'h1',result:{h1CandleColors,h1H4CandleColors},archive:history?.manifest??null});}});
    if(token===serial)self.postMessage({key:data.key,result,archive:history?.manifest??null,computeMs:performance.now()-started});
  }catch(error){if(token===serial)self.postMessage({key:data.key,error:error.message});}
};
function merge(a=[],b=[]){const map=new Map(a.map(r=>[r.t,r]));for(const row of b)map.set(row.t,row);return [...map.values()].sort((x,y)=>x.t-y.t);}

