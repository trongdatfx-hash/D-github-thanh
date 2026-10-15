const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixtureRoot=process.env.NETFLOW_FIXTURES;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];let failure=null;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('response',r=>{if(r.url().includes('fapi.binance.com'))requests.push([r.status(),new URL(r.url()).pathname]);});
  await page.route('http://netflow.test/**',async route=>{
   const u=new URL(route.request().url()),file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1),target=path.resolve(root,file);
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
  assert.match(await page.locator('#stat-score').textContent(),/\d+\/100/);assert((await page.locator('.badge').innerText()).includes('chưa train'));
  assert.match(await page.locator('#stat-group').textContent(),/S[+−0]/);assert.equal(await page.locator('#status').isVisible(),false);assert.equal(await page.locator('.stats-table').count(),0);
  assert.equal(await page.locator('.calendar-panel').isVisible(),true);assert.match(await page.locator('.calendar-panel').innerText(),/Forex Factory/);assert(await page.locator('.calendar-row').count()>0);assert.match(await page.locator('#calendar-status').innerText(),/đã có thực tế/);assert(await page.locator('.calendar-actual:not(.pending)').count()>0);
  const smoothList=page.locator('#calendar-list'),firstCalendarRow=page.locator('.calendar-row').first();await firstCalendarRow.evaluate(node=>node.dataset.reuseProbe='kept');await smoothList.evaluate(node=>{node.style.scrollBehavior='auto';node.scrollTop=36;});await page.locator('#calendar-refresh').click();await page.waitForFunction(()=>!document.querySelector('#calendar-refresh').disabled);assert.equal(await page.locator('.calendar-row').first().getAttribute('data-reuse-probe'),'kept');assert(Math.abs(await smoothList.evaluate(node=>node.scrollTop)-36)<3);
  await page.locator('#calendar-impact').selectOption('high');assert(await page.locator('.calendar-row').count()>0);assert.equal(await page.locator('.calendar-impact.medium').count(),0);await page.locator('#calendar-impact').selectOption('important');
  await page.locator('#calendar-currency').selectOption('USD');assert(await page.locator('.calendar-row').count()>0);assert.equal(await page.locator('.calendar-currency').evaluateAll(nodes=>nodes.every(node=>node.textContent==='USD')),true);await page.locator('#calendar-currency').selectOption('all');
  assert.equal(await page.locator('#trade-cost').inputValue(),'0.10');
  assert((await page.locator('#stats-context').innerText()).includes('ML chưa train'));
  await page.locator('#stat-trade-level').selectOption('60');assert((await page.locator('#stat-history-note').innerText()).includes('TREND6 ≥60'));await page.locator('#stat-trade-level').selectOption('all');
  await page.locator('#trade-cost').fill('0.20');await page.locator('#trade-cost').blur();assert((await page.locator('#stat-history-note').innerText()).includes('RT 0.2%'));await page.locator('#trade-cost').fill('0.10');await page.locator('#trade-cost').blur();
  const strengthReadout=await page.locator('#strength-readout').innerText();assert.match(strengthReadout,/SPY -?\d/);assert.match(strengthReadout,/QQQ -?\d/);assert.match(await page.locator('#strength-composite').innerText(),/^-?\d/);
  assert.match(await page.locator('#trend-strength').innerText(),/^TREND6 [↑↓] .+ \d+ · P(?:—|\d+) · n=\d+$/);
  const trendBox=await page.locator('#trend-strength').boundingBox(),chartBox=await page.locator('#chart').boundingBox();
  assert(trendBox.x+trendBox.width<=chartBox.x+chartBox.width);assert(trendBox.y-chartBox.y>chartBox.height*.35);assert(trendBox.y+trendBox.height<chartBox.y+chartBox.height*.65);
  assert.match(await page.locator('#reversal-readout').innerText(),/^REV6 V2→2 /);
  assert.equal(await page.locator('#live-indicator').innerText(),'● LIVE');assert(await page.locator('#live-indicator').evaluate(el=>el.classList.contains('live')));
  assert.equal(await page.locator('#days').inputValue(),'30');
  for(const id of ['spy','qqq','relative','geometry-pivots'])assert.equal(await page.locator('#'+id).isChecked(),false);
  for(const id of ['composite','alignment','price-bands','reversal-zone','phase-width','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','geometry-toggle','double-tap-full'])assert.equal(await page.locator('#'+id).isChecked(),true);
  assert((await page.locator('#fit').innerText()).includes('1.5 ngày'));assert((await page.locator('#chart-fit').innerText()).includes('1.5 ngày'));
  const fitWindow=await page.locator('#chart').evaluate(node=>({hours:+node.dataset.fitWindowHours,start:+node.dataset.fitStart,end:+node.dataset.fitEnd}));assert.equal(fitWindow.hours,36);assert(fitWindow.end>fitWindow.start);assert(fitWindow.end-fitWindow.start<=36*60*60*1000);
  assert.equal(await page.locator('#geometry-score').inputValue(),'64');assert.equal(await page.locator('#geometry-lines').inputValue(),'4');
  assert.match(await page.locator('#geometry-readout').innerText(),/^GEO (HT|KC) \d+/);assert((await page.locator('#geometry-readout').getAttribute('title')).includes('Walk-forward'));
  const geometryCanvas=page.locator('#geometry-overlay');assert(+(await geometryCanvas.getAttribute('data-lines'))>0);assert(+(await geometryCanvas.getAttribute('data-pivots'))>0);assert(await geometryCanvas.evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0)));
  assert((await page.locator('label:has(#phase-width)').innerText()).includes('Composite × Volume'));
  assert(await page.locator('#chart canvas').count()>0);assert((await page.locator('#chart').boundingBox()).height>=800);
  assert((await page.locator('#tooltip').innerText()).includes('Điểm xác nhận'));assert((await page.locator('#tooltip').innerText()).includes('không phải xác suất thắng'));assert((await page.locator('#tooltip').innerText()).includes('TREND6'));assert.match(await page.locator('#tooltip').innerText(),/Màu nến Composite (ĐỒNG THUẬN|PHÂN KỲ|XÁC NHẬN MỘT PHẦN)/);
  assert.equal(await page.locator('#cvd-spectrum').evaluate(canvas=>canvas.width>0&&canvas.height>0),true);
  assert.equal(await page.locator('#cvd-spectrum').getAttribute('data-source'),'COMPOSITE→SPY');
  const dayCanvas=page.locator('#day-separators');assert.equal(await dayCanvas.evaluate(canvas=>canvas.width>0&&canvas.height>0),true);assert(+(await dayCanvas.getAttribute('data-count'))>0);assert(await dayCanvas.evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0)));
  await page.locator('#markers').uncheck();assert.equal(await dayCanvas.isVisible(),false);await page.locator('#markers').check();assert.equal(await dayCanvas.isVisible(),true);
  await page.locator('#symbol').selectOption('QQQUSDT');await page.locator('#signal').selectOption('SPYUSDT');
  assert.equal(await page.locator('#cvd-spectrum').getAttribute('data-source'),'QQQUSDT');
  assert((await page.locator('#tooltip').innerText()).includes('Giá QQQ, dấu từ SPY'));
  for(const id of ['spy','qqq','composite','relative','alignment','price-bands','reversal-zone','phase-width','cvd-spectrum-toggle','show-strength','spy-volume-strength','bands','markers','geometry-toggle','geometry-pivots']){await page.locator('#'+id).uncheck();await page.locator('#'+id).check();}
  await page.locator('#geometry-score').selectOption('72');assert((await page.locator('#geometry-readout').innerText()).startsWith('GEO '));await page.locator('#geometry-score').selectOption('64');
  for(const interval of fixtureRoot||process.env.NETFLOW_LIVE?['5m','30m','1h','15m']:['15m']){
   await page.locator('#interval').selectOption(interval);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'),{},{timeout:120000});
   assert.match(await page.locator('#stat-score').textContent(),/\d+\/100/);
  }
  for(const [width,height] of [[1440,1100],[390,844]]){
   await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`stats-${width}.png`),fullPage:true});
   await page.locator('#chart').scrollIntoViewIfNeeded();
   const box=await page.locator('#chart').boundingBox();await page.mouse.move(box.x+Math.min(box.width*.6,box.width-120),box.y+80);
   try{await page.waitForFunction(()=>document.querySelector('#stats-context').textContent.includes('NẾN ĐANG XEM'),{},{timeout:5000});}catch(e){console.log({width,box,context:await page.locator('#stats-context').innerText()});if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`crosshair-failure-${width}.png`)});throw e;}
   const contextBefore=await page.locator('#stats-context').innerText();await page.waitForTimeout(3200);assert.equal(await page.locator('#stats-context').innerText(),contextBefore);
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
  assert.deepEqual(errors,[]);console.log('Chart passed: desktop/mobile/fullscreen, double tap, 36-hour fit, controls, tooltip, wheel/drag, CSV. API statuses:',JSON.stringify(requests));
  if(!process.env.NETFLOW_LIVE){
   failure=451;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HTTP 451'));assert((await page.locator('#status').innerText()).includes('Dữ liệu cũ chưa cập nhật'));assert.equal(await page.locator('#live-indicator').innerText(),'● KHÔNG LIVE');
   await page.locator('#days').selectOption('7');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Không có dữ liệu thay thế'));assert.equal(await page.locator('#stat-score').textContent(),'—');assert(await page.locator('#export').isDisabled());
   failure='network';await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('CORS'));assert.equal(await page.locator('#stat-score').textContent(),'—');
   failure=null;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'));assert.equal(await page.locator('#live-indicator').innerText(),'● LIVE');
   console.log('Failure handling passed: 451 keeps stale data, changed history clears, CORS/network empty, recovery.');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
