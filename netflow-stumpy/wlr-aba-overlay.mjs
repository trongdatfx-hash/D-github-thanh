// Presentation helpers; no OHLC prices, candle colors or model refitting.
export const ABA_OVERLAY_WIDTH_RATIO=1/3;
export function freezeAbaResult(previous,result){
 if(result?.status!=='READY'||previous?.status!=='READY')return result;
 const a=previous.track,b=result.track;
 if(a.day!==b.day||a.originStart!==b.originStart||a.q.issuedAt!==b.q.issuedAt)return result;
 const track={...b,q:a.q,prediction:a.prediction,baseline:a.baseline??b.baseline,direction:a.direction??b.direction,model:a.model,computedAt:a.computedAt,sourceAsOf:a.sourceAsOf};
 return {...result,track,state:{...result.state,track},changePct:track.prediction.ready?100*(track.prediction.value/track.q.currentWlr-1):null};
}
export function canRetainAba(active,context,ageMs){
 return Boolean(active?.track.prediction.ready&&context.live&&context.symbol==='SPYUSDT'&&context.interval==='15m'&&Number.isFinite(context.expectedTime)&&context.expectedTime>=active.lastTime&&context.expectedTime-active.lastTime<=900000&&ageMs>=0&&ageMs<=20000);
}
export function abaOverlayGeometry(timeScale,wlr,pane,bounds,track){
 if(!pane||!bounds||!wlr||!track?.prediction.ready)return null;
 const regionWidth=(bounds.right-bounds.left)*ABA_OVERLAY_WIDTH_RATIO,left=bounds.xBase-regionWidth/2,right=bounds.xBase+regionWidth/2,anchorY=wlr.priceToCoordinate(track.q.currentWlr),y=wlr.priceToCoordinate(track.prediction.value),low=wlr.priceToCoordinate(track.prediction.low),high=wlr.priceToCoordinate(track.prediction.high);
 if(![left,right,anchorY,y,low,high,pane.height,pane.top].every(Number.isFinite)||right-left<=12)return null;
 return {left,right,width:right-left,anchorY,y,low,high,top:pane.top,height:pane.height,widthRatio:ABA_OVERLAY_WIDTH_RATIO,alignment:'cvd-center'};
}
export function abaLabel(track){
 if(track.signal?.emit===false)return {first:'A · WAIT',second:({NEAR_BASE:'gần nền',BAND_CROSSES_WLR:'dải cắt WLR',CALIBRATION_DISAGREES:'P50 chưa rõ',WAIT_HISTORY:'thiếu mẫu'}[track.signal.reason]??'chờ kiểm định')};
 const d=track.direction,pct=v=>Math.round(100*v)+'%';
 return {first:d?.ready&&Number.isFinite(d.pAbove)?'A↑ '+pct(d.pAbove):'A↑ WAIT',second:d?.baseline.ready&&Number.isFinite(d.baseline.pAbove)?'/ nền '+pct(d.baseline.pAbove):'/ nền WAIT'};
}
export function abaPaintKey(geometry,width,height,dpr,track){
 const snap=v=>Math.round(v*dpr);
 return [width,height,dpr,...['left','right','y','low','high','top','height'].map(k=>snap(geometry[k])),track.originStart,track.q.issuedAt,track.q.currentWlr,track.q.color,track.prediction.value,track.direction?.ready,track.direction?.pAbove,track.direction?.baseline.ready,track.direction?.baseline.pAbove,track.signal?.emit,track.signal?.reason].join('|');
}
