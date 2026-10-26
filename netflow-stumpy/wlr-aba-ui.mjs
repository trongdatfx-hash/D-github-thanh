import {collectionState,snapshotKey,usableSignal,researchPreviewSignal,reasonText,SNAPSHOT_TTL,activePolicy} from './wlr-aba-status.mjs?v=20261025-dcommon-all1';
import {COLOR_NAMES} from './wlr-aba-live.mjs?v=20261026-aba-history1';
import {freezeAbaResult,canRetainAba,abaOverlayGeometry,abaPaintKey,abaLabel} from './wlr-aba-overlay.mjs?v=20261025-dcommon-all1';
const fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'—',pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—',change=x=>Number.isFinite(x)?(x>=0?'+':'')+x.toFixed(2)+'%':'—',date=t=>Number.isFinite(t)?new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
export function createWlrAba({chart,wlr,host,actions,getContext,paneBounds,getCvdBounds,onStateChange=()=>{}}){
 const label=document.createElement('label');label.className='aba-toggle';const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='wlr-aba-toggle';toggle.checked=true;label.append(toggle,'WLR A–B–A · nghiên cứu');actions.append(label);
 const panel=document.createElement('section');panel.className='aba-panel';panel.setAttribute('aria-labelledby','aba-title');panel.innerHTML=`<div class="aba-head"><div><span class="aba-eyebrow">ÂU → PRE → RTH → POST · XANH / ĐỎ / VÀNG</span><h2 id="aba-title">WLR A–B–A V2</h2></div><button id="aba-reset" type="button">Theo WLR hiện tại</button></div><div class="aba-health" role="group" aria-label="Độ mới dữ liệu và điều kiện sử dụng"><p id="aba-chart-health"></p><p id="aba-collection-health"></p><p id="aba-publication-health"></p><p id="aba-decision-health"></p><p id="aba-signal-health"></p><p id="aba-forward-health"></p><p id="aba-policy-health"></p></div><p id="aba-status" role="status" aria-live="polite">Đang chờ dữ liệu M15 đã đóng…</p><div class="aba-grid"><div><small>WLR cuối đã đóng tại mốc dự báo</small><strong id="aba-reference">—</strong><span id="aba-origin"></span></div><div><small>P50 nghiên cứu · A kế tiếp</small><strong id="aba-target">—</strong><span id="aba-range"></span></div><div><small>Thuộc A–B–A · tần suất mẫu đã xác nhận</small><strong id="aba-membership">—</strong><span id="aba-count"></span></div></div><p id="aba-progress"></p><p id="aba-source"></p><section class="aba-comparison" aria-labelledby="aba-compare-title"><h3 id="aba-compare-title">Trung vị A kế tiếp cao hay thấp hơn WLR cuối?</h3><p>Mốc so sánh là điểm WLR tại nến cuối đã đóng lúc phát dự báo, được giữ nguyên qua A→B→A; không dùng điểm kết thúc A còn chưa biết. Nền hướng đoán phía thường gặp hơn từ lịch sử cùng màu/phiên, một mẫu đủ điều kiện mỗi ngày.</p><div class="aba-table-scroll" tabindex="0" role="region" aria-label="So sánh hướng và giá dự báo với nền"><table><caption>Nghiên cứu đang theo dõi · chưa phải tín hiệu sử dụng</caption><thead><tr><th scope="col">Chỉ số</th><th scope="col">A–B–A</th><th scope="col">Nền cùng màu / phiên</th></tr></thead><tbody id="aba-live-table"><tr><td colspan="3">Chờ dữ liệu dự báo…</td></tr></tbody></table></div></section><section class="aba-comparison" aria-labelledby="aba-direction-title"><h3 id="aba-direction-title">Kết quả hướng · hồi cứu và forward đã khóa</h3><p id="aba-direction-status" class="aba-direction-status" role="status">Đang tải kiểm định hướng…</p><p id="aba-direction-sample"></p><p id="aba-v2-protocol"></p><p id="aba-v3-freeze"></p><div class="aba-table-scroll" tabindex="0" role="region" aria-label="Đối chiếu gate V2 và V3"><table><caption>V2 giữ nguyên · V3 mở rộng 6 tuần</caption><thead><tr><th>Phiên bản</th><th>Cửa sổ gate</th><th>Mẫu / tối thiểu</th><th>Ngày / tối thiểu</th><th>Độ phủ</th><th>Trạng thái gate</th></tr></thead><tbody id="aba-policy-comparison"></tbody></table></div><p id="aba-v2-calibration"></p><p id="aba-v2-gate"></p><p id="aba-v2-interval"></p><div class="aba-table-scroll" tabindex="0" role="region" aria-label="Đối chiếu tỷ lệ dự báo với thực tế"><table><caption>Kiểm tra tỷ lệ cao hơn WLR · theo nhóm dự báo</caption><thead><tr><th>Nhóm dự báo</th><th>Trung bình dự báo</th><th>Thực tế cao hơn</th><th>Số mốc / ngày</th></tr></thead><tbody id="aba-reliability-table"></tbody></table></div><div class="aba-table-scroll" tabindex="0" role="region" aria-label="Thống kê dự đoán hướng ngoài mẫu"><table><caption id="aba-direction-caption">Chấm cùng mốc, không tính mẫu chưa có trung vị cuối là sai</caption><thead><tr><th scope="col">Thước đo</th><th scope="col">Mô hình</th><th scope="col">Nền</th><th scope="col">Chênh lệch</th><th scope="col">Kiểm định</th></tr></thead><tbody id="aba-direction-table"></tbody></table></div><p id="aba-direction-limit">Tỷ lệ đúng hướng càng cao càng tốt; Brier càng thấp càng tốt. Kiểm định chênh lệch dùng block bootstrap theo ngày, 97,5%, cần ≥30 ngày và cả khoảng cải thiện lớn hơn 0. V2 và V3 chọn theo độ chính xác hướng trong giai đoạn riêng. V3 khóa mô hình, hiệu chỉnh và gate trước forward; kết quả lịch sử sau gate vẫn là hồi cứu đã được xem. Dữ liệu test cũ đã được xem nên kết quả vẫn mang tính thăm dò; forward được ghi riêng. Tỷ lệ hướng dùng phép hiệu chỉnh đã chọn trên validation, hoặc giữ tỷ lệ gốc khi phép hiệu chỉnh chưa tốt hơn; chưa bảo đảm độ tin cậy riêng cho từng mẫu.</p><p>P10–P90 đã có thống kê độ phủ hồi cứu ở trên; chưa được hiệu chỉnh để bảo đảm độ phủ 80% trong tương lai. Mẫu A–B–A đang dở vẫn được theo dõi, nhưng chỉ chấm hướng khi trung vị A kế tiếp đã hoàn tất.</p></section><details><summary>Kết quả kiểm tra và cách hiểu</summary><p id="aba-validation">Đang tải kết quả kiểm tra…</p><p>Bắt đầu từ nến mở cửa châu Âu (08:00–08:15 London), sau khi nến đóng; tự đổi giờ mùa hè. Hoạt động đến hết POST New York. Cửa sổ 8/16 nến dùng lịch sử liên tục trước phiên Âu để khởi tạo. Thiếu lịch sử thì báo chờ.</p><p>A là WLR đang theo dõi; B là đúng một đoạn khác màu. Xanh và đỏ theo gate V3; WLR vàng chỉ vẽ preview khi có ≥12 ngày lịch sử causal và xác suất hướng đã hiệu chỉnh ≥75%. Trung vị lấy trên đường WLR, khác giá đóng nến. Nhận dạng mẫu và xác định trung vị cuối đoạn là hai việc riêng: A kế tiếp đang mở vẫn thuộc mẫu, nhưng trung vị cuối chưa được biết.</p><p>Vùng P10–P90 và đường trung vị dự kiến được vẽ gọn bằng một phần ba bề ngang phổ CVD và neo đúng tâm phổ, cho phép chồng lên CVD, theo trục giá SPY. P10–P90 là phân vị lịch sử có điều kiện, không phải khoảng chắc chắn của giá. Thời gian hoàn tất thay đổi; vùng ngang không đại diện 8 nến tương lai. Tần suất thuộc mẫu chỉ tính trên các mẫu lịch sử đã xác nhận; mẫu chưa xác nhận được báo riêng. Không phải tỷ lệ thắng hoặc xác suất đã hiệu chỉnh.</p><p>Giá kỳ vọng, P10–P90 và mốc WLR cuối đã đóng được giữ nguyên trong cùng lượt A→B→A. Màu nến đang chạy không đổi mốc này. Nhãn A ↑ …% / nền …% so cùng khả năng trung vị A kế tiếp cao hơn WLR mốc, có điều kiện mẫu hoàn tất; đây là tần suất lịch sử có làm trơn, không phải tỷ lệ nhận dạng A–B–A hoặc xác suất đã hiệu chỉnh. Vùng vẽ dùng trực tiếp thang giá của đường WLR; chỉ đổi lượt khi mẫu kết thúc/bị phá bằng nến đã đóng hoặc bấm “Theo WLR hiện tại”. Khi đồng bộ ngắn, giữ khung cũ kèm trạng thái; dữ liệu mất mới hoặc đổi symbol/timeframe thì ẩn.</p><a href="data/wlr-aba/report.json" target="_blank" rel="noopener">Báo cáo A–B–A</a> · <a href="WLR-ABA.md" target="_blank" rel="noopener">Phương pháp</a></details><div id="aba-history" aria-live="polite"></div>`;host.closest('.chart-card').after(panel);
 const $=id=>panel.querySelector('#'+id),canvas=document.createElement('canvas');canvas.id='wlr-aba-overlay';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Vùng trung vị dự kiến của WLR cùng màu kế tiếp');host.append(canvas);const badge=document.createElement('div');badge.id='wlr-aba-readout';badge.setAttribute('aria-live','polite');host.append(badge);
 let snapshotReport=null,snapshotVerified=false,snapshotReceivedAt=0,snapshotError='',refreshing=false,activeStage='';
 let worker=null,active=null,historyBands=[],request=0,pending='',frame=0,resetNext=false,restored=null,syncStartedAt=null,geometryMissingAt=null,lastPaintKey='';
 const buffer=document.createElement('canvas');
 try{restored=JSON.parse(sessionStorage.getItem('netflow:wlr-aba:europe-post:policy-v3:dcommon-v1')??'null');}catch{}
 const schedule=()=>{onStateChange();if(!frame)frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(draw);});};
 function wait(message,retain=false){
  if(retain&&active&&syncStartedAt===null)syncStartedAt=performance.now();
  if(retain&&canRetainAba(active,getContext(),syncStartedAt===null?Infinity:performance.now()-syncStartedAt)){
   canvas.dataset.sync='updating';$('aba-status').textContent=message+' · giữ dự báo WLR đã chốt, đang đồng bộ';badge.textContent='A–B–A · ĐANG ĐỒNG BỘ · WLR mốc '+fmt(active.track.q.currentWlr);schedule();return;
  }
  tableRows('aba-live-table',[['Mẫu hiện tại','WAIT','WAIT']]);active=null;syncStartedAt=null;canvas.dataset.sync='waiting';$('aba-status').textContent=message;badge.textContent='A–B–A · '+message;$('aba-reference').textContent=$('aba-target').textContent=$('aba-membership').textContent='—';$('aba-origin').textContent=$('aba-range').textContent=$('aba-count').textContent=$('aba-progress').textContent='';schedule();
 }

 function tableRows(id,rows){const body=$(id);body.replaceChildren();for(const cells of rows){const tr=document.createElement('tr');cells.forEach((text,i)=>{const td=document.createElement(i?'td':'th');if(!i)td.scope='row';td.textContent=text;tr.append(td);});body.append(tr);}}
 const gateReason=reasonText;
 const signed=(x,digits=2)=>Number.isFinite(x)?(x>=0?'+':'')+x.toFixed(digits):'—',sideText=s=>s===1?'CAO HƠN':s===-1?'THẤP HƠN':'WAIT · hòa / chưa đủ mẫu';
 function liveTable(result){
  const t=result.track,p=t.prediction,b=t.baseline,d=t.direction,priceText=v=>v?.ready?fmt(v.value)+' · '+change(100*(v.value/t.q.currentWlr-1)):'WAIT',band=v=>v?.ready?fmt(v.low)+' – '+fmt(v.high):'WAIT';
  tableRows('aba-live-table',[
   ['Mốc WLR cuối đã đóng',fmt(t.q.currentWlr),fmt(t.q.currentWlr)],
   ['Hướng trung vị A kế tiếp',t.signal?.emit!==true?'WAIT · '+gateReason(t.signal.reason):d?.ready?sideText(d.side):'WAIT',d?.baseline.ready?sideText(d.baseline.side):'WAIT'],
   ['Tần suất cao hơn / thấp hơn · có điều kiện',d?.ready?pct(d.pAbove)+' / '+pct(d.pBelow):'WAIT',d?.baseline.ready?pct(d.baseline.pAbove)+' / '+pct(d.baseline.pBelow):'WAIT'],
   ['Trung vị A kế tiếp',priceText(p),priceText(b)],
   ['Vùng P10–P90',band(p),band(b)],
   ['Ngày lịch sử có hướng khác mốc',d?String(d.n):'—',d?String(d.baseline.n):'—'],
   ['Thuộc mẫu A–B–A · khác tỷ lệ đúng hướng',p.memberReady?pct(p.pMembership):'WAIT',b?.memberReady?pct(b.pMembership):'WAIT']
  ]);
 }
 function policyComparison(report){
  tableRows('aba-policy-comparison',[report.v2,report.v3].map((p,i)=>{
   if(!p)return ['V'+(i+2),'Đang tính','WAIT','WAIT','WAIT','WAIT'];
   const trials=p.gateValidation?.trials??[],chosen=p.gate?trials.find(t=>t.config.band===p.gate.band&&t.config.gap===p.gate.gap):null,best=chosen??trials.reduce((a,b)=>(b.score?.n??0)>(a?.score?.n??-1)?b:a,null);
   return ['V'+p.version,p.spec.gateStart+' → trước '+p.spec.testStart,(best?.score?.n??0)+' / '+p.spec.minimumGateN+(chosen?'':' (nhiều nhất)'),(best?.score?.days??0)+' / '+p.spec.minimumGateDays,pct(best?.coverage)+' / '+pct(p.spec.minimumGateCoverage),p.status];
  }));
 }
 function directionTable(report){
  const v=activePolicy(report),status=$('aba-direction-status');
  $('aba-title').textContent='WLR A–B–A V'+(v?.version??'—');
  policyComparison(report);
  if(!v?.test||!v.calibration?.model||!v.calibration?.baseline){status.dataset.state=v?.status??'WAIT';status.textContent='WAIT · '+(v?.status??'đang tính A–B–A');return;}
  const s=v.test,raw=s.raw,filtered=s.filtered,model=v.selectedModel;
  status.dataset.state=v.status!=='READY'?v.status:filtered.status;status.textContent=v.status!=='READY'?'V'+v.version+' · WAIT · '+v.status:'V'+v.version+' · gate READY · '+(filtered.status==='PROMISING_REQUIRES_FORWARD_TEST'?'hồi cứu có cải thiện, chưa xác thực live':'hồi cứu chưa chứng minh vượt nền');
  $('aba-direction-caption').textContent=model+' · chọn theo đúng hướng, hiệu chỉnh có đối chứng, WAIT chọn bằng validation';
  $('aba-direction-sample').textContent=filtered.hits+'/'+filtered.n+' lần đúng sau WAIT; '+filtered.days+' ngày. Trước WAIT: '+raw.hits+'/'+raw.n+'. Phát '+s.emitted+'/'+s.queries+' mốc dự báo ('+pct(s.signalCoverage)+'); '+filtered.unfinished+' mốc đã phát chưa có trung vị cuối, không chấm sai. Kho '+date(report.sourceAsOf)+'.';
  $('aba-v3-freeze').textContent=v.version===3?'Cấu hình V3 đã khóa lúc '+date(v.freeze?.createdAt)+' (giờ VN) · ID '+(v.policyId?.slice(0,12)??'WAIT')+'. Không tự chọn lại mô hình, hiệu chỉnh hoặc gate bằng kết quả forward.':'';
  $('aba-v2-protocol').textContent='Chọn mô hình: '+v.spec.selectionStart+' → '+v.spec.calibrationStart+'; fit hiệu chỉnh: → '+v.spec.gateStart+'; chọn phép hiệu chỉnh và WAIT: → '+v.spec.testStart+'. Hồi cứu sau gate từ '+v.spec.testStart+' đến trước '+(v.spec.historicalEnd??v.spec.forwardStart)+'; dữ liệu đã từng được xem. Forward từ '+v.spec.forwardStart+': '+v.forward.filtered.n+' mốc chấm / '+v.forward.filtered.days+' ngày · '+v.forward.queries+' queries. Đây là tái tính theo ngày từ kho, chưa phải sổ dự báo ghi nhận live.';
  const c=v.calibration,used=c.model.validation.usedFit,baseUsed=c.baseline.validation.usedFit;
  $('aba-v2-calibration').textContent='Hiệu chỉnh mô hình: '+(used?'dùng sigmoid đã fit':c.model.fittedCandidate.status!=='READY'?'chưa đủ mẫu, giữ tỷ lệ gốc':'giữ tỷ lệ gốc; sigmoid chưa thắng validation')+'; nền: '+(baseUsed?'dùng sigmoid':'giữ tỷ lệ gốc')+'. Fit '+c.model.n+' mốc / '+c.model.days+' ngày; chọn trên '+c.model.validation.n+' mốc / '+c.model.validation.days+' ngày khác. Đây vẫn là tỷ lệ thăm dò.';
  $('aba-v2-gate').textContent=v.gate?'WAIT khi tỷ lệ không đồng thuận P50 hoặc không vượt nền hơn '+(100*v.gate.gap).toFixed(0)+' điểm %. '+(v.gate.band==='whole'?'Yêu cầu cả P10–P90 ở cùng phía WLR.':'Bộ lọc bắt buộc cả dải một phía chưa đủ mẫu validation nên chưa dùng làm mặc định.'):'Chưa chọn được ngưỡng WAIT đủ mẫu. Cửa sổ gate '+v.spec.gateStart+' → '+v.spec.testStart+' đã cố định; thêm nến live không tự bổ sung mẫu vào cửa sổ này. Cần một phiên bản kiểm định mới được chốt trước khi thu kết quả mới.';
  const iv=s.intervals;$('aba-v2-interval').textContent='Độ phủ P10–P90: '+pct(iv.coverage)+' cân bằng theo ngày; '+iv.hits+'/'+iv.n+' trung vị thực tế trong dải ('+pct(iv.queryCoverage)+' theo số mốc). Dải chưa được hiệu chỉnh để bảo đảm 80%.';
  tableRows('aba-reliability-table',s.reliability.model.map(b=>[(100*b.from).toFixed(0)+'–'+(100*b.to).toFixed(0)+'%',pct(b.forecast),pct(b.actual),b.n+' / '+b.days]));
  const cmp=filtered.comparison,interval=c=>Number.isFinite(c.low)?signed(100*c.low)+' … '+signed(100*c.high)+' điểm %':'Chưa đủ mẫu';
  tableRows('aba-direction-table',[
   ['Đúng hướng · theo số mốc',pct(filtered.accuracy),pct(filtered.baselineAccuracy),signed(Number.isFinite(filtered.accuracy)&&Number.isFinite(filtered.baselineAccuracy)?100*(filtered.accuracy-filtered.baselineAccuracy):null)+' điểm %',filtered.hits+'/'+filtered.n+' so '+filtered.baselineHits+'/'+filtered.n],
   ['Đúng hướng · cân bằng theo ngày',pct(filtered.dayAccuracy),pct(filtered.baselineDayAccuracy),signed(100*cmp.gain)+' điểm %','Khoảng 97,5%: '+interval(cmp)],
   ['Trước / sau WAIT · theo số mốc',pct(raw.accuracy),pct(filtered.accuracy),'Khác tập mốc','Giữ '+filtered.n+'/'+raw.n+' mốc đã chấm'],
   ['Trước / sau WAIT · cân bằng ngày',pct(raw.dayAccuracy),pct(filtered.dayAccuracy),'Khác tập mốc','Không coi thay đổi tỷ lệ là bằng chứng tự động'],
   ['Brier · sau WAIT',Number.isFinite(filtered.brier)?filtered.brier.toFixed(4):'—',Number.isFinite(filtered.baselineBrier)?filtered.baselineBrier.toFixed(4):'—',signed(filtered.probabilityComparison.gain,4),'Càng thấp càng tốt']
  ]);
 }
 function clearDrawing(status){
  if(lastPaintKey){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);lastPaintKey='';}
  canvas.dataset.status=status;canvas.setAttribute('aria-label','A–B–A · '+status);
 }
 function draw(){
  frame=0;const w=host.clientWidth,h=host.clientHeight,dpr=window.devicePixelRatio||1;
  if(!toggle.checked||!active?.track.prediction.ready){clearDrawing(!toggle.checked?'HIDDEN':'WAIT');return;}
  if(active.track.q?.color===0&&active.track.signal?.emit!==true){clearDrawing(active.track.signal?.reason??'WAIT_YELLOW_LOW_ACCURACY');return;}
  const waiting=active.track.signal?.emit!==true,displayStatus=waiting?'VISIBLE_WAIT':'VISIBLE';
  const track=active.track,p=track.prediction,geometry=abaOverlayGeometry(chart.timeScale(),wlr,paneBounds(0),getCvdBounds(),track);
  // Chart setData/resize can temporarily have no coordinates. Keep the last
  // completed bitmap until the next scheduled chart paint, never publish a blank.
  if(!geometry){geometryMissingAt??=performance.now();if(performance.now()-geometryMissingAt>20000)clearDrawing('WAIT_COORDINATES');return;}geometryMissingAt=null;
  const {left,right,width:regionWidth,y,low,high,top,height}=geometry;
  if(right<=0||left>=chart.timeScale().width()){clearDrawing('OFFSCREEN');return;}
  const key=abaPaintKey(geometry,w,h,dpr,track);
  if(key===lastPaintKey){canvas.dataset.status=displayStatus;return;}
  const bitmapWidth=Math.round(w*dpr),bitmapHeight=Math.round(h*dpr);
  if(buffer.width!==bitmapWidth||buffer.height!==bitmapHeight){buffer.width=bitmapWidth;buffer.height=bitmapHeight;}
  const ctx=buffer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const color=track.q.color>0?'26,224,163':track.q.color<0?'255,77,112':'246,200,95';
  ctx.save();ctx.globalAlpha=waiting?.4:1;ctx.translate(0,top);ctx.beginPath();ctx.rect(left,0,regionWidth,height);ctx.clip();ctx.fillStyle=`rgba(${color},.14)`;ctx.fillRect(left,Math.min(high,low),regionWidth,Math.abs(low-high));ctx.strokeStyle=`rgb(${color})`;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([]);
  ctx.restore();
  // Only resize the visible canvas when its dimensions change. Swap the fully
  // rendered back buffer in the same task so no empty intermediate frame shows.
  if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const front=canvas.getContext('2d');front.setTransform(1,0,0,1,0,0);front.clearRect(0,0,bitmapWidth,bitmapHeight);front.drawImage(buffer,0,0);
  lastPaintKey=key;canvas.dataset.status=displayStatus;canvas.dataset.left=String(left);canvas.dataset.right=String(right);canvas.dataset.widthRatio='1/3';canvas.dataset.alignment='cvd-center';canvas.setAttribute('aria-label',`${waiting?'WAIT · vùng tham khảo, chưa đạt bộ lọc; ':''}${abaLabel(track).first} ${abaLabel(track).second}; trung vị WLR dự kiến ${fmt(p.value)}, P10 ${fmt(p.low)}, P90 ${fmt(p.high)}, mốc WLR ${fmt(track.q.currentWlr)}; rộng một phần ba, neo tâm phổ CVD`);canvas.dataset.referenceWlr=String(track.q.currentWlr);canvas.dataset.expectedWlr=String(p.value);canvas.dataset.p10Wlr=String(p.low);canvas.dataset.p90Wlr=String(p.high);
 }
 function show(result){
  if(result.status!=='READY'){wait(result.message);return;}
  const context=getContext(),policySignal=result.track.policySignal??result.track.signal,usageSignal=usableSignal(result.track,snapshotReport,context.now,{verified:snapshotIsVerified(),live:context.live});
  const signal=researchPreviewSignal({...result.track,policySignal},snapshotReport,{verified:snapshotIsVerified(),live:context.live});
  result={...result,track:{...result.track,policySignal,usageSignal,signal}};
  active=freezeAbaResult(active,result);result=active;syncStartedAt=null;canvas.dataset.sync='ready';const {track:t,progress:g}=result,p=t.prediction,name=COLOR_NAMES[t.q.color],other=COLOR_NAMES[g.betweenColor];canvas.dataset.status=p.ready?'READY':'WAIT_SAMPLES';canvas.dataset.color=String(t.q.color);liveTable(result);
  const stage=g.stage==='NEXT_A_FORMING'?`ĐÃ THUỘC A–B–A · A ${name} kế tiếp đang mở`:g.stage==='B_FORMING'?`A ${name} → B ${other} · chờ A ${name} kế tiếp`:`A ${name} đang hình thành · chờ đúng một B khác màu`;
  activeStage=stage;
  $('aba-status').textContent=(t.signal?.emit!==true?'WAIT · '+gateReason(t.signal.reason)+' · ':'')+stage;$('aba-reference').textContent=fmt(t.q.currentWlr);$('aba-origin').textContent=`A ${name} · mốc mẫu ${date(t.q.issuedAt)} · ${t.q.knownBars} nến đã biết`;
  $('aba-target').textContent=t.signal?.emit!==true?'WAIT · '+gateReason(t.signal.reason):p.ready?`${fmt(p.value)} · ${change(result.changePct)}`:'WAIT · chưa đủ mẫu';$('aba-range').textContent=p.ready?`Nghiên cứu P50 ${fmt(p.value)} · P10–P90: ${fmt(p.low)} – ${fmt(p.high)}`:`Cần 12 ngày có trung vị hoàn tất; hiện có ${p.n}`;
  $('aba-membership').textContent=p.memberReady?pct(p.pMembership):'WAIT · ít mẫu xác nhận';$('aba-count').textContent=`${p.memberN} ngày đã xác nhận · ${p.unresolvedN} chưa xác nhận trong nhóm ${p.nEvents} ngày`;
  $('aba-progress').textContent=g.stage==='NEXT_A_FORMING'?`Đã quan sát ${g.observedBars} nến của A kế tiếp; trung vị tạm ${fmt(g.observedMedian)}. Chưa dùng làm trung vị thực tế cuối cùng.`:`${p.predictedMembership===true?'Dự đoán nghiêng về A–B–A':p.predictedMembership===false?'Dự đoán chưa nghiêng về A–B–A':'Chưa đủ dữ liệu để kết luận thuộc mẫu'}. Mẫu đang dở vẫn được theo dõi; chưa xác nhận không đồng nghĩa sai.`;
  $('aba-source').textContent=`${t.model} · SPY M15 · SPY V + Composite · kho ${date(t.sourceAsOf)} · tính lúc ${date(t.computedAt)}. Dự báo được giữ nguyên để theo dõi A→B→A.`;
  const probabilityLabel=abaLabel(t);badge.textContent=`${probabilityLabel.first} ${probabilityLabel.second} · ${name} · ${g.stage==='NEXT_A_FORMING'?'A kế tiếp đang mở':g.stage==='B_FORMING'?'đang ở B':'chờ B'}`;
  $('aba-history').replaceChildren();for(const r of [...(result.state.history??[])].reverse().slice(0,3)){const line=document.createElement('p');line.textContent=`${date(r.computedAt)} · ${COLOR_NAMES[r.color]} · ${r.stage==='COMPLETE_ABA'?`Đã hoàn tất · dự kiến ${fmt(r.value)}, thực tế ${fmt(r.actualMedian)}`:r.stage==='PATTERN_BROKEN'?'Đã xác nhận khác mẫu A–B–A':'Hết phiên: chưa xác nhận, không gán sai'}`;$('aba-history').append(line);}schedule();
 }
 function update(){
  canvas.style.display=badge.style.display=toggle.checked?'block':'none';panel.dataset.enabled=String(toggle.checked);if(!toggle.checked){++request;pending='';active=null;tableRows('aba-live-table',[['Mẫu hiện tại','Đã tắt','Đã tắt']]);$('aba-status').textContent='Đã tắt vùng dự báo A–B–A';schedule();return;}
  renderHealth();
  const c=getContext(),last=c.features?.at(-1);if(c.symbol!=='SPYUSDT'||c.interval!=='15m'){++request;pending='';wait('Chỉ hỗ trợ SPY M15');return;}
  if(!c.live){++request;pending='';wait('WAIT · chờ dữ liệu SPY M15 đã đóng còn mới');return;}
  if(!last||last.t!==c.expectedTime){++request;pending='';wait('WAIT · dữ liệu WLR đang đồng bộ',true);return;}
  const key=last.t+'|'+snapshotKey(snapshotReport)+'|'+Math.floor(c.now/SNAPSHOT_TTL)+'|'+resetNext;if(key===pending){schedule();return;}pending=key;const id=++request;
  ensureWorker();
  worker.postMessage({id,rows:c.features,now:c.now,reset:resetNext,restore:restored});resetNext=false;restored=null;
 }
 $('aba-reset').addEventListener('click',()=>{resetNext=true;pending='';update();});toggle.addEventListener('change',()=>{pending='';update();});chart.timeScale().subscribeVisibleLogicalRangeChange(schedule);window.addEventListener('resize',schedule);new ResizeObserver(schedule).observe(host);for(const e of ['wheel','pointermove','pointerup'])host.addEventListener(e,schedule,{passive:true});
 function snapshotIsVerified(){return snapshotVerified&&Date.now()-snapshotReceivedAt<2*SNAPSHOT_TTL;}
 function renderHealth(){
  const c=getContext(),r=snapshotReport,source=collectionState(r,c.now),verified=snapshotIsVerified();
  $('aba-chart-health').textContent='Chart Binance: '+(c.live?'LIVE':'KHÔNG LIVE')+' · độc lập với kho nghiên cứu';
  $('aba-chart-health').dataset.state=c.live?'LIVE':'WAIT';
  $('aba-collection-health').textContent='Kho nghiên cứu: '+source.status+' · '+source.source+' · trễ hiện tại '+(Number.isFinite(source.lagHours)?source.lagHours.toFixed(2)+' giờ':'chưa rõ')+' · nến cuối đóng '+date(source.lastClose)+' (giờ VN)';
  $('aba-collection-health').dataset.state=verified?source.status:'UNKNOWN';
  $('aba-publication-health').textContent='Publish '+date(r?.publishedAt)+' (giờ VN) · dữ liệu đến '+date(r?.sourceAsOf)+' · '+(verified?'đã đối chiếu archive/report':snapshotError||'WAIT · chờ xác minh snapshot')+'. Publish mới không đồng nghĩa dữ liệu live.';
  $('aba-decision-health').textContent='Lợi thế giá: '+(r?.decision??'WAIT')+' · '+(r?.selectionReady?'đã chọn '+r.selectedTrial:'chưa chọn mô hình')+'; chọn mô hình không xác nhận hiệu quả.';
  $('aba-decision-health').dataset.state=verified?(r?.decision??'WAIT'):'WAIT';
  const usageSignal=usableSignal(active?.track,r,c.now,{verified,live:c.live}),previewSignal=researchPreviewSignal(active?.track,r,{verified,live:c.live});
  $('aba-signal-health').textContent='Tín hiệu sử dụng: WAIT · '+reasonText(usageSignal.reason)+' · vùng P50/P10–P90 chỉ để nghiên cứu.';
  $('aba-signal-health').dataset.state='WAIT';
  const policy=activePolicy(r),forward=policy?.forward;
  $('aba-policy-health').textContent='Bộ lọc nghiên cứu V'+(policy?.version??'—')+': '+(policy?.status??'WAIT')+' · Preview hôm nay: '+(previewSignal.emit?'ACTIVE':'WAIT · '+reasonText(previewSignal.reason))+' · READY không phải tín hiệu sử dụng.';
  $('aba-policy-health').dataset.state=verified?(policy?.status??'WAIT'):'WAIT';
  $('aba-forward-health').textContent='Forward V'+(policy?.version??'—')+' từ '+(policy?.spec?.forwardStart??'—')+': '+(forward?.queries??'—')+' queries · '+(forward?.filtered?.n??'—')+' mốc chấm / '+(forward?.filtered?.days??'—')+' ngày'+(forward?.phase==='NOT_STARTED'?' · CHƯA BẮT ĐẦU':'')+'. Tái tính từ kho; chưa xác thực sổ dự báo ghi nhận live.';
  if(active){
   active={...active,track:{...active.track,usageSignal,signal:previewSignal}};
   liveTable(active);const p=active.track.prediction;
   $('aba-target').textContent=previewSignal.emit?fmt(p.value)+' · '+change(active.changePct):'WAIT · '+reasonText(previewSignal.reason);
   $('aba-status').textContent=(previewSignal.emit?'V3 PREVIEW · ':'WAIT · '+reasonText(previewSignal.reason)+' · ')+activeStage;
   badge.textContent=previewSignal.emit?'A · V3 PREVIEW · NGHIÊN CỨU':'A · WAIT · '+reasonText(previewSignal.reason)+' · NGHIÊN CỨU';schedule();
  }
 }
 function acceptSnapshot(r){
  const changed=snapshotKey(r)!==snapshotKey(snapshotReport);
  snapshotReport=r;snapshotVerified=true;snapshotReceivedAt=Date.now();snapshotError='';
  directionTable(r);
  const selected=activePolicy(r)?.selectedModel??r.selectedTrial,test=r.test?.[selected];
  $('aba-validation').textContent=test?`Nghiên cứu ${test.days} ngày / ${test.queries} mốc; ${test.targetN} trung vị hoàn tất. ${selected}: MAE ${fmt(test.maePct)}%; nền giữ trung vị ${fmt(r.test?.CURRENT_MEDIAN?.maePct)}%. Quyết định giá: ${r.decision??'WAIT'}.`:'WAIT · chưa có kết quả nghiên cứu';
  if(changed)pending='';renderHealth();
 }
 function snapshotFailed(message){
  snapshotVerified=false;snapshotError=message;pending='';
  $('aba-direction-status').dataset.state='WAIT';
  $('aba-direction-status').textContent='WAIT · '+message+' · kết quả bên dưới là bản đã tải trước đó';
  renderHealth();
 }
 function ensureWorker(){
  if(worker)return;
  worker=new Worker(new URL('./wlr-aba-worker.mjs?v=20261026-aba-history1',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.type==='snapshot'){refreshing=false;historyBands=data.historyBands??historyBands;acceptSnapshot(data.report);schedule();update();return;}
   if(data.type==='snapshot-error'){refreshing=false;snapshotFailed(data.error);return;}
   if(data.id!==request||!toggle.checked)return;
   if(data.error){snapshotFailed(data.error);wait(data.error,true);return;}
    historyBands=data.historyBands??historyBands;acceptSnapshot(data.report);schedule();
   const context=getContext();
   if(!context.live){pending='';wait('WAIT · dữ liệu chart không còn mới');return;}
   if(context.expectedTime!==context.features?.at(-1)?.t){pending='';wait('WAIT · dữ liệu WLR đang đồng bộ',true);return;}
   show(data.result);
   try{sessionStorage.setItem('netflow:wlr-aba:europe-post:policy-v3:dcommon-v1',JSON.stringify(data.result.state));}catch{}
  };
  worker.onerror=()=>{refreshing=false;snapshotFailed('lỗi xử lý A–B–A');wait('WAIT · lỗi xử lý A–B–A',true);worker?.terminate();worker=null;};
 }
 function refreshSnapshot(){
  if(refreshing)return;refreshing=true;
  try{ensureWorker();worker.postMessage({type:'refresh'});}
  catch(e){refreshing=false;snapshotFailed(e.message);}
 }
 refreshSnapshot();
 setInterval(refreshSnapshot,SNAPSHOT_TTL);
 setInterval(()=>{renderHealth();if(toggle.checked)update();},3000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshSnapshot();update();}});

 function getStrategyState(){
  const c=getContext(),verified=snapshotIsVerified(),track=active?.track,policy=activePolicy(snapshotReport);
   return {enabled:toggle.checked,live:c.live,verified,version:policy?.version,synced:active?.status==='READY'&&active.lastTime===c.expectedTime&&syncStartedAt===null,track,lastTime:active?.lastTime,progress:active?.progress,historyBands,preview:researchPreviewSignal(track,snapshotReport,{verified,live:c.live}),usage:usableSignal(track,snapshotReport,c.now,{verified,live:c.live})};
 }
 return {update,schedule,toggle,getStrategyState};
}

