import test from 'node:test';
import assert from 'node:assert/strict';
import {SpectrumPrimitive} from '../spectrum-primitive.mjs';
test('spectrum paints in current chart frame with current pane coordinates',()=>{
  let updates=0;const paints=[],context={save(){},restore(){}};
  const primitive=new SpectrumPrimitive(scope=>paints.push(scope.mediaSize));
  primitive.attached({requestUpdate:()=>updates++});primitive.redraw();assert.equal(updates,1);
  const renderer=primitive.paneViews()[0].renderer();
  for(const size of [{width:900,height:400},{width:500,height:200}])renderer.draw({useMediaCoordinateSpace:fn=>fn({context,mediaSize:size})});
  assert.deepEqual(paints,[{width:900,height:400},{width:500,height:200}]);
  primitive.detached();primitive.redraw();assert.equal(updates,1);
});
test('renderer restores chart context even if a paint throws',()=>{
  let restores=0;const primitive=new SpectrumPrimitive(()=>{throw Error('paint failed');});
  assert.throws(()=>primitive.paneViews()[0].renderer().draw({useMediaCoordinateSpace:fn=>fn({context:{save(){},restore(){restores++;}}})}));
  assert.equal(restores,1);
});
