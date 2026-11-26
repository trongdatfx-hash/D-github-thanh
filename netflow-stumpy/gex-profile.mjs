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
export function drawGex({context:ctx,mediaSize:{width,height},profile,basis,scale,anchor,priceToY,span=100}){
  if(!profile||!Number.isFinite(anchor)||!Number.isFinite(basis)||!(scale>0))return;
  const half=Math.max(12,Math.min(span,width*.22)),x=Math.max(half+4,Math.min(width-half-4,anchor+half+12));
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  ctx.strokeStyle='#9ca3af66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();
  for(const b of profile.bins){
    const y=priceToY(gexPrice(b.strike,basis,scale));if(!Number.isFinite(y)||y<0||y>height)continue;
    const strength=Math.min(1,Math.abs(b.force)/10),length=strength*half;
    if(!length)continue;
    const call=b.sign>=0;
    ctx.fillStyle=call?`rgba(239,68,68,${.2+.5*strength})`:`rgba(34,197,94,${.2+.5*strength})`;
    ctx.fillRect(call?x-length:x,y-2,length,4);
  }
  if(Number.isFinite(profile.zeroGamma)){
    const value=gexPrice(profile.zeroGamma,basis,scale),y=priceToY(value);
    if(Number.isFinite(y)&&y>=0&&y<=height){
      ctx.strokeStyle='#cbd5e1';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.setLineDash([]);
      ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillStyle='#e2e8f0';ctx.fillText('Zero Gamma '+value.toFixed(2),6,Math.max(13,y-5));
    }
  }
  ctx.restore();
}
