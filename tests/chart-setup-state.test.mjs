import test from 'node:test';
import assert from 'node:assert/strict';
import {CHART_SETUP_KEY,REVERSAL_SETUP_DEFAULTS,readChartSetup,normalizeReversalSetup,saveReversalSetup,restoreSetupControls} from '../netflow-stumpy/chart-setup-state.mjs';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};

test('TK V2 changes survive a new mount and preserve the manually saved chart and viewport',()=>{
  const storage=memory(),prior={version:1,savedAt:100,controls:{symbol:'SPYUSDT',composite:false},timeRange:{from:10,to:20}};
  storage.setItem(CHART_SETUP_KEY,JSON.stringify(prior));
  const setup={roundTripBps:10,trendFilter:true,holdStrongTrend:false,showTrades:false};
  saveReversalSetup(setup,storage);
  const reloaded=readChartSetup(storage);
  assert.deepEqual(normalizeReversalSetup(reloaded.tkV2),setup);
  assert.deepEqual(reloaded.controls,prior.controls);assert.deepEqual(reloaded.timeRange,prior.timeRange);assert.equal(reloaded.savedAt,100);
  // A later manual chart save keeps the latest automatically saved TK V2 choices.
  storage.setItem(CHART_SETUP_KEY,JSON.stringify({...readChartSetup(storage),controls:{symbol:'QQQUSDT'}}));
  assert.deepEqual(readChartSetup(storage).tkV2,setup);
});
test('explicit false and zero persist; missing or corrupt fields use independent defaults',()=>{
  assert.deepEqual(normalizeReversalSetup({roundTripBps:0,trendFilter:false,holdStrongTrend:false,showTrades:false}),{roundTripBps:0,trendFilter:false,holdStrongTrend:false,showTrades:false});
  assert.deepEqual(normalizeReversalSetup({roundTripBps:Infinity,trendFilter:'true',showTrades:null}),REVERSAL_SETUP_DEFAULTS);
  const storage=memory();storage.setItem(CHART_SETUP_KEY,'{');assert.equal(readChartSetup(storage),null);
  saveReversalSetup({roundTripBps:4},storage);assert.equal(readChartSetup(storage).tkV2.roundTripBps,4);
});
test('invalid fee or denied storage never destroys the last valid setup',()=>{
  const storage=memory();saveReversalSetup({roundTripBps:5},storage);const before=storage.getItem(CHART_SETUP_KEY);
  for(const value of [NaN,Infinity,-1,10001,'5'])assert.throws(()=>saveReversalSetup({roundTripBps:value},storage));
  assert.equal(storage.getItem(CHART_SETUP_KEY),before);
  assert.throws(()=>saveReversalSetup({roundTripBps:5},null));
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readChartSetup(denied),null);assert.throws(()=>saveReversalSetup({roundTripBps:5},denied));
});
test('restoring a numeric input cannot abort later checkboxes or select choices',()=>{
  const nodes={threshold:{type:'number',min:'0',max:'10',value:'1'},flag:{type:'checkbox',checked:true},period:{options:[{value:'4'},{value:'8'}],value:'4'}};
  restoreSetupControls({threshold:'2.5',flag:false,period:'8'},Object.keys(nodes),id=>nodes[id]);
  assert.equal(nodes.threshold.value,'2.5');assert.equal(nodes.flag.checked,false);assert.equal(nodes.period.value,'8');
  for(const invalid of ['','NaN','Infinity','11','-1'])restoreSetupControls({threshold:invalid},['threshold'],id=>nodes[id]);
  assert.equal(nodes.threshold.value,'2.5');
  restoreSetupControls({period:'bad',missing:true},['period','missing'],id=>nodes[id]);assert.equal(nodes.period.value,'8');
});
