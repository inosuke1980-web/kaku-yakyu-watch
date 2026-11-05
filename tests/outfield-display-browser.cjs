'use strict';
const {chromium}=require('playwright'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});let page;try{
 const output=process.env.FIXTURE_SCREENSHOT_DIR;
 for(const [width,height] of [[1280,900],[375,667],[390,844]]){
  page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?debug=plays');
  for(const play of ['flyOut','linerHit','relayLF','relayCF','relayRF','relayHome','relayThird']){
   await page.selectOption('#debugPlay',play);await page.click('#debugStart');
   await page.waitForTimeout(600);assert.match(await page.locator('#pitchMotion').innerText(),/ストレート.*140.*km\/h/);
   if(output)await page.screenshot({path:path.join(output,`${width}-${play}-pitch.png`)});
   for(const [step,delay] of [[1,650],[2,400],[3,400],[4,400]]){
    await page.waitForTimeout(delay);
    if(output)await page.screenshot({path:path.join(output,`${width}-${play}-${step}.png`)});
   }
   console.log(new Date().toISOString(),width,play,'frames captured');
  }
  assert.deepEqual(errors,[]);await page.close();
  page=await browser.newPage({viewport:{width,height}});await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.click('#start');await page.waitForFunction(()=>document.querySelector('#pitchMotion').textContent.includes('km/h'),null,{timeout:15000});
  assert.ok(await page.locator('#pitchMotion').isVisible());
  if(width<600){const d=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight}));assert.ok(d.w<=d.iw&&d.h<=d.ih+1,JSON.stringify(d));}
  if(output)await page.screenshot({path:path.join(output,`${width}-normal.png`)});
  await page.click('#pause');await page.selectOption('#speed','2');await page.click('#pause');await page.waitForFunction(()=>document.querySelector('#pitchMotion').textContent.includes('km/h'),null,{timeout:15000});
  await page.click('#start');assert.equal(await page.locator('#pitchMotion').textContent(),'');
  console.log(new Date().toISOString(),width,'normal pitch controls PASS');await page.close();page=null;
 }
} catch(e){if(page&&process.env.FIXTURE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,'failure.png')}).catch(()=>{});throw e}finally{await browser.close()}})().catch(e=>{console.error(new Date().toISOString(),e);process.exitCode=1});
