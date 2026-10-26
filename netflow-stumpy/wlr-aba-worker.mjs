import {updateAba,historicalAbaBandRanges} from './wlr-aba-live.mjs?v=20261026-aba-history1';
import {createSnapshotLoader} from './wlr-aba-snapshot.mjs?v=20261025-dcommon-all1';
const library=createSnapshotLoader();
let state=null,serial=0,bandSnapshot='',historyBands=[];
function bandHistory(archive,report){
 const key=String(report.snapshotId??[report.sourceAsOf,report.publishedAt].join(':'));
 if(key!==bandSnapshot){historyBands=historicalAbaBandRanges(archive,report);bandSnapshot=key;}
 return historyBands;
}
self.onmessage=async({data})=>{
 if(data.type==='refresh'){
  try{const [archive,report]=await library({force:true});self.postMessage({type:'snapshot',report,historyBands:bandHistory(archive,report)});}
  catch(e){self.postMessage({type:'snapshot-error',error:e.message});}return;
 }
 const token=++serial;
 try{
  const [archive,report]=await library();if(token!==serial)return;
  if(data.restore&&!state)state=data.restore;
  const result=updateAba({rows:data.rows,archive,report,now:data.now,previous:state,reset:data.reset});state=result.state;
  self.postMessage({id:data.id,result,report,historyBands:bandHistory(archive,report)});
 }catch(e){if(token===serial)self.postMessage({id:data.id,error:e.message});}
};

