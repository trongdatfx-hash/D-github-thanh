// GEX_ODTE_v15_0i: raw strikes remain raw until paint, so basis changes
// always move both the spectrum and Zero Gamma together.
export function parseGex(text){
  const raw=String(text??'').trim().replace(/[\r\n]/g,'');
  if(!raw||raw.length>1000000)throw Error('Dữ liệu GEX trống hoặc quá lớn (tối đa 1 MB).');
  const number=s=>s?.trim()!==''&&Number.isFinite(Number(s))?Number(s):NaN;
  const spreadMatch=raw.match(/^S:([^|]+)\|/),spread=spreadMatch?number(spreadMatch[1]):0;
  if(!Number.isFinite(spread))throw Error('Giá trị S: không hợp lệ.');
  const body=spreadMatch?raw.slice(spreadMatch[0].length):raw;
  const p=body.indexOf('|P:');
  const levels=p>=0&&body.startsWith('L:')?body.slice(2,p):'';
  const profile=p>=0?body.slice(p+3):body.replace(/^P:/,'');
  const bins=[];let zeroGamma=null;
  for(const row of levels.split(';')){
    const fields=row.split(',');
    if(fields[1]?.trim()==='ZG'){
      const value=number(fields[0]);if(!Number.isFinite(value)||value<=0)throw Error('Mức Zero Gamma không hợp lệ.');
      zeroGamma=value;
    }
  }
  for(const row of profile.split(';')){
    if(!row.trim())continue;
    const f=row.split(','),[strike,force,sign]=f.map(number);
    if(f.length!==3||!Number.isFinite(strike)||strike<=0||!Number.isFinite(force)||![-1,0,1].includes(sign))throw Error('Sai định dạng P: cần strike,độ mạnh,dấu;…');
    bins.push({strike,force,sign});
    if(bins.length>5000)throw Error('Tối đa 5.000 mức GEX.');
  }
  if(!bins.length)throw Error('Không tìm thấy phổ P:.');
  return {spread,zeroGamma,bins};
}
export function gexPrice(strike,basis,scale){return (strike-basis)/scale;}
export function gexLayout(width,anchor){
  const mobile=width<600,half=Math.min(width*.23,mobile?52:100),margin=8;
  const x=Math.max(half+margin,Math.min(width-half-margin,anchor+half+12));
  return {x,half,mobile,rowPixels:mobile?3:2,font:mobile?11:12};
}
export function drawGex({context:ctx,mediaSize:{width,height},profile,basis,scale,anchor,priceToY,mapping}){
  if(!profile||!Number.isFinite(anchor)||width<40||!(height>0))return;
  if(!mapping&&(!Number.isFinite(basis)||!(scale>0)))return;
  const convert=k=>mapping?k*mapping.ratio+mapping.offset:gexPrice(k,basis,scale);
  const {x,half,mobile,rowPixels,font}=gexLayout(width,anchor),visible=new Map();
  // At small zoom, keep the strongest bar of each sign in each pixel group.
  // Summing normalized forces would fabricate a larger exposure.
  const prices=profile.bins.map(b=>convert(b.strike)).filter(Number.isFinite).sort((a,b)=>a-b);
  let gap=Infinity;for(let i=1;i<prices.length;i++)if(prices[i]>prices[i-1])gap=Math.min(gap,prices[i]-prices[i-1]);
  for(const b of profile.bins){
    const value=convert(b.strike),y=priceToY(value);if(!Number.isFinite(y)||y<0||y>height||!b.force)continue;
    const key=Math.floor(y/rowPixels)+':'+(b.sign>=0?'call':'put'),old=visible.get(key);
    if(!old||Math.abs(b.force)>Math.abs(old.force))visible.set(key,{...b,y,value});
  }
  if(!visible.size&&!Number.isFinite(profile.zeroGamma))return;
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  const ys=[...visible.values()].map(b=>b.y),top=ys.length?Math.max(0,Math.min(...ys)-10):0,bottom=ys.length?Math.min(height,Math.max(...ys)+10):height;
  if(ys.length){
    ctx.fillStyle='rgba(5,14,27,.22)';ctx.fillRect(x-half-3,top,half*2+6,bottom-top);
    ctx.strokeStyle='#b9cee080';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();
    ctx.font=`600 ${font}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#e2e8f0';ctx.fillText('GEX',x,Math.max(font+2,top-3));
  }
  for(const b of visible.values()){
    const strength=Math.min(1,Math.abs(b.force)/10),length=Math.max(1.5,strength*half);
    const call=b.sign>=0;
    const neighbour=Number.isFinite(gap)?priceToY(b.value+gap):null;
    const h=Number.isFinite(neighbour)?Math.max(1.5,Math.min(mobile?5:7,Math.abs(neighbour-b.y)*.7)):3;
    ctx.fillStyle=call?`rgba(255,104,112,${.42+.48*strength})`:`rgba(43,229,199,${.42+.48*strength})`;
    ctx.fillRect(call?x-length:x,b.y-h/2,length,h);
    // Bright outer ends make direction and magnitude readable on small screens.
    ctx.fillStyle=call?'#ff9ba0':'#91ffeb';ctx.fillRect(call?x-length:x+length-1,b.y-h/2,1,h);
  }
  if(Number.isFinite(profile.zeroGamma)){
    const value=convert(profile.zeroGamma),y=priceToY(value);
    if(Number.isFinite(y)&&y>=0&&y<=height){
      ctx.strokeStyle='#f9dc85';ctx.lineWidth=1.3;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x-half,y);ctx.lineTo(x+half,y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#ffe4a0';ctx.fillRect(x-2,y-2,4,4);
      const label='Zero Gamma '+value.toFixed(2);ctx.font=`600 ${font}px sans-serif`;ctx.textAlign='center';
      const tw=(ctx.measureText?.(label).width??label.length*font*.58)+10;
      const tx=Math.max(tw/2+2,Math.min(width-tw/2-2,x)),ty=y<font+14?Math.min(height-4,y+font+9):Math.max(font+3,y-8);
      ctx.fillStyle='rgba(8,18,32,.93)';ctx.fillRect(tx-tw/2,ty-font-2,tw,font+6);
      ctx.fillStyle='#ffe4a0';ctx.fillText(label,tx,ty);
    }
  }
  ctx.restore();
}

