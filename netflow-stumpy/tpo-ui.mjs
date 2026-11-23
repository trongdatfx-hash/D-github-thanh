import {tpoWindows,buildTpo,tpoBlockLetter} from './tpo-profile.mjs?v=20261123-tpo-midnight1';
import {TpoMinuteLoader} from './tpo-minutes.mjs?v=20261123-tpo-midnight1';
export function mountTpo({chart,price,controls,host,get,context}){
  const box=document.createElement('span');box.className='tpo-controls';
  box.innerHTML='<label title="TPO theo phiên New York; ô 30 phút, IB một giờ đầu"><input id="tpo-toggle" type="checkbox" checked>TPO</label><label>Phiên <select id="tpo-session"><option value="BOTH">PRE + RTH</option><option value="PRE">PRE</option><option value="RTH">RTH</option></select></label><label>Bước giá <select id="tpo-row-size"><option value="0.1">0.1</option><option value="0.2">0.2</option><option value="0.5" selected>0.5</option><option value="1">1</option><option value="2">2</option></select></label><label>Nguồn TPO <select id="tpo-source"><option value="AUTO">Ưu tiên M1</option><option value="M15">M15</option></select></label><small id="tpo-status" role="status">Chờ nến M15</small>';
  box.innerHTML=box.innerHTML.replace('id="tpo-session"','id="tpo-anchor"').replace('<option value="BOTH">','<option value="DAY" selected>Ngày · từ 00h NY</option><option value="BOTH">');
  box.style.cssText='display:inline-flex;flex-wrap:wrap;align-items:center;gap:8px';controls.append(box);
  const lookup=id=>box.querySelector('#'+id),loader=new TpoMinuteLoader(get);let profiles=[],requestUpdate=()=>{},activeKey='',revision='';
  const status=lookup('tpo-status');status.style.cssText='color:#b5c8df;font-size:12px';
  const primitive={attached(p){requestUpdate=p.requestUpdate;},detached(){loader.cancel();},updateAllViews(){},paneViews(){return [{zOrder:()=> 'bottom',renderer:()=>({draw(target){target.useMediaCoordinateSpace(draw);}})}];}};
  price.attachPrimitive(primitive);
  function draw({context:ctx,mediaSize:{width,height}}){
    if(!lookup('tpo-toggle').checked||!profiles.length)return;
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    for(const p of profiles){
      if(!p.va)continue;
      const anchorX=chart.timeScale().timeToCoordinate(p.start/1000);
      const x=anchorX??chart.timeScale().timeToCoordinate(p.bars[0]?.t/1000);
      const lastX=chart.timeScale().timeToCoordinate(p.bars.at(-1)?.t/1000);
      if(!Number.isFinite(x)||!Number.isFinite(lastX)||lastX<0||x>width)continue;
      const maxBlocks=Math.max(1,...p.rows.map(r=>r.blocks.length));
      const available=Math.max(16,Math.min(width<650?100:180,Math.abs(lastX-x)*.45));
      const cell=Math.min(10,available/maxBlocks),left=x+5;
      const fullBlocks=(p.end-p.start)/1800000;
      if(p.session==='DAY'&&Number.isFinite(anchorX)){
        ctx.strokeStyle='rgba(148,199,234,.28)';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(anchorX,0);ctx.lineTo(anchorX,height);ctx.stroke();ctx.setLineDash([]);
      }
      for(const r of p.rows){
        const y1=price.priceToCoordinate(r.high),y2=price.priceToCoordinate(r.low);if(!Number.isFinite(y1)||!Number.isFinite(y2))continue;
        const top=Math.min(y1,y2),h=Math.abs(y2-y1);if(top>height||top+h<0)continue;
        const inVA=r.low>=p.va.val-1e-8&&r.high<=p.va.vah+1e-8;
        for(let j=0;j<r.blocks.length;j++){
          const block=r.blocks[j],hue=205-170*block/Math.max(1,fullBlocks-1);
          ctx.fillStyle=`hsla(${hue},85%,65%,${inVA?.5:.22})`;
          ctx.fillRect(left+j*cell,top,Math.max(.5,cell-.6),Math.max(.7,h-.6));
          if(cell>=7&&h>=11){ctx.fillStyle='rgba(240,248,255,.88)';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(tpoBlockLetter(block),left+(j+.5)*cell,top+h/2+3);}
        }
      }
      const right=Math.min(width-4,left+available+7);
      const titleY=price.priceToCoordinate(p.rows.at(-1).high);
      if(Number.isFinite(titleY)){ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillStyle='#c6d9ed';ctx.fillText(`${p.day.slice(5)} ${p.session==='DAY'?'00h NY':p.session} · ${p.source}${p.forming?' TẠM':''}`,left,Math.max(13,Math.min(height-12,titleY-18)));}
      const line=(value,label,color,dash=[])=>{const y=price.priceToCoordinate(value);if(!Number.isFinite(y)||y<12||y>height-8)return;
        ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle=color;ctx.font='10px sans-serif';ctx.textAlign='left';ctx.fillText(label+' '+value.toFixed(2),left+2,y-3);};
      line((p.va.pocIndex+.5)*p.rowSize,'POC','#ffd35c');
      line(p.va.vah,'VAH','#94c7ea',[3,3]);line(p.va.val,'VAL','#94c7ea',[3,3]);
      if(p.ib){const y1=price.priceToCoordinate(p.ib.high),y2=price.priceToCoordinate(p.ib.low);
        if(Number.isFinite(y1)&&Number.isFinite(y2)){ctx.strokeStyle=p.ib.complete?'#e4b7ff':'#9675ae';ctx.lineWidth=2;ctx.setLineDash(p.ib.complete?[]:[2,2]);ctx.beginPath();ctx.moveTo(x+1,y1);ctx.lineTo(x+1,y2);ctx.stroke();ctx.setLineDash([]);ctx.font='10px sans-serif';ctx.fillStyle='#e4b7ff';ctx.textAlign='left';ctx.fillText('IB 1h'+(p.ib.complete?'':' TẠM'),x+4,Math.max(12,Math.min(height-10,y1-5)));}
      }
    }ctx.restore();
  }
  function update(){
    const state=context();
    const enabled=lookup('tpo-toggle').checked&&state.interval==='15m';
    const key=[enabled,state.symbol,lookup('tpo-anchor').value,lookup('tpo-source').value].join('|');
    if(key!==activeKey){activeKey=key;loader.cancel();revision='';}
    if(!enabled){profiles=[];status.textContent=lookup('tpo-toggle').checked?'TPO · chọn M15':'TPO tắt';host.dataset.tpoState='off';requestUpdate();return;}
    const windows=tpoWindows(state.bars,{session:lookup('tpo-anchor').value});
    const selectedSource=lookup('tpo-source').value;
    // Full bar values participate: live high/low changes must repaint the profile.
    const sig=[state.symbol,state.now,lookup('tpo-row-size').value,selectedSource,...windows.flatMap(w=>w.bars.map(b=>[b.t,b.h,b.l].join(',')))].join('|');
    if(sig!==revision){revision=sig;rebuild(state,windows);}
    if(selectedSource==='AUTO'&&windows.length&&!document.hidden){
      const myKey=activeKey;
      void loader.refresh(state.symbol,windows,state.now).then(changed=>{if(changed&&myKey===activeKey&&lookup('tpo-toggle').checked){revision='';rebuild(context(),tpoWindows(context().bars,{session:lookup('tpo-anchor').value}));}});
    }
  }
  function rebuild(state,windows){
    try{profiles=windows.map(w=>buildTpo(w,{minutes:loader.read(state.symbol,[w]),now:state.now,rowSize:Number(lookup('tpo-row-size').value),source:lookup('tpo-source').value}));
      const sources=[...new Set(profiles.map(p=>p.source))].join(', '),missing=profiles.some(p=>p.missing),forming=profiles.some(p=>p.forming);
      status.textContent=profiles.length?`TPO ${lookup('tpo-anchor').value==='DAY'?'00h NY · ':''}30m · ${sources}${profiles.some(p=>p.approximate)?' xấp xỉ':''}${missing?' · THIẾU NẾN':''}${forming?' · TẠM':''}`:'TPO · chưa có dữ liệu theo mốc đã chọn';
      status.title='Mặc định neo 00:00 New York mỗi ngày, tự đổi DST. Màu xanh lam → vàng theo thứ tự thời gian, không phải mua/bán. VA 70% số ô TPO. IB: khoảng giá giờ đầu từ mốc đã chọn. TPO từ OHLC vẫn là xấp xỉ giá đã giao dịch; M15 được dùng khi M1 thiếu. Ba ngày/phiên gần nhất, độc lập vùng zoom. Nến hiện tại và phiên đang chạy có thể thay đổi.';
      host.dataset.tpoState=profiles.length?'ready':'empty';host.dataset.tpoSource=sources;host.dataset.tpoProfiles=String(profiles.length);
    }catch(error){profiles=[];status.textContent=error.message;host.dataset.tpoState='error';}
    requestUpdate();
  }
  for(const input of box.querySelectorAll('input,select'))input.addEventListener('change',()=>{revision='';update();});
  return {update,getProfiles:()=>profiles};
}
