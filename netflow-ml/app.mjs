import {analyze,mlStatus} from './engine.mjs';
import {calculateStrength,dvpStatus} from './dvp.mjs';
import {load} from './data.mjs';
const $=id=>document.getElementById(id),fmt=x=>x===null||x===undefined?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:3});
const date=t=>new Date(t).toLocaleString('vi-VN',{timeZone:'America/New_York',hour12:false});
let rows=[],count=130,offset=0,controller=null,busy=false,drag=null;
$('dvp').textContent=dvpStatus.message;
function selection(){const all=$('rth').checked?rows.filter(x=>x.session==='RTH'):rows;return all.slice(Math.max(0,all.length-offset-count),Math.max(0,all.length-offset));}
function draw(kind){
  const canvas=$(kind),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=devicePixelRatio||1;
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const data=selection(),left=8,right=w-75,top=12,bottom=h-24;
  if(!data.length){ctx.fillStyle='#94a7bb';ctx.fillText('Chưa có dữ liệu',20,40);return;}
  const values=kind==='price'?data.flatMap(b=>[b.h,b.l]):kind==='flow'?data.map(b=>b.net):data.flatMap(b=>[b.raw,b.adjusted,b.upper,b.lower]).filter(x=>x!==null);
  if(!values.length){ctx.fillStyle='#94a7bb';ctx.fillText('Đang khởi động Strength / hiệu chỉnh theo phiên',20,40);return;}
  let lo=Math.min(...values),hi=Math.max(...values);
  if(kind!=='price'){lo=Math.min(lo,0);hi=Math.max(hi,0);}
  const pad=(hi-lo)*.08||1;lo-=pad;hi+=pad;
  const y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top),step=(right-left)/data.length,x=i=>left+(i+.5)*step;
  ctx.font='11px Segoe UI';
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;ctx.strokeStyle='#243345';ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();ctx.fillStyle='#8397ab';ctx.fillText(fmt(v),right+8,y(v)+3);}
  if(kind==='price'||kind==='flow')data.forEach((b,i)=>{
    const color=kind==='flow'?(b.net>=0?'#54dbbb':'#ef6e79'):b.adjusted===null?'#7a899a':b.adjusted>=0?'#54dbbb':'#ef6e79';
    ctx.fillStyle=color;ctx.strokeStyle=color;
    if(kind==='price'){ctx.beginPath();ctx.moveTo(x(i),y(b.h));ctx.lineTo(x(i),y(b.l));ctx.stroke();ctx.fillRect(x(i)-step*.3,Math.min(y(b.o),y(b.c)),Math.max(1,step*.6),Math.max(1,Math.abs(y(b.o)-y(b.c))));}
    else ctx.fillRect(x(i)-step*.35,Math.min(y(0),y(b.net)),Math.max(1,step*.7),Math.max(1,Math.abs(y(0)-y(b.net))));
  });
  if(kind==='strength')for(const [key,color,dashed] of [['upper','#d3b870',true],['lower','#d3b870',true],['raw','#74aaff',false],['adjusted','#54dbbb',false]]){
    ctx.strokeStyle=color;ctx.lineWidth=dashed?1:2;ctx.setLineDash(dashed?[4,4]:[]);ctx.beginPath();let active=false;
    data.forEach((b,i)=>{if(b[key]===null){active=false;return;}if(active)ctx.lineTo(x(i),y(b[key]));else ctx.moveTo(x(i),y(b[key]));active=true;});ctx.stroke();
  }
  ctx.setLineDash([]);ctx.lineWidth=1;ctx.fillStyle='#8397ab';
  ctx.fillText(date(data[0].t)+' ET',left,h-4);ctx.textAlign='right';ctx.fillText(date(data.at(-1).t)+' ET',right,h-4);ctx.textAlign='left';
}
function render(){for(const kind of ['price','strength','flow'])draw(kind);const b=rows.at(-1);for(const [id,key] of [['net','net'],['net24','net24'],['volume24','volume24']])$(id).textContent=fmt(b?.[key]);$('session').textContent=b?.session??'—';$('ml').textContent=mlStatus(rows).message;}
async function refresh(){
  if(busy)return;busy=true;controller=new AbortController();$('refresh').disabled=true;
  const symbol=$('symbol').value;
  $('status').textContent=`Đang xác nhận ${symbol} và tải nến đã đóng…`;
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const result=await load(symbol,Number($('days').value),{signal:controller.signal});
    rows=analyze(result.bars,calculateStrength(result.bars));offset=0;
    $('export').disabled=false;
    const latest=rows.at(-1),stale=result.serverTime-latest.end>900000;
    $('status').textContent=`${symbol} · ${result.contract.status} / ${result.contract.contractType} · ${rows.length} nến · đóng lúc ${date(latest.end)} ET${stale?' · DỮ LIỆU TRỄ':''}`;
    render();
  }catch(e){$('status').textContent=`Không tải được: ${e.message}. ${rows.length?'Biểu đồ giữ dữ liệu lần tải trước; chưa cập nhật.':'Không có dữ liệu thay thế.'}`;}
  finally{clearTimeout(timeout);busy=false;$('refresh').disabled=false;}
}
for(const id of ['symbol','days'])$(id).addEventListener('change',()=>{controller?.abort();rows=[];$('export').disabled=true;render();if(busy){const retry=setInterval(()=>{if(!busy){clearInterval(retry);refresh();}},100);}else refresh();});
$('refresh').addEventListener('click',refresh);$('rth').addEventListener('change',()=>{offset=0;render();});
$('export').addEventListener('click',()=>{const keys=['t','end','session','o','h','l','c','v','buy','sell','net','volume24','net24','raw','adjusted','sigma','upper','lower','sourceSamples','rthSamples'];const csv=[keys.join(','),...rows.map(b=>keys.map(k=>b[k]??'').join(','))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=`${$('symbol').value}-M15-netflow.csv`;a.click();URL.revokeObjectURL(url);});
for(const kind of ['price','strength','flow']){
  const canvas=$(kind);
  canvas.addEventListener('wheel',e=>{e.preventDefault();count=Math.max(30,Math.min(600,count+(e.deltaY>0?20:-20)));render();},{passive:false});
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,offset};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();if(drag){const total=$('rth').checked?rows.filter(x=>x.session==='RTH').length:rows.length;offset=Math.max(0,Math.min(Math.max(0,total-count),drag.offset+Math.round((e.clientX-drag.x)/rect.width*count)));render();}const data=selection(),b=data[Math.max(0,Math.min(data.length-1,Math.floor((e.clientX-rect.left-8)/(rect.width-83)*data.length)))];if(b)$('hover').textContent=`${date(b.t)} ET · ${b.session} · O ${fmt(b.o)} H ${fmt(b.h)} L ${fmt(b.l)} C ${fmt(b.c)} · Net ${fmt(b.net)} · S ${fmt(b.raw)} → ${fmt(b.adjusted)} · ${b.reason} · mẫu phiên ${b.sourceSamples} / RTH ${b.rthSamples}`;});
}
new ResizeObserver(render).observe($('price'));setInterval(()=>{if(!document.hidden)refresh();},60000);refresh();
