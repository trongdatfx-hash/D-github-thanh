import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWeeklyTrendMap} from '../weekly-trend-ui.mjs';
test('daily H1 cells render without removed weekly summary or chart badge nodes',()=>{
 const root={dataset:{}},cells={replaceChildren(...nodes){this.nodes=nodes;}};
 globalThis.document={getElementById:id=>id==='weekly-trend-map'?root:id==='weekly-days'?cells:null,createElement:()=>({})};
 renderWeeklyTrendMap(null);assert.equal(cells.nodes.length,7);assert.ok(cells.nodes[0].innerHTML.includes('Mon'));
 renderWeeklyTrendMap({label:'UP',cells:[{name:'Fri',packet:{direction:1,quality:.8,blocks:9,preview:true}}]});
 assert.equal(cells.nodes.length,1);assert.ok(cells.nodes[0].innerHTML.includes('9H1'));assert.ok(cells.nodes[0].innerHTML.includes('PREVIEW'));assert.equal(root.dataset.state,'up');
 delete globalThis.document;
});
