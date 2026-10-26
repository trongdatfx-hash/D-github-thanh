// Rendering/integration fixture only; model cutoffs below are not a performance test.
// Run with BROWSER_EXECUTABLE=/path/to/chrome node this-file.cjs, or installed Playwright Chromium.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
(async()=>{
 const {quantileDataset}=await import('../quantile-price-core.mjs');
 const manifest=read('netflow-stumpy/data/binance/m15/manifest.json'),raw={SPYUSDT:[],QQQUSDT:[]};
 for(const m of manifest.months){const doc=read(`netflow-stumpy/data/binance/m15/${m}.json`);for(const s of Object.keys(raw))raw[s].push(...doc[s].map(([t,o,h,l,c,v,end,q,buy])=>({t,o,h,l,c,v,end,q,buy})));}
 const sample=quantileDataset(raw.SPYUSDT,raw.QQQUSDT).filter(r=>r.targets[6]).at(-1);assert(sample,'Recorded box fixture');
 const now=sample.issuedAt+60000,report=read('netflow-stumpy/data/quantile-price/report.json');
 // UI fixture only: allow a historical clock with a model. No replay result uses this object.
 for(const m of Object.values(report.models))m.trainEnd=now-86400000;
 let browserArgs=['--no-sandbox'];
 if(process.env.SPARTICUZ_CHROMIUM){const c=(await import(process.env.SPARTICUZ_CHROMIUM+'/build/index.js')).default;process.env.BROWSER_EXECUTABLE=await c.executablePath();browserArgs=c.args;}
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:browserArgs});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],oldRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('wlr-aba'))oldRequests.push(r.url());});
  await page.addInitScript(({now})=>{const RealDate=Date,started=RealDate.now();class Clock extends RealDate{constructor(...a){super(...(a.length?a:[now+RealDate.now()-started]));}static now(){return now+RealDate.now()-started;}}window.Date=Clock;},{now});
  await page.route('http://netflow.test/**',async route=>{
   const u=new URL(route.request().url());if(u.pathname.endsWith('/data/quantile-price/report.json'))return route.fulfill({json:report});
   const file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1),target=path.resolve(root,file);
   if(!target.startsWith(root+path.sep)||!fs.existsSync(target))return route.fulfill({status:404,body:''});
   await route.fulfill({contentType:/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(target)});
  });
  await page.route('https://fapi.binance.com/**',async route=>{
   const u=new URL(route.request().url());let json;
   if(u.pathname.endsWith('exchangeInfo'))json={symbols:read('netflow-stumpy/symbol-validation.json')};
   else if(u.pathname.endsWith('/time'))json={serverTime:now};
   else{const s=u.searchParams.get('symbol');json=(raw[s]??[]).filter(r=>r.t>=+u.searchParams.get('startTime')&&r.t<=+u.searchParams.get('endTime')).slice(0,+u.searchParams.get('limit')).map(r=>[r.t,r.o,r.h,r.l,r.c,r.v,r.end,r.q,1,0,r.buy,0]);}
   await route.fulfill({json});
  });
  await page.goto('http://netflow.test/');
  await page.waitForFunction(()=>document.querySelector('#chart')?.dataset.chartReady==='true',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#quantile-price-panel')?.dataset.state==='RESEARCH',{},{timeout:120000});
  assert.equal(await page.locator('#live-indicator').getAttribute('class'),'live');
  await page.locator('#quantile-price-view').click();
  await page.waitForFunction(()=>document.querySelectorAll('#strength-box-labels span').length>0);
  assert.equal(await page.locator('#quantile-price-values tr').count(),2);
  assert(await page.locator('#strength-box-overlay').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
  assert.match(await page.locator('#quantile-price-validation').innerText(),/chưa vượt nền/);
  assert.equal(await page.locator('#wlr-aba-toggle').count(),0);
  await page.locator('#strength-box-composite').selectOption('filter');
  assert.match(await page.locator('#quantile-price-status').innerText(),/lọc Composite cần kiểm định riêng/);
  assert.equal(await page.locator('#quantile-price-panel').getAttribute('data-state'),'WAIT');
  await page.locator('#strength-box-composite-threshold').selectOption('0.5');
  await page.locator('#strength-box-composite').selectOption('off');
  await page.waitForFunction(()=>document.querySelector('#quantile-price-panel')?.dataset.state==='RESEARCH');
  await page.locator('#quantile-price-horizon').selectOption('6');
  assert.equal(await page.locator('#quantile-price-panel').getAttribute('data-horizon'),'6');
  await page.locator('#symbol').selectOption('QQQUSDT');
  assert.match(await page.locator('#quantile-price-status').innerText(),/hỗ trợ SPYUSDT M15/);
  await page.locator('#symbol').selectOption('SPYUSDT');
  await page.locator('#strength-box-composite').selectOption('annotate');
  await page.waitForFunction(()=>document.querySelector('#quantile-price-panel')?.dataset.state==='RESEARCH');
  await page.locator('#strength-box-toggle').uncheck();
  await page.waitForFunction(()=>document.querySelectorAll('#strength-box-labels span').length===0);
  await page.locator('#strength-box-toggle').check();
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('#strength-box-overlay')?.width>0);
  assert((await page.locator('#chart').boundingBox()).width<=390);
  assert.deepEqual(oldRequests,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',fixtureTime:new Date(now).toISOString(),checks:'chart, LIVE, boxes and pixel rendering, P10/P50/P90, composite annotation/filter, horizon, symbol, toggle, mobile, no old model requests or JS errors'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
