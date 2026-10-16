import test from 'node:test';
import assert from 'node:assert/strict';
import {rev63Forecast,rev63ColorRegime,rev63ColorQualitySummary,rev63GeometryQualitySummary,REV63_COLOR_ROWS,REV63_GEOMETRY_ROWS} from '../rev6-3-v1.mjs';

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

test('REV6-3 includes the current causal line regime and summarizes four geometry cohorts',()=>{
  const forecast=rev63Forecast({geometryRegime:{key:'true_break',at:1,direction:1,confidence:.8},priceRows:[{t:1}]});
  assert.equal(forecast.geometryRegime.key,'true_break');assert(forecast.components.regime>0);assert.equal(REV63_GEOMETRY_ROWS.length,4);
  const records=[
    {scored:true,pUp:.7,correct:true,brier:.09,returnPct:1,geometryRegime:'hold_support'},
    {scored:true,pUp:.3,correct:true,brier:.04,returnPct:-2,geometryRegime:'hold_resistance'},
    {scored:true,pUp:.8,correct:true,brier:.04,returnPct:1.5,geometryRegime:'true_break'},
    {scored:true,pUp:.6,correct:false,brier:.36,returnPct:-1,geometryRegime:'false_break'}
  ],summary=rev63GeometryQualitySummary(records);
  assert.equal(summary.n,4);assert.equal(summary.summaries.true_break.n,1);assert.equal(summary.summaries.false_break.expectancy,-1);
});

test('REV6-3 trend uses only confirmed causal lines and closed candle geometry',()=>{
  const priceRows=[{t:1,o:100,h:102,l:99,c:100},{t:2,o:100,h:103,l:99,c:102},{t:3,o:102,h:104,l:101,c:103}],line={kind:'support',score:90,knownAt:2,endValue:102.5};
  const confirmed=rev63Forecast({priceRows,geometryLines:[line]});
  const provisional=rev63Forecast({priceRows,geometryLines:[{...line,provisional:true}]});
  const future=rev63Forecast({priceRows,geometryLines:[{...line,knownAt:4}]});
  assert(confirmed.components.line>0);assert.equal(provisional.components.line,0);assert.equal(future.components.line,0);
  assert(confirmed.trendScore>provisional.trendScore);assert.equal(provisional.pUp,future.pUp);
});
