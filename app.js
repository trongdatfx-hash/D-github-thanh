const SYMBOL="SPYUSDT";
const API="https://fapi.binance.com/fapi/v1/klines";
const BASIS_API="https://fapi.binance.com/futures/data/basis";
const WSBASE="wss://fstream.binance.com/market/stream?streams=";
const TFMS={ "1m":60000,"5m":300000,"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000,"1d":86400000 };
let tf="15m", days=7, bars=[], ws=null, canvas,ctx,tip,crossV,crossH;
let basisOn=false,basisData=[],basisMap=new Map(),basisPoll=null; let lsOn=true,lsData=[],lsPoll=null; let divLook=4;
let strengthOn=true,strengthLen=8,strengthHl=2,strengthLook=500; let first=0, visible=120, dragging=false, dragX=0, dragFirst=0,crosshair={idx:null,x:null,y:null};let drawQueued=false,strengthCache=null,strengthCacheKey="";
/* Embedded-dashboard Y-axis control: drag right price scale, double-tap to auto-fit. */
const AXIS_W=72;
const yState={price:{manual:false,lo:0,hi:0},basis:{manual:false,lo:0,hi:0},ls:{manual:false,lo:0,hi:0}};
let axisDrag=null,lastAxisTap=0;
function axisPaneAt(y){const H=canvas?canvas.clientHeight:0,basisH=basisOn?Math.max(88,Math.floor(H*.17)):0,lsH=lsOn?Math.max(128,Math.floor(H*.23)):0,bottom=38,lowerTop=H-bottom-lsH-basisH,lsTop=H-bottom-lsH;if(lsOn&&y>=lsTop)return"ls";if(basisOn&&y>=lowerTop&&y<lsTop)return"basis";return"price"}
function visibleBarsForY(){return bars.slice(Math.max(0,first),Math.min(bars.length,first+visible))}
function autoRange(pane){
 const full=visibleBarsForY();if(!full.length)return[0,1];
 if(pane==="price"){let lo=Math.min(...full.map(b=>b.l)),hi=Math.max(...full.map(b=>b.h));if(!isFinite(lo)||!isFinite(hi)||hi<=lo){const c=Number(full.at(-1)?.c)||1;return[c-Math.abs(c)*.01,c+Math.abs(c)*.01]}const pad=(hi-lo)*.08||Math.max(Math.abs(hi)*.002,.01);return[lo-pad,hi+pad]}
 if(pane==="basis"){const vals=full.map(b=>getBasisAt(b.t)?.basis).filter(Number.isFinite);if(!vals.length)return[0,1];let lo=Math.min(...vals),hi=Math.max(...vals);if(!(hi>lo))return[lo-.0001,hi+.0001];const pad=(hi-lo)*.12;return[lo-pad,hi+pad]}
 const vals=full.map(b=>getTopLSAt(b.t)?.ratio).filter(Number.isFinite);if(!vals.length)return[.5,1.5];let lo=Math.min(...vals),hi=Math.max(...vals);if(!(hi>lo)){lo=Math.max(.01,lo-.05);hi+=.05}else{const pad=(hi-lo)*.12;lo=Math.max(.01,lo-pad);hi+=pad}return[lo,hi]
}
function yRange(pane){const s=yState[pane]||(yState[pane]={manual:false,lo:0,hi:0});if(!s.manual){const a=autoRange(pane);s.lo=a[0];s.hi=a[1]}return[s.lo,s.hi]}
function inYAxis(e){if(!canvas)return false;const r=canvas.getBoundingClientRect();return e.clientX>=r.right-AXIS_W}
function axisPointerDown(e){if(!inYAxis(e))return;e.preventDefault();e.stopPropagation();const r=canvas.getBoundingClientRect(),pane=axisPaneAt(e.clientY-r.top),st=yState[pane],now=performance.now();if(now-lastAxisTap<320){st.manual=false;lastAxisTap=0;axisDrag=null;requestDraw();return}lastAxisTap=now;const[lo,hi]=yRange(pane),auto=autoRange(pane);axisDrag={pane,pointerId:e.pointerId,y0:e.clientY,lo,hi,cy:(lo+hi)/2,autoSpan:Math.max(auto[1]-auto[0],1e-12)};try{canvas.setPointerCapture(e.pointerId)}catch(_){}}
function axisPointerMove(e){if(!axisDrag)return;e.preventDefault();e.stopPropagation();const st=yState[axisDrag.pane],k=Math.exp((e.clientY-axisDrag.y0)*.006);let half=(axisDrag.hi-axisDrag.lo)/2*k;half=Math.min(Math.max(half,axisDrag.autoSpan*.01),axisDrag.autoSpan*25);st.lo=axisDrag.cy-half;st.hi=axisDrag.cy+half;st.manual=true;requestDraw()}
function axisPointerEnd(e){if(!axisDrag)return;e.preventDefault();e.stopPropagation();try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){}axisDrag=null}

