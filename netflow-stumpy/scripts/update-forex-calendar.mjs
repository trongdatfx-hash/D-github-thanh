import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {FOREX_FACTORY_FEED_URL,FOREX_FACTORY_READER_URL,normalizeCalendarFeed,parseForexFactoryMarkdown,mergeCalendarResults} from '../forex-calendar.mjs?v=20261025-dcommon-all1';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'data','forex-calendar.json');
const headers={accept:'application/json','user-agent':'netflow-rth-lite-calendar/1.1'};
const [feedResponse,readerResponse]=await Promise.all([fetch(FOREX_FACTORY_FEED_URL,{headers}),fetch(FOREX_FACTORY_READER_URL,{headers:{...headers,accept:'text/plain'}}).catch(()=>null)]);
if(!feedResponse.ok)throw Error(`Forex Factory feed HTTP ${feedResponse.status}`);
const baseEvents=normalizeCalendarFeed(await feedResponse.json());
let results=[];
if(readerResponse?.ok){results=parseForexFactoryMarkdown(await readerResponse.text());console.log(`Read ${results.length} result rows from the Forex Factory calendar page`);}
else console.warn(`Actual-result reader unavailable${readerResponse?` (HTTP ${readerResponse.status})`:''}; keeping the official weekly feed`);
const events=mergeCalendarResults(baseEvents,results);
if(events.length<5)throw Error(`Refusing to save an unexpectedly short calendar (${events.length} events)`);
const previous=await readFile(output,'utf8').then(JSON.parse).catch(()=>null);
const previousEvents=JSON.stringify(previous?.events??[]),nextEvents=JSON.stringify(events);
if(previousEvents===nextEvents){console.log(`Calendar unchanged (${events.length} events)`);process.exit(0);}
const payload={source:FOREX_FACTORY_FEED_URL,resultsSource:FOREX_FACTORY_READER_URL,updatedAt:new Date().toISOString(),events};
await mkdir(path.dirname(output),{recursive:true});
const temporary=`${output}.tmp`;
await writeFile(temporary,`${JSON.stringify(payload,null,2)}\n`,'utf8');
await rename(temporary,output);
console.log(`Saved ${events.length} Forex Factory events to ${output}`);
