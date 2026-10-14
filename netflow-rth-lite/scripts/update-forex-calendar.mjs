import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {FOREX_FACTORY_FEED_URL,normalizeCalendarFeed} from '../forex-calendar.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'data','forex-calendar.json');
const response=await fetch(FOREX_FACTORY_FEED_URL,{headers:{accept:'application/json','user-agent':'netflow-rth-lite-calendar/1.0'}});
if(!response.ok)throw Error(`Forex Factory feed HTTP ${response.status}`);
const events=normalizeCalendarFeed(await response.json());
if(events.length<5)throw Error(`Refusing to save an unexpectedly short calendar (${events.length} events)`);
const previous=await readFile(output,'utf8').then(JSON.parse).catch(()=>null);
const previousEvents=JSON.stringify(previous?.events??[]),nextEvents=JSON.stringify(events);
if(previousEvents===nextEvents){console.log(`Calendar unchanged (${events.length} events)`);process.exit(0);}
const payload={source:FOREX_FACTORY_FEED_URL,updatedAt:new Date().toISOString(),events};
await mkdir(path.dirname(output),{recursive:true});
const temporary=`${output}.tmp`;
await writeFile(temporary,`${JSON.stringify(payload,null,2)}\n`,'utf8');
await rename(temporary,output);
console.log(`Saved ${events.length} Forex Factory events to ${output}`);
