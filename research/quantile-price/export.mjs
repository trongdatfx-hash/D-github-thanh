import fs from 'node:fs';
import {quantileDataset,QR_FEATURES,QR_VERSION} from '../../netflow-stumpy/quantile-price-core.mjs';
const root=new URL('../../netflow-stumpy/data/binance/m15/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'));
const raw={SPYUSDT:[],QQQUSDT:[]};for(const month of manifest.months){const doc=JSON.parse(fs.readFileSync(new URL(month+'.json',root),'utf8'));for(const s of Object.keys(raw))raw[s].push(...doc[s].map(([t,o,h,l,c,v,end,q,buy])=>({t,o,h,l,c,v,end,q,buy})));}
for(const s of Object.keys(raw))raw[s]=[...new Map(raw[s].map(r=>[r.t,r])).values()].sort((a,b)=>a.t-b.t);
const datasets={strength:quantileDataset(raw.SPYUSDT,raw.QQQUSDT,Infinity,{source:'strength'}),causalChannel:quantileDataset(raw.SPYUSDT,raw.QQQUSDT,Infinity,{source:'causalChannel'})};
process.stdout.write(JSON.stringify({version:QR_VERSION,features:QR_FEATURES,sourceAsOf:manifest.lastTime+900000,data:datasets.strength,datasets}));
