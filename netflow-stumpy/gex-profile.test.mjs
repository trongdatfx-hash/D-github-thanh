import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGex,gexPrice,drawGex} from './gex-profile.mjs';
const sample='S:18.32|L:7579,ZG,ZERO GAMMA,description,0;7668,CW,Call Wall,Hold: 67% | Break: 33%,4353.8|P:7568,-2.2,-1;7668,10,1';
test('Pine data preserves signs, spread and only ZG level',()=>{
 const p=parseGex(sample);assert.equal(p.spread,18.32);assert.equal(p.zeroGamma,7579);assert.equal(p.bins.length,2);assert.deepEqual(p.bins[0],{strike:7568,force:-2.2,sign:-1});assert.equal(gexPrice(7579,18.32,10),756.068);
});
test('plain P data works without inventing Zero Gamma',()=>{
 assert.equal(parseGex('P:700,3,1;690,-2,-1').zeroGamma,null);assert.equal(parseGex('700,3,1').bins.length,1);
});
test('reject malformed, empty and oversized input',()=>{
 for(const s of ['', 'S:bad|P:700,3,1','S:0|L:700,ZG|P:', 'P:700,,1','P:700,2,5','L:700,CW,x','P:700,NaN,-1','x'.repeat(1000001)])assert.throws(()=>parseGex(s));
});
test('mirror draw uses live conversion, Call left / Put right, ZG only',()=>{
 const rects=[],texts=[],segments=[];let point;
 const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},stroke(){},setLineDash(){},moveTo(x,y){point=[x,y];},lineTo(x,y){segments.push([point,[x,y]]);},fillRect(...r){rects.push(r);},fillText(...t){texts.push(t);}};
 const profile=parseGex(sample),options={context:ctx,mediaSize:{width:1000,height:800},profile,basis:18.32,scale:10,anchor:600,priceToY:v=>800-v};
 drawGex(options);assert.equal(rects.length,2);const axis=segments[0][0][0];assert.equal(rects[0][0],axis);assert.ok(rects[1][0]<axis);assert.equal(texts.length,1);assert.match(texts[0][0],/^Zero Gamma 756.07$/);
 const firstY=rects[0][1];rects.length=0;drawGex({...options,basis:28.32});assert.equal(rects[0][1],firstY+1);
});
test('actual supplied Pine snapshot parses completely',()=>{
 if(!process.env.GEX_PINE_PATH)return;
 const pine=readFileSync(process.env.GEX_PINE_PATH,'utf8'),raw=pine.match(/gexDataInput = input.text_area\("([^"\r\n]*)"/)[1];
 const p=parseGex(raw);assert.equal(p.spread,18.32);assert.equal(p.zeroGamma,7579);assert.ok(p.bins.length>80);
});