const AXIS_W=72;
const yState={price:{manual:false,lo:0,hi:0},basis:{manual:false,lo:0,hi:0},ls:{manual:false,lo:0,hi:0}};
let axisDrag=null,lastAxisTap=0;
function axisPaneAt(y){const H=canvas?canvas.clientHeight:0,basisH=basisOn?Math.max(88,Math.floor(H*.17)):0,lsH=lsOn?Math.max(128,Math.floor(H*.23)):0,bottom=38,lowerTop=H-bottom-lsH-basisH,lsTop=H-bottom-lsH;if(lsOn&&y>=lsTop)return"ls";if(basisOn&&y>=lowerTop&&y<lsTop)return"basis";return"price"}
function visibleBarsForY(){return bars.slice(Math.max(0,first),Math.min(bars.length,first+visible))}
function autoRange(pane){
 const full=visibleBarsForY();if(!full.length)return[0,1];
 if(pane==="price"){let lo=Math.min(...full.map(b=>b.l)),hi=Math.max(...full.map(b=>b.h));if(!isFinite(lo)||!isFinite(hi)||hi<=lo){const c=Number(full.at(-1)?.c)||1;return[c-Math.abs(c)*.01,c+Math.abs(c)*.01]}const pad=(hi-lo)*.08||Math.max(Math.abs(hi)*.002,.01);return[lo-pad,hi+pad]}
 if(pane==="basis"){const vals=full.map(b=>getBasisAt(b.t)?.basis).filter(Number.isFinite);if(!vals.length)return[0,1];let lo=Math.min(...vals),hi=Math.max(...vals);if(!(hi>lo))return[lo-.0001,hi+.0001];const pad=(hi-lo)*.12;return[lo-pad,hi+pad]}
 const vals=full.map(b=>getTopLSAt(b.t)?.ratio).filter(Number.isFinite);if(!vals.length)return[.5,1.5];let lo=Math.min(...vals),hi=Math.max(...vals);if(!(hi>lo)){lo=Math.max(.01,lo-.05);hi+=.05}else{const pad=(hi-lo)*.12;lo=Math.max(.01,lo-pad);hi+=pad}return[lo,hi]
}
function yRange(pane){const s=yState[pane]||(yState[pane]={manual:false,lo:0,hi:0});if(!s.manual){const a=autoRange(pane);s.lo=a[0];s.hi=a[1]}return[s.lo,s.hi]}
function inYAxis(e){if(!canvas)return false;const r=canvas.getBoundingClientRect();return e.clientX>=r.right-AXIS_W}
function axisPointerDown(e){if(!inYAxis(e))return;e.preventDefault();e.stopPropagation();const r=canvas.getBoundingClientRect(),pane=axisPaneAt(e.clientY-r.top),st=yState[pane],now=performance.now();if(now-lastAxisTap<320){st.manual=false;lastAxisTap=0;axisDrag=null;requestDraw();return}lastAxisTap=now;const[lo,hi]=yRange(pane),auto=autoRange(pane);axisDrag={pane,pointerId:e.pointerId,y0:e.clientY,lo,hi,cy:(lo+hi)/2,autoSpan:Math.max(auto[1]-auto[0],1e-12)};try{canvas.setPointerCapture(e.pointerId)}catch(_){}}
function axisPointerMove(e){if(!axisDrag)return;e.preventDefault();e.stopPropagation();const st=yState[axisDrag.pane],k=Math.exp((e.clientY-axisDrag.y0)*.006);let half=(axisDrag.hi-axisDrag.lo)/2*k;half=Math.min(Math.max(half,axisDrag.autoSpan*.01),axisDrag.autoSpan*25);st.lo=axisDrag.cy-half;st.hi=axisDrag.cy+half;st.manual=true;requestDraw()}
function axisPointerEnd(e){if(!axisDrag)return;e.preventDefault();e.stopPropagation();try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){}axisDrag=null}

