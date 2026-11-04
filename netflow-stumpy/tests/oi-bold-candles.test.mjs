import test from 'node:test';
import assert from 'node:assert/strict';
import {OiBoldCandles,oiBodyWidth,oiBodyContrast} from '../oi-bold-candles.mjs';
test('width stays inside candle spacing, including tight zoom',()=>{
  for(const spacing of [2,3,6,10,30]){assert.ok(oiBodyWidth(spacing)>spacing*.65);assert.ok(oiBodyWidth(spacing)<spacing);}
  assert.equal(oiBodyWidth(1),0);assert.equal(oiBodyWidth(NaN),0);
});
test('body uses original OHLC and state palette, with no wick or autoscale changes',()=>{
  const primitive=new OiBoldCandles(),drawn=[];let requests=0;
  primitive.attached({chart:{timeScale:()=>({options:()=>({barSpacing:10}),timeToCoordinate:()=>20})},series:{priceToCoordinate:p=>100-p},requestUpdate:()=>requests++});
  primitive.setData([{time:1,open:40,close:60,color:'#123456'}]);
  const context={save(){},restore(){},strokeRect(){},fillRect(...rect){drawn.push({rect,color:this.fillStyle});}};
  primitive.draw({useBitmapCoordinateSpace:fn=>fn({context,horizontalPixelRatio:2,verticalPixelRatio:2,bitmapSize:{width:200,height:200}})});
  assert.equal(requests,1);assert.equal(drawn.length,1);assert.equal(drawn[0].color,oiBodyContrast('#123456').body);assert.equal(drawn[0].rect[1],80);assert.equal(drawn[0].rect[3],40);
  primitive.setData([]);primitive.draw({useBitmapCoordinateSpace(){throw Error('disabled must not paint');}});
  primitive.detached();assert.equal(primitive.series,null);
});
test('downward OI expansion overrides H1 color with a dark purple body and no outline',()=>{
  const primitive=new OiBoldCandles(),fills=[];let borders=0;
  primitive.attached({chart:{timeScale:()=>({options:()=>({barSpacing:10}),timeToCoordinate:()=>20})},series:{priceToCoordinate:p=>100-p},requestUpdate(){}});
  primitive.setData([{time:1,open:60,close:40,color:'#18d6a3',oiKind:'down-oi-increase'}]);
  const context={save(){},restore(){},fillRect(){fills.push(this.fillStyle);},strokeRect(){borders++;}};
  primitive.draw({useBitmapCoordinateSpace:fn=>fn({context,horizontalPixelRatio:1,verticalPixelRatio:1,bitmapSize:{width:200,height:200}})});
  assert.deepEqual(fills,['#5b21b6']);assert.equal(borders,0);
  assert.equal(oiBodyContrast('#18d6a3','same-sign').border,'#fff3bf');
});
