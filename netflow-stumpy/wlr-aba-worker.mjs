import {updateAba} from './wlr-aba-live.mjs?v=20261022-europe1';
import {SPEC} from './wlr-aba-core.mjs?v=20261022-europe1';
let libraryPromise=null,state=null,serial=0;
function library(){return libraryPromise??=Promise.all(['archive','report'].map(async name=>{const response=await fetch(`data/wlr-aba/${name}.json`,{cache:'no-cache'});if(!response.ok)throw Error('Chưa tải được kho A–B–A');return response.json();})).then(([archive,report])=>{if(archive.schema!=='wlr-aba-v2'||report.schema!=='wlr-aba-v2'||archive.inputScope!==SPEC.inputScope||report.spec?.inputScope!==SPEC.inputScope||archive.sourceAsOf!==report.sourceAsOf)throw Error('Kho và báo cáo A–B–A từ mở cửa châu Âu đang cập nhật; thử lại sau');if(report.v2?.version!==2)throw Error('A–B–A V2 đang tính chọn hướng, hiệu chỉnh và WAIT; thử lại sau');return [archive,report];}).catch(e=>{libraryPromise=null;throw e;});}
self.onmessage=async({data})=>{
 const token=++serial;
 try{
  const [archive,report]=await library();if(token!==serial)return;
  if(data.restore&&!state)state=data.restore;
  const result=updateAba({rows:data.rows,archive,report,now:data.now,previous:state,reset:data.reset});state=result.state;
  self.postMessage({id:data.id,result});
 }catch(e){if(token===serial)self.postMessage({id:data.id,error:e.message});}
};
