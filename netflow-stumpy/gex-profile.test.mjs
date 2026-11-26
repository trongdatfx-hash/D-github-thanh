import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGex,gexPrice,drawGex,gexLayout} from './gex-profile.mjs';
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
test('mirror draw uses mapping, Call left / Put right, central ZG label and local line',()=>{
 const rects=[],texts=[],segments=[];let point;
 const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},stroke(){},setLineDash(){},moveTo(x,y){point=[x,y];},lineTo(x,y){segments.push([point,[x,y]]);},fillRect(...r){rects.push({r,color:this.fillStyle});},fillText(...t){texts.push(t);},measureText:t=>({width:t.length*6})};
 const profile=parseGex(sample),options={context:ctx,mediaSize:{width:1000,height:800},profile,basis:18.32,scale:10,anchor:600,priceToY:v=>800-v};
 drawGex(options);const bars=rects.filter(r=>r.color.startsWith('rgba(255,104')||r.color.startsWith('rgba(43,229'));assert.equal(bars.length,2);
 const axis=gexLayout(1000,600).x;assert.equal(bars[0].r[0],axis);assert.ok(bars[1].r[0]<axis);
 const label=texts.find(t=>t[0].startsWith('Zero Gamma'));assert.match(label[0],/^Zero Gamma 756.07$/);assert.equal(label[1],axis);
 const line=segments.at(-1);assert.ok(line[0][0]>0);assert.ok(line[1][0]<1000);
 const firstY=bars[0].r[1];rects.length=0;drawGex({...options,basis:28.32});assert.equal(rects.find(r=>r.color.startsWith('rgba(43,229')).r[1],firstY+1);
});
test('mobile widths stay compact and text fits within the pane',()=>{
 for(const width of [240,320,390,600,1280]){const layout=gexLayout(width,10000);assert.ok(layout.x+layout.half<=width-7);assert.ok(layout.x-layout.half>=7);if(width<600)assert.ok(layout.half<=52);}
});
test('dense rows keep strongest per sign without adding normalized magnitudes',()=>{
 const bars=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},stroke(){},setLineDash(){},moveTo(){},lineTo(){},fillText(){},fillRect(...r){if(this.fillStyle.startsWith('rgba(255,104'))bars.push(r);}};
 drawGex({context:ctx,mediaSize:{width:320,height:400},profile:{zeroGamma:null,bins:[{strike:1,force:2,sign:1},{strike:2,force:6,sign:1}]},mapping:{ratio:1,offset:0},anchor:300,priceToY:v=>100+v*.1});
 assert.equal(bars.length,1);assert.equal(bars[0][2],52*.6);
});
test('actual supplied Pine snapshot parses completely',()=>{
 if(!process.env.GEX_PINE_PATH)return;
 const pine=readFileSync(process.env.GEX_PINE_PATH,'utf8'),raw=pine.match(/gexDataInput = input.text_area\("([^"\r\n]*)"/)[1];
 const p=parseGex(raw);assert.equal(p.spread,18.32);assert.equal(p.zeroGamma,7579);assert.ok(p.bins.length>80);
});

