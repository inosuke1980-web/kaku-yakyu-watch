'use strict';
const {chromium,webkit}=require('playwright'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const sizes=[[375,667],[390,664],[390,844],[375,812],[390,568],[1280,900]];
(async()=>{
 const engine=process.env.FIXTURE_ENGINE==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.FIXTURE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 try{for(const [width,height] of sizes){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('#start');await page.click('#pause');
 // Stop scheduling without clearing the visible observer: fixture only.
 await page.evaluate(()=>{stop();render()});await page.evaluate(()=>document.fonts.ready);
 const check=async(label)=>{
 const metric=await page.evaluate(()=>{
  const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};
  const selectors=['.score-card','.field-stage','.field','#miniScore','#batterToday','#pitchResult','header'];
  const boxes=Object.fromEntries(selectors.map(s=>[s,rect(s)]));
  return {width:innerWidth,height:innerHeight,docH:document.documentElement.scrollHeight,docW:document.documentElement.scrollWidth,boxes,numericOverflow:[...document.querySelectorAll('#mobileLines tr>*:not(:first-child)')].some(t=>t.scrollWidth>t.clientWidth+1),fieldScroll:document.querySelector('.field-card').scrollHeight>document.querySelector('.field-card').clientHeight+1,tableOverflow:[...document.querySelectorAll('#mobileLines table')].some(t=>t.scrollWidth>t.clientWidth+1),font:getComputedStyle(document.querySelector('#mobileLines table')).fontSize};
 });
 if(width<=600){
  assert.ok(metric.docH<=height+1,label+' no vertical page scroll');assert.ok(metric.docW<=width,label+' no horizontal page scroll');
  for(const [sel,r] of Object.entries(metric.boxes)){assert.ok(r.h>0&&r.y>=0&&r.bottom<=height+1,label+' fits '+sel);}
  assert.ok(!metric.tableOverflow,'scoreboard fits');assert.equal(metric.numericOverflow,false,'inning headers and scores are not truncated');assert.equal(metric.fieldScroll,false,label+' no inner field-card scroll');
  const field=metric.boxes['.field'];const scale=Math.min(field.w/400,field.h/485);assert.ok(scale>=.46,label+' field remains discernible');
  assert.ok(metric.boxes['.score-card'].bottom<=metric.boxes['.field'].y+1);
  for(const sel of ['#pause','#next','#speed','#watchInfo'])assert.ok((await page.locator(sel).boundingBox()).height>=44,sel+' tappable');
 }else{assert.ok(await page.locator('#lines').isVisible());assert.ok(await page.locator('#start').isVisible());assert.ok(metric.boxes['.field'].h>=300);}
 console.log(label,JSON.stringify(metric));
 if(process.env.FIXTURE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,`watch-${width}-${height}-${label}.png`),fullPage:true});
 };
 await check('initial');
 assert.ok(await page.evaluate(()=>{const before=JSON.stringify(game),r=Math.random;try{Math.random=()=>{throw Error('UI consumed RNG')};updateWatchLayout();return JSON.stringify(game)===before}finally{Math.random=r}}),'UI observation is read only and consumes no RNG');
 // Display fixture uses the existing display store; no fabricated data in the app.
 await page.evaluate(()=>{plateResults.set(batter(),['三振','四球','単打','遊ゴロ','二塁打','左飛','本塁打','犠飛','見逃し三振','三塁打','併殺打','失策出塁']);game.inning=12;for(const t of game.teams)t.runs=Array.from({length:12},(_,i)=>i%4===0?1:0);render()});
 await check('extended');
 if(width===390&&height===844){
  await page.addStyleTag({content:'body.watching main{padding-top:51px;padding-bottom:38px}'});await check('safe-area');
  await page.evaluate(()=>{game.inning=18;for(const t of game.teams)t.runs.push(0,0,0,0,0,0);render()});await check('18-innings');
 }

 await page.click('#pause');assert.equal(await page.locator('#pause').textContent(),'一時停止');await page.selectOption('#speed','2');assert.equal(await page.locator('#speed').inputValue(),'2');assert.ok(await page.evaluate(()=>playing&&(timer!==null||flightTimer!==null)),'speed change keeps scheduler active');await page.click('#pause');assert.equal(await page.locator('#pause').textContent(),'再開');await page.selectOption('#speed','1');
 if(width<=600){await page.click('#watchInfo');assert.ok(await page.locator('#start').isVisible());await page.click('#watchInfo');await check('returned');
  await page.setViewportSize({width,height:height+80});const h=await page.evaluate(()=>document.querySelector('main').getBoundingClientRect().height);assert.equal(h,height+80,'dvh follows visible height');}
 assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
