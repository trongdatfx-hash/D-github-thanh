import test from 'node:test';
import assert from 'node:assert/strict';
import {pattern,closedBars,settle,similar,STEP} from '../netflow-stumpy/gpt-pattern-core.mjs';
import worker,{PatternMemory} from './worker.mjs';
function fixture(n=150,end=Math.floor(Date.now()/STEP)*STEP){return Array.from({length:n},(_,i)=>{const c=100+Math.sin(i*Math.PI/4)*3+i*.025,o=c-.12;return {t:end-(n-i)*STEP,o,h:c+.6,l:o-.5,c,v:100+i,q:10000,buy:5100};});}
class Storage {
  constructor(){this.map=new Map();this.queue=Promise.resolve();}
  async get(k){return structuredClone(this.map.get(k));}
  async put(k,v){this.map.set(k,structuredClone(v));}
  async delete(k){this.map.delete(k);}
  async list({prefix='',reverse=false,limit=1000}={}){let pairs=[...this.map].filter(([k])=>k.startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b));if(reverse)pairs.reverse();return new Map(pairs.slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
  transaction(fn){const result=this.queue.then(()=>fn(this));this.queue=result.catch(()=>{});return result;}
}
const request=(path,bars,symbol='SPYUSDT')=>new Request('https://worker.example'+path,{method:'POST',body:JSON.stringify({symbol,interval:'15m',bars}),headers:{'Content-Type':'application/json'}});
test('forming candle never changes confirmed features or pivots',()=>{
  const bars=fixture(),now=bars.at(-1).t+STEP;
  const a=pattern(bars,{now}),b=pattern([...bars,{t:now,o:110,h:1000,l:1,c:600}],{now});assert.deepEqual(a,b);
  assert.ok(a.pivots.every(p=>p.confirmedAt<=a.asOf));assert.ok(a.sequence.includes('HH'));assert.ok(a.sequence.includes('HL'));
});
test('malformed bars rejected and gaps cannot become geometry',()=>{
  const bars=fixture();assert.throws(()=>closedBars([bars[1],bars[0]],Date.now()));assert.throws(()=>closedBars([{...bars[0],l:999}],Date.now()));
  bars.splice(-10,1);assert.equal(pattern(bars),null);
});
test('outcome requires exactly eight contiguous closed future candles',()=>{
  const bars=fixture(),sample=pattern(bars.slice(0,100),{now:Date.now()});
  assert.ok(!settle(sample,bars.slice(0,107),Date.now()).outcome);
  assert.ok(settle(sample,bars.slice(0,108),Date.now()).outcome);
  assert.ok(!settle(sample,bars.filter(b=>b.t!==sample.lastTime+4*STEP),Date.now()).outcome);
});
test('historical query cannot retrieve future or overlapping outcomes',()=>{
  const bars=fixture(300),old=pattern(bars.slice(0,100)),saved=settle(old,bars,Date.now()),current=pattern(bars);
  assert.equal(similar(current,[{...saved,vector:current.vector}]).n,1);
  assert.equal(similar(current,[{...saved,vector:current.vector,outcome:{...saved.outcome,closedAt:current.asOf+STEP}}]).n,0);
  assert.equal(similar(current,[{...current,outcome:saved.outcome}]).n,0);
  assert.equal(similar(current,[]).upRate,null);
});
test('parallel tabs share the three sample daily quota',async()=>{
  const storage=new Storage(),memory=new PatternMemory({storage},{}),bars=fixture(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await storage.put('learn:'+day,2);
  const result=await Promise.all(Array.from({length:12},(_,i)=>memory.fetch(request('/observe',bars,i%2?'SPYUSDT':'QQQUSDT')).then(r=>r.json())));
  assert.equal(result.filter(r=>r.learned).length,1);assert.equal(await storage.get('learn:'+day),3);
  assert.equal((await storage.list({prefix:'sample:'})).size,1);
});
test('same pivot not learned twice as more candles close',async()=>{
  const storage=new Storage(),memory=new PatternMemory({storage},{}),bars=fixture();
  const r=await (await memory.fetch(request('/observe',bars))).json();assert.equal(r.learned,true);
  const again=await (await memory.fetch(request('/observe',bars))).json();assert.equal(again.learned,false);assert.equal(again.count,1);
});
test('stale observations do not consume learning quota',async()=>{
  const storage=new Storage(),memory=new PatternMemory({storage},{}),bars=fixture(150,Math.floor(Date.now()/STEP)*STEP-10*STEP);
  const r=await (await memory.fetch(request('/observe',bars))).json();assert.equal(r.learned,false);assert.equal((await storage.list({prefix:'sample:'})).size,0);
});
test('missing OpenAI secret reports unavailable, not a fabricated analysis',async()=>{
  const memory=new PatternMemory({storage:new Storage()},{});const r=await memory.fetch(request('/analyze',fixture()));assert.equal(r.status,503);
});
test('outer worker denies bad origin and missing access token',async()=>{
  const r=await worker.fetch(new Request('https://worker.example/analyze',{method:'POST',headers:{Origin:'https://attacker.example'}}),{});assert.equal(r.status,403);
  const r2=await worker.fetch(new Request('https://worker.example/analyze',{method:'POST'}),{ANALYST_TOKEN:'private'});assert.equal(r2.status,401);
});
test('analysis uses configured Responses model, returns cached answer without another charge',async()=>{
  const original=globalThis.fetch,storage=new Storage(),memory=new PatternMemory({storage},{OPENAI_API_KEY:'unit-test-key'});let calls=0;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.model,'gpt-5.6-terra');assert.equal(body.store,false);calls++;return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'CHƯA ĐỦ MẪU.'}]}]});};
  try{const bars=fixture(),a=await (await memory.fetch(request('/analyze',bars))).json(),b=await (await memory.fetch(request('/analyze',bars))).json();assert.equal(a.answer,'CHƯA ĐỦ MẪU.');assert.equal(b.cached,true);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
