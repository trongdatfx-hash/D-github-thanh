import test from 'node:test';
import assert from 'node:assert/strict';
import {exportChatSample} from '../netflow-stumpy/chat-pattern-export.mjs';
import {STEP,dayNY} from '../netflow-stumpy/gpt-pattern-core.mjs';
const now=Date.now(),end=Math.floor(now/STEP)*STEP,bars=Array.from({length:150},(_,i)=>{const c=100+Math.sin(i*Math.PI/4)*3+i*.025;return {t:end-(150-i)*STEP,o:c-.1,h:c+.6,l:c-.7,c,v:100,q:1000,buy:510};});
const args={bars,symbol:'SPYUSDT',now,visible:{from:bars[0].t/1000,to:end/1000}};
test('same pivot export is update, not a second sample',()=>{const a=exportChatSample(args),b=exportChatSample({...args,memory:a.memory});assert.equal(b.count,1);assert.equal(b.memory.samples.length,1);assert.match(b.text,/DVP_CHAT_PATTERN_V1/);assert.match(b.text,/CHƯA ĐỦ MẪU/);});
test('daily cap includes both symbols and exported historical windows',()=>{const a=exportChatSample(args),s=a.memory.samples[0],memory={version:1,samples:Array.from({length:3},(_,i)=>({...s,id:'other:'+i,exportDay:dayNY(now)}))};assert.throws(()=>exportChatSample({...args,symbol:'QQQUSDT',memory}),/3 mẫu/);});
test('new day allows a new sample; missing geometry consumes nothing',()=>{const a=exportChatSample(args);a.memory.samples=a.memory.samples.map(s=>({...s,id:'old',exportDay:'2000-01-01'}));assert.equal(exportChatSample({...args,memory:a.memory}).count,1);assert.throws(()=>exportChatSample({...args,bars:bars.slice(-10)}),/24 nến/);assert.equal(a.memory.samples.length,1);});
