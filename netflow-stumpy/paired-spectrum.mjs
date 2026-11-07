import {oiSpectrumDay} from './oi-spectrum.mjs?v=20261104-oi-stale-fast2';

export function spyCandleVolumeFlow(bars){
  return bars.filter(b=>[b.o,b.c,b.v].every(Number.isFinite)&&b.v>=0).map(b=>({...b,net:Math.sign(b.c-b.o)*b.v}));
}

export function buildSpectrumComparison(priceRows,flowBars,oiProfile,now,{binStep=.5,range=12,flowSource='taker'}={}){
  const empty={rows:[],day:null,count:0,oiCount:0,pairedReady:false,maxCvd:0,maxOiGross:0,binStep,flowSource};
  if(!Number.isFinite(now)||now<=0||!priceRows.length)return empty;
  const day=oiProfile.ready?oiProfile.day:oiSpectrumDay(now),center=priceRows.at(-1).c,flow=new Map(flowBars.map(r=>[r.t,r.net]));
  const daily=priceRows.filter(r=>r.end<now&&oiSpectrumDay(r.t)===day&&Number.isFinite(flow.get(r.t)));
  const dailyTimes=new Set(daily.map(r=>r.t)),oiTimes=new Set(oiProfile.times??[]);
  const pairedReady=oiProfile.ready===true&&oiProfile.day===day&&oiTimes.size>0&&[...oiTimes].every(t=>dailyTimes.has(t));
  // When OI is available, compare exactly the same timestamps, even over gaps.
  const selected=pairedReady?daily.filter(r=>oiTimes.has(r.t)):daily,bins=new Map();
  const get=price=>{const key=Math.round(price/binStep);if(!bins.has(key))bins.set(key,{price:key*binStep,cvd:0,opened:0,closed:0});return bins.get(key);};
  for(const row of selected)get(row.c).cvd+=flow.get(row.t);
  if(pairedReady)for(const row of oiProfile.bins){const bin=get(row.price);bin.opened=row.opened;bin.closed=row.closed;}
  const rows=[...bins.values()].filter(r=>Math.abs(r.price-center)<=range).sort((a,b)=>a.price-b.price).map(r=>({...r,netOi:r.opened-r.closed,grossOi:r.opened+r.closed,rank:0}));
  const top=[...rows].filter(r=>r.grossOi>0).sort((a,b)=>b.grossOi-a.grossOi||Math.abs(a.price-center)-Math.abs(b.price-center)).slice(0,3);
  top.forEach((r,i)=>{r.rank=i+1;});
  return {rows,day,stale:pairedReady&&oiProfile.stale===true,last:oiProfile.last,times:selected.map(r=>r.t),count:selected.length,oiCount:pairedReady?oiTimes.size:0,pairedReady,maxCvd:Math.max(0,...rows.map(r=>Math.abs(r.cvd))),maxOiGross:Math.max(0,...rows.map(r=>r.grossOi)),binStep,flowSource};
}

export function spectrumLaneLayout(width,anchor,{showCvd=true,compare=true}={}){
  const compact=width<650,halfCvd=showCvd?(compact?25:40):0,oiWidth=compare?(compact?44:62):0,gap=showCvd&&compare?12:0;
  const total=2*halfCvd+gap+oiWidth,left=Math.max(4,Math.min(width-total-6,anchor+8));
  return {left,right:left+total,xCvd:left+halfCvd,halfCvd,xOi:left+2*halfCvd+gap,oiWidth};
}

export function spectrumPriceGroup(comparison,currentPrice,{levels=3}={}){
  const step=comparison.binStep??.5;
  if(!Number.isFinite(currentPrice)||!Number.isInteger(levels)||levels<1)return null;
  const bucket=Math.floor(Math.round(currentPrice/step)/levels),first=bucket*levels*step,low=first-step/2,high=low+levels*step;
  const rows=comparison.rows.filter(row=>Math.floor(Math.round(row.price/step)/levels)===bucket);
  const cvd=rows.reduce((sum,row)=>sum+row.cvd,0),opened=rows.reduce((sum,row)=>sum+row.opened,0),closed=rows.reduce((sum,row)=>sum+row.closed,0),netOi=opened-closed;
  const ready=rows.length>0&&comparison.count>0&&comparison.pairedReady;
  const state=!ready?'WAIT':cvd===0||netOi===0?'neutral':`${cvd>0?'buy':'sell'}-oi-${netOi>0?'increase':'decrease'}`;
  return {low,high,levels,count:rows.length,cvd,opened,closed,netOi,grossOi:opened+closed,ready,state};
}

export function confirmSpectrumGroup(group,comparison,priceRows,oiPoints,{minSamples=2,minShare=.6}={}){
  const empty={state:'WAIT',count:0,support:0,share:0};
  if(!group?.ready||group.cvd===0||group.netOi===0)return empty;
  const times=new Set(comparison.times??[]),step=comparison.binStep??.5;
  const expected=`${group.cvd>0?'up':'down'}-oi-${group.netOi>0?'increase':'decrease'}`;
  let count=0,support=0,totalWeight=0,supportWeight=0;
  for(const row of priceRows){
    const bin=Math.round(row.c/step)*step,point=oiPoints.get(row.t);
    if(!times.has(row.t)||bin<group.low||bin>=group.high||!point?.matched||!Number.isFinite(point.delta)||point.delta===0)continue;
    count++;totalWeight+=Math.abs(point.delta);
    if(point.kind===expected){support++;supportWeight+=Math.abs(point.delta);}
  }
  const share=totalWeight?supportWeight/totalWeight:0,opposed=count-support;
  const state=support>=minSamples&&share>=minShare?'confirmed':opposed>=minSamples&&1-share>=minShare?'conflict':count<minSamples?'forming':'mixed';
  return {state,count,support,share};
}

