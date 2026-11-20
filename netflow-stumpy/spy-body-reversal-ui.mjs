import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';

const PALETTE={lower:'#76d7ff',upper:'#ffd166',outline:'#07111f',tag:'#091a2b'};
const colorOf=point=>point.direction>0?PALETTE.lower:PALETTE.upper;
const clamp=(value,low,high)=>Math.max(low,Math.min(value,high));

// Select the FIRST uninterrupted reversal line of this candle trend, even when
// later thresholds are unsolved. Red uses its highest price; green its lowest.
export function firstTrendReversalAnchor(state){
  const last=state.last;
  if(!last)return null;
  const points=state.points.filter(p=>p.time<=last.time);
  if(points.at(-1)!==last)points.push(last);
  let start=points.length-1;
  while(start>0){
    const current=points[start],previous=points[start-1];
    if(current.flip||previous.direction!==last.direction||
      (last.trend!==undefined&&previous.trend!==last.trend))break;
    start--;
  }
  let anchor=points[start];
  const firstSegment=anchor.segment;
  for(let i=start+1;i<points.length;i++){
    const point=points[i];
    if(point.segment!==firstSegment)break;
    if(Number.isFinite(point.value)&&(last.direction<0?point.value>anchor.value:point.value<anchor.value))anchor=point;
  }
  return anchor;
}

export function bodyReversalPrimitive(chart,price){
  let state={points:[],last:null},visible=false;
  const primitive=new SpectrumPrimitive(({context:ctx,mediaSize:{width,height}})=>{
    if(!visible)return;
    ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    const scale=chart.timeScale(),xOf=t=>scale.timeToCoordinate(t),yOf=v=>price.priceToCoordinate(v);
    const compact=width<600;
    ctx.lineCap='round';ctx.lineJoin='round';
    function strokePath(points,color,{live=false,strong=false}={}){
      if(points.length<2)return;
      const draw=()=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
      ctx.setLineDash([]);ctx.globalAlpha=.94;ctx.strokeStyle=PALETTE.outline;ctx.lineWidth=strong?6:4.5;draw();
      ctx.setLineDash(live?[3,5]:[8,4,1,4]);ctx.globalAlpha=strong?1:.88;ctx.strokeStyle=color;ctx.lineWidth=strong?2.8:2;draw();
      ctx.setLineDash([]);ctx.globalAlpha=1;
    }
    function dot(x,y,color,{live=false,flip=false,latest=false}={}){
      if(x<0||x>width||y<0||y>height)return;
      const radius=latest?5:flip?3.5:2;
      ctx.beginPath();ctx.arc(x,y,radius+1.5,0,Math.PI*2);ctx.fillStyle=PALETTE.outline;ctx.fill();
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=live?PALETTE.tag:color;ctx.fill();
      if(live||latest){ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.stroke();}
      if(latest&&!live){ctx.beginPath();ctx.arc(x,y,1.8,0,Math.PI*2);ctx.fillStyle=PALETTE.outline;ctx.fill();}
    }

    // Batch uninterrupted color runs: dash spacing must not restart each candle.
    let previous=null,run=[],runColor=null;
    const markers=[];
    const flush=()=>{if(run.length>1)strokePath(run,runColor);run=[];};
    for(const point of state.points){
      const x=xOf(point.time),y=yOf(point.value),color=colorOf(point);
      if(!Number.isFinite(x)||!Number.isFinite(y)){flush();previous=null;continue;}
      const connected=previous&&previous.segment===point.segment;
      if(!connected){flush();run=[[x,y]];runColor=color;}
      else if(runColor!==color){flush();run=[[previous.x,previous.y],[x,y]];runColor=color;}
      else run.push([x,y]);
      if(!connected||point.flip)markers.push({x,y,color,flip:point.flip});
      previous={...point,x,y};
    }
    flush();
    for(const marker of markers)dot(marker.x,marker.y,marker.color,marker);

    // Keep live points bright; hollow markers and short dashes indicate preview.
    if(state.preview){
      const p=state.preview,x=xOf(p.time),y=yOf(p.value);
      if(Number.isFinite(x)&&Number.isFinite(y)){
        if(previous&&previous.segment===p.segment)strokePath([[previous.x,previous.y],[x,y]],colorOf(p),{live:true,strong:true});
        dot(x,y,colorOf(p),{live:true});
      }
    }
    const last=state.last;
    if(!last)return;
    const currentX=xOf(last.time),currentY=yOf(last.value),logical=Number.isFinite(currentX)?scale.coordinateToLogical(currentX):null;
    const end=logical===null?null:scale.logicalToCoordinate(logical+2);
    const color=colorOf(last);
    if([currentX,currentY,end].every(Number.isFinite)&&end>=0&&currentX<=width){
      strokePath([[currentX,currentY],[end,currentY]],color,{live:!!last.preview,strong:true});
      dot(currentX,currentY,color,{live:!!last.preview,latest:true});
      if(currentY>=0&&currentY<=height){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(end,currentY-4);ctx.lineTo(end,currentY+4);ctx.stroke();}
    }

    const anchor=firstTrendReversalAnchor(state);
    const x=xOf(anchor.time),y=yOf(anchor.value);
    if(![x,y].every(Number.isFinite)||x<0||x>width)return;
    if(anchor!==last)dot(x,y,color,{live:!!anchor.preview,flip:true});

    // Keep the compact name beside its selected reversal point.
    const label='ĐẢO V₂';ctx.font='700 '+(compact?10:11)+'px system-ui';ctx.textBaseline='middle';
    const boxWidth=ctx.measureText(label).width+25,boxHeight=compact?20:22;
    const rightLimit=width-boxWidth-8-(width>=800&&x>width*.75?180:0);
    const left=clamp(x-boxWidth-9,8,Math.max(8,rightLimit));
    const top=clamp(y+(last.direction>0?10:-boxHeight/2),8,Math.max(8,height-boxHeight-8));
    const centerY=top+boxHeight/2,leaderX=clamp(x,0,width);
    ctx.globalAlpha=.8;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([2,3]);
    ctx.beginPath();ctx.moveTo(leaderX,clamp(y,0,height));ctx.lineTo(left+boxWidth+5,centerY);ctx.lineTo(left+boxWidth,centerY);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
    ctx.beginPath();ctx.roundRect(left,top,boxWidth,boxHeight,4);ctx.fillStyle=PALETTE.tag;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.arc(left+9,centerY,2.5,0,Math.PI*2);ctx.fillStyle=anchor.preview?PALETTE.tag:color;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#f4faff';ctx.fillText(label,left+17,centerY+.5);
    if(y<0||y>height){
      const tip=y<0?1:height-1,base=y<0?7:height-7,arrowX=clamp(x,6,width-6);
      ctx.beginPath();ctx.moveTo(arrowX,tip);ctx.lineTo(arrowX-4,base);ctx.lineTo(arrowX+4,base);ctx.closePath();ctx.fillStyle=color;ctx.fill();
    }
  });
  price.attachPrimitive(primitive);
  return {setData(next,enabled){state=next;visible=enabled;primitive.redraw();}};
}
