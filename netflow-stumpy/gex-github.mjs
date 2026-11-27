import {parseGex} from './gex-profile.mjs?v=20261126-gex3';
import {gexMapping} from './gex-calibration.mjs?v=20261126-gex3';
export const GEX_SHARED_PATH='netflow-stumpy/data/gex-shared.json';
const API='https://api.github.com/repos/trongdatfx-hash/D-github-thanh/contents/'+GEX_SHARED_PATH;
export function encodeGexJson(value){
  const bytes=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
function decode(value){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
export function normalizeSharedGex(data){
  if(data?.version!==1||data.symbol!=='SPYUSDT'||typeof data.text!=='string'||typeof data.revision!=='string'||!data.revision)throw Error('Bản GEX chung không hợp lệ.');
  const parsed=parseGex(data.text),stamp=Date.parse(data.publishedAt);
  if(!Number.isFinite(stamp))throw Error('Bản GEX chung thiếu thời điểm lưu.');
  const mapping=gexMapping(data.mapping??{mode:'BASIS',basis:parsed.spread,scale:10});
  return {...data,mapping,version:2,loadedAt:stamp,savedAt:stamp,draft:data.text,enabled:data.enabled!==false,origin:'github',sharedRevision:data.revision};
}
export function sharedGexPayload(state,{label='GEX lưu từ web',now=Date.now(),revision}={}){
  parseGex(state.text);const mapping=gexMapping(state.mapping);
  // Whitelist only data fields. The GitHub credential never enters a snapshot.
  return {version:1,symbol:'SPYUSDT',revision:revision??now.toString(36)+'-'+Math.random().toString(36).slice(2),publishedAt:new Date(now).toISOString(),sourceLabel:String(label).slice(0,120),text:state.text,mapping,enabled:state.enabled!==false};
}
export function shouldLoadSharedGex(current,remote){
  if(!current)return true;
  if(current.sharedRevision===remote.sharedRevision)return false;
  if(current.draft&&current.draft!==current.text)return false;
  if(!current.text)return true;
  return current.origin==='github'&&remote.loadedAt>(current.loadedAt??0);
}
async function request(fetcher,url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{return await fetcher(url,{...options,signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}
}
function failure(status){
  const message=status===401?'Token GitHub không hợp lệ hoặc đã hết hạn.':status===403?'GitHub từ chối quyền ghi hoặc đang giới hạn truy cập. Cần Contents: Read and write cho đúng repository.':status===409?'Bản GitHub vừa thay đổi. Nạp lại bản chung trước khi lưu tiếp; chưa ghi đè dữ liệu.':'GitHub HTTP '+status+' · chưa lưu bản chung.';
  const error=Error(message);error.status=status;return error;
}
export async function fetchSharedGex(fetcher=fetch){
  try{
    const response=await request(fetcher,API+'?ref=main',{headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw failure(response.status);
    const file=await response.json();return normalizeSharedGex(JSON.parse(decode(file.content)));
  }catch{
    const response=await request(fetcher,new URL('./data/gex-shared.json',import.meta.url).href+'?t='+Date.now());
    if(!response.ok)throw Error('Chưa tải được GEX chung (HTTP '+response.status+'). Dữ liệu trên thiết bị được giữ nguyên.');
    return normalizeSharedGex(await response.json());
  }
}
export async function publishGexToGitHub({token,state,fetcher=fetch,label}){
  const credential=String(token??'').trim();if(!credential)throw Error('Nhập token GitHub có quyền Contents: Read and write trước khi lưu.');
  const payload=sharedGexPayload(state,{label});
  const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+credential,'X-GitHub-Api-Version':'2022-11-28'};
  const before=await request(fetcher,API+'?ref=main',{headers});
  let sha;if(before.ok){sha=(await before.json()).sha;if(typeof sha!=='string'||!sha)throw Error('Không đọc được phiên bản file GitHub hiện tại.');}else if(before.status!==404)throw failure(before.status);
  const body={message:'data: publish shared GEX from web',content:encodeGexJson(payload),branch:'main',...(sha?{sha}:{})};
  const response=await request(fetcher,API,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw failure(response.status);
  const result=await response.json();if(!result.commit?.sha)throw Error('GitHub chưa xác nhận commit; chưa đánh dấu đã lưu.');
  return {state:normalizeSharedGex(payload),commit:result.commit.sha};
}