const $=id=>document.getElementById(id);
function setStatus(s,ok=true){$("status").textContent=s;$("status").className=ok?"ok":"bad"}
function intervalMs(){return TFMS[tf]}
function normCdf(z){if(!isFinite(z))return z>0?1:0;const az=Math.abs(z),t=1/(1+0.2316419*az),d=.3989422804014327*Math.exp(-az*az/2),p=d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return z>=0?1-p:p;}
function calcStrength(all){const out=new Array(all.length).fill(null),norm=new Array(all.length).fill(null),L=20;let vs=0;for(let i=0;i<all.length;i++){vs+=all[i].v;if(i>=L)vs-=all[i-L].v;if(i>=L-1&&vs>0)norm[i]=(all[i].buy-all[i].sell)/(vs/L)}const roll=new Array(all.length).fill(null);for(let i=strengthLen-1;i<all.length;i++){let q=0,ok=true;for(let j=i-strengthLen+1;j<=i;j++){if(norm[j]==null){ok=false;break}q+=norm[j]}if(ok)roll[i]=q}const ew=new Array(all.length).fill(null);let rs=null;const aa=strengthHl>0?1-Math.pow(2,-1/Math.max(1,strengthHl)):1;for(let i=0;i<all.length;i++){if(roll[i]==null)continue;rs=rs==null?roll[i]:rs+aa*(roll[i]-rs);ew[i]=strengthHl>0?rs:roll[i]}let sum=0,c=0;for(let i=0;i<all.length;i++){if(ew[i]!=null){sum+=Math.abs(ew[i]);c++}if(i>=strengthLook&&ew[i-strengthLook]!=null){sum-=Math.abs(ew[i-strengthLook]);c--}if(ew[i]!=null&&c>=strengthLook){const sig=sum/c*1.2533141373;if(sig>0)out[i]=2*normCdf(ew[i]/sig)-1}}return out}
function nice(n){if(!isFinite(n))return "";if(Math.abs(n)>=1e9)return (n/1e9).toFixed(1)+"B";if(Math.abs(n)>=1e6)return (n/1e6).toFixed(1)+"M";if(Math.abs(n)>=1e3)return (n/1e3).toFixed(0)+"K";return n.toFixed(n<10?2:0)}
function dateLabel(t){const d=new Date(t);if(tf==="1d")return d.toLocaleDateString("en-US",{month:"short",day:"2-digit"});return d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false})}
function fullDate(t){return new Date(t).toLocaleString("en-US",{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}
function basisPeriod(){return ["5m","15m","30m","1h","2h","4h","6h","12h","1d"].includes(tf)?tf:null}
function lsPeriod(){return ["5m","15m","30m","1h","2h","4h","6h","12h","1d"].includes(tf)?tf:(tf==="1m"?"5m":null)}
async function fetchJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
async function loadBasis(){
  basisData=[];basisMap=new Map();const period=basisPeriod();
  if(!basisOn||!period||!bars.length){requestDraw();return}
  const end=Date.now(),start=Math.max(bars[0].t,end-days*86400000),step=TFMS[period]||900000;
  try{
    const u=BASIS_API+"?pair="+encodeURIComponent(SYMBOL)+"&contractType=PERPETUAL&period="+period+"&startTime="+start+"&endTime="+end+"&limit=500";
    const a=await fetchJson(u);
    basisData=(Array.isArray(a)?a:[]).filter(x=>isFinite(+x.timestamp)&&isFinite(+x.basis)).map(x=>({t:+x.timestamp,basis:+x.basis,basisRate:+x.basisRate||0,futuresPrice:+x.futuresPrice,indexPrice:+x.indexPrice,source:"basis"})).sort((a,b)=>a.t-b.t);if(!basisData.length)throw new Error("Basis endpoint returned no records");
  }catch(e){
    console.warn("Basis endpoint unavailable, deriving from Binance Mark/Index:",e);
    try{
      const mp=await fetchJson("https://fapi.binance.com/fapi/v1/markPriceKlines?symbol="+encodeURIComponent(SYMBOL)+"&interval="+period+"&startTime="+start+"&endTime="+end+"&limit=1500");
      const ip=await fetchJson("https://fapi.binance.com/fapi/v1/indexPriceKlines?pair="+encodeURIComponent(SYMBOL)+"&interval="+period+"&startTime="+start+"&endTime="+end+"&limit=1500");
      const im=new Map((Array.isArray(ip)?ip:[]).map(x=>[+x[0],+x[4]]));
      basisData=(Array.isArray(mp)?mp:[]).filter(x=>im.has(+x[0])).map(x=>({t:+x[0],basis:+x[4]-im.get(+x[0]),basisRate:im.get(+x[0])?((+x[4]-im.get(+x[0]))/im.get(+x[0])):0,futuresPrice:+x[4],indexPrice:im.get(+x[0]),source:"mark-index"})).sort((a,b)=>a.t-b.t);
    }catch(e2){console.warn("Basis fallback failed:",e2);basisData=[]}
  }
  basisData.forEach(x=>basisMap.set(x.t,x));
  requestDraw()
}
function getBasisAt(t){
  if(!basisData.length)return null;
  const step=TFMS[basisPeriod()]||900000;let lo=0,hi=basisData.length-1,best=null;
  while(lo<=hi){const m=(lo+hi)>>1,v=basisData[m].t;if(v<t)lo=m+1;else if(v>t)hi=m-1;else return basisData[m]}
  for(const i of [hi,lo]){if(i>=0&&i<basisData.length){const q=basisData[i];if(!best||Math.abs(q.t-t)<Math.abs(best.t-t))best=q}}
  return best&&Math.abs(best.t-t)<=step*.55?best:null
}
function normTopLS(x){
 const r=+x.longShortRatio; let lp=+x.longAccount,sp=+x.shortAccount;
 if(!(lp>=0&&sp>=0&&(lp+sp)>0)){lp=r>0?r/(1+r):.5;sp=1-lp}
 if(lp>1||sp>1){const s=lp+sp;if(s>0){lp/=s;sp/=s}}
 return {t:+x.timestamp,ratio:r,longPct:lp,shortPct:sp};
}
async function loadTopLS(){
 lsData=[]; const period=lsPeriod(); if(!lsOn||!period||!bars.length){requestDraw();return}
 const end=Date.now(),start=Math.max(bars[0].t,end-days*86400000),all=[]; let cursor=start;
 try{
  while(cursor<end){
   const u="https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol="+encodeURIComponent(SYMBOL)+"&period="+period+"&limit=500&startTime="+cursor+"&endTime="+end;
   const a=await fetchJson(u); if(!Array.isArray(a)||!a.length)break;
   all.push(...a);
   const next=+a[a.length-1].timestamp+(TFMS[period]||900000);
   if(next<=cursor)break; cursor=next; if(a.length<500)break;
   await new Promise(r=>setTimeout(r,80));
  }
  const seen=new Set();
  lsData=all.map(normTopLS).filter(x=>isFinite(x.t)&&isFinite(x.ratio)&&x.ratio>0&&!seen.has(x.t)&&(seen.add(x.t),true)).sort((a,b)=>a.t-b.t);
 }catch(e){console.warn("Top Trader L/S load failed:",e);lsData=[]}
 requestDraw();
}
function dayKey(t){
 const d=new Date(t);
 return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function getTopLSAt(t){
 if(!lsData.length)return null; const step=TFMS[lsPeriod()]||900000; const targetDay=dayKey(t); let lo=0,hi=lsData.length-1,best=null;
 while(lo<=hi){const m=(lo+hi)>>1,v=lsData[m].t;if(v<t)lo=m+1;else if(v>t)hi=m-1;else return dayKey(v)===targetDay?lsData[m]:null}
 for(const i of [hi,lo])if(i>=0&&i<lsData.length){const q=lsData[i];if(dayKey(q.t)!==targetDay)continue;if(!best||Math.abs(q.t-t)<Math.abs(best.t-t))best=q}
 return best&&Math.abs(best.t-t)<=step*.55?best:null;
}
function topLSDivergenceAt(i,full){
 if(i<divLook||!full[i])return null;
 const a=getTopLSAt(full[i].t),p0=full[i-divLook],p1=full[i];
 const b0=getTopLSAt(p0.t);
 if(!a||!b0)return null;
 const priceCh=(p1.c-p0.c)/Math.max(Math.abs(p0.c),1);
 const longCh=a.longPct-b0.longPct;
 const netCh=(a.longPct-a.shortPct)-(b0.longPct-b0.shortPct);
 let type=null;
 if(priceCh< -0.001 && longCh>0.005) type="BULL";
 else if(priceCh>0.001 && longCh< -0.005) type="BEAR";
 return type?{type,priceCh,longCh,netCh}:null;
}
function scheduleTopLSPoll(){if(lsPoll)clearInterval(lsPoll);lsPoll=setInterval(()=>{if(lsOn)loadTopLS()},60000)}
function scheduleBasisPoll(){if(basisPoll)clearInterval(basisPoll);basisPoll=setInterval(()=>{if(basisOn)loadBasis()},60000)}
async function loadHistory(){
 $("status").textContent="Loading Binance data…";$("status").className="bad";$("err").style.display="none";
 const end=Date.now(),start=end-days*86400000,all=[];let cursor=start;
 while(cursor<end){
  const u=`${API}?symbol=${SYMBOL}&interval=${tf}&startTime=${cursor}&endTime=${end}&limit=1500`;let r;
  try{r=await fetch(u,{cache:"no-store"})}catch(e){throw new Error("Không kết nối được Binance API: "+e.message)}
  if(!r.ok){let msg="";try{msg=await r.text()}catch(_){}throw new Error("Binance HTTP "+r.status+" "+msg.slice(0,180))}
  const a=await r.json();if(!a.length)break;all.push(...a);const next=+a[a.length-1][0]+intervalMs();if(next<=cursor)break;cursor=next;if(a.length<1500)break;await new Promise(r=>setTimeout(r,80))
 }
 const seen=new Set();bars=all.filter(x=>!seen.has(+x[0])&&(seen.add(+x[0]),true)).map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5],buy:+x[9],sell:Math.max(0,+x[5]-+x[9]),closed:Date.now()>+x[6]}));
 bars.sort((a,b)=>a.t-b.t);first=Math.max(0,bars.length-visible);if(basisOn)await loadBasis();if(lsOn)await loadTopLS();draw();connect();scheduleBasisPoll();scheduleTopLSPoll()
}
function connect(){
 if(ws)try{ws.close()}catch(e){}
 const stream=`${SYMBOL.toLowerCase()}@kline_${tf}`;ws=new WebSocket(WSBASE+stream);
 ws.onopen=()=>setStatus(`LIVE · ${tf}`,true);
 ws.onmessage=e=>{try{const z=JSON.parse(e.data),k=z.data.k,b={t:+k.t,o:+k.o,h:+k.h,l:+k.l,c:+k.c,v:+k.v,buy:+k.V,sell:Math.max(0,+k.v-+k.V),closed:!!k.x},i=bars.findIndex(x=>x.t===b.t);if(i>=0)bars[i]=b;else bars.push(b);bars.sort((a,b)=>a.t-b.t);if(first+visible>=bars.length-2)first=Math.max(0,bars.length-visible);draw();setStatus(`LIVE · ${tf} · ${Math.max(0,Date.now()-+z.data.E)} ms`,true)}catch(err){}};
 ws.onerror=()=>setStatus("WebSocket error",false);ws.onclose=()=>{setStatus("Reconnecting…",false);setTimeout(()=>connect(),1200)}
}
function fit(){visible=Math.min(120,bars.length);first=Math.max(0,bars.length-visible);draw()}
function move(n){first=Math.max(0,Math.min(Math.max(0,bars.length-visible),first+n));draw()}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);draw()}
function requestDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;draw()})}
function draw(){
 if(!ctx||!bars.length)return;const W=canvas.clientWidth,H=canvas.clientHeight;ctx.clearRect(0,0,W,H);ctx.fillStyle="#171a21";ctx.fillRect(0,0,W,H);
 const left=70,right=72,top=55,bottom=38,gap=18,full=bars.slice(Math.max(0,first),Math.min(bars.length,first+visible));if(!full.length)return;
 const n=full.length,pw=(W-left-right)/n,basisH=basisOn?Math.max(88,Math.floor(H*.17)):0,lsH=lsOn?Math.max(128,Math.floor(H*.23)):0,lowerTop=H-bottom-lsH-basisH,basisTop=lowerTop,basisBottom=basisTop+basisH,lsTop=H-bottom-lsH,priceH=Math.floor(H*(basisOn||lsOn ? .43 : .54)),volTop=top+priceH+gap,volH=Math.max(70,lowerTop-volTop-gap),body=Math.max(2,Math.min(8,pw*.62)),vbar=Math.max(2,Math.min(6,pw*.28));
 let [plo,phi]=yRange("price");
 let vmax=Math.max(...full.map(b=>Math.max(b.buy,b.sell)),1);const stepRaw=vmax/3,p10=Math.pow(10,Math.floor(Math.log10(stepRaw||1))),nm=stepRaw/p10,vstep=(nm<=1?1:nm<=2?2:nm<=5?5:10)*p10;vmax=vstep*3;
 const py=v=>top+(phi-v)/(phi-plo)*priceH,vy=v=>volTop+volH-(v/vmax)*volH;
 ctx.fillStyle="#e7e9ee";ctx.font="600 16px Arial";ctx.fillText("SPYUSDT.P",16,26);ctx.fillStyle="#8d96a7";ctx.font="12px Arial";ctx.fillText(`Price · ${tf}`,16,43);ctx.fillStyle="#e7e9ee";ctx.font="600 15px Arial";ctx.fillText("Taker Buy/Sell Volume",16,volTop-8);
 ctx.font="11px Arial";ctx.lineWidth=1;ctx.textAlign="right";
 for(let i=0;i<=4;i++){const yy=top+i*priceH/4,val=phi-i*(phi-plo)/4;ctx.strokeStyle="#2d333d";ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(W-right,yy);ctx.stroke();ctx.fillStyle="#7e899d";ctx.fillText(val.toFixed(2),W-right+60,yy+4)}
 for(let i=0;i<=3;i++){const yy=volTop+i*volH/3,val=vmax*(1-i/3);ctx.strokeStyle="#303642";ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(W-right,yy);ctx.stroke();ctx.fillStyle="#7e899d";ctx.fillText(nice(val),left-9,yy+4)}
 ctx.textAlign="left";
 full.forEach((b,i)=>{const x=left+i*pw+pw/2,up=b.c>=b.o;ctx.strokeStyle=up?"#2ebd85":"#f6465d";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,py(b.h));ctx.lineTo(x,py(b.l));ctx.stroke();ctx.fillStyle=up?"#2ebd85":"#f6465d";ctx.fillRect(x-body/2,Math.min(py(b.o),py(b.c)),body,Math.max(1,Math.abs(py(b.o)-py(b.c))));ctx.fillStyle="#f6465d";ctx.fillRect(x-vbar-2,vy(b.sell),vbar,(b.sell/vmax)*volH);ctx.fillStyle="#2ebd85";ctx.fillRect(x+2,vy(b.buy),vbar,(b.buy/vmax)*volH)});
 const strengthKey=bars.length+"|"+strengthLen+"|"+strengthHl+"|"+strengthLook+"|"+(bars.length?bars[bars.length-1].t:0)+"|"+(bars.length?bars[bars.length-1].buy:0);const strengthAll=(strengthCacheKey===strengthKey&&strengthCache)?strengthCache:(strengthCacheKey=strengthKey,strengthCache=calcStrength(bars));
