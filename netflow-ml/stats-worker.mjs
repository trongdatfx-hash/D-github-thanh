import {strengthStatistics} from './strength-stats.mjs?v=20261025-dcommon-all1';
import {flowAlignment} from './engine.mjs?v=20261025-dcommon-all1';
self.onmessage=({data})=>{try{
  const alignment=flowAlignment(data.rows.SPYUSDT??[],data.rows.QQQUSDT??[],{step:data.step});
  const stats=strengthStatistics({...data.rows,alignment},data.symbol,data.source,data.step);
  self.postMessage({id:data.id,symbol:data.symbol,source:data.source,stats});
}catch(error){self.postMessage({id:data.id,error:error.message});}};
