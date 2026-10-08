// Regression: mutable raw/main can be stale even when HTTP 200/cache=no-store.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const base=path.resolve(__dirname,'..'),sha='a'.repeat(40);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage(),errors=[];
 let apiDown=false,rawDown=false,lookups=0,immutable=0;
 const fresh=JSON.parse(fs.readFileSync(path.join(base,'ai-engine/reports/layers_latest.json')));
 Object.assign(fresh,{data_as_of:Date.now()-60000,generated_at:Date.now()-30000,stale:false,live_rest_available:true,live_market_available:true,feature_ready:true});
 fresh.collection.market['SPYUSDT/last'].source='rest';
 const old={...fresh,data_as_of:Date.now()-3*3600000,generated_at:Date.now()-3*3600000};
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.WebSocket=class{constructor(){this.readyState=1}}});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='api.github.com'){
   lookups++;return route.fulfill(apiDown?{status:403,body:'limited'}:{json:{object:{sha}}});
  }
  if(u.hostname==='raw.githubusercontent.com'&&rawDown)return route.fulfill({status:503,body:'unavailable'});
  if(u.pathname.endsWith('layers_latest.json')){
   if(u.pathname.includes('/'+sha+'/'))immutable++;
   return route.fulfill({json:u.hostname==='raw.githubusercontent.com'&&u.pathname.includes('/main/')?old:fresh});
  }
  if(u.pathname.endsWith('paper_live.json'))return route.fulfill({json:{horizons:[]}});
  if(u.pathname==='/ai-dashboard/')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(base,'ai-dashboard/index.html'))});
  if(u.pathname.endsWith('.js')||u.pathname.endsWith('.css'))return route.fulfill({contentType:u.pathname.endsWith('.js')?'text/javascript':'text/css',body:fs.readFileSync(path.join(base,'ai-dashboard',path.basename(u.pathname)))});
  return route.fulfill({contentType:'text/html',body:'<p>Chart fixture</p>'});
 });
 await page.goto('http://sources.test/ai-dashboard/');
 await page.waitForFunction(()=>document.getElementById('dataStatus').textContent.includes('Dữ liệu nến đã đóng'));
 assert.equal(immutable,1);assert.equal(lookups,1);
 // Automatic/visibility refresh reuses a head for 120 seconds.
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 assert.equal(lookups,1);
 // API-limited fallback must compare both copies, not take old raw HTTP 200.
 apiDown=true;
 await page.locator('#refresh').click();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 assert((await page.locator('#dataStatus').innerText()).includes('Dữ liệu nến đã đóng'));
 // Pages remains usable when both public API and raw are unavailable.
 rawDown=true;
 await page.locator('#refresh').click();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 assert((await page.locator('#dataStatus').innerText()).includes('Dữ liệu nến đã đóng'));
 assert.deepEqual(errors,[]);
 console.log('Commit source, bounded API polling, stale raw/new Pages, API/raw outage fallback: passed');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
