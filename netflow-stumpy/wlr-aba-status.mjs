// Data freshness, model selection and evidence are independent states.
export const M15=900000, SNAPSHOT_TTL=60000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function snapshotKey(report){return report?String(report.snapshotId??[report.publishedAt,report.sourceAsOf,report.collection?.checkedAt].join(':')):'';}
export function chartFresh(data,now,receivedAt,wallNow=Date.now()){
 if(!data||!finite(now)||!finite(receivedAt)||wallNow-receivedAt<0||wallNow-receivedAt>=15000)return false;
 const step=({'5m':300000,'15m':M15,'30m':1800000,'1h':3600000})[data.interval];
 return Boolean(step&&['SPYUSDT','QQQUSDT'].every(s=>{
  const last=data[s]?.at(-1);return finite(last?.t)&&finite(last?.end)&&last.t<=now&&now-last.end<=15000;
 }));
}
export function collectionState(report,now){
 const c=report?.collection,times=['SPYUSDT','QQQUSDT'].map(s=>c?.lastTimeBySymbol?.[s]);
 if(!finite(now)||!times.every(finite)||times.some(t=>t+M15>now)||!['live','delayed'].includes(c?.status)||!['rest','daily-archive'].includes(c?.source))return {status:'UNKNOWN',source:c?.source??'unknown',lagHours:null,lastClose:null};
 const lastClose=Math.min(...times)+M15,lagHours=Math.max(0,now-lastClose)/3600000;
 return {status:c.source==='daily-archive'||c.status==='delayed'||now-lastClose>M15+15000?'DELAYED':'LIVE',source:c.source,lagHours,lastClose};
}
export function activePolicy(report){return report?.activePolicyVersion===3?report.v3?.version===3?report.v3:null:report?.activePolicyVersion==null||report.activePolicyVersion===2?report?.v2:null;}
export function policyKey(policy){return policy?JSON.stringify({...(policy.version===3?{version:3,policyId:policy.policyId}:{}),model:policy.selectedModel,calibration:policy.calibration,gate:policy.gate}):'';}
// Passing a retrospective filter is separate from permission to use a signal.
export function usableSignal(track,report,now,{verified=false,live=false}={}){
 const blocked=reason=>({emit:false,reason});
 if(!live)return blocked('WAIT_LIVE');
 if(!verified||!report)return blocked('WAIT_SNAPSHOT');
 const policy=activePolicy(report);
 if(!policy)return blocked('WAIT_POLICY');
 if(policy.version===3&&(!policy.policyId||!Number.isFinite(policy.forwardOpen)||policy.freeze?.status!=='FROZEN'||policy.freeze?.id!==policy.policyId))return blocked('WAIT_POLICY_FREEZE');
 if(policy.status!=='READY')return blocked(policy.status??'WAIT_POLICY');
 if(!policy.gate)return blocked('WAIT_GATE_VALIDATION');
 if(track?.policyKey!==policyKey(policy))return blocked('POLICY_CHANGED');
 if(policy.version===3&&now<policy.forwardOpen)return blocked('WAIT_FORWARD_START');
 if(collectionState(report,now).status!=='LIVE')return blocked('DELAYED_ARCHIVE');
 if(report.decision!=='PROMISING_REQUIRES_FUTURE_VALIDATION')return blocked(report.decision??'NOT_ESTABLISHED');
 // Date-based forward replay is not an immutable live prediction ledger.
 // Existing publishers supply no prospective validation. Stay research-only until
 // a separately audited ledger and promotion protocol exist; never infer it from N>0.
 return blocked('FORWARD_NOT_VALIDATED');
}
export const reasonText=reason=>({WAIT_POLICY_FREEZE:'chờ khóa cấu hình V3',WAIT_FORWARD_START:'V3 chờ forward từ 26/10/2026',WAIT_LIVE:'chờ dữ liệu chart còn mới',WAIT_SNAPSHOT:'chờ xác minh snapshot',WAIT_POLICY:'chưa có policy hợp lệ',WAIT_GATE_VALIDATION:'chờ kiểm định WAIT',WAIT_CALIBRATION:'chờ hiệu chỉnh',WAIT_SELECTION:'chờ chọn mô hình',POLICY_CHANGED:'policy đã đổi; giữ mẫu cũ để nghiên cứu',DELAYED_ARCHIVE:'kho nghiên cứu trễ hoặc chưa rõ độ mới',NOT_ESTABLISHED:'chưa xác lập lợi thế giá',FORWARD_NOT_VALIDATED:'chưa xác thực forward ghi nhận live',NEAR_BASE:'gần nền',BAND_CROSSES_WLR:'dải cắt WLR',CALIBRATION_DISAGREES:'tỷ lệ chưa đồng thuận P50',WAIT_HISTORY:'thiếu mẫu',MODEL_CHANGED:'bấm Theo WLR hiện tại để dùng mô hình mới',BEFORE_POLICY_WINDOW:'chưa tới giai đoạn policy'}[reason]??reason??'chờ dữ liệu');
