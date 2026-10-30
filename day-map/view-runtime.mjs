// Keep logical canvas dimensions separate from its device-pixel backing store.
export function resizeCanvas(canvas,dpr=globalThis.devicePixelRatio||1){
  const h=Number(canvas.dataset.logicalHeight??canvas.getAttribute('height'))||330;
  canvas.dataset.logicalHeight=String(h);
  canvas.style.height=`${h}px`;
  const w=Math.max(1,canvas.clientWidth),ratio=Math.min(3,Math.max(1,dpr));
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  }
  const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
  return {c,w,h};
}

export function selectedDayIndex(previousDays,value,nextDays){
  const index=Number(value),selected=previousDays[index]?.day;
  if(!selected||index===previousDays.length-1)return nextDays.length-1;
  const found=nextDays.findIndex(x=>x.day===selected);
  return found<0?nextDays.length-1:found;
}

export function collectionLastTime(collection,lastTime){
  const bySymbol=collection?.lastTimeBySymbol;
  if(bySymbol&&typeof bySymbol==='object'){
    const spy=bySymbol.SPYUSDT,qqq=bySymbol.QQQUSDT;
    return Number.isFinite(spy)&&Number.isFinite(qqq)?Math.min(spy,qqq):NaN;
  }
  return Number.isFinite(lastTime)?lastTime:NaN;
}

export function collectionIsStale(collection,lastTime,now=Date.now(),step=900000){
  const end=collectionLastTime(collection,lastTime);
  if(!Number.isFinite(end)||now-end-step>step+15000)return true;
  return String(collection?.status??'').toLowerCase()!=='live';
}

export async function fetchHistoryManifest(url,{fetchImpl=fetch}={}){
  let primaryError;
  try{
    const response=await fetchImpl(url,{cache:'no-cache'});
    if(!response.ok)throw Error(`History manifest HTTP ${response.status}`);
    return await response.json();
  }catch(error){primaryError=error;}
  try{
    const cached=await fetchImpl(url,{cache:'force-cache'});
    if(!cached.ok)throw Error(`Cached history manifest HTTP ${cached.status}`);
    return await cached.json();
  }catch{return Promise.reject(primaryError);}
}

export function topUpStatusLabel(manifest,now=Date.now(),step=900000){
  const topUp=manifest?.topUp;
  if(topUp?.status==='ok')return `nối live +${topUp.added} M15`;
  if(topUp?.status==='current')return collectionIsStale(manifest?.collection,manifest?.lastTime,now,step)?'REST không có nến mới':'live đã đồng bộ';
  if(topUp?.status==='failed')return `nối live lỗi: ${topUp.reason}`;
  return '';
}
