import {COLOR_NAMES} from './wlr-aba-live.mjs?v=20261021-v2';
import {freezeAbaResult,canRetainAba,abaOverlayGeometry,abaPaintKey,abaLabel} from './wlr-aba-overlay.mjs?v=20261021-spy1';
const fmt=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:2}):'�',pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'�',change=x=>Number.isFinite(x)?(x>=0?'+':'')+x.toFixed(2)+'%':'�',date=t=>Number.isFinite(t)?new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'�';
export function createWlrAba({chart,wlr,host,actions,getContext,paneBounds,getCvdBounds}){
 const label=document.createElement('label');label.className='aba-toggle';const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='wlr-aba-toggle';toggle.checked=true;label.append(toggle,'WLR A�B�A V2 � th? nghi?m');actions.append(label);
 const panel=document.createElement('section');panel.className='aba-panel';panel.setAttribute('aria-labelledby','aba-title');panel.innerHTML=`<div class="aba-head"><div><span class="aba-eyebrow">PRE ? RTH ? POST � XANH / �? / V�NG</span><h2 id="aba-title">WLR A�B�A V2</h2></div><button id="aba-reset" type="button">Theo WLR hi?n t?i</button></div><p id="aba-status" role="status" aria-live="polite">�ang ch? d? li?u M15 �? ��ng�</p><div class="aba-grid"><div><small>WLR cu?i �? ��ng t?i m?c d? b�o</small><strong id="aba-reference">�</strong><span id="aba-origin"></span></div><div><small>Trung v? A k? ti?p � P50</small><strong id="aba-target">�</strong><span id="aba-range"></span></div><div><small>Thu?c A�B�A � t?n su?t m?u �? x�c nh?n</small><strong id="aba-membership">�</strong><span id="aba-count"></span></div></div><p id="aba-progress"></p><p id="aba-source"></p><section class="aba-comparison" aria-labelledby="aba-compare-title"><h3 id="aba-compare-title">Trung v? A k? ti?p cao hay th?p h�n WLR cu?i?</h3><p>M?c so s�nh l� �i?m WLR t?i n?n cu?i �? ��ng l�c ph�t d? b�o, ��?c gi? nguy�n qua A?B?A; kh�ng d�ng �i?m k?t th�c A c?n ch�a bi?t. N?n h�?ng �o�n ph�a th�?ng g?p h�n t? l?ch s? c�ng m�u/phi�n, m?t m?u �? �i?u ki?n m?i ng�y.</p><div class="aba-table-scroll" tabindex="0" role="region" aria-label="So s�nh h�?ng v� gi� d? b�o v?i n?n"><table><caption>M?u �ang theo d?i</caption><thead><tr><th scope="col">Ch? s?</th><th scope="col">A�B�A</th><th scope="col">N?n c�ng m�u / phi�n</th></tr></thead><tbody id="aba-live-table"><tr><td colspan="3">Ch? d? li?u d? b�o�</td></tr></tbody></table></div></section><section class="aba-comparison" aria-labelledby="aba-direction-title"><h3 id="aba-direction-title">T? l? �o�n ��ng h�?ng � ki?m �?nh ngo�i m?u</h3><p id="aba-direction-status" class="aba-direction-status" role="status">�ang t?i ki?m �?nh h�?ng�</p><p id="aba-direction-sample"></p><p id="aba-v2-protocol"></p><p id="aba-v2-calibration"></p><p id="aba-v2-gate"></p><p id="aba-v2-interval"></p><div class="aba-table-scroll" tabindex="0" role="region" aria-label="�?i chi?u t? l? d? b�o v?i th?c t?"><table><caption>Ki?m tra t? l? cao h�n WLR � theo nh�m d? b�o</caption><thead><tr><th>Nh�m d? b�o</th><th>Trung b?nh d? b�o</th><th>Th?c t? cao h�n</th><th>S? m?c / ng�y</th></tr></thead><tbody id="aba-reliability-table"></tbody></table></div><div class="aba-table-scroll" tabindex="0" role="region" aria-label="Th?ng k� d? �o�n h�?ng ngo�i m?u"><table><caption id="aba-direction-caption">Ch?m c�ng m?c, kh�ng t�nh m?u ch�a c� trung v? cu?i l� sai</caption><thead><tr><th scope="col">Th�?c �o</th><th scope="col">M� h?nh</th><th scope="col">N?n</th><th scope="col">Ch�nh l?ch</th><th scope="col">Ki?m �?nh</th></tr></thead><tbody id="aba-direction-table"></tbody></table></div><p id="aba-direction-limit">T? l? ��ng h�?ng c�ng cao c�ng t?t; Brier c�ng th?p c�ng t?t. Ki?m �?nh ch�nh l?ch d�ng block bootstrap theo ng�y, 97,5%, c?n ?30 ng�y v� c? kho?ng c?i thi?n l?n h�n 0. V2 ch?n theo �? ch�nh x�c h�?ng trong giai �o?n ri�ng; ph�p hi?u ch?nh v� WAIT ��?c ch?n tr�?c test. D? li?u test c? �? ��?c xem n�n k?t qu? v?n mang t�nh th�m d?; forward ��?c ghi ri�ng. T? l? h�?ng d�ng ph�p hi?u ch?nh �? ch?n tr�n validation, ho?c gi? t? l? g?c khi ph�p hi?u ch?nh ch�a t?t h�n; ch�a b?o �?m �? tin c?y ri�ng cho t?ng m?u.</p><p>P10�P90 �? c� th?ng k� �? ph? h?i c?u ? tr�n; ch�a ��?c hi?u ch?nh �? b?o �?m �? ph? 80% trong t��ng lai. M?u A�B�A �ang d? v?n ��?c theo d?i, nh�ng ch? ch?m h�?ng khi trung v? A k? ti?p �? ho�n t?t.</p></section><details><summary>K?t qu? ki?m tra v� c�ch hi?u</summary><p id="aba-validation">�ang t?i k?t qu? ki?m tra�</p><p>B?t �?u t? n?n PRE s? 0 (04:00�04:15 New York), sau khi n?n ��ng. C?a s? 8/16 n?n d�ng l?ch s? li�n t?c tr�?c PRE �? kh?i t?o; kh�ng c?n ch? 16 n?n PRE. Thi?u l?ch s? th? b�o ch?.</p><p>A l� WLR �ang theo d?i; B l� ��ng m?t �o?n kh�c m�u. V�ng ��?c t�nh nh� xanh v� �?. Trung v? l?y tr�n ��?ng WLR, kh�c gi� ��ng n?n. Nh?n d?ng m?u v� x�c �?nh trung v? cu?i �o?n l� hai vi?c ri�ng: A k? ti?p �ang m? v?n thu?c m?u, nh�ng trung v? cu?i ch�a ��?c bi?t.</p><p>V�ng P10�P90 v� ��?ng trung v? d? ki?n ��?c v? g?n b?ng m?t ph?n ba b? ngang ph? CVD v� neo ��ng t�m ph?, cho ph�p ch?ng l�n CVD, theo tr?c gi� SPY. P10�P90 l� ph�n v? l?ch s? c� �i?u ki?n, kh�ng ph?i kho?ng ch?c ch?n c?a gi�. Th?i gian ho�n t?t thay �?i; v�ng ngang kh�ng �?i di?n 8 n?n t��ng lai. T?n su?t thu?c m?u ch? t�nh tr�n c�c m?u l?ch s? �? x�c nh?n; m?u ch�a x�c nh?n ��?c b�o ri�ng. Kh�ng ph?i t? l? th?ng ho?c x�c su?t �? hi?u ch?nh.</p><p>Gi� k? v?ng, P10�P90 v� m?c WLR cu?i �? ��ng ��?c gi? nguy�n trong c�ng l�?t A?B?A. M�u n?n �ang ch?y kh�ng �?i m?c n�y. Nh?n A ? �% / n?n �% so c�ng kh? n�ng trung v? A k? ti?p cao h�n WLR m?c, c� �i?u ki?n m?u ho�n t?t; ��y l� t?n su?t l?ch s? c� l�m tr�n, kh�ng ph?i t? l? nh?n d?ng A�B�A ho?c x�c su?t �? hi?u ch?nh. V�ng v? d�ng tr?c ti?p thang gi� c?a ��?ng WLR; ch? �?i l�?t khi m?u k?t th�c/b? ph� b?ng n?n �? ��ng ho?c b?m �Theo WLR hi?n t?i�. Khi �?ng b? ng?n, gi? khung c? k�m tr?ng th�i; d? li?u m?t m?i ho?c �?i symbol/timeframe th? ?n.</p><a href="data/wlr-aba/report.json" target="_blank" rel="noopener">B�o c�o A�B�A</a> � <a href="WLR-ABA.md" target="_blank" rel="noopener">Ph��ng ph�p</a></details><div id="aba-history" aria-live="polite"></div>`;host.closest('.chart-card').after(panel);
 const $=id=>panel.querySelector('#'+id),canvas=document.createElement('canvas');canvas.id='wlr-aba-overlay';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','V�ng trung v? d? ki?n c?a WLR c�ng m�u k? ti?p');host.append(canvas);const badge=document.createElement('div');badge.id='wlr-aba-readout';badge.setAttribute('aria-live','polite');host.append(badge);
 let activeSymbol=getContext().symbol;
 let worker=null,active=null,request=0,pending='',frame=0,resetNext=false,restored=null,syncStartedAt=null,geometryMissingAt=null,lastPaintKey='';
 const buffer=document.createElement('canvas');
 try{restored=JSON.parse(sessionStorage.getItem('netflow:wlr-aba:pre0:v2:'+activeSymbol)??'null');}catch{}
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(draw);});};
 function wait(message,retain=false){
  if(retain&&active&&syncStartedAt===null)syncStartedAt=performance.now();
  if(retain&&canRetainAba(active,getContext(),syncStartedAt===null?Infinity:performance.now()-syncStartedAt)){
   canvas.dataset.sync='updating';$('aba-status').textContent=message+' � gi? d? b�o WLR �? ch?t, �ang �?ng b?';badge.textContent='A�B�A � �ANG �?NG B? � WLR m?c '+fmt(active.track.q.currentWlr);schedule();return;
  }
  tableRows('aba-live-table',[['M?u hi?n t?i','WAIT','WAIT']]);active=null;syncStartedAt=null;canvas.dataset.sync='waiting';$('aba-status').textContent=message;badge.textContent='A�B�A � '+message;$('aba-reference').textContent=$('aba-target').textContent=$('aba-membership').textContent='�';$('aba-origin').textContent=$('aba-range').textContent=$('aba-count').textContent=$('aba-progress').textContent='';schedule();
 }

 function tableRows(id,rows){const body=$(id);body.replaceChildren();for(const cells of rows){const tr=document.createElement('tr');cells.forEach((text,i)=>{const td=document.createElement(i?'td':'th');if(!i)td.scope='row';td.textContent=text;tr.append(td);});body.append(tr);}}
 const gateReason=reason=>({NEAR_BASE:'g?n n?n',BAND_CROSSES_WLR:'d?i c?t WLR',CALIBRATION_DISAGREES:'t? l? ch�a �?ng thu?n P50',WAIT_HISTORY:'thi?u m?u',WAIT_GATE_VALIDATION:'ch? ki?m �?nh WAIT',MODEL_CHANGED:'b?m Theo WLR hi?n t?i �? d�ng V2',BEFORE_POLICY_WINDOW:'ch�a t?i giai �o?n V2'}[reason]??'ch? d? li?u');
 const signed=(x,digits=2)=>Number.isFinite(x)?(x>=0?'+':'')+x.toFixed(digits):'�',sideText=s=>s===1?'CAO H�N':s===-1?'TH?P H�N':'WAIT � h?a / ch�a �? m?u';
 function liveTable(result){
  const t=result.track,p=t.prediction,b=t.baseline,d=t.direction,priceText=v=>v?.ready?fmt(v.value)+' � '+change(100*(v.value/t.q.currentWlr-1)):'WAIT',band=v=>v?.ready?fmt(v.low)+' � '+fmt(v.high):'WAIT';
  tableRows('aba-live-table',[
   ['M?c WLR cu?i �? ��ng',fmt(t.q.currentWlr),fmt(t.q.currentWlr)],
   ['H�?ng trung v? A k? ti?p',t.signal?.emit===false?'WAIT � '+gateReason(t.signal.reason):d?.ready?sideText(d.side):'WAIT',d?.baseline.ready?sideText(d.baseline.side):'WAIT'],
   ['T?n su?t cao h�n / th?p h�n � c� �i?u ki?n',d?.ready?pct(d.pAbove)+' / '+pct(d.pBelow):'WAIT',d?.baseline.ready?pct(d.baseline.pAbove)+' / '+pct(d.baseline.pBelow):'WAIT'],
   ['Trung v? A k? ti?p',priceText(p),priceText(b)],
   ['V�ng P10�P90',band(p),band(b)],
   ['Ng�y l?ch s? c� h�?ng kh�c m?c',d?String(d.n):'�',d?String(d.baseline.n):'�'],
   ['Thu?c m?u A�B�A � kh�c t? l? ��ng h�?ng',p.memberReady?pct(p.pMembership):'WAIT',b?.memberReady?pct(b.pMembership):'WAIT']
  ]);
 }
 function directionTable(report){
  const v=report.v2,status=$('aba-direction-status');
  if(!v?.test){status.textContent='WAIT � �ang t�nh A�B�A V2';return;}
  const s=v.test,raw=s.raw,filtered=s.filtered,model=v.selectedModel;
  status.dataset.state=filtered.status;status.textContent=v.status!=='READY'?'WAIT � '+v.status:filtered.status==='PROMISING_REQUIRES_FORWARD_TEST'?'V2 � C� T�N HI?U H?I C?U � ch�a forward test':'V2 � CH�A CH?NG MINH V�?T N?N';
  $('aba-direction-caption').textContent=model+' � ch?n theo ��ng h�?ng, hi?u ch?nh c� �?i ch?ng, WAIT ch?n b?ng validation';
  $('aba-direction-sample').textContent=filtered.hits+'/'+filtered.n+' l?n ��ng sau WAIT; '+filtered.days+' ng�y. Tr�?c WAIT: '+raw.hits+'/'+raw.n+'. Ph�t '+s.emitted+'/'+s.queries+' m?c d? b�o ('+pct(s.signalCoverage)+'); '+filtered.unfinished+' m?c �? ph�t ch�a c� trung v? cu?i, kh�ng ch?m sai. Kho '+date(report.sourceAsOf)+'.';
  $('aba-v2-protocol').textContent='Ch?n m� h?nh: '+v.spec.selectionStart+' ? '+v.spec.calibrationStart+'; fit hi?u ch?nh: ? '+v.spec.gateStart+'; ch?n ph�p hi?u ch?nh v� WAIT: ? '+v.spec.testStart+'. K?t qu? test c? l� h?i c?u �? ��?c xem. Forward t? '+v.spec.forwardStart+': '+v.forward.filtered.n+' m?c ch?m / '+v.forward.filtered.days+' ng�y.';
  const c=v.calibration,used=c.model.validation.usedFit,baseUsed=c.baseline.validation.usedFit;
  $('aba-v2-calibration').textContent='Hi?u ch?nh m� h?nh: '+(used?'d�ng sigmoid �? fit':c.model.fittedCandidate.status!=='READY'?'ch�a �? m?u, gi? t? l? g?c':'gi? t? l? g?c; sigmoid ch�a th?ng validation')+'; n?n: '+(baseUsed?'d�ng sigmoid':'gi? t? l? g?c')+'. Fit '+c.model.n+' m?c / '+c.model.days+' ng�y; ch?n tr�n '+c.model.validation.n+' m?c / '+c.model.validation.days+' ng�y kh�c. ��y v?n l� t? l? th�m d?.';
  $('aba-v2-gate').textContent=v.gate?'WAIT khi t? l? kh�ng �?ng thu?n P50 ho?c kh�ng v�?t n?n h�n '+(100*v.gate.gap).toFixed(0)+' �i?m %. '+(v.gate.band==='whole'?'Y�u c?u c? P10�P90 ? c�ng ph�a WLR.':'B? l?c b?t bu?c c? d?i m?t ph�a ch�a �? m?u validation n�n ch�a d�ng l�m m?c �?nh.'):'Ch�a ch?n ��?c ng�?ng WAIT �? m?u.';
  const iv=s.intervals;$('aba-v2-interval').textContent='�? ph? P10�P90: '+pct(iv.coverage)+' c�n b?ng theo ng�y; '+iv.hits+'/'+iv.n+' trung v? th?c t? trong d?i ('+pct(iv.queryCoverage)+' theo s? m?c). D?i ch�a ��?c hi?u ch?nh �? b?o �?m 80%.';
  tableRows('aba-reliability-table',s.reliability.model.map(b=>[(100*b.from).toFixed(0)+'�'+(100*b.to).toFixed(0)+'%',pct(b.forecast),pct(b.actual),b.n+' / '+b.days]));
  const cmp=filtered.comparison,interval=c=>Number.isFinite(c.low)?signed(100*c.low)+' � '+signed(100*c.high)+' �i?m %':'Ch�a �? m?u';
  tableRows('aba-direction-table',[
   ['��ng h�?ng � theo s? m?c',pct(filtered.accuracy),pct(filtered.baselineAccuracy),signed(100*(filtered.accuracy-filtered.baselineAccuracy))+' �i?m %',filtered.hits+'/'+filtered.n+' so '+filtered.baselineHits+'/'+filtered.n],
   ['��ng h�?ng � c�n b?ng theo ng�y',pct(filtered.dayAccuracy),pct(filtered.baselineDayAccuracy),signed(100*cmp.gain)+' �i?m %','Kho?ng 97,5%: '+interval(cmp)],
   ['Tr�?c / sau WAIT � theo s? m?c',pct(raw.accuracy),pct(filtered.accuracy),'Kh�c t?p m?c','Gi? '+filtered.n+'/'+raw.n+' m?c �? ch?m'],
   ['Tr�?c / sau WAIT � c�n b?ng ng�y',pct(raw.dayAccuracy),pct(filtered.dayAccuracy),'Kh�c t?p m?c','Kh�ng coi thay �?i t? l? l� b?ng ch?ng t? �?ng'],
   ['Brier � sau WAIT',Number.isFinite(filtered.brier)?filtered.brier.toFixed(4):'�',Number.isFinite(filtered.baselineBrier)?filtered.baselineBrier.toFixed(4):'�',signed(filtered.probabilityComparison.gain,4),'C�ng th?p c�ng t?t']
  ]);
 }
 function clearDrawing(status){
  if(lastPaintKey){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);lastPaintKey='';}
  canvas.dataset.status=status;canvas.setAttribute('aria-label','A�B�A � '+status);
 }
 function draw(){
  frame=0;const w=host.clientWidth,h=host.clientHeight,dpr=window.devicePixelRatio||1;
  if(!toggle.checked||!active?.track.prediction.ready||active.track.signal?.emit===false){clearDrawing(!toggle.checked?'HIDDEN':active?.track.signal?.emit===false?'WAIT_FILTER':'WAIT');return;}
  const track=active.track,p=track.prediction,geometry=abaOverlayGeometry(chart.timeScale(),wlr,paneBounds(0),getCvdBounds(),track);
  // Chart setData/resize can temporarily have no coordinates. Keep the last
  // completed bitmap until the next scheduled chart paint, never publish a blank.
  if(!geometry){geometryMissingAt??=performance.now();if(performance.now()-geometryMissingAt>20000)clearDrawing('WAIT_COORDINATES');return;}geometryMissingAt=null;
  const {left,right,width:regionWidth,y,low,high,top,height}=geometry;
  if(right<=0||left>=chart.timeScale().width()){clearDrawing('OFFSCREEN');return;}
  const key=abaPaintKey(geometry,w,h,dpr,track);
  if(key===lastPaintKey){canvas.dataset.status='VISIBLE';return;}
  const bitmapWidth=Math.round(w*dpr),bitmapHeight=Math.round(h*dpr);
  if(buffer.width!==bitmapWidth||buffer.height!==bitmapHeight){buffer.width=bitmapWidth;buffer.height=bitmapHeight;}
  const ctx=buffer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const color=track.q.color>0?'26,224,163':track.q.color<0?'255,77,112':'246,200,95';
  ctx.save();ctx.translate(0,top);ctx.beginPath();ctx.rect(left,0,regionWidth,height);ctx.clip();ctx.fillStyle=`rgba(${color},.14)`;ctx.fillRect(left,Math.min(high,low),regionWidth,Math.abs(low-high));ctx.strokeStyle=`rgb(${color})`;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([]);
  ctx.restore();
  // Only resize the visible canvas when its dimensions change. Swap the fully
  // rendered back buffer in the same task so no empty intermediate frame shows.
  if(canvas.width!==bitmapWidth||canvas.height!==bitmapHeight){canvas.width=bitmapWidth;canvas.height=bitmapHeight;}
  const front=canvas.getContext('2d');front.setTransform(1,0,0,1,0,0);front.clearRect(0,0,bitmapWidth,bitmapHeight);front.drawImage(buffer,0,0);
  lastPaintKey=key;canvas.dataset.status='VISIBLE';canvas.dataset.left=String(left);canvas.dataset.right=String(right);canvas.dataset.widthRatio='1/3';canvas.dataset.alignment='cvd-center';canvas.setAttribute('aria-label',`${abaLabel(track).first} ${abaLabel(track).second}; trung v? WLR d? ki?n ${fmt(p.value)}, P10 ${fmt(p.low)}, P90 ${fmt(p.high)}, m?c WLR ${fmt(track.q.currentWlr)}; r?ng m?t ph?n ba, neo t�m ph? CVD`);canvas.dataset.referenceWlr=String(track.q.currentWlr);canvas.dataset.expectedWlr=String(p.value);canvas.dataset.p10Wlr=String(p.low);canvas.dataset.p90Wlr=String(p.high);
 }
 function show(result){
  if(result.status!=='READY'){wait(result.message);return;}active=freezeAbaResult(active,result);result=active;syncStartedAt=null;canvas.dataset.sync='ready';const {track:t,progress:g}=result,p=t.prediction,name=COLOR_NAMES[t.q.color],other=COLOR_NAMES[g.betweenColor];canvas.dataset.status=p.ready?'READY':'WAIT_SAMPLES';canvas.dataset.color=String(t.q.color);liveTable(result);
  const stage=g.stage==='NEXT_A_FORMING'?`�? THU?C A�B�A � A ${name} k? ti?p �ang m?`:g.stage==='B_FORMING'?`A ${name} ? B ${other} � ch? A ${name} k? ti?p`:`A ${name} �ang h?nh th�nh � ch? ��ng m?t B kh�c m�u`;
  $('aba-status').textContent=(t.signal?.emit===false?'WAIT � '+gateReason(t.signal.reason)+' � ':'')+stage;$('aba-reference').textContent=fmt(t.q.currentWlr);$('aba-origin').textContent=`A ${name} � m?c m?u ${date(t.q.issuedAt)} � ${t.q.knownBars} n?n �? bi?t`;
  $('aba-target').textContent=t.signal?.emit===false?'WAIT � '+gateReason(t.signal.reason):p.ready?`${fmt(p.value)} � ${change(result.changePct)}`:'WAIT � ch�a �? m?u';$('aba-range').textContent=p.ready?`P10�P90: ${fmt(p.low)} � ${fmt(p.high)}`:`C?n 12 ng�y c� trung v? ho�n t?t; hi?n c� ${p.n}`;
  $('aba-membership').textContent=p.memberReady?pct(p.pMembership):'WAIT � �t m?u x�c nh?n';$('aba-count').textContent=`${p.memberN} ng�y �? x�c nh?n � ${p.unresolvedN} ch�a x�c nh?n trong nh�m ${p.nEvents} ng�y`;
  $('aba-progress').textContent=g.stage==='NEXT_A_FORMING'?`�? quan s�t ${g.observedBars} n?n c?a A k? ti?p; trung v? t?m ${fmt(g.observedMedian)}. Ch�a d�ng l�m trung v? th?c t? cu?i c�ng.`:`${p.predictedMembership===true?'D? �o�n nghi�ng v? A�B�A':p.predictedMembership===false?'D? �o�n ch�a nghi�ng v? A�B�A':'Ch�a �? d? li?u �? k?t lu?n thu?c m?u'}. M?u �ang d? v?n ��?c theo d?i; ch�a x�c nh?n kh�ng �?ng ngh?a sai.`;
  $('aba-source').textContent=`${t.model} � SPY M15 � SPY V + Composite � kho ${date(t.sourceAsOf)} � t�nh l�c ${date(t.computedAt)}. D? b�o ��?c gi? nguy�n �? theo d?i A?B?A.`;
  const probabilityLabel=abaLabel(t);badge.textContent=`${probabilityLabel.first} ${probabilityLabel.second} � ${name} � ${g.stage==='NEXT_A_FORMING'?'A k? ti?p �ang m?':g.stage==='B_FORMING'?'�ang ? B':'ch? B'}`;
  $('aba-history').replaceChildren();for(const r of [...(result.state.history??[])].reverse().slice(0,3)){const line=document.createElement('p');line.textContent=`${date(r.computedAt)} � ${COLOR_NAMES[r.color]} � ${r.stage==='COMPLETE_ABA'?`�? ho�n t?t � d? ki?n ${fmt(r.value)}, th?c t? ${fmt(r.actualMedian)}`:r.stage==='PATTERN_BROKEN'?'�? x�c nh?n kh�c m?u A�B�A':'H?t phi�n: ch�a x�c nh?n, kh�ng g�n sai'}`;$('aba-history').append(line);}schedule();
 }
 function update(){
  canvas.style.display=badge.style.display=toggle.checked?'block':'none';panel.dataset.enabled=String(toggle.checked);if(!toggle.checked){++request;pending='';active=null;tableRows('aba-live-table',[['M?u hi?n t?i','�? t?t','�? t?t']]);$('aba-status').textContent='�? t?t v�ng d? b�o A�B�A';schedule();return;}
  const c=getContext();if(c.symbol!==activeSymbol){worker?.terminate();worker=null;++request;active=null;pending='';restored=null;resetNext=true;activeSymbol=c.symbol;lastPaintKey='';}
  let scope=panel.querySelector('[data-spy-scope]');if(!scope){scope=document.createElement('p');scope.dataset.spyScope='true';panel.querySelector('.aba-head').after(scope);}scope.hidden=c.symbol!=='SPY';scope.textContent='SPY ETF: d? b�o chuy?n t? kho SPYUSDT, ch�a ki?m �?nh ri�ng SPY. B?ng t? l? h?i c?u b�n d�?i ch? �p d?ng cho SPYUSDT.';
  const last=c.features?.at(-1);if(!['SPYUSDT','SPY'].includes(c.symbol)||c.interval!=='15m'){++request;pending='';wait('Ch? h? tr? SPY M15');return;}
  if(!c.live){++request;pending='';wait('WAIT � ch? d? li?u SPY M15 �? ��ng c?n m?i');return;}
  if(!last||last.t!==c.expectedTime){++request;pending='';wait('WAIT � d? li?u WLR �ang �?ng b?',true);return;}
  const key=last.t+'|'+resetNext;if(key===pending){schedule();return;}pending=key;const id=++request;
  if(!worker){worker=new Worker(new URL('./wlr-aba-worker.mjs?v=20261021-spy1',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.id!==request||!toggle.checked)return;if(data.error){pending='';wait(data.error,true);return;}const context=getContext();if(!context.live){pending='';wait('WAIT � d? li?u SPY kh�ng c?n m?i');return;}if(context.expectedTime!==context.features?.at(-1)?.t){pending='';wait('WAIT � d? li?u WLR �ang �?ng b?',true);return;}show(data.result);try{sessionStorage.setItem('netflow:wlr-aba:pre0:v2:'+activeSymbol,JSON.stringify(data.result.state));}catch{}};worker.onerror=()=>{pending='';wait('WAIT � l?i x? l? A�B�A',true);worker?.terminate();worker=null;};}
  worker.postMessage({id,symbol:c.symbol,rows:c.features,now:c.now,reset:resetNext,restore:restored});resetNext=false;restored=null;
 }
 $('aba-reset').addEventListener('click',()=>{resetNext=true;pending='';update();});toggle.addEventListener('change',()=>{pending='';update();});chart.timeScale().subscribeVisibleLogicalRangeChange(schedule);window.addEventListener('resize',schedule);new ResizeObserver(schedule).observe(host);for(const e of ['wheel','pointermove','pointerup'])host.addEventListener(e,schedule,{passive:true});
 fetch('data/wlr-aba/report.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>{directionTable(r);const selected=r.v2?.selectedModel??r.selectedTrial,test=r.test[selected];$('aba-validation').textContent=`Ki?m tra t?i m?c �?u �o?n: ${test.days} ng�y / ${test.queries} m?c; ${test.targetN} trung v? �? ho�n t?t. ${selected}: MAE trung v? ${test.maePct.toFixed(4)}%; gi? trung v? hi?n t?i ${r.test.CURRENT_MEDIAN.maePct.toFixed(4)}%. Ch�a x�c l?p l?i th? d? b�o gi�; k?t qu? th�m d? tr�n kho �? nghi�n c?u. Kho ${date(r.sourceAsOf)}.`;}).catch(()=>{$('aba-direction-status').textContent='WAIT � ch�a t?i ��?c b�o c�o ki?m �?nh h�?ng';$('aba-validation').textContent='Ch�a t?i ��?c b�o c�o ki?m tra A�B�A.';});
 return {update,schedule,toggle};
}



