import test from 'node:test';
import assert from 'node:assert/strict';
import {rev63ColorRegime,rev63ColorQualitySummary,REV63_COLOR_ROWS} from '../rev6-3-v1.mjs';

test('REV6-3 color regime labels agreement and gray-to-agreement causally',()=>{
  assert.deepEqual(rev63ColorRegime({direction:1,agreement:.35},{direction:0}),{colorRegime:'agreement_up',colorTransition:'neutral_to_agreement',colorAgreement:.35});
  assert.deepEqual(rev63ColorRegime({direction:-1,agreement:.4},{direction:-1}),{colorRegime:'agreement_down',colorTransition:null,colorAgreement:.4});
  assert.deepEqual(rev63ColorRegime({direction:0,agreement:0},{direction:1}),{colorRegime:'neutral',colorTransition:null,colorAgreement:0});
  assert.equal(REV63_COLOR_ROWS.length,4);
});

test('REV6-3 color quality reports hit, Brier and directional expectancy by regime',()=>{
  const records=[
    {scored:true,pUp:.7,correct:true,brier:.09,returnPct:1,colorRegime:'agreement_up',colorTransition:'neutral_to_agreement'},
    {scored:true,pUp:.3,correct:true,brier:.04,returnPct:-2,colorRegime:'agreement_down',colorTransition:null},
    {scored:true,pUp:.6,correct:false,brier:.36,returnPct:-1,colorRegime:'neutral',colorTransition:null},
    {scored:true,pUp:.8,correct:true,brier:.04,returnPct:5},
    {scored:true,void:true,pUp:.8,correct:true,brier:.04,returnPct:5,colorRegime:'agreement_up'}
  ],summary=rev63ColorQualitySummary(records);
  assert.equal(summary.n,3);assert.equal(summary.summaries.agreement_up.n,1);assert.equal(summary.summaries.agreement_down.n,1);assert.equal(summary.summaries.neutral.n,1);assert.equal(summary.summaries.neutral_to_agreement.n,1);
  assert.equal(summary.summaries.agreement_up.accuracy,100);assert.equal(summary.summaries.agreement_down.expectancy,2);assert.equal(summary.summaries.neutral.expectancy,-1);assert.equal(summary.summaries.neutral_to_agreement.brier,.09);
});