export function drawPairedSpectrum({context,mediaSize,anchor,priceToY,history,comparison,showCvd=true,compare=true,source='C→S',format=String,large=null}){
  if(!showCvd&&!compare)return;
  const {width,height}=mediaSize,lane=spectrumLaneLayout(width,anchor,{showCvd,compare});
  const line=(x1,x2,y,color,size)=>{if(!Number.isFinite(y)||y<22||y>height-4||x1===x2)return;context.strokeStyle=color;context.lineWidth=size;context.beginPath();context.moveTo(x1,y);context.lineTo(x2,y);context.stroke();};
  context.save();context.beginPath();context.rect(0,0,width,height);context.clip();
  context.font=`600 ${width<650?8:9}px Inter,system-ui,sans-serif`;context.textBaseline='top';context.textAlign='center';context.fillStyle='#c5d6eb';
  if(showCvd&&large){
    context.fillText('Taker lớn P95',lane.xCvd,5);
    context.font='600 8px Inter,system-ui,sans-serif';context.fillStyle=large.stale?'#ffc67d':'#c5d6eb';
    context.fillText(large.stale?'TRỄ / THIẾU':large.ready?'MỘT PHẦN NGÀY':'CHỜ M15 ĐÓNG',lane.xCvd,16);
    context.strokeStyle='rgba(157,181,209,.25)';context.lineWidth=1;context.beginPath();context.moveTo(lane.xCvd,30);context.lineTo(lane.xCvd,height);context.stroke();
    for(const r of large.rows){const y=priceToY(r.price);if(y<32)continue;const scale=large.maxTotal?lane.halfCvd/large.maxTotal:0;line(lane.xCvd-r.sell*scale,lane.xCvd,y,'#ff627d',4);line(lane.xCvd,lane.xCvd+r.buy*scale,y,'#23e0a4',4);}
  }else if(showCvd){
    context.fillText(compare?(comparison.flowSource==='spy-candle-volume'?'CVD ngày ΔV':'CVD ngày'):'CVD∞ '+source,lane.xCvd,5);
    context.strokeStyle='rgba(157,181,209,.25)';context.lineWidth=1;context.beginPath();context.moveTo(lane.xCvd,20);context.lineTo(lane.xCvd,height);context.stroke();
    for(const bin of history.bins){
      const y=priceToY(bin.price),length=history.maxAbs?bin.value/history.maxAbs*lane.halfCvd:0;
      line(lane.xCvd,lane.xCvd+length,y,bin.value>=0?(compare?'rgba(75,153,245,.18)':'#4b99f5'):(compare?'rgba(242,138,97,.18)':'#f28a61'),compare?2:4);
    }
    if(compare)for(const bin of comparison.rows){const length=comparison.maxCvd?bin.cvd/comparison.maxCvd*lane.halfCvd:0;line(lane.xCvd,lane.xCvd+length,priceToY(bin.price),bin.cvd>=0?'#4b99f5':'#f28a61',bin.rank?5:3);}
  }
  if(compare){
    context.fillStyle='#c5d6eb';context.fillText(comparison.pairedReady?(comparison.stale?'OI CŨ':'OI + / −'):'OI WAIT',lane.xOi+lane.oiWidth/2,5);
    context.fillStyle='rgba(9,18,31,.65)';context.fillRect(lane.xOi-3,20,lane.oiWidth+6,Math.max(0,height-20));
    const labels=[];
    for(const row of comparison.rows){
      if(!comparison.pairedReady||!row.grossOi||!comparison.maxOiGross)continue;
      const y=priceToY(row.price),scale=lane.oiWidth/comparison.maxOiGross,buyEnd=lane.xOi+row.opened*scale,end=buyEnd+row.closed*scale;
      line(lane.xOi,buyEnd,y,row.rank?'#23e0a4':'rgba(35,224,164,.38)',row.rank?5:2);
      line(buyEnd,end,y,row.rank?'#ff627d':'rgba(255,98,125,.38)',row.rank?5:2);
      if(row.rank&&Number.isFinite(y)&&y>=34&&y<height-15)labels.push({row,y});
    }
    context.textBaseline='bottom';context.textAlign='right';context.font='700 8px Inter,system-ui,sans-serif';
    const used=[];for(const {row,y} of labels.sort((a,b)=>a.row.rank-b.row.rank)){
      if(used.some(previous=>Math.abs(previous-y)<16))continue;used.push(y);
      context.fillStyle='#edf4ff';context.fillText(`#${row.rank} ${format(row.price)}`,lane.right,y-4);
    }
  }
  context.restore();return lane;
}

