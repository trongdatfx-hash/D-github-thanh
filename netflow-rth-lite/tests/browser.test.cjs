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
    json=read(fixtureRoot?path.join(fixtureRoot,`${symbol}-${interval}.json`):path.join(root,`../netflow-ml/tests/fixtures/${symbol}.json`)).filter(x=>+x[0]>=+u.searchParams.get('startTime')).slice(0,1000);
   }
   return route.fulfill({json});
  });
  await page.goto('http://netflow.test/');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'),{},{timeout:120000});
  assert(!(await page.locator('#net').innerText()).includes('—'));assert((await page.locator('.badge').innerText()).includes('chưa train'));
  const strengthReadout=await page.locator('#strength-readout').innerText();assert.match(strengthReadout,/SPY -?\d/);assert.match(strengthReadout,/QQQ -?\d/);assert.match(await page.locator('#strength-composite').innerText(),/^-?\d/);
  assert.equal(await page.locator('#live-indicator').innerText(),'● LIVE');assert(await page.locator('#live-indicator').evaluate(el=>el.classList.contains('live')));
  assert(await page.locator('#chart canvas').count()>0);
  await page.locator('#symbol').selectOption('QQQUSDT');await page.locator('#signal').selectOption('SPYUSDT');
  assert((await page.locator('#tooltip').innerText()).includes('QQQUSDT · O'));
  for(const id of ['spy','qqq','composite','alignment','price-bands','show-strength','bands','markers']){await page.locator('#'+id).uncheck();await page.locator('#'+id).check();}
  for(const interval of fixtureRoot||process.env.NETFLOW_LIVE?['5m','30m','1h','15m']:['15m']){
   await page.locator('#interval').selectOption(interval);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'),{},{timeout:120000});
   assert(!(await page.locator('#net').innerText()).includes('—'));
  }
  for(const [width,height] of [[1440,1100],[390,844]]){
   await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const box=await page.locator('#chart').boundingBox();await page.mouse.move(box.x+box.width*.45,box.y+80);await page.mouse.wheel(0,-200);
   await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+80,{steps:10});await page.mouse.up();await page.locator('#fit').click();
   if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`rth-${width}.png`),fullPage:true});
  }
  await page.locator('#fullscreen').click();await page.waitForFunction(()=>document.querySelector('#fullscreen').textContent.includes('Thu nhỏ'));
  const fullBox=await page.locator('.chart-card').boundingBox();assert(Math.abs(fullBox.width-390)<2);assert(Math.abs(fullBox.height-844)<2);assert((await page.locator('#chart').boundingBox()).height>450);assert(await page.evaluate(()=>document.body.classList.contains('chart-fullscreen')));
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
  assert.deepEqual(errors,[]);console.log('Chart passed: desktop/mobile/fullscreen, 4 timeframes where available, controls, tooltip, wheel/drag, fit, CSV. API statuses:',JSON.stringify(requests));
  if(!process.env.NETFLOW_LIVE){
   failure=451;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HTTP 451'));assert((await page.locator('#status').innerText()).includes('Dữ liệu cũ chưa cập nhật'));assert.equal(await page.locator('#live-indicator').innerText(),'● KHÔNG LIVE');
   await page.locator('#days').selectOption('7');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Không có dữ liệu thay thế'));assert.equal(await page.locator('#net').innerText(),'—');assert(await page.locator('#export').isDisabled());
   failure='network';await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('CORS'));assert.equal(await page.locator('#net').innerText(),'—');
   failure=null;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRADING'));assert.equal(await page.locator('#live-indicator').innerText(),'● LIVE');
   console.log('Failure handling passed: 451 keeps stale data, changed history clears, CORS/network empty, recovery.');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
