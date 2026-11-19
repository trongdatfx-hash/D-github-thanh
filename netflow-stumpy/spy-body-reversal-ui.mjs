import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';

export function bodyReversalPrimitive(chart,price){
  let state={points:[],last:null},visible=false;
  const primitive=new SpectrumPrimitive(({context:ctx,mediaSize:{width,height}})=>{
    if(!visible)return;
    ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    const scale=chart.timeScale(),xOf=t=>scale.timeToCoordinate(t),yOf=v=>price.priceToCoordinate(v);
    let previous=null;
    ctx.lineWidth=1.5;ctx.setLineDash([7,3,1.5,3]);
    for(const point of state.preview?[...state.points,state.preview]:state.points){
      const x=xOf(point.time),y=yOf(point.value);
      if(!Number.isFinite(x)||!Number.isFinite(y)){previous=null;continue;}
      const color=point.direction>0?'#52eac0':'#ff8fa7';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=point.preview?.55:1;
      if(previous&&previous.segment===point.segment){ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(x,y);ctx.stroke();}
      if(point.flip&&x>=0&&x<=width&&y>=0&&y<=height){ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();}
      previous={...point,x,y};
    }
    const last=state.last;
    if(!last)return;
    const x=xOf(last.time),y=yOf(last.value),logical=Number.isFinite(x)?scale.coordinateToLogical(x):null;
    const end=logical===null?null:scale.logicalToCoordinate(logical+2);
    if(![x,y,end].every(Number.isFinite)||end<0||x>width)return;
    const color=last.direction>0?'#52eac0':'#ff8fa7';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=last.preview?.65:1;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(end,y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.font='700 12px system-ui';ctx.textBaseline='middle';
    const label='ĐẢO V₂',textWidth=ctx.measureText(label).width,labelX=Math.max(4,Math.min(end+6,width-textWidth-9)),labelY=Math.max(12,Math.min(y-12,height-12));
    ctx.fillStyle='#101d2b';ctx.fillRect(labelX-3,labelY-9,textWidth+6,18);ctx.fillStyle=color;ctx.fillText(label,labelX,labelY);
    // Keep the label reachable when the model threshold is outside price autoscale;
    // an edge arrow points toward its real level, without stretching candle scale.
    if(y<0||y>height){const tip=y<0?2:height-2,base=y<0?7:height-7;ctx.beginPath();ctx.moveTo(labelX+textWidth/2,tip);ctx.lineTo(labelX+textWidth/2-3,base);ctx.lineTo(labelX+textWidth/2+3,base);ctx.closePath();ctx.fill();}
  });
  price.attachPrimitive(primitive);
  return {setData(next,enabled){state=next;visible=enabled;primitive.redraw();}};
}
