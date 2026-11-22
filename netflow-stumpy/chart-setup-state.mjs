export const CHART_SETUP_KEY='netflow-rth-lite:chart-setup:v1';
export const REVERSAL_SETUP_DEFAULTS=Object.freeze({roundTripBps:0,trendFilter:false,holdStrongTrend:true,showTrades:true});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function browserSetupStorage(){try{return globalThis.localStorage??null;}catch{return null;}}
export function readChartSetup(storage=browserSetupStorage()){
  try{const saved=JSON.parse(storage?.getItem(CHART_SETUP_KEY)||'null');return saved?.version===1&&record(saved.controls)?saved:null;}catch{return null;}
}
export function normalizeReversalSetup(value){
  const setup={...REVERSAL_SETUP_DEFAULTS};
  if(!record(value))return setup;
  if(typeof value.roundTripBps==='number'&&Number.isFinite(value.roundTripBps)&&value.roundTripBps>=0&&value.roundTripBps<=10000)setup.roundTripBps=value.roundTripBps;
  for(const key of ['trendFilter','holdStrongTrend','showTrades'])if(typeof value[key]==='boolean')setup[key]=value[key];
  return setup;
}
export function saveReversalSetup(value,storage=browserSetupStorage()){
  if(!storage)throw Error('Trình duyệt đang chặn bộ nhớ cục bộ');
  if(!record(value)||!Number.isFinite(value.roundTripBps)||value.roundTripBps<0||value.roundTripBps>10000)throw Error('Phí phải từ 0 đến 10.000 bps; setup hợp lệ trước đó vẫn được giữ');
  const saved=readChartSetup(storage)??{version:1,controls:{}};
  const next={...saved,tkV2:normalizeReversalSetup(value),tkV2SavedAt:Date.now()};
  storage.setItem(CHART_SETUP_KEY,JSON.stringify(next));return next.tkV2;
}
export function restoreSetupControls(saved,ids,lookup){
  if(!record(saved))return;
  for(const id of ids){
    const node=lookup(id),value=saved[id];if(!node)continue;
    if(node.type==='checkbox'){if(typeof value==='boolean')node.checked=value;continue;}
    if(typeof value!=='string')continue;
    if(node.options){if([...node.options].some(option=>option.value===value))node.value=value;continue;}
    if(node.type==='number'||node.type==='range'){
      const number=Number(value);
      if(value.trim()===''||!Number.isFinite(number)||(node.min!==''&&node.min!==undefined&&number<Number(node.min))||(node.max!==''&&node.max!==undefined&&number>Number(node.max)))continue;
      node.value=value;
    }
  }
}
