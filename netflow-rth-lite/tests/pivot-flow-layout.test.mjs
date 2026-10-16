import test from 'node:test';
import assert from 'node:assert/strict';
import {pivotFlowLayout} from '../pivot-flow-layout.mjs';

test('cột NF rộng đúng hai lần bước nến khi zoom và vẫn sát trục giá',()=>{
  const normal=pivotFlowLayout(6,10,300),zoomed=pivotFlowLayout(20,10,300);
  assert.equal(normal.barWidth,12);assert.equal(zoomed.barWidth,40);
  assert.equal(normal.shownCount,10);assert(zoomed.shownCount<10);
  assert(normal.panelWidth<=300&&zoomed.panelWidth<=300);
  assert.equal(pivotFlowLayout(0,10,300),null);
});
