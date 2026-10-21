import {updateAba} from './wlr-aba-live.mjs';
let libraryPromise=null,state=null,serial=0;
function library(){return libraryPromise??=Promise.all(['archive','report'].map(async name=>{const response=await fetch(`data/wlr-aba/${name}.json`,{cache:'no-cache'});if(!response.ok)throw Error('Chưa tải được kho A–B–A');return response.json();})).then(([archive,report])=>{if(archive.schema!=='wlr-aba-v1'||archive.sourceAsOf!==report.sourceAsOf)throw Error('Kho và báo cáo A–B–A chưa đồng bộ; thử lại sau');return [archive,report];}).catch(e=>{libraryPromise=null;throw e;});}
self.onmessage=async({data})=>{
 const token=++serial;
 try{
  const [archive,report]=await library();if(token!==serial)return;
  if(data.restore&&!state)state=data.restore;
  const result=updateAba({rows:data.rows,archive,report,now:data.now,previous:state,reset:data.reset});state=result.state;
  self.postMessage({id:data.id,result});
 }catch(e){if(token===serial)self.postMessage({id:data.id,error:e.message});}
};
