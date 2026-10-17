const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixtureRoot=process.env.NETFLOW_FIXTURES;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];let failure=null;
  if(!process.env.NETFLOW_LIVE)await page.addInitScript(()=>{class MockWebSocket{static CONNECTING=0;static OPEN=1;constructor(){this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({});},0);}close(){this.readyState=3;}}window.WebSocket=MockWebSocket;});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('response',r=>{if(r.url().includes('fapi.binance.com'))requests.push([r.status(),new URL(r.url()).pathname]);});
  await page.route('http://netflow.test/**',async route=>{
   const u=new URL(route.request().url()),file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1),target=path.resolve(root,file);
   if(u.pathname==='/data/binance/m15/manifest.json')return route.fulfill({json:{interval:'15m',months:[],lastTime:Date.now(),updatedAt:new Date().toISOString()}});
   if(!target.startsWith(root+path.sep)||!fs.existsSync(target))return route.fulfill({status:404,body:''});
   await route.fulfill({contentType:file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(target)});
  });
  if(!process.env.NETFLOW_LIVE)await page.route('https://fapi.binance.com/**',async route=>{
   const u=new URL(route.request().url());
   if(failure==='network')return route.abort('failed');if(failure)return route.fulfill({status:failure,body:'blocked'});
   let json;
   if(u.pathname.endsWith('exchangeInfo'))json={symbols:read(path.join(root,'symbol-validation.json'))};
   else if(u.pathname.endsWith('/time'))json=read(fixtureRoot?path.join(fixtureRoot,'time.json'):path.join(root,'../netflow-ml/tests/fixtures/time.json'));
   else{
    const symbol=u.searchParams.get('symbol'),interval=u.searchParams.get('interval');
    if(!fixtureRoot&&interval!=='15m')return route.fulfill({status:400,body:'No recorded fixture for this interval'});
    json=read(fixtureRoot?path.join(fixtureRoot,`${symbol}-${interval}.json`):path.join(root,`../netflow-ml/tests/fixtures/${symbol}.json`)).filter(x=>+x[0]>=+u.searchParams.get('startTime')&&+x[0]<=+u.searchParams.get('endTime')).slice(0,+u.searchParams.get('limit'));
   }
   return route.fulfill({json});
  });
  await page.goto('http://netflow.test/');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'),{},{timeout:120000});
  assert.equal(await page.locator('main > .chart-options').count(),1);assert.equal(await page.locator('.chart-card .toggles').count(),0);assert.equal(await page.locator('.chart-options + .chart-card').count(),1);
  assert.equal(await page.locator('.chart-head h2').count(),0);
  const priceAxisCanvases=page.locator('#chart table tr>td:last-child canvas');assert(await priceAxisCanvases.count()>=4);assert.equal(await priceAxisCanvases.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).touchAction==='none')),true);
  assert.equal(await page.locator('#rev63-geometry-body tr').count(),4);assert.match(await page.locator('.rev63-geometry-panel').innerText(),/Giữ hỗ trợ/);assert.match(await page.locator('.rev63-geometry-panel').innerText(),/Phá thật/);assert.match(await page.locator('#rev63-state').innerText(),/GEO/);
  assert.match(await page.locator('#stat-score').textContent(),/\d+\/100/);assert((await page.locator('.badge').innerText()).includes('chưa train'));
  assert.match(await page.locator('#stat-group').textContent(),/S[+−0]/);assert.equal(await page.locator('#status').isVisible(),false);assert.equal(await page.locator('.stats-table').count(),0);
  assert.equal(await page.locator('.calendar-panel').isVisible(),true);assert.match(await page.locator('.calendar-panel').innerText(),/Forex Factory/);assert(await page.locator('.calendar-row').count()>0);assert.match(await page.locator('#calendar-status').innerText(),/tin · \d+ đã có thực tế/);assert.equal(await page.locator('.calendar-actual').count(),await page.locator('.calendar-row').count());
  assert.equal(await page.locator('#calendar-impact').inputValue(),'important');assert.equal(await page.locator('#calendar-currency').inputValue(),'USD');assert.equal(await page.locator('.calendar-currency').evaluateAll(nodes=>nodes.every(node=>node.textContent==='USD')),true);
  const smoothList=page.locator('#calendar-list'),firstCalendarRow=page.locator('.calendar-row').first();await firstCalendarRow.evaluate(node=>node.dataset.reuseProbe='kept');await smoothList.evaluate(node=>{node.style.scrollBehavior='auto';node.scrollTop=36;});await page.locator('#calendar-refresh').click();await page.waitForFunction(()=>!document.querySelector('#calendar-refresh').disabled);assert.equal(await page.locator('.calendar-row').first().getAttribute('data-reuse-probe'),'kept');assert(Math.abs(await smoothList.evaluate(node=>node.scrollTop)-36)<3);
  await page.locator('#calendar-impact').selectOption('high');assert(await page.locator('.calendar-row').count()>0);assert.equal(await page.locator('.calendar-impact.medium').count(),0);await page.locator('#calendar-impact').selectOption('important');
  await page.locator('#calendar-currency').selectOption('USD');assert(await page.locator('.calendar-row').count()>0);assert.equal(await page.locator('.calendar-currency').evaluateAll(nodes=>nodes.every(node=>node.textContent==='USD')),true);await page.locator('#calendar-currency').selectOption('all');
  assert.equal(await page.locator('#stat-trade-level').count(),0);assert.equal(await page.locator('#trade-cost').count(),0);assert.equal(await page.locator('#stat-history').count(),0);assert.match(await page.locator('#rev63-label').innerText(),/(UP|DOWN|WAIT)/);assert((await page.locator('#rev63-components').innerText()).includes('Trend'));assert((await page.locator('#rev63-calibration').innerText()).includes('50–60%'));
  assert.equal(await page.locator('#wlr-horizon').inputValue(),'3');assert.equal(await page.locator('#wlr-stats-body tr').count(),8);assert((await page.locator('#wlr-stats-context').innerText()).includes('horizon 3 nến'));await page.locator('#wlr-horizon').selectOption('6');assert((await page.locator('#wlr-stats-context').innerText()).includes('horizon 6 nến'));await page.locator('#wlr-horizon').selectOption('3');
  assert.equal(await page.locator('.rev63-color-panel:not(.rev63-geometry-panel) h2').innerText(),'Thống kê REV6-3 theo 4 chế độ màu');assert.equal(await page.locator('#rev63-color-body tr').count(),4);assert.match(await page.locator('#rev63-color-body').innerText(),/Đồng thuận tăng/);assert.match(await page.locator('#rev63-color-body').innerText(),/Xám → đồng thuận/);
  const strengthReadout=await page.locator('#strength-readout').innerText();assert.match(strengthReadout,/SPY -?\d/);assert.match(strengthReadout,/QQQ -?\d/);assert.match(await page.locator('#strength-composite').innerText(),/^-?\d/);
  assert.equal((await page.locator('label:has(#spy-volume-strength)').innerText()).trim(),'SPY V');
  assert.match(await page.locator('#candle-countdown').innerText(),/^\d{2}:\d{2}$/);
  const countdownLayout=await page.locator('#candle-countdown').evaluate(node=>{const rect=node.getBoundingClientRect(),chartRect=node.parentElement.getBoundingClientRect(),axisCell=document.querySelector('#chart table tr>td:last-child'),axisRect=axisCell?.getBoundingClientRect();return {right:chartRect.right-rect.right,rightStyle:node.style.right,width:rect.width,axisWidth:axisRect?.width??NaN,fontSize:parseFloat(getComputedStyle(node).fontSize)};});assert.equal(countdownLayout.rightStyle,'2ch');assert(countdownLayout.right>10&&countdownLayout.right<20);assert(countdownLayout.width<countdownLayout.axisWidth);assert.equal(countdownLayout.fontSize,12);
  assert.equal(await page.locator('#geometry-impact').count(),0);assert.equal(await page.locator('#impact-status').count(),0);
  const strengthLabels=await page.locator('#strength-readout').evaluate(node=>{const top=+node.dataset.paneTop,bottom=+node.dataset.paneBottom,zeroY=+node.dataset.zeroY,host=node.getBoundingClientRect(),boxes=[...node.children].map(child=>{const rect=child.getBoundingClientRect();return {top:child.offsetTop,bottom:child.offsetTop+child.offsetHeight,right:rect.right};}).sort((a,b)=>a.top-b.top);return {top,bottom,zeroY,right:host.right,boxes};});assert(strengthLabels.boxes.every(box=>box.top>=strengthLabels.top&&box.bottom<=strengthLabels.bottom&&Math.abs(box.right-strengthLabels.right)<2));for(let i=1;i<strengthLabels.boxes.length;i++)assert(strengthLabels.boxes[i].top-strengthLabels.boxes[i-1].bottom>=3);assert(Math.abs((strengthLabels.boxes[0].top+strengthLabels.boxes.at(-1).bottom)/2-strengthLabels.zeroY)<2);
  assert.equal(await page.locator('#trend-strength').count(),0);
  const forecastBox=await page.locator('#geometry-readout').boundingBox(),chartBox=await page.locator('#chart').boundingBox();
  assert(forecastBox.x+forecastBox.width<=chartBox.x+chartBox.width);assert(forecastBox.y-chartBox.y>chartBox.height*.35);assert(forecastBox.y+forecastBox.height<chartBox.y+chartBox.height*.65);
  const pivotReadout=page.locator('#pivot-zone-readout');assert.equal(await pivotReadout.isVisible(),false);assert.equal(await pivotReadout.getAttribute('aria-hidden'),'true');
  const pivotFlow=page.locator('#pivot-flow-overlay');assert.equal(await pivotFlow.count(),1);assert.match(await pivotFlow.getAttribute('aria-label'),/Composite NF/);assert(['hidden','visible'].includes(await pivotFlow.getAttribute('data-status')));if(await pivotFlow.getAttribute('data-status')==='visible'){assert.match(await pivotFlow.getAttribute('aria-label'),/Biến động 5 nến: (THẤP|TRUNG BÌNH|CAO) \d+%/);assert.match(await pivotFlow.getAttribute('aria-label'),/Histogram 5 nến/);assert.match(await pivotFlow.getAttribute('aria-label'),/EWMA half-life 32 nến/);assert.equal(+(await pivotFlow.getAttribute('data-bins')),5);assert(['low','medium','high'].includes(await pivotFlow.getAttribute('data-volatility-key')));assert(Number.isFinite(+(await pivotFlow.getAttribute('data-volatility-score'))));assert(['between-zones','pane-center'].includes(await pivotFlow.getAttribute('data-placement')));}
  if(await pivotFlow.getAttribute('data-status')==='visible'){const width=await pivotFlow.evaluate(node=>({bar:+node.dataset.barWidth,spacing:+node.dataset.barSpacing}));assert(Math.abs(width.bar-2*width.spacing)<.01);}
  assert.equal(await page.locator('#live-indicator').innerText(),'● LIVE');assert(await page.locator('#live-indicator').evaluate(el=>el.classList.contains('live')));assert(await page.locator('#live-indicator').evaluate(el=>el.parentElement.classList.contains('chart-actions')));
  assert.equal(await page.locator('#days').inputValue(),'30');
  assert.equal((await page.locator('label:has(#alignment)').innerText()).trim(),'SPY V Δ nến');assert.equal(await page.locator('label:has(#alignment)').getAttribute('data-pane'),'strength-spy-v');assert.match(await page.locator('label:has(#alignment)').getAttribute('title'),/Bốn màu/);
  assert.deepEqual(await page.locator('#chart').evaluate(el=>({pane:el.dataset.spyVolumeDeltaPane,scale:el.dataset.spyVolumeDeltaScale,deltaTitle:el.dataset.spyVolumeDeltaTitle,spyLabel:el.dataset.spyVolumeStrengthLabel,units:el.dataset.spyVolumeStrengthUnits,positive:el.dataset.spyVolumeStrengthPositive,negative:el.dataset.spyVolumeStrengthNegative})),{pane:'2',scale:'symmetric-overlay',deltaTitle:'hidden',spyLabel:'fixed-right',units:'signed-2dp',positive:'#f6c85f',negative:'#f3f6fb'});
  assert.deepEqual(await page.locator('#chart').evaluate(el=>({oldPane:el.dataset.compositeNetflowPane,netflowPane:el.dataset.netflowPane,taker:el.dataset.takerFlowOverlay,overlay:el.dataset.compositeStrengthOverlay,label:el.dataset.compositeStrengthOverlayLabel,side:el.dataset.fixedReadoutSide,lineWidth:el.dataset.strengthLineWidth})),{oldPane:'removed',netflowPane:'removed',taker:'spy-qqq-composite-relative',overlay:'pane-1-only-symmetric-zero',label:'C Taker NF',side:'right-price-scale',lineWidth:'1'});
  assert.match(await page.locator('#composite-flow-fixed').innerText(),/^C Taker NF [-+−]?\d.*K$/);assert.match(await page.locator('#spy-volume-fixed').innerText(),/^SPY V [-+−]?\d/);
  for(const id of ['spy','qqq','relative'])assert.equal(await page.locator('#'+id).isChecked(),false);await page.locator('#spy').check();assert.equal(await page.locator('#chart').getAttribute('data-netflow-pane'),'removed');await page.locator('#spy').uncheck();assert.equal(await page.locator('#chart').getAttribute('data-netflow-pane'),'removed');
  assert((await page.locator('label:has(#relative)').getAttribute('title')).includes('NetFlow cùng nến'));
  for(const id of ['composite','alignment','price-bands','pivot-zones','phase-width','candle-agreement-color','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','geometry-toggle','geometry-pivots','double-tap-full'])assert.equal(await page.locator('#'+id).isChecked(),true);
  assert((await page.locator('#fit').innerText()).includes('1.5 ngày'));assert((await page.locator('#chart-fit').innerText()).includes('1.5 ngày'));assert((await page.locator('#chart-fit-half').innerText()).includes('0.5 ngày'));assert.equal(await page.locator('#chart-save').innerText(),'Lưu setup');
  const fitWindow=await page.locator('#chart').evaluate(node=>({hours:+node.dataset.fitWindowHours,start:+node.dataset.fitStart,end:+node.dataset.fitEnd}));assert.equal(fitWindow.hours,36);assert(fitWindow.end>fitWindow.start);assert(fitWindow.end-fitWindow.start<=36*60*60*1000);
  await page.locator('#chart-fit-half').click();const halfFitWindow=await page.locator('#chart').evaluate(node=>({hours:+node.dataset.fitWindowHours,start:+node.dataset.fitStart,end:+node.dataset.fitEnd}));assert.equal(halfFitWindow.hours,12);assert(halfFitWindow.end>halfFitWindow.start);assert(halfFitWindow.end-halfFitWindow.start<=12*60*60*1000);
  assert.equal(await page.locator('#geometry-score').inputValue(),'55');assert.equal(await page.locator('#geometry-lines').inputValue(),'6');
  assert.match(await page.locator('#geometry-readout').innerText(),/^UP \d+% · DOWN \d+% · WAIT \d+%$/);assert((await page.locator('#geometry-readout').getAttribute('title')).includes('REV6-3 Trend V2'));
  const geometryCanvas=page.locator('#geometry-overlay');assert(+(await geometryCanvas.getAttribute('data-lines'))>0);assert(+(await geometryCanvas.getAttribute('data-pivots'))>0);assert.equal(+(await geometryCanvas.getAttribute('data-states')),4);assert(await geometryCanvas.evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0)));
  assert((await page.locator('label:has(#phase-width)').innerText()).includes('Composite × Volume'));
  assert(await page.locator('#chart canvas').count()>0);assert((await page.locator('#chart').boundingBox()).height>=800);
  assert((await page.locator('#tooltip').innerText()).includes('Điểm xác nhận'));assert((await page.locator('#tooltip').innerText()).includes('không phải xác suất thắng'));assert(!(await page.locator('#tooltip').innerText()).includes('TREND6'));assert.match(await page.locator('#tooltip').innerText(),/Màu nến Composite×Volume (ĐỒNG THUẬN TĂNG|ĐỒNG THUẬN GIẢM|TRUNG TÍNH)/);assert((await page.locator('#tooltip').innerText()).includes('Màu SPY−QQQ tương đối: XÁM'));
  await page.locator('#candle-agreement-color').uncheck();assert((await page.locator('#tooltip').innerText()).includes('Màu nến C×V đang tắt'));await page.locator('#candle-agreement-color').check();assert.match(await page.locator('#tooltip').innerText(),/Màu nến Composite×Volume/);
  assert.equal(await page.locator('#cvd-spectrum').evaluate(canvas=>canvas.width>0&&canvas.height>0),true);
  assert.equal(await page.locator('#cvd-spectrum').getAttribute('data-source'),'COMPOSITE→SPY');
  const dayCanvas=page.locator('#day-separators');assert.equal(await dayCanvas.evaluate(canvas=>canvas.width>0&&canvas.height>0),true);assert(+(await dayCanvas.getAttribute('data-count'))>0);assert(await dayCanvas.evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0)));
  await page.locator('#markers').uncheck();assert.equal(await dayCanvas.isVisible(),false);await page.locator('#markers').check();assert.equal(await dayCanvas.isVisible(),true);
  await page.locator('#symbol').selectOption('QQQUSDT');await page.locator('#signal').selectOption('SPYUSDT');
  await page.waitForFunction(()=>document.querySelector('#pivot-flow-overlay')?.dataset.status==='hidden');
  assert.equal(await page.locator('#cvd-spectrum').getAttribute('data-source'),'QQQUSDT');
  assert((await page.locator('#tooltip').innerText()).includes('Giá QQQ, Strength phân tích SPY'));
  for(const id of ['spy','qqq','composite','relative','alignment','price-bands','pivot-zones','phase-width','candle-agreement-color','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','geometry-toggle','geometry-pivots']){await page.locator('#'+id).uncheck();await page.locator('#'+id).check();}
  await page.locator('#geometry-score').selectOption('72');assert((await page.locator('#geometry-readout').innerText()).startsWith('UP '));assert(+(await geometryCanvas.getAttribute('data-lines'))>0);await page.locator('#geometry-score').selectOption('55');
  for(const interval of fixtureRoot||process.env.NETFLOW_LIVE?['5m','30m','1h','15m']:['15m']){
   await page.locator('#interval').selectOption(interval);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'),{},{timeout:120000});
   assert.match(await page.locator('#stat-score').textContent(),/\d+\/100/);
  }
  for(const [width,height] of [[1440,1100],[390,844]]){
   await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`stats-${width}.png`),fullPage:true});
   await page.locator('#chart').scrollIntoViewIfNeeded();
   const box=await page.locator('#chart').boundingBox();await page.mouse.move(box.x+Math.min(box.width*.6,box.width-120),box.y+80);
   try{await page.waitForFunction(()=>document.querySelector('#tooltip').textContent.includes('NẾN ĐANG XEM'),{},{timeout:5000});}catch(e){console.log({width,box,context:await page.locator('#tooltip').innerText()});if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`crosshair-failure-${width}.png`)});throw e;}
   const contextBefore=await page.locator('#tooltip').innerText();await page.waitForTimeout(3200);assert.equal(await page.locator('#tooltip').innerText(),contextBefore);
   await page.mouse.wheel(0,-200);
   await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+80,{steps:10});await page.mouse.up();await page.locator('#fit').click();
   if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`rth-${width}.png`),fullPage:true});
  }
  await page.locator('#chart').dblclick({position:{x:120,y:120}});await page.waitForFunction(()=>document.querySelector('#fullscreen').textContent.includes('Thu nhỏ'));
  const fullBox=await page.locator('.chart-card').boundingBox();assert(Math.abs(fullBox.width-390)<2);assert(Math.abs(fullBox.height-844)<2);assert((await page.locator('#chart').boundingBox()).height>450);assert(await page.evaluate(()=>document.body.classList.contains('chart-fullscreen')));assert.equal(await page.locator('#tooltip').isVisible(),false);
  await page.locator('#chart-fit').click();if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,'rth-fullscreen-390.png')});
  await page.locator('#fullscreen').click();await page.waitForFunction(()=>document.querySelector('#fullscreen').textContent.includes('Full chart'));
  const download=page.waitForEvent('download');await page.locator('#export').click();assert((await download).suggestedFilename().includes('quote-netflow'));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await page.locator('#chart').scrollIntoViewIfNeeded();const touchBox=await page.locator('#chart').boundingBox();
  const x=touchBox.x+touchBox.width/2,y=Math.max(30,touchBox.y+100);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await page.waitForTimeout(300);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-35,y,id:1},{x:x+35,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-65,y,id:1},{x:x+65,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:3}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+3,y:y+2,id:4}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('#fullscreen').textContent.includes('Thu nhỏ'));await page.locator('#fullscreen').click();await page.waitForFunction(()=>document.querySelector('#fullscreen').textContent.includes('Full chart'));
  await page.locator('#relative').check();await page.locator('#geometry-score').selectOption('72');await page.locator('#chart-save').click();assert.equal(await page.locator('#chart-save').innerText(),'✓ Đã lưu');
  const savedSetup=await page.evaluate(()=>JSON.parse(localStorage.getItem('netflow-rth-lite:chart-setup:v1')));assert.equal(savedSetup.version,1);assert.equal(savedSetup.controls.relative,true);assert.equal(savedSetup.controls['geometry-score'],'72');assert(savedSetup.timeRange.to>savedSetup.timeRange.from);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'),{},{timeout:120000});assert.equal(await page.locator('#relative').isChecked(),true);assert.equal(await page.locator('#geometry-score').inputValue(),'72');assert.equal(await page.locator('#chart-save').innerText(),'Lưu setup');
  assert.deepEqual(errors,[]);console.log('Chart passed: desktop/mobile/fullscreen, double tap, 36-hour fit, saved setup, controls, tooltip, wheel/drag, CSV. API statuses:',JSON.stringify(requests));
  if(!process.env.NETFLOW_LIVE){
   failure=451;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HTTP 451'));assert((await page.locator('#status').innerText()).includes('Dữ liệu cũ chưa cập nhật'));assert.equal(await page.locator('#live-indicator').innerText(),'● KHÔNG LIVE');
   await page.locator('#days').selectOption('7');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Không có dữ liệu thay thế'));assert.equal(await page.locator('#stat-score').textContent(),'—');assert(await page.locator('#export').isDisabled());
   failure='network';await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('CORS'));assert.equal(await page.locator('#stat-score').textContent(),'—');
   failure=null;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'));assert.equal(await page.locator('#live-indicator').innerText(),'● LIVE');
   console.log('Failure handling passed: 451 keeps stale data, changed history clears, CORS/network empty, recovery.');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
