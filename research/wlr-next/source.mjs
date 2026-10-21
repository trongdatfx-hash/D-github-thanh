import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {prepareRaw} from '../../netflow-stumpy/analogs-features.mjs';
import {sessionAt} from '../../netflow-stumpy/engine.mjs';
import {chartWlrRows,segmentWlr} from '../../netflow-stumpy/wlr-aba-core.mjs';
export function loadSource(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=path.join(root,'netflow-stumpy/data/binance/m15'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),raw={SPYUSDT:[],QQQUSDT:[]},files=[];
 for(const month of manifest.months){const file=path.join(dir,month+'.json'),bytes=fs.readFileSync(file),doc=JSON.parse(bytes);files.push({path:path.relative(root,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});for(const symbol of Object.keys(raw))raw[symbol].push(...doc[symbol].map(r=>{const [t,o,h,l,c,v,end,q,buy]=r;return {t,o,h,l,c,v,end,q,buy,net:2*buy-q,sell:q-buy,nf:q>0?100*(2*buy-q)/q:null,...sessionAt(t)};}));}
 for(const symbol of Object.keys(raw))raw[symbol]=[...new Map(raw[symbol].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
 const asOf=Math.min(...Object.values(raw).map(a=>a.at(-1).end+1)),features=prepareRaw(raw,{now:asOf}),frame=segmentWlr(chartWlrRows(raw.SPYUSDT,features.SPYUSDT));
 return {root,asOf,frame,source:{asOf:new Date(asOf).toISOString(),firstTime:new Date(raw.SPYUSDT[0].t).toISOString(),bars:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v.length])),files}};
}
