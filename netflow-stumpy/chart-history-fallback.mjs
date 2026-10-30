import {loadPersistentHistory} from './history-store.mjs?v=20261030-chart-live2';

// A historical view never counts as a successful live response.
export async function chartHistoryFallback({interval,days,now=Date.now(),signal}){
 if(interval!=='15m')throw Error('Kho dự phòng chỉ có M15');
 const archive=await loadPersistentHistory({days,signal}),cutoff=now-days*86400000;
 const data={interval,days,serverTime:now,historical:true,contracts:[]};
 for(const symbol of ['SPYUSDT','QQQUSDT']){
  data[symbol]=archive[symbol].filter(r=>r.t>=cutoff&&r.end<now);
  if(!data[symbol].length)throw Error('Kho chưa có nến M15 trong cửa sổ đã chọn');
 }
 return data;
}
