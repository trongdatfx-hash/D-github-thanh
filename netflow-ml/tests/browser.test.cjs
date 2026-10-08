// Run with NODE_PATH pointing to the bundled dependencies (Playwright), no install needed.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[];let failure=false;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://netflow.test/**',async route=>{
      const u=new URL(route.request().url()),file=u.pathname==='/'?'index.html':path.basename(u.pathname);
      if(!['index.html','style.css','app.mjs','data.mjs','engine.mjs','dvp.mjs'].includes(file))return route.fulfill({status:404,body:''});
      await route.fulfill({contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(root,file))});
    });
    await page.route('https://fapi.binance.com/**',async route=>{
      const u=new URL(route.request().url());
      if(failure)return route.fulfill({status:451,body:'restricted'});
      let json;
      if(u.pathname.endsWith('exchangeInfo'))json={symbols:read('symbol-validation.json')};
      else if(u.pathname.endsWith('time'))json=read('tests/fixtures/time.json');
      else {json=read(`tests/fixtures/${u.searchParams.get('symbol')}.json`).filter(x=>x[0]>=Number(u.searchParams.get('startTime')));}
      await route.fulfill({json});
    });
    await page.goto('http://netflow.test/');
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('TRADING'));
    assert(!(await page.locator('#net').innerText()).includes('—'));
    assert((await page.locator('#ml').innerText()).includes('chưa train'));
    for(const [w,h] of [[1440,1100],[390,844]]){
      await page.setViewportSize({width:w,height:h});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('#price').hover();await page.mouse.wheel(0,100);
      if(process.env.NETFLOW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NETFLOW_SCREENSHOTS,`netflow-${w}.png`),fullPage:true});
    }
    await page.locator('#symbol').selectOption('QQQUSDT');
    await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('QQQUSDT · TRADING'));
    await page.locator('#rth').check();await page.locator('#price').hover();
    const download=page.waitForEvent('download');await page.locator('#export').click();assert.equal((await download).suggestedFilename(),'QQQUSDT-M15-netflow.csv');
    failure=true;await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('HTTP 451'));
    assert((await page.locator('#status').innerText()).includes('chưa cập nhật'));
    await page.locator('#symbol').selectOption('SPYUSDT');
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Không có dữ liệu thay thế'));
    assert.equal(await page.locator('#net').innerText(),'—');assert(await page.locator('#export').isDisabled());
    assert.deepEqual(errors,[]);
    console.log('Browser passed: SPY/QQQ, desktop/mobile, zoom, RTH filter, CSV, blocked API, no JS errors.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
