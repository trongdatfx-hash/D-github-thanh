
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPatternStructures,causalAtr,analyzeGeometry,classifyBreakoutRetest} from '../geometry.mjs';
function fixture(type='box',bias=1){
 const bars=[],pivots=[],context=[],n=80;
 const upper=i=>type==='wedge'?106-.045*i:type==='flag'?106-.025*(i-30):104;
 const lower=i=>type==='wedge'?98+.025*i:type==='flag'?102-.025*(i-30):100;
 for(let i=0;i<n;i++){
  let c=(upper(i)+lower(i))/2+.8*Math.sin(i*Math.PI/4);
  if(type==='flag'&&i<30)c=92+i*.35;
  bars.push({t:i*900000,o:c-.05,c,h:c+.3,l:c-.3,v:100});
  context.push({flow:bias*10,volume:bias*.5});
 }
 for(let i=32;i<=76;i+=8){bars[i].h=upper(i);pivots.push({type:'high',index:i,value:upper(i),t:bars[i].t,confirmedIndex:i+2,confirmedAt:bars[i+2].t});}
 for(let i=36;i<=76;i+=8){bars[i].l=lower(i);pivots.push({type:'low',index:i,value:lower(i),t:bars[i].t,confirmedIndex:i+2,confirmedAt:bars[i+2].t});}
 return {bars,pivots,context};
}
for(const type of ['box','wedge','flag'])test('recognizes paired '+type+' with confirmed pivots',()=>{
 const f=fixture(type),patterns=buildPatternStructures(f.bars,f.pivots,f.context,{minScore:0});
 assert(patterns.some(p=>p.type===type),JSON.stringify(patterns.map(p=>p.type)));
 const p=patterns.find(p=>p.type===type);assert.equal(p.rails.length,2);assert(p.rails.every(r=>r.knownAt===f.bars.at(-1).t));assert.equal(p.phase,'accumulation');
});
test('flow bias distinguishes distribution and missing context stays neutral',()=>{
 const f=fixture('box',-1);assert.equal(buildPatternStructures(f.bars,f.pivots,f.context,{minScore:0})[0].phase,'distribution');
 assert.equal(buildPatternStructures(f.bars,f.pivots,f.context.map(()=>({})),{minScore:0})[0].phase,'neutral');
});
test('future pivots and insufficient touches cannot form a setup',()=>{
 const f=fixture();assert.equal(buildPatternStructures(f.bars,f.pivots.map(p=>({...p,confirmedIndex:100})),f.context,{minScore:0}).length,0);
 assert.equal(buildPatternStructures(f.bars,f.pivots.slice(0,1),f.context,{minScore:0}).length,0);
});
test('50/50 budgets retain paired rails within maxLines',()=>{
 const f=fixture(),g=analyzeGeometry({price:f.bars},{minProminenceAtr:0,minScore:0,maxLines:4});
 assert.deepEqual(g.selectionBudget,{classic:2,pattern:2});assert(g.lines.length<=4);
 assert.equal(g.lines.filter(l=>l.source==='pattern').length%2,0);
});
test('strong breakout requires real volume expansion, body, range and aligned flows',()=>{
 const bars=Array.from({length:40},(_,i)=>({t:i,o:100,c:100,h:100.4,l:99.6,v:100}));
 bars[39]={t:39,o:100,c:102,h:102.1,l:99.9,v:200};
 const rail={kind:'resistance',source:'pattern',knownAt:37,startIndex:0,startValue:100.5,slope:0,score:85};
 const opts={strengthDirection:1,flowDirection:1,volumeDirection:1};
 const s=classifyBreakoutRetest(bars,[rail],opts);assert.equal(s.key,'strong_break');assert.equal(s.relativeVolume,2);
 for(const altered of [{...bars[39],v:100},{...bars[39],v:undefined},{...bars[39],o:101.9}]){
  const r=classifyBreakoutRetest([...bars.slice(0,-1),altered],[rail],opts);assert.notEqual(r?.key,'strong_break');
 }
 assert.notEqual(classifyBreakoutRetest(bars,[rail],{...opts,flowDirection:-1})?.key,'strong_break');
 assert.notEqual(classifyBreakoutRetest(bars,[{...rail,knownAt:39}],opts)?.key,'strong_break');
});
