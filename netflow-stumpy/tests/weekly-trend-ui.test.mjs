import test from 'node:test';
import assert from 'node:assert/strict';
import {compactWeeklyDayLabel} from '../weekly-trend-ui.mjs';

test('compact weekly label mirrors the current preview packet',()=>{
  assert.equal(compactWeeklyDayLabel('Fri',{direction:-1,quality:.516,blocks:3,preview:true}),'Fri · DOWN · 52% · 3H1 · PREVIEW');
});

test('compact weekly label handles confirmed UP and missing packets',()=>{
  assert.equal(compactWeeklyDayLabel('Wed',{direction:1,quality:.804,blocks:12,preview:false}),'Wed · UP · 80% · 12H1');
  assert.equal(compactWeeklyDayLabel('Mon',null),'');
});
