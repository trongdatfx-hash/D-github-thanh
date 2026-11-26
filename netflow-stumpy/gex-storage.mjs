import {CHART_SETUP_KEY} from './chart-setup-state.mjs?v=20261122-setup1';
import {parseGex} from './gex-profile.mjs?v=20261126-gex3';
export const GEX_STORAGE_KEY='netflow:gex:v1';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function json(storage,key){try{return JSON.parse(storage?.getItem(key)||'null');}catch{return null;}}
function valid(value){
  if(!object(value)||typeof value.text!=='string'||value.text.length>1000000)return false;
  if(value.draft!==undefined&&(typeof value.draft!=='string'||value.draft.length>1000000))return false;
  if(value.text){try{parseGex(value.text);}catch{return false;}}
  return true;
}
export function readGexState(storage){
  const setup=json(storage,CHART_SETUP_KEY),candidates=[json(storage,GEX_STORAGE_KEY),setup?.gex].filter(valid);
  // Newer explicit empty state wins too: clearing GEX must not resurrect a backup.
  candidates.sort((a,b)=>(Number(b.savedAt)||Number(b.loadedAt)||0)-(Number(a.savedAt)||Number(a.loadedAt)||0));
  return candidates[0]??null;
}
export function writeGexState(storage,state){
  const snapshot={...state,version:2,savedAt:Date.now()};
  if(!valid(snapshot))throw Error('Bản lưu GEX không hợp lệ.');
  const result={snapshot,local:false,setup:false};
  try{const text=JSON.stringify(snapshot);storage.setItem(GEX_STORAGE_KEY,text);result.local=storage.getItem(GEX_STORAGE_KEY)===text;}catch{}
  try{
    const old=json(storage,CHART_SETUP_KEY),setup=object(old)&&old.version===1&&object(old.controls)?old:{version:1,controls:{}};
    const next={...setup,controls:{...setup.controls,'gex-spectrum-toggle':Boolean(snapshot.enabled)},gex:snapshot,gexSavedAt:snapshot.savedAt};
    const text=JSON.stringify(next);storage.setItem(CHART_SETUP_KEY,text);result.setup=storage.getItem(CHART_SETUP_KEY)===text;
  }catch{}
  return result;
}
