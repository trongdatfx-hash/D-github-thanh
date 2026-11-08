import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
test('chart startup defines responsive helpers before applying chart options',()=>{
 const begin=app.indexOf('const isCompactChart='),end=app.indexOf('\nfunction init(',begin),fn=app.indexOf('function applyResponsiveChartOptions(');
 assert.ok(begin>=0&&begin<fn);assert.ok(end>fn);
 for(const mobile of [false,true]){
  let options=null;
  const host={dataset:{}},ctx={chart:{applyOptions:o=>{options=o;}},$:()=>host,L:{version:()=> 'test'},matchMedia:query=>({matches:mobile}),navigator:{maxTouchPoints:mobile?1:0},isFullChart:()=>true};
  vm.createContext(ctx);vm.runInContext(app.slice(begin,end)+'\napplyResponsiveChartOptions();',ctx);
  assert.equal(options.layout.fontSize,mobile?11:12);assert.equal(options.handleScroll.vertTouchDrag,mobile);assert.equal(options.handleScale.pinch,true);
 }
});
