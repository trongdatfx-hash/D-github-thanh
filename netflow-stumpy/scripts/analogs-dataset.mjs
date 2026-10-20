import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareRaw,fromKlines} from '../analogs-features.mjs';
import {sessionAt} from '../engine.mjs';
import {candidateIndices,summarize} from '../analogs-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),get=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data));}
if(args.includes('--finalize')){
  const input=JSON.parse(fs.readFileSync(get('--input',path.join(root,'data/analogs/features.json'))));
  const profiles=JSON.parse(fs.readFileSync(get('--profiles',path.join(root,'data/analogs/profiles.json'))));
  const results={};for(const [key,ranked]of Object.entries(profiles.ranked)){
    const [symbol,m,h]=key.split(':');results[key]={...summarize(input.rows[symbol],+m,+h,ranked),engine:'STUMPY MASS',libraryVersion:profiles.libraryVersion};
  }
  save(get('--output',path.join(root,'data/analogs/snapshot.json')),{version:1,generatedAt:Date.now(),provenance:input.provenance,sourceAsOf:input.asOf,results});
  console.log(JSON.stringify({results:Object.keys(results).length,samples:Object.fromEntries(Object.entries(results).map(([k,v])=>[k,v.n]))}));
}else{
  let raw,asOf=Date.now(),provenance='Kho nến đóng Binance M15';
  if(args.includes('--fixtures')){
    const directory=get('--fixtures');const doc=Object.fromEntries(['SPYUSDT','QQQUSDT'].map(s=>[s,JSON.parse(fs.readFileSync(path.join(directory,s+'.json')))]));
    asOf=Math.min(...Object.values(doc).map(a=>+a.at(-1)[6]+1));raw=fromKlines(doc,asOf);provenance='Mẫu Binance lịch sử kiểm thử · không phải dữ liệu live';
  }else{
    const directory=get('--history',path.join(root,'data/binance/m15'));
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
    raw={SPYUSDT:[],QQQUSDT:[]};
    for(const month of manifest.months){const doc=JSON.parse(fs.readFileSync(path.join(directory,month+'.json')));for(const symbol of Object.keys(raw))raw[symbol].push(...(doc[symbol]??[]).map(r=>{const [t,o,h,l,c,v,end,q,buy]=r;return {t,o,h,l,c,v,end,q,buy,net:2*buy-q,sell:q-buy,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)};}));}
    for(const symbol of Object.keys(raw))raw[symbol]=[...new Map(raw[symbol].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
    if(!raw.SPYUSDT.length||!raw.QQQUSDT.length)throw Error('Kho thiếu SPY/QQQ');
    asOf=Math.min(asOf,...Object.values(raw).map(a=>a.at(-1).end+1));
  }
  const rows=prepareRaw(raw,{now:asOf}),tasks={};
  for(const [symbol,data]of Object.entries(rows))for(const m of [8,16,32])for(const h of [3,6,12])tasks[`${symbol}:${m}:${h}`]=candidateIndices(data,m,h);
  save(get('--output',path.join(root,'data/analogs/features.json')),{version:1,asOf,provenance,rows,tasks});
  console.log(JSON.stringify({asOf,rows:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]))}));
}
