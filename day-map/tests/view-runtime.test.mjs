import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeCanvas,selectedDayIndex,collectionIsStale} from '../view-runtime.mjs';

test('repeated DPR renders keep logical height and bounded backing store',()=>{
  const transforms=[],canvas={dataset:{},style:{},clientWidth:280,width:300,height:350,
    getAttribute(){return String(this.height);},getContext(){return {setTransform(...args){transforms.push(args);}};}};
  for(let i=0;i<50;i++){const {w,h}=resizeCanvas(canvas,2);assert.equal(h,350);assert.equal(w,280);}
  assert.equal(canvas.height,700);assert.equal(canvas.width,560);assert.equal(canvas.style.height,'350px');
  canvas.clientWidth=400;resizeCanvas(canvas,3);assert.equal(canvas.height,1050);assert.equal(canvas.width,1200);
  assert.equal(transforms.at(-1)[0],3);
});

test('refresh preserves historical selection while latest follows new day',()=>{
  const before=[{day:'2026-10-28'},{day:'2026-10-29'}],after=[...before,{day:'2026-10-30'}];
  assert.equal(selectedDayIndex(before,'0',after),0);
  assert.equal(selectedDayIndex(before,'1',after),2);
  assert.equal(selectedDayIndex([],'',after),2);
});

test('LIVE metadata expires by candle time even after a failed refresh',()=>{
  const t=Date.UTC(2026,9,30),c={status:'live',lastTimeBySymbol:{SPYUSDT:t,QQQUSDT:t}};
  assert.equal(collectionIsStale(c,t,t+900000),false);
  assert.equal(collectionIsStale(c,t,t+1800000+15001),true);
  assert.equal(collectionIsStale({...c,status:'delayed'},t,t+900000),true);
  assert.equal(collectionIsStale(null,undefined,t),true);
});
