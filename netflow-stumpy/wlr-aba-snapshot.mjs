import {snapshotKey,SNAPSHOT_TTL,activePolicy} from './wlr-aba-status.mjs?v=20261023-v3fix1';
import {SPEC} from './wlr-aba-core.mjs?v=20261022-europe1';
export function validateSnapshot(archive,report){
 if(archive?.schema!=='wlr-aba-v2'||report?.schema!=='wlr-aba-v2'||archive.inputScope!==SPEC.inputScope||report.spec?.inputScope!==SPEC.inputScope||archive.sourceAsOf!==report.sourceAsOf)throw Error('WAIT · kho và báo cáo A–B–A không đồng bộ');
 if(report.activePolicyVersion===3&&(!activePolicy(report)||!report.v3.policyId||!Number.isFinite(report.v3.forwardOpen)||report.v3.freeze?.status!=='FROZEN'||report.v3.freeze.id!==report.v3.policyId||archive.activePolicyVersion!==3||archive.policyId!==report.v3.policyId))throw Error('WAIT · kho V3 và cấu hình đã khóa không khớp');
 if(report.v2?.version!==2)throw Error('WAIT · chưa có policy A–B–A V2');
 if(report.snapshotId||archive.snapshotId){if(!report.snapshotId||archive.snapshotId!==report.snapshotId)throw Error('WAIT · phiên bản archive/report không khớp');}
 else if(JSON.stringify(archive.collection)!==JSON.stringify(report.collection))throw Error('WAIT · nguồn archive/report không khớp');
 return [archive,report];
}
export function createSnapshotLoader({get=fetch,clock=Date.now}={}){
 let value=null,loadedAt=0,pending=null;
 const read=async url=>{const r=await get(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('WAIT · không tải được snapshot A–B–A');return r.json();};
 return async function load({force=false}={}){
  if(pending)return pending;
  if(!force&&value&&clock()-loadedAt<SNAPSHOT_TTL)return value;
  pending=(async()=>{
   const report=await read('data/wlr-aba/report.json?ts='+clock());
   const archive=await read('data/wlr-aba/archive.json?v='+encodeURIComponent(snapshotKey(report)));
   if(!report.snapshotId&&snapshotKey(await read('data/wlr-aba/report.json?ts='+clock()))!==snapshotKey(report))throw Error('WAIT · snapshot đang được publish; chờ đồng bộ');
   value=validateSnapshot(archive,report);loadedAt=clock();return value;
  })().catch(e=>{value=null;loadedAt=0;throw e;}).finally(()=>{pending=null;});
  return pending;
 };
}
