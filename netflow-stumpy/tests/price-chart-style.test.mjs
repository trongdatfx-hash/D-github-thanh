import test from 'node:test';
import assert from 'node:assert/strict';
import {priceCandleData,mountPriceChartStyle} from '../price-chart-style.mjs';
test('line mode suppresses per-candle colors without changing original OHLC',()=>{
  const candles=[{time:1,open:100,high:103,low:98,close:102,color:'red',wickColor:'blue'}];
  const out=priceCandleData(candles,true);assert.equal(out[0].color,'transparent');assert.equal(out[0].wickColor,'transparent');
  assert.equal(out[0].high,103);assert.equal(candles[0].color,'red');assert.equal(priceCandleData(candles,false),candles);
});
test('button switches close-price line and candles while retaining primitive host',()=>{
  const elements=[];globalThis.document={createElement:()=>{const el={value:'CANDLES',setAttribute(){}};elements.push(el);return el;}};
  let render=0;const options=[],writes=[],priceOptions=[];
  const layer=mountPriceChartStyle({chart:{addSeries:()=>({applyOptions:o=>options.push(o)})},price:{applyOptions:o=>priceOptions.push(o)},actions:{append(){}},host:{dataset:{}},L:{LineSeries:{}},writeSeries:(...args)=>writes.push(args),onChange:()=>render++});
  elements[1].onclick();assert.equal(render,1);assert.equal(layer.isLine(),true);
  layer.update([{t:1000,c:102}],{precision:2},'test');assert.deepEqual(writes.at(-1)[2],[{time:1,value:102}]);assert.equal(priceOptions.at(-1).lastValueVisible,false);
  elements[1].onclick();layer.update([{t:1000,c:102}],{precision:2},'test');assert.equal(layer.isLine(),false);assert.deepEqual(writes.at(-1)[2],[]);assert.equal(priceOptions.at(-1).lastValueVisible,true);
  delete globalThis.document;
});
