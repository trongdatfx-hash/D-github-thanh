import {oiDeltaGates} from './oi-delta-gate.mjs?v=20261104-oi-p62-1';

// Each column uses only its own candle and preceding observations. Price bins
// estimate where flow occurred; they are not positions' entry prices.
export function regionFlow(priceRows,flowRows,oiByTime,step,now,{binStep=.5,levels=3,window=96,columns=5,percentile=.62}={}){
  const empty={bins:[],mode:'price-region',latest:null};
  if(!(step>0)||!(binStep>0)||!Number.isFinite(now)||!Number.isInteger(levels)||levels<1||!Number.isInteger(window)||window<1||!Number.isInteger(columns)||columns<1)return empty;
  const prices=priceRows.filter(r=>Number.isFinite(r.t)&&r.t<=now&&[r.o,r.h,r.l,r.c,r.end].every(Number.isFinite)&&r.h>=Math.max(r.o,r.c)&&r.l<=Math.min(r.o,r.c)).sort((a,b)=>a.t-b.t);
  const flow=new Map(flowRows.map(r=>[r.t,r]));
  const valid=r=>Number.isFinite(r?.net)&&Number.isFinite(r?.q)&&r.q>0&&Math.abs(r.net)<=r.q*(1+1e-9);
  const bucket=p=>Math.floor(Math.round(p/binStep)/levels),gates=oiDeltaGates(oiByTime,step,now,{percentile}),bins=[];
  for(let i=Math.max(0,prices.length-columns);i<prices.length;i++){
    const current=prices[i],key=bucket(current.c),selected=prices.slice(Math.max(0,i-window+1),i+1).filter(r=>bucket(r.c)===key);
    let net=0,quote=0,body=0,span=0,paired=0,netOi=0,threshold=0,gateCount=0,count=0;
    for(const row of selected){
      const f=flow.get(row.t);if(!valid(f))continue;
      count++;net+=f.net;quote+=f.q;body+=row.c-row.o;span+=row.h-row.l;
      const a=oiByTime.get(row.t-step),b=oiByTime.get(row.t);
      if(row.end>=now||!Number.isFinite(a?.oi)||!Number.isFinite(b?.oi)||a.oi<=0||b.oi<=0)continue;
      paired++;netOi+=b.oi-a.oi;
      const gate=gates.get(row.t);if(gate?.ready){gateCount++;threshold+=gate.threshold;}
    }
    const pct=quote?100*net/quote:null,complete=count>0&&paired===count,ready=complete&&gateCount===count&&count>=2;
    const oiState=!complete?'missing':!ready?'warmup':Math.abs(netOi)>threshold?(netOi>0?'increase':'decrease'):'normal';
    const efficiency=span?body/span:0,direction=Math.sign(pct??0);
    const absorption=count>=2&&Math.abs(pct??0)>=20&&direction*efficiency<=.1;
    const low=key*levels*binStep-binStep/2,high=low+levels*binStep;
    bins.push({t:current.t,pct,net,quote,count,priceCount:selected.length,paired,netOi,threshold:ready?threshold:null,oiState,efficiency,absorption,low,high,provisional:current.end>=now,flowReady:count===selected.length&&valid(flow.get(current.t))});
  }
  return {bins,latest:bins.at(-1)??null,mode:'price-region',window,levels,binStep,percentile};
}

export function regionFlowLabel(bar){
  if(!bar||!Number.isFinite(bar.pct))return 'CHỜ CVD';
  const side=bar.pct>0?'MUA':bar.pct<0?'BÁN':'CÂN BẰNG';
  const oi={increase:'OI TĂNG',decrease:'OI GIẢM',normal:'OI NHẸ',warmup:'OI CHỜ NỀN',missing:`OI THIẾU ${bar.paired}/${bar.count}`}[bar.oiState];
  const price=Math.abs(bar.efficiency)<=.1?'GIÁ NGANG':bar.efficiency>0?'GIÁ TĂNG':'GIÁ GIẢM';
  return `${side} ${bar.pct>0?'+':''}${bar.pct.toFixed(1)}% · ${oi} · ${price}${bar.absorption?' · NGHI HẤP THỤ':''}${bar.provisional?' · XEM TRƯỚC':''}${!bar.flowReady?' · CVD THIẾU':''}`;
}

