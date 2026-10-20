import {strengthStatistics} from './strength-stats.mjs';
import {flowAlignment} from './engine.mjs';
self.onmessage=({data})=>{try{
  const alignment=flowAlignment(data.rows.SPYUSDT??[],data.rows.QQQUSDT??[],{step:data.step});
  const stats=strengthStatistics({...data.rows,alignment},data.symbol,data.source,data.step);
  self.postMessage({id:data.id,symbol:data.symbol,source:data.source,stats});
}catch(error){self.postMessage({id:data.id,error:error.message});}};
