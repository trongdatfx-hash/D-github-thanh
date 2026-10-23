import {updateAba} from './wlr-aba-live.mjs?v=20261023-v3fix1';
import {createSnapshotLoader} from './wlr-aba-snapshot.mjs?v=20261023-v3fix1';
const library=createSnapshotLoader();
let state=null,serial=0;
self.onmessage=async({data})=>{
 if(data.type==='refresh'){
  try{const [,report]=await library({force:true});self.postMessage({type:'snapshot',report});}
  catch(e){self.postMessage({type:'snapshot-error',error:e.message});}return;
 }
 const token=++serial;
 try{
  const [archive,report]=await library();if(token!==serial)return;
  if(data.restore&&!state)state=data.restore;
  const result=updateAba({rows:data.rows,archive,report,now:data.now,previous:state,reset:data.reset});state=result.state;
  self.postMessage({id:data.id,result,report});
 }catch(e){if(token===serial)self.postMessage({id:data.id,error:e.message});}
};