if(strengthOn){const sy=volTop+volH*.62,amp=volH*.34;ctx.strokeStyle="#3a424e";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(left,sy);ctx.lineTo(W-right,sy);ctx.stroke();ctx.setLineDash([]);let prev=null;for(let i=0;i<n;i++){const v=strengthAll[first+i];if(v==null){prev=null;continue}const x=left+i*pw+pw/2,y=sy-v*amp,col=v>=0?"#26a69a":"#ef5350";ctx.strokeStyle=col;ctx.lineWidth=2.5;if(prev){ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(x,y);ctx.stroke()}if(Math.abs(v)>=.95){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill()}prev={x,y}}ctx.fillStyle="#aab3c2";ctx.font="10px Arial";ctx.fillText(`Strength S · N=${strengthLen} · EWMA=${strengthHl} · lookback=${strengthLook}`,left,sy-7)}
// Binance Basis dedicated pane — aligned to the nearest M15 candle timestamp
if(basisOn&&basisData.length&&basisPeriod()){
 const vals=[];for(let i=0;i<n;i++){const q=getBasisAt(full[i].t);if(q&&isFinite(q.basis))vals.push(q.basis)}
 if(vals.length){
  let [lo,hi]=yRange("basis");
  const paneTop=basisTop,paneBottom=lsTop,by=paneTop+25,bh=Math.max(42,paneBottom-by-10),bpy=v=>by+bh-(v-lo)/(hi-lo)*bh;let prev=null;
  ctx.save();ctx.fillStyle="#141820";ctx.fillRect(0,paneTop,W,basisH);ctx.strokeStyle="#303642";ctx.beginPath();ctx.moveTo(0,paneTop);ctx.lineTo(W,paneTop);ctx.stroke();
  ctx.strokeStyle="rgba(240,185,11,.38)";ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(left,by+bh/2);ctx.lineTo(W-right,by+bh/2);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<n;i++){const q=getBasisAt(full[i].t);if(!q||!isFinite(q.basis)){prev=null;continue}const x=left+i*pw+pw/2,y=bpy(q.basis);ctx.strokeStyle=q.basis>=0?"#f0b90b":"#9b87f5";ctx.lineWidth=2.7;if(prev){ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(x,y);ctx.stroke()}ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();prev={x,y}}
  ctx.fillStyle="#f0b90b";ctx.font="11px Arial";ctx.textAlign="left";ctx.fillText("Basis · Binance USDⓈ-M · "+basisPeriod(),left,paneTop+17);
  ctx.textAlign="right";ctx.fillStyle="#aab3c2";ctx.font="10px Arial";ctx.fillText(hi.toFixed(6),W-right,by+6);ctx.fillText(lo.toFixed(6),W-right,by+bh+2);ctx.textAlign="left";ctx.restore();
 }
}
// Binance Top Trader Long/Short Position pane
if(lsOn&&lsData.length&&lsPeriod()){
 const pts=[]; for(let i=0;i<n;i++){const q=getTopLSAt(full[i].t); if(q)pts.push(q)}
 if(pts.length){
  const paneTop=lsTop,paneBottom=H-bottom,padTop=25,padBottom=18,chartTop=paneTop+padTop,chartH=Math.max(55,paneBottom-chartTop-padBottom);
  ctx.save();ctx.fillStyle="#141820";ctx.fillRect(0,paneTop,W,lsH);ctx.strokeStyle="#303642";ctx.beginPath();ctx.moveTo(0,paneTop);ctx.lineTo(W,paneTop);ctx.stroke();
  const barW=Math.max(3,Math.min(10,pw*.58));
  for(let i=0;i<n;i++){const q=getTopLSAt(full[i].t); if(!q)continue; const x=left+i*pw+pw/2,longH=chartH*q.longPct,shortH=chartH*q.shortPct;ctx.fillStyle="#2ebd85";ctx.fillRect(x-barW/2,chartTop+chartH-longH,barW,longH);ctx.fillStyle="#f6465d";ctx.fillRect(x-barW/2,chartTop,barW,shortH)}
  ctx.font="10px Arial";ctx.textAlign="right";
  for(let j=0;j<=2;j++){const yy=chartTop+j*chartH/2;ctx.strokeStyle="#303642";ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(W-right,yy);ctx.stroke();ctx.fillStyle="#7e899d";ctx.fillText((100-j*50)+"%",left-9,yy+4)}
  let [rlo,rhi]=yRange("ls");
  const ry=v=>chartTop+chartH-(v-rlo)/(rhi-rlo)*chartH;let prev=null;
  for(let i=0;i<n;i++){const q=getTopLSAt(full[i].t);if(!q){prev=null;continue}const x=left+i*pw+pw/2,y=ry(q.ratio);ctx.strokeStyle="#e7e9ee";ctx.lineWidth=2.3;if(prev&&dayKey(full[i].t)===dayKey(full[i-1].t)){ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(x,y);ctx.stroke()}prev={x,y}}
  ctx.textAlign="right";ctx.fillStyle="#aab3c2";ctx.font="10px Arial";ctx.fillText(rhi.toFixed(2),W-right,chartTop+4);ctx.fillText(((rhi+rlo)/2).toFixed(2),W-right,chartTop+chartH/2+4);ctx.fillText(rlo.toFixed(2),W-right,chartTop+chartH+4);
  ctx.textAlign="left";ctx.fillStyle="#e7e9ee";ctx.font="600 12px Arial";ctx.fillText("Top Trader L/S · Divergence · Daily Reset",left,paneTop+16);
  ctx.save();ctx.setLineDash([4,4]);for(let i=0;i<n;i++){if(i===0||dayKey(full[i].t)!==dayKey(full[i-1].t)){const x=left+i*pw;ctx.strokeStyle="rgba(255,255,255,.30)";ctx.beginPath();ctx.moveTo(x,chartTop);ctx.lineTo(x,chartTop+chartH);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#aab3c2";ctx.font="9px Arial";ctx.fillText(new Date(full[i].t).toLocaleDateString("en-US",{month:"short",day:"2-digit"}),x+3,chartTop+12);ctx.setLineDash([4,4])}}ctx.restore();
  ctx.fillStyle="#f6465d";ctx.fillRect(left+225,paneTop+8,10,10);ctx.fillStyle="#8d96a7";ctx.font="10px Arial";ctx.fillText("Short %",left+240,paneTop+17);
  ctx.fillStyle="#2ebd85";ctx.fillRect(left+292,paneTop+8,10,10);ctx.fillStyle="#8d96a7";ctx.fillText("Long %",left+307,paneTop+17);
  ctx.fillStyle="#e7e9ee";ctx.fillRect(left+362,paneTop+8,18,2);ctx.fillStyle="#8d96a7";ctx.fillText("Long/Short Ratio",left+385,paneTop+17);
  const last=getTopLSAt(full[n-1].t);if(last){ctx.fillStyle="#e7e9ee";ctx.font="11px Arial";ctx.fillText("L "+(last.longPct*100).toFixed(1)+"%  S "+(last.shortPct*100).toFixed(1)+"%  Ratio "+last.ratio.toFixed(3),left,paneTop+lsH-5)}
  // Divergence markers: price down + top-trader Long rising = bullish; price up + Long falling = bearish.
  for(let i=divLook;i<n;i++){
    const d=topLSDivergenceAt(i,full); if(!d)continue;
    const x=left+i*pw+pw/2, b=full[i];
    const y=d.type==="BULL"?py(b.l)-8:py(b.h)+8;
    ctx.fillStyle=d.type==="BULL"?"#2ebd85":"#f6465d";
    ctx.beginPath();
    if(d.type==="BULL"){ctx.moveTo(x,y-6);ctx.lineTo(x-6,y+5);ctx.lineTo(x+6,y+5)}
    else{ctx.moveTo(x,y+6);ctx.lineTo(x-6,y-5);ctx.lineTo(x+6,y-5)}
    ctx.closePath();ctx.fill();
    ctx.font="bold 9px Arial";ctx.textAlign="center";ctx.fillText(d.type==="BULL"?"BULL DIV":"BEAR DIV",x,d.type==="BULL"?y-9:y+16);
  }
  ctx.restore();
 }
}
// Day separators
ctx.save();ctx.setLineDash([5,5]);for(let i=0;i<n;i++){if(i===0||new Date(full[i].t).toLocaleDateString()!==new Date(full[i-1].t).toLocaleDateString()){const x=left+i*pw;ctx.strokeStyle="rgba(255,255,255,.24)";ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,volTop+volH);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#aab3c2";ctx.font="10px Arial";ctx.fillText(new Date(full[i].t).toLocaleDateString("en-US",{month:"short",day:"2-digit"}),x+4,top+12);ctx.setLineDash([5,5])}}ctx.restore();
const zy=volTop+volH;ctx.strokeStyle="#39404c";ctx.beginPath();ctx.moveTo(left,zy);ctx.lineTo(W-right,zy);ctx.stroke();ctx.fillStyle="#778294";ctx.font="11px Arial";ctx.textAlign="center";
 const ticks=Math.min(8,n),every=Math.max(1,Math.floor(n/ticks));for(let i=0;i<n;i+=every)ctx.fillText(dateLabel(full[i].t),left+i*pw+pw/2,H-12);ctx.textAlign="left";
 const b=full[n-1];ctx.font="11px Arial";ctx.fillStyle="#aab3c2";ctx.fillText(`Buy ${nice(b.buy)}   Sell ${nice(b.sell)}   Net ${nice(b.buy-b.sell)}`,left,volTop+15);
 ctx.fillStyle="#f6465d";ctx.fillRect(W/2-160,volTop+15,10,10);ctx.fillStyle="#8d96a7";ctx.fillText("Taker Sell Volume (SPY)",W/2-145,volTop+24);ctx.fillStyle="#2ebd85";ctx.fillRect(W/2+45,volTop+15,10,10);ctx.fillStyle="#8d96a7";ctx.fillText("Taker Buy Volume (SPY)",W/2+60,volTop+24)
}
// Crosshair lines are handled by lightweight HTML overlays for continuous movement.
canvas=$("c");ctx=canvas.getContext("2d");tip=$("tip");crossV=$("crossV");crossH=$("crossH");window.addEventListener("resize",resize);canvas.addEventListener("pointerdown",axisPointerDown,true);canvas.addEventListener("pointermove",axisPointerMove,true);canvas.addEventListener("pointerup",axisPointerEnd,true);canvas.addEventListener("pointercancel",axisPointerEnd,true);canvas.addEventListener("pointerdown",axisPointerDown,true);canvas.addEventListener("pointermove",axisPointerMove,true);canvas.addEventListener("pointerup",axisPointerEnd,true);canvas.addEventListener("pointercancel",axisPointerEnd,true);
$("tf").onchange=async()=>{tf=$("tf").value;await loadHistory()};$("range").onchange=async()=>{days=+$("range").value;await loadHistory()};$("strOn").onchange=()=>{strengthOn=$("strOn").checked;requestDraw()};$("strLen").onchange=()=>{strengthLen=+$("strLen").value;strengthCacheKey="";requestDraw()};$("strHl").onchange=()=>{strengthHl=+$("strHl").value;strengthCacheKey="";requestDraw()};
$("basisOn").onchange=async()=>{basisOn=$("basisOn").checked;if(basisOn)await loadBasis();else{basisData=[];basisMap.clear();requestDraw()}};$("lsOn").onchange=async()=>{lsOn=$("lsOn").checked;if(lsOn)await loadTopLS();else{lsData=[];requestDraw()}};$("fit").onclick=fit;$("left").onclick=()=>move(-Math.max(1,Math.floor(visible*.35)));$("right").onclick=()=>move(Math.max(1,Math.floor(visible*.35)));$("refresh").onclick=()=>loadHistory();
canvas.addEventListener("wheel",e=>{e.preventDefault();if(!bars.length)return;const factor=e.deltaY<0?.8:1.25,old=visible,newV=Math.max(20,Math.min(bars.length,Math.round(old*factor))),rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,left=70,right=72,pw=(canvas.clientWidth-left-right)/old,idx=Math.max(0,Math.min(old-1,Math.floor((x-left)/pw))),center=first+idx;visible=newV;first=Math.max(0,Math.min(Math.max(0,bars.length-visible),center-Math.floor(newV*(idx/Math.max(old,1)))));crosshair.idx=null;requestDraw()},{passive:false});
// Mobile/desktop pointer interaction: one-finger pan, two-finger pinch zoom, tap for Crosshair.
const pointers=new Map();let pinchStartDist=0,pinchStartVisible=0,pinchStartCenter=0,panStartX=0,panStartFirst=0,panMoved=false;
function hideCross(){tip.style.display="none";crosshair.idx=null;if(crossV)crossV.style.display="none";if(crossH)crossH.style.display="none"}
function pointerPos(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function showCross(e){if(!bars.length)return;const p=pointerPos(e),left=70,right=72,pw=(canvas.clientWidth-left-right)/Math.max(visible,1),idx=Math.floor((p.x-left)/pw);if(idx<0||idx>=Math.min(visible,bars.length-first)){hideCross();requestDraw();return}const b=bars[first+idx];if(!b)return;crosshair.idx=idx;crosshair.x=p.x;crosshair.y=p.y;const snapX=left+idx*pw+pw/2;if(crossV){crossV.style.left=snapX+"px";crossV.style.display="block"}if(crossH){crossH.style.top=p.y+"px";crossH.style.display="block"}tip.innerHTML="<b>"+fullDate(b.t)+"</b><br><b>O</b> "+b.o+" &nbsp; <b>H</b> "+b.h+" &nbsp; <b>L</b> "+b.l+" &nbsp; <b>C</b> "+b.c+"<br><span style='color:#2ebd85'>Taker Buy: "+b.buy.toFixed(4)+"</span><br><span style='color:#f6465d'>Taker Sell: "+b.sell.toFixed(4)+"</span><br><b>NetFlow:</b> "+(b.buy-b.sell).toFixed(4);const lq=lsOn?getTopLSAt(b.t):null;if(lq)tip.innerHTML+="<br><span style=\"color:#2ebd85\">Top L/S: Long "+(lq.longPct*100).toFixed(1)+"% · Short "+(lq.shortPct*100).toFixed(1)+"% · Ratio "+lq.ratio.toFixed(3)+"</span>";const bq=basisOn?getBasisAt(b.t):null;if(bq)tip.innerHTML+="<br><span style='color:#f0b90b'>Basis: "+bq.basis.toFixed(6)+" ("+(bq.basisRate*100).toFixed(4)+"%)</span>";tip.style.display="block";const tw=Math.min(245,canvas.clientWidth-16),th=bq?125:105;tip.style.left=Math.min(canvas.clientWidth-tw-8,Math.max(8,p.x+14))+"px";tip.style.top=Math.min(canvas.clientHeight-th-8,Math.max(8,p.y+14))+"px";requestDraw()}
function dist2(){const a=[...pointers.values()];if(a.length<2)return 0;return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
function mid2(){const a=[...pointers.values()];return a.length<2?(canvas.clientWidth/2):((a[0].x+a[1].x)/2)}
canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});panMoved=false;if(pointers.size===1){panStartX=e.clientX;panStartFirst=first}else if(pointers.size===2){pinchStartDist=dist2();pinchStartVisible=visible;pinchStartCenter=mid2();hideCross()}});
canvas.addEventListener("pointermove",e=>{if(!bars.length)return;const p0=pointers.get(e.pointerId);if(p0){p0.x=e.clientX;p0.y=e.clientY}
 if(pointers.size>=2){const d=dist2();if(pinchStartDist>0&&d>0){const nv=Math.max(20,Math.min(bars.length,Math.round(pinchStartVisible*pinchStartDist/d))),rect=canvas.getBoundingClientRect(),x=mid2()-rect.left,old=pinchStartVisible,left=70,right=72,pw=(canvas.clientWidth-left-right)/Math.max(old,1),idx=Math.max(0,Math.min(old-1,Math.floor((x-left)/pw))),center=first+idx;visible=nv;first=Math.max(0,Math.min(Math.max(0,bars.length-visible),center-Math.floor(nv*(idx/Math.max(old,1)))));requestDraw()}return}
 if(pointers.size===1&&p0){const dx=e.clientX-panStartX;if(Math.abs(dx)>3)panMoved=true;if(panMoved){const pw=(canvas.clientWidth-142)/Math.max(visible,1),d=Math.round(-dx/pw);first=Math.max(0,Math.min(Math.max(0,bars.length-visible),panStartFirst+d));hideCross();requestDraw()}else if(e.pointerType==="mouse")showCross(e)}});
canvas.addEventListener("pointerup",e=>{const wasTap=!panMoved&&pointers.size===1;if(wasTap&&e.pointerType!=="mouse")showCross(e);pointers.delete(e.pointerId);if(pointers.size<2)pinchStartDist=0});
canvas.addEventListener("pointercancel",e=>{pointers.delete(e.pointerId);pinchStartDist=0;panMoved=false});
canvas.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse"){hideCross();requestDraw()}});

(async()=>{try{await loadHistory();resize()}catch(e){console.error(e);setStatus("ERROR",false);const el=$("err");el.innerHTML="<b>Không tải được dữ liệu Binance.</b><br>"+String(e.message).replace(/</g,"&lt;")+"<br><br>Hãy bấm <b>↻ Reload</b>. Nếu vẫn lỗi, mở F12 → Console để xem chi tiết.";el.style.display="block";resize()}})();