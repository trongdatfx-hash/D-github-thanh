import {COMPOSITE_STRENGTH_VERSION} from './engine.mjs?v=20261029-price-delta1';
import {forecastQuery,forecastCandidates,predictPath,projectPath,MODEL_NAMES} from './rth-forecast-core.mjs?v=20261029-price-delta1';
import {shapeDistance} from './analogs-core.mjs?v=20261029-price-delta1';
import {attachPivotStates} from './rth-pivot.mjs?v=20261029-price-delta1';
let libraryPromise=null;
function library(){return libraryPromise??=Promise.all(['archive','report'].map(async name=>{const r=await fetch(`data/rth-forecast/${name}.json`,{cache:'no-cache'});if(!r.ok)throw Error('Chưa có thư viện đường RTH');const value=await r.json();if(value.strengthVersion!==COMPOSITE_STRENGTH_VERSION)throw Error('Đang xây lại thư viện RTH theo Composite D common');return value;})).catch(e=>{libraryPromise=null;throw e;});}
self.onmessage=async({data:{id,features,now,mode='AUTO'}})=>{
 try{
  const [archive,report]=await library(),statistical=Object.keys(report.validation).filter(m=>m!=='FLAT').sort((a,b)=>(report.validation[a].pathMaePct??Infinity)-(report.validation[b].pathMaePct??Infinity))[0],model=mode==='STAT'?statistical:report.selectedModel;
  self.postMessage({id,selection:{model,automatic:report.selectedModel,statistical,validation:report.validation,test:report.test,testStart:report.testStart,sourceAsOf:report.sourceAsOf}});
  if(!model||!report.selectedModel)throw Error('Chưa đủ ngày validation để chọn đường');
  const queryRows=model.startsWith('PIVOT')?attachPivotStates(features):features,q=forecastQuery(queryRows,{now});if(!q)throw Error('Cần đủ 8 nến M15 sắp tới nằm trọn trong RTH và dữ liệu chart còn mới');
  if(q.targetDay<report.testStart)throw Error('Mốc chart trước thời điểm chọn mô hình; không vẽ hồi cứu bằng lựa chọn tương lai');
  const candidates=forecastCandidates(archive.cases,q);if(candidates.length<20)throw Error('Chưa đủ 20 ngày cùng phút RTH trong quá khứ');
  const rankings={};if(!['FLAT','PRIOR'].includes(model)){const m=model.endsWith('16')?16:8,query=queryRows.slice(-m);rankings[m]=candidates.map(c=>({index:c.startIndex,distance:shapeDistance(query,archive.rows.slice(c.i-m+1,c.i+1),{technique:'price-volume'})})).sort((a,b)=>a.distance-b.distance||a.index-b.index);}
  const prediction=predictPath(q,candidates,model,rankings);if(prediction.n<12)throw Error('Chưa đủ 12 mẫu cho đường tham chiếu');
  self.postMessage({id,result:{...prediction,...projectPath(prediction,q),model,modelName:MODEL_NAMES[model],test:report.test[model],validation:report.validation[model],sourceAsOf:archive.sourceAsOf,candidateN:candidates.length,clock:q.clockMinute,targetEnd:q.targetEnd}});
 }catch(e){self.postMessage({id,error:e.message});}
};
