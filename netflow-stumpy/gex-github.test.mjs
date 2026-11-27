import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeGexJson,normalizeSharedGex,sharedGexPayload,shouldLoadSharedGex,fetchSharedGex,publishGexToGitHub} from './gex-github.mjs';
const state={text:'S:24|L:7187,ZG,ZERO GAMMA|P:7180,-2,-1;7200,3,1',mapping:{mode:'BASIS',basis:24,scale:10},enabled:true};
const payload=sharedGexPayload(state,{label:'EOW · dữ liệu',now:100000,revision:'v1'});
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('provided EOW snapshot has 100 profile bins and shared Zero Gamma 716.30 at S/10',()=>{
 const real=normalizeSharedGex(JSON.parse(readFileSync(new URL('./data/gex-shared.json',import.meta.url),'utf8')));
 assert.equal(real.sourceLabel,'EOW_26-11_23h24.txt');assert.ok(real.text.includes('7187,ZG,'));assert.equal((7187-real.mapping.basis)/real.mapping.scale,716.3);
});
test('shared snapshots preserve raw strikes and mapping, exclude credentials',()=>{
 const data=sharedGexPayload({...state,token:'secret-do-not-save',draft:'private draft'},{now:100000,revision:'v1'});
 assert.equal(JSON.stringify(data).includes('secret-do-not-save'),false);assert.equal(data.draft,undefined);
 const normalized=normalizeSharedGex(data);assert.equal(normalized.origin,'github');assert.equal(normalized.mapping.basis,24);assert.equal(normalized.sharedRevision,'v1');
 assert.throws(()=>normalizeSharedGex({...data,text:'bad'}));assert.throws(()=>normalizeSharedGex({...data,symbol:'QQQUSDT'}));
});
test('fresh phone loads shared data, local drafts and explicit clears are retained',()=>{
 const remote=normalizeSharedGex(payload);
 assert.equal(shouldLoadSharedGex(null,remote),true);assert.equal(shouldLoadSharedGex({text:'',draft:''},remote),true);
 assert.equal(shouldLoadSharedGex({text:'',draft:'',sharedRevision:'v1'},remote),false);
 assert.equal(shouldLoadSharedGex({...state,draft:'unfinished'},remote),false);
 assert.equal(shouldLoadSharedGex({...state,origin:'local'},remote),false);
 assert.equal(shouldLoadSharedGex({...state,origin:'github',loadedAt:1,sharedRevision:'v0'},remote),true);
});
test('public loader reads newest GitHub file without authentication and falls back to Pages',async()=>{
 let seen;
 const result=await fetchSharedGex(async(url,options)=>{seen=options;return response({content:encodeGexJson(payload)});});
 assert.equal(result.sharedRevision,'v1');assert.equal(seen.headers.Authorization,undefined);
 let calls=0;const fallback=await fetchSharedGex(async()=>++calls===1?response({},403):response(payload));assert.equal(calls,2);assert.equal(fallback.sourceLabel,'EOW · dữ liệu');
});
test('save performs authenticated SHA read then conditional update, confirms commit',async()=>{
 const calls=[];const result=await publishGexToGitHub({token:'session-only-test',state,fetcher:async(url,options)=>{calls.push({url,options});return options.method==='PUT'?response({commit:{sha:'a'.repeat(40)}}):response({sha:'old-sha'});}});
 assert.equal(calls.length,2);assert.equal(calls[0].options.headers.Authorization,'Bearer session-only-test');
 const body=JSON.parse(calls[1].options.body);assert.equal(body.sha,'old-sha');assert.equal(body.branch,'main');assert.equal(calls[1].url.includes('api.github.com/repos/trongdatfx-hash/D-github-thanh/contents/'),true);
 assert.equal(Buffer.from(body.content,'base64').toString('utf8').includes('session-only-test'),false);assert.equal(result.commit,'a'.repeat(40));
});
test('permission, conflict and unconfirmed commit never report success or retry writes',async()=>{
 for(const code of [401,403,409]){let writes=0;await assert.rejects(publishGexToGitHub({token:'test',state,fetcher:async(url,options)=>{if(options.method==='PUT'){writes++;return response({},code);}return response({sha:'old'});}}),e=>e.status===code);assert.equal(writes,1);}
 await assert.rejects(publishGexToGitHub({token:'',state}),/token/);
 await assert.rejects(publishGexToGitHub({token:'test',state,fetcher:async(url,options)=>response(options.method==='PUT'?{}:{sha:'old'})}),/chưa xác nhận commit/);
});
