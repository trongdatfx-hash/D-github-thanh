const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const base=__dirname;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:"msedge"});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.sockets=[];window.WebSocket=class{constructor(url){this.url=url;window.sockets.push(this);setTimeout(()=>this.onopen?.(),1)} close(){this.onclose?.()} emit(d){this.onmessage?.({data:JSON.stringify({data:d})})}}});
 const step=900000,bucket=Math.floor(Date.now()/step)*step,start=bucket-650*step;
 const ks=Array.from({length:650},(_,i)=>{const p=100+i*.01+Math.sin(i/7),vol=1000+i%40,buy=vol*(.5+.3*Math.sin(i/9));return [start+i*step,p-.1,p+.4,p-.4,p,vol,start+(i+1)*step-1,p*vol,100,buy,p*buy]});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='fapi.binance.com'){
   let data;if(u.pathname.includes('Klines')||u.pathname.endsWith('/klines')) data=ks;
   else if(u.pathname.includes('fundingRate')) data=ks.map((k,i)=>({fundingTime:k[0],fundingRate:.0001*Math.sin(i/15)}));
   else data=ks.slice(-400).map((k,i)=>({timestamp:k[0],longShortRatio:1+.3*Math.sin(i/10),buySellRatio:1+.4*Math.sin(i/12),sumOpenInterestValue:100000+i*10+100*Math.sin(i/9)}));
   await route.fulfill({json:data});return;
  }
  if(u.pathname==='/ai-dashboard/'||u.pathname==='/ai-dashboard/index.html'){await route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(base,'index.html'))});return}
  if(u.pathname.endsWith('.js')){await route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(base,path.basename(u.pathname)))});return}
  await route.fulfill({contentType:'text/html',body:'<p>Chart test fixture</p>'});
 });
 await page.goto('http://matrix.test/ai-dashboard/');
 await page.waitForFunction(()=>document.querySelectorAll('#matrixV2Table tbody tr').length===12);
 assert.equal(await page.locator('#matrixTable tbody tr').count(),12);
 console.log('Closed history rendered, V1 preserved');
 const causal=await page.evaluate(()=>{const raw=rows.map(r=>({...r,...r.v2Aux})),a=features(raw.slice(0,600)),b=features(raw);return JSON.stringify(a[599])===JSON.stringify(b[599])});assert(causal,'Features must be prefix invariant');
 await page.evaluate(({bucket,step})=>{const ws=sockets.at(-1);const k={i:'15m',t:bucket,T:bucket+step-1,o:'107',h:'108',l:'106',c:'107.5',v:'800',V:'700',x:false};ws.emit({e:'markPriceUpdate',p:'107.5',i:'107.4',r:'.0001'});ws.emit({e:'kline',s:'QQQUSDT',k});ws.emit({e:'kline',s:'SPYUSDT',k});ws.emit({e:'aggTrade',p:'107.5',q:'3',m:false});}, {bucket,step});
 await page.waitForFunction(()=>document.getElementById('matrixV2Status').textContent.includes('Nến đang chạy'));
 assert((await page.locator('#matrixV2Table tbody tr').nth(0).innerText()).includes('LIVE provisional'));
 console.log('Live SPY/QQQ + mark/aggTrade updates rendered');
 for(const [w,h,name] of [[1440,1000,'desktop'],[390,844,'mobile'],[844,390,'landscape']]){
  await page.setViewportSize({width:w,height:h});await page.locator('#matrixV2Panel').scrollIntoViewIfNeeded();
  const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,visible:document.getElementById('matrixV2Panel').getBoundingClientRect().height}));assert(metrics.width<=w,JSON.stringify(metrics));assert(metrics.visible>0);
  await page.screenshot({path:path.join(require('os').tmpdir(),`matrix-v2-${name}.png`),fullPage:false});
 }
 await page.locator('#matrixV2Run').click();
 await page.evaluate(()=>sockets.at(-1).close());await page.waitForFunction(()=>document.getElementById('matrixV2Status').textContent.includes('STALE'));
 console.log('Disconnect, recalculate, desktop/mobile/landscape overflow checks passed');
 await page.evaluate(()=>{window.trainCount=0;const old=train;train=function(){window.trainCount++;return old()};sockets.at(-1).emit({e:'kline',s:'SPYUSDT',k:{i:'15m',t:rows.at(-1).time,T:rows.at(-1).closeTime,o:'107',h:'108',l:'106',c:'107.5',v:'800',V:'700',x:true}})});
 await page.waitForFunction(()=>window.trainCount>0);console.log('Closed M15 socket event retrained/recalculated');
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#matrixV2Table tbody tr').length===12);console.log('Persistent snapshots survived reload');
 assert.deepEqual(errors,[]);console.log('No page JavaScript errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

