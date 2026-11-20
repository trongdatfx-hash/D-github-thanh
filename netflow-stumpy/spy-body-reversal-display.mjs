import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';

export const reversalExitLabel=t=>t.reason==='SPY_FLIP'?'Đổi dấu SPY V':t.deferredTpTime!=null?'Trend yếu sau mốc V₂':'Mốc V₂ đủ 4 M15';
const side=p=>p.direction>0?'BUY':'SELL';
export function reversalTradeDisplay(report){
  if(!report)return {status:'Chờ dữ liệu',position:null,latest:null,events:[]};
  const events=[];
  const entry=p=>events.push({kind:'entry',time:p.entryTime/1000,value:p.entry,direction:p.direction,label:side(p)});
  for(const t of report.trades){entry(t);events.push({kind:'exit',time:t.exitTime/1000,value:t.exit,direction:t.direction,label:'THOÁT '+side(t),reason:reversalExitLabel(t)});}
  // A censored position has a real entry but no observed exit fill.
  for(const t of report.censored??[])entry(t);
  const p=report.open;
  if(p)entry(p);
  let status='Đứng ngoài';
  if(p)status=p.tpDue?(p.pendingReason==='SPY_FLIP'?'Chờ thoát · đổi dấu':'Chờ thoát · mốc V₂'):p.waitForFlip?'Giữ lệnh · chờ đổi dấu':p.tpExpired?'Giữ lệnh · thiếu pha liên tục':p.holdingTrend?'Giữ trend khỏe':'Đang giữ lệnh';
  else if(report.pending)status='Chờ vào '+side(report.pending);
  else if(report.watching)status='Chờ xác nhận '+side(report.watching);
  else if(report.censored?.at(-1)?.lastObservedTime>=((report.trades.at(-1)?.exitTime??-Infinity)))status='Đứng ngoài · lịch sử gián đoạn';
  events.sort((a,b)=>a.time-b.time||(a.kind==='exit'?-1:1));
  return {status,position:p??null,pending:report.pending??report.watching??null,latest:report.trades.at(-1)??null,events};
}

export function reversalTradePrimitive(chart,price){
  let events=[],enabled=true;
  const layer=new SpectrumPrimitive(({context:ctx,mediaSize:{width,height}})=>{
    if(!enabled)return;
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    ctx.font='700 10px system-ui';ctx.textBaseline='middle';
    for(const e of events){
      const x=chart.timeScale().timeToCoordinate(e.time),y=price.priceToCoordinate(e.value);
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>width||y<0||y>height)continue;
      const exit=e.kind==='exit',color=exit?'#ffd166':e.direction>0?'#39edb5':'#ff7998';
      ctx.strokeStyle='#07111f';ctx.lineWidth=4;ctx.fillStyle=color;
      ctx.beginPath();
      if(exit){ctx.moveTo(x-4,y-4);ctx.lineTo(x+4,y+4);ctx.moveTo(x+4,y-4);ctx.lineTo(x-4,y+4);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}
      else{const d=e.direction>0?1:-1;ctx.moveTo(x,y);ctx.lineTo(x-5,y+d*9);ctx.lineTo(x+5,y+d*9);ctx.closePath();ctx.stroke();ctx.fill();}
      const label='V₂ '+e.label+' '+e.value.toFixed(2),w=ctx.measureText(label).width+10;
      const left=Math.max(1,Math.min(width-w-1,x-w/2));
      const top=Math.max(1,Math.min(height-18,y+(exit?-29:e.direction>0?13:-29)));
      ctx.fillStyle='#081727e8';ctx.fillRect(left,top,w,17);ctx.fillStyle=color;ctx.fillText(label,left+5,top+8.5);
    }
    ctx.restore();
  });
  price.attachPrimitive(layer);
  return {setData(report,visible=true){events=reversalTradeDisplay(report).events;enabled=visible;layer.redraw();}};
}
