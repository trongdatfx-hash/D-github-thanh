import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {compactArchive} from '../wlr-aba-archive.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),input=path.join(root,'research/wlr-aba/output'),output=path.join(root,'netflow-stumpy/data/wlr-aba'),read=name=>JSON.parse(fs.readFileSync(path.join(input,name+'.json'))),result=compactArchive(read('tasks'),read('report'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'netflow-stumpy/data/binance/m15/manifest.json')));
for(const body of Object.values(result))body.collection=manifest.collection??null;
fs.mkdirSync(output,{recursive:true});for(const [name,body]of Object.entries(result))fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(body));
console.log(JSON.stringify({published:result.archive.schema,cases:result.archive.cases.length,vectors:result.archive.vectors.length,sourceAsOf:result.archive.sourceAsOf,model:result.report.selectedTrial}));
