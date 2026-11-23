import {tpoWindows,buildTpo} from './tpo-profile.mjs?v=20261123-tpo-trades3';
import {TpoMinuteLoader} from './tpo-minutes.mjs?v=20261123-tpo-trades3';
import {TpoTradeLoader} from './tpo-trades.mjs?v=20261123-tpo-trades3';
import {tpoRenderMode,compactTpoRows} from './tpo-layout.mjs?v=20261123-tpo-trades3';
export function mountTpo({chart,price,controls,host,get,context}){
  const box=document.createElement('span');box.className='tpo-controls';
  box.innerHTML='<label><input id="tpo-toggle" type="checkbox" checked>TPO</label><label>Mốc <select id="tpo-anchor"><option value="DAY" selected>Ngày · từ 00h NY</option><option value="BOTH">PRE + RTH</option><option value="PRE">PRE</option><option value="RTH">RTH</option></select></label><label>Bước giá <select id="tpo-row-size"><option value="0.1">0.1</option><option value="0.2">0.2</option><option value="0.5" selected>0.5</option><option value="1">1</option><option value="2">2</option></select></label><label>Kiểu TPO <select id="tpo-layout"><option value="STACKED">Gộp phổ</option><option value="EXPANDED">Trải thời gian</option></select></label><label>Nguồn TPO <select id="tpo-source"><option value="TRADES" selected>Khớp lệnh · thử</option><option value="AUTO">Ưu tiên M1</option><option value="M15">M15</option></select></label><small id="tpo-status" role="status">Chờ nến M15</small>';
  box.style.cssText='display:inline-flex;flex-wrap:wrap;align-items:center;gap:8px';controls.append(box);
  // Keep settings reachable when the chart hides the original options panel.
  let summary=null;
  const toolbar=document.querySelector?.('.chart-actions');
  if(toolbar){
    const settings=document.createElement('details');settings.id='tpo-settings';settings.style.cssText='position:relative';
    summary=document.createElement('summary');summary.textContent='TPO ⚙';summary.style.cssText='cursor:pointer;white-space:nowrap;font-size:12px';settings.append(summary);
    box.style.cssText='position:absolute;top:100%;right:0;width:min(440px,85vw);display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px;background:#101e30;border:1px solid #36516e;border-radius:8px;z-index:200;box-shadow:0 6px 24px #0008';
    settings.append(box);toolbar.append(settings);
  }
  const lookup=id=>box.querySelector('#'+id),loader=new TpoMinuteLoader(get),tradeLoader=new TpoTradeLoader(get);
  let profiles=[],requestUpdate=()=>{},activeKey='',revision='',timer=null;
  const status=lookup('tpo-status');status.style.cssText='color:#b5c8df;font-size:12px';
  const cancel=()=>{loader.cancel();tradeLoader.cancel();};
  const primitive={attached(p){requestUpdate=p.requestUpdate;},detached(){cancel();clearInterval(timer);},updateAllViews(){},paneViews(){return [{zOrder:()=> 'bottom',renderer:()=>({draw(target){target.useMediaCoordinateSpace(draw);}})}];}};
  price.attachPrimitive(primitive);
  const colour=(block,total,alpha)=>`hsla(${205-170*block/Math.max(1,total-1)},85%,65%,${alpha})`;
  function draw({context:ctx,mediaSize:{width,height}}){
    if(!lookup('tpo-toggle').checked||!profiles.length)return;
    const expanded=lookup('tpo-layout')?.value==='EXPANDED',modes=new Set();
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    for(const p of profiles){
      if(!p.va)continue;
      const time=x=>chart.timeScale().timeToCoordinate(x/1000),anchorX=time(p.start),x=anchorX??time(p.bars[0]?.t),lastX=time(p.bars.at(-1)?.t);
      if(!Number.isFinite(x)||!Number.isFinite(lastX)||lastX<0||x>width)continue;
      const maxBlocks=Math.max(1,...p.rows.map(r=>r.blocks.length)),total=(p.end-p.start)/1800000;
      const available=Math.max(16,Math.min(width<650?110:220,Math.abs(lastX-x)*.45));
      const cell=expanded?Math.max(1,Math.abs((time(p.start+1800000)??(x+8))-x)):Math.min(12,available/maxBlocks);
      const left=x+5,right=Math.min(width-4,expanded?lastX+cell:left+maxBlocks*cell+6);
      const h=Math.abs((price.priceToCoordinate(p.rows[0].high)??0)-(price.priceToCoordinate(p.rows[0].low)??0));
      const mode=tpoRenderMode(cell,h);modes.add(mode);
      if(p.session==='DAY'&&Number.isFinite(anchorX)){
        ctx.strokeStyle='rgba(148,199,234,.3)';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(anchorX,0);ctx.lineTo(anchorX,height);ctx.stroke();ctx.setLineDash([]);
      }
      // A quiet backing separates profiles from candles without covering price.
      const topY=price.priceToCoordinate(p.rows.at(-1).high),bottomY=price.priceToCoordinate(p.rows[0].low);
      if(Number.isFinite(topY)&&Number.isFinite(bottomY)){ctx.fillStyle='rgba(8,18,31,.3)';ctx.fillRect(left-2,topY-2,Math.max(1,right-left+4),bottomY-topY+4);}
      if(mode==='compact'&&!expanded){
        for(const r of compactTpoRows(p.rows,v=>price.priceToCoordinate(v))){
          if(r.y>height||r.y+r.height<0)continue;
          const inVA=r.indices.some(i=>i*p.rowSize>=p.va.val-1e-8&&(i+1)*p.rowSize<=p.va.vah+1e-8);
          ctx.fillStyle=colour(r.mean,total,inVA?.66:.3);ctx.fillRect(left,r.y,Math.max(1,r.count*cell),r.height);
        }
      }else for(const r of p.rows){
        const y1=price.priceToCoordinate(r.high),y2=price.priceToCoordinate(r.low);if(!Number.isFinite(y1)||!Number.isFinite(y2))continue;
        const top=Math.min(y1,y2),rh=Math.abs(y2-y1);if(top>height||top+rh<0)continue;
        const inVA=r.low>=p.va.val-1e-8&&r.high<=p.va.vah+1e-8;
        for(let j=0;j<r.blocks.length;j++){
          const block=r.blocks[j],bx=expanded?(time(p.start+block*1800000)??(x+block*cell)):left+j*cell;
          if(bx>width||bx+cell<0)continue;
          ctx.fillStyle=colour(block,total,inVA?.58:.27);ctx.fillRect(bx,top,Math.max(1,cell-.7),Math.max(1,rh-.5));
        }
      }
      // Single prints only inside the profile, excluding one-block tails.
      ctx.strokeStyle='#ffb85b';ctx.lineWidth=2;
      for(const index of p.singles??[]){const y1=price.priceToCoordinate((index+1)*p.rowSize),y2=price.priceToCoordinate(index*p.rowSize);if(!Number.isFinite(y1)||!Number.isFinite(y2))continue;ctx.beginPath();ctx.moveTo(left-3,y1);ctx.lineTo(left-3,y2);ctx.stroke();}
      const labelX=Math.max(6,left),titleY=topY;
      if(Number.isFinite(titleY)){ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillStyle='#d5e5f5';ctx.fillText(`${p.day.slice(5)} ${p.session==='DAY'?'00h NY':p.session} · ${p.source}${p.forming?' TẠM':''}`,labelX,Math.max(13,Math.min(height-12,titleY-18)));}
      const line=(value,label,color,dash=[])=>{const y=price.priceToCoordinate(value);if(!Number.isFinite(y)||y<12||y>height-8)return;
        ctx.strokeStyle=color;ctx.lineWidth=label==='POC'?2:1;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle=color;ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillText(label+' '+value.toFixed(2),labelX,y-3);};
      line((p.va.pocIndex+.5)*p.rowSize,'POC','#ffd35c');line(p.va.vah,'VAH','#94c7ea',[3,3]);line(p.va.val,'VAL','#94c7ea',[3,3]);
      if(p.ib){const y1=price.priceToCoordinate(p.ib.high),y2=price.priceToCoordinate(p.ib.low);
        if(Number.isFinite(y1)&&Number.isFinite(y2)){ctx.strokeStyle=p.ib.complete?'#e4b7ff':'#9675ae';ctx.lineWidth=2;ctx.setLineDash(p.ib.complete?[]:[2,2]);ctx.beginPath();ctx.moveTo(x+1,y1);ctx.lineTo(x+1,y2);ctx.stroke();ctx.setLineDash([]);ctx.font='11px sans-serif';ctx.fillStyle='#e4b7ff';ctx.textAlign='left';ctx.fillText('IB 1h'+(p.ib.complete?'':' TẠM'),labelX,Math.max(12,Math.min(height-10,y1-5)));}
      }
    }
    host.dataset.tpoRender=[...modes].join(',');ctx.restore();
  }
  function update(){
    const state=context(),enabled=lookup('tpo-toggle').checked&&state.interval==='15m';
    const key=[enabled,state.symbol,lookup('tpo-anchor').value,lookup('tpo-source').value].join('|');
    if(key!==activeKey){activeKey=key;cancel();revision='';}
    if(!enabled){profiles=[];status.textContent=lookup('tpo-toggle').checked?'TPO · chọn M15':'TPO tắt';if(summary)summary.textContent=status.textContent+' ⚙';host.dataset.tpoState='off';requestUpdate();return;}
    const windows=tpoWindows(state.bars,{session:lookup('tpo-anchor').value}),source=lookup('tpo-source').value;
    const sig=[state.symbol,state.now,lookup('tpo-row-size').value,lookup('tpo-layout')?.value,source,...windows.flatMap(w=>w.bars.map(b=>[b.t,b.h,b.l].join(',')))].join('|');
    if(sig!==revision){revision=sig;rebuild(state,windows);}
    if(source!=='M15'&&windows.length&&!document.hidden){
      const myKey=activeKey,ready=()=>{if(myKey===activeKey&&lookup('tpo-toggle').checked){revision='';const current=context();rebuild(current,tpoWindows(current.bars,{session:lookup('tpo-anchor').value}));}};
      void loader.refresh(state.symbol,windows,state.now).then(ready);
      if(source==='TRADES')void tradeLoader.refresh(state.symbol,windows,state.now).then(ready);
    }
  }
  function rebuild(state,windows){
    try{
      const source=lookup('tpo-source').value;
      profiles=windows.map(w=>buildTpo(w,{minutes:loader.read(state.symbol,[w]),trades:tradeLoader.read(state.symbol,w,state.now),now:state.now,rowSize:Number(lookup('tpo-row-size').value),source}));
      const sources=[...new Set(profiles.map(p=>p.source))].join(', '),missing=profiles.some(p=>p.missing),forming=profiles.some(p=>p.forming),n=profiles.reduce((s,p)=>s+p.tradeBlocks,0),fallback=profiles.reduce((s,p)=>s+p.fallbackBlocks,0);
      status.textContent=profiles.length?`TPO 30m · ${sources}${source==='TRADES'?` · khớp ${n}/${n+fallback} block`:''}${profiles.some(p=>p.approximate)?' · OHLC xấp xỉ':''}${missing?' · THIẾU NẾN':''}${forming?' · TẠM':''}${source==='TRADES'&&tradeLoader.note?' · '+tradeLoader.note:''}`:'TPO · chưa có dữ liệu';
      status.title='Mốc 00:00 New York, tự đổi DST. Xanh lam → vàng theo thời gian, không phải mua/bán. VA 70% số ô TPO; IB một giờ đầu. Vạch cam: single prints bên trong phổ. Khớp lệnh: mỗi mức giá chỉ tính một lần trong block 30m, không nhân volume. Chỉ dùng block tải đủ, phần còn lại dùng M1/M15 xấp xỉ. REST giới hạn 48h, tải dần; dữ liệu đang chạy trễ vài giây. Ba ngày/phiên gần nhất. Gộp phổ tự đổi ô/thanh theo zoom; Trải thời gian đặt block ở đúng giờ.';
      host.dataset.tpoState=profiles.length?'ready':'empty';host.dataset.tpoSource=sources;host.dataset.tpoProfiles=String(profiles.length);host.dataset.tpoTradeBlocks=String(n);host.dataset.tpoFallbackBlocks=String(fallback);host.dataset.tpoLayout=lookup('tpo-layout')?.value??'STACKED';
      if(summary){summary.textContent=source==='TRADES'?`TPO · Khớp ${n}/${n+fallback} ⚙`:'TPO · '+sources+' ⚙';summary.title=status.textContent;}
    }catch(error){profiles=[];status.textContent=error.message;host.dataset.tpoState='error';}
    requestUpdate();
  }
  for(const input of box.querySelectorAll('input,select'))input.addEventListener('change',()=>{revision='';update();});
  // Continue bounded backfill even when indicator history has not refreshed.
  if(typeof window!=='undefined')timer=setInterval(()=>{if(!document.hidden&&lookup('tpo-toggle').checked)update();},30000);
  return {update,getProfiles:()=>profiles};
}
