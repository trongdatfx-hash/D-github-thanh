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

export function collectionIsStale(collection,lastTime,now=Date.now(),step=900000){
  const stamps=Object.values(collection?.lastTimeBySymbol??{}).filter(Number.isFinite);
  const end=stamps.length?Math.min(...stamps):lastTime;
  if(!Number.isFinite(end)||now-end-step>step+15000)return true;
  return String(collection?.status??'').toLowerCase()!=='live';
}