export function regionFlowDescription(state,format=String){
  const bar=state.latest;if(!bar)return 'Chờ CVD theo nhóm giá.';
  return `${regionFlowLabel(bar)}. Vùng ${format(bar.low)}–${format(bar.high)}, ${bar.count}/${bar.priceCount} nến có CVD trong ${state.window} nến gần nhất. Lực = 100 × tổng delta quote / tổng quote volume. OI khớp ${bar.paired}/${bar.count} nến; ngưỡng ròng = tổng P${Math.round(state.percentile*100)} |ΔOI| của 10 kỳ trước từng nến. Cột đặc: OI tăng rõ; rỗng: OI giảm rõ; nhạt: OI nhẹ, thiếu hoặc chưa đủ nền. Chấm vàng: |lực| ≥20%, ít nhất 2 nến và phản ứng giá cùng hướng ≤10% tổng biên nến. Giá nhóm dùng tổng thân nến / tổng biên nến. Phân bổ theo close là ước lượng; OI không xác định Long/Short. Nến chưa đóng không được ghép OI. Đây là mô tả trạng thái, không phải xác suất dự báo.`;
}

export function drawRegionFlow({context,canvas,state,layout,right,zero,halfHeight,live,format=String,source=''}){
  const {panelWidth,barWidth,gap,shownCount}=layout,left=right-panelWidth,bars=state.bins.slice(-shownCount),latest=state.latest;
  context.save();context.fillStyle='rgba(9,18,31,.94)';context.strokeStyle='#7189a5';context.lineWidth=1;
  context.fillRect(left,zero-halfHeight-17,panelWidth,2*halfHeight+50);context.strokeRect(left+.5,zero-halfHeight-16.5,panelWidth-1,2*halfHeight+49);
  context.strokeStyle='#7e92aa';context.setLineDash([2,3]);context.beginPath();context.moveTo(left+3,zero+.5);context.lineTo(right-3,zero+.5);context.stroke();context.setLineDash([]);
  for(let i=0;i<bars.length;i++){
    const b=bars[i];if(!Number.isFinite(b.pct))continue;
    const x=left+6+i*(barWidth+gap),size=Math.max(1,Math.abs(b.pct)/100*(halfHeight-4)),y=b.pct>=0?zero-size:zero,color=b.pct>=0?'#1ae0a3':'#ff4d70';
    context.strokeStyle=color;context.fillStyle=color;context.globalAlpha=['increase','decrease'].includes(b.oiState)?1:.38;
    if(b.oiState==='decrease')context.strokeRect(x+.5,y+.5,Math.max(1,barWidth-1),Math.max(1,size-1));else context.fillRect(x,y,barWidth,size);
    context.globalAlpha=1;
    if(b.absorption){context.fillStyle='#f6c85f';context.beginPath();context.arc(x+barWidth/2,b.pct>=0?y-3:y+size+3,2,0,2*Math.PI);context.fill();}
    if(live&&b.provisional){context.strokeStyle='#f6c85f';context.setLineDash([2,2]);context.strokeRect(x-.5,y-.5,barWidth+1,size+1);context.setLineDash([]);}
  }
  context.font='700 9px system-ui,sans-serif';context.textBaseline='middle';context.textAlign='left';context.fillStyle='#c5d6eb';
  context.fillText('CVD × OI · VÙNG',left+5,zero-halfHeight-8,panelWidth-10);
  const parts=regionFlowLabel(latest).split(' · ');
  context.fillStyle=latest?.pct>0?'#39f0b9':latest?.pct<0?'#ff718d':'#c5d6eb';
  context.fillText(parts.slice(0,2).join(' · '),left+5,zero+halfHeight+8,panelWidth-10);
  context.fillStyle=latest?.absorption?'#f6c85f':'#b4c4d6';context.fillText(parts.slice(2).join(' · '),left+5,zero+halfHeight+22,panelWidth-10);context.restore();
  canvas.dataset.status='visible';canvas.dataset.mode='price-region';canvas.dataset.bins=String(bars.length);canvas.dataset.live=String(live);canvas.dataset.oiState=latest?.oiState??'missing';canvas.dataset.absorption=String(!!latest?.absorption);canvas.dataset.barWidth=String(barWidth);canvas.dataset.barSpacing=String(layout.barSpacing);
  canvas.setAttribute('aria-label',source+'. '+regionFlowDescription(state,format));
}
