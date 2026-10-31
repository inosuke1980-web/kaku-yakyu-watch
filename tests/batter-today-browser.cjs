'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.FIXTURE_CHROMIUM_PATH?{executablePath:process.env.FIXTURE_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('#start');await page.click('#pause');
  await page.evaluate(()=>{stop();game.bases=[null,null,null];game.balls=game.strikes=game.outs=0;game.teams[0].bat=0;game.half=0;game.inning=1;render()});
  for(const shape of ['standard','wide','small','leftWide','rightWide','dome','grassPark','grassDome']){
   await page.selectOption('#parkShape',shape);await page.evaluate(()=>applyParkShape(document.querySelector('#parkShape').value));
   assert.equal(await page.locator('#homePlate').getAttribute('points'),'195,288 205,288 205,293 200,298 195,293');assert.ok(await page.locator('#homePlate').isVisible());
  }
  // Complete 9 actual walk branches to reach the same batter again. Tactics and
  // pitching changes are suppressed only in this browser fixture, not the app.
  await page.evaluate(()=>{const r=Math.random,t=tactics,m=maybeChangePitcher;try{Math.random=()=>0;tactics=()=>false;maybeChangePitcher=()=>{};for(let i=0;i<9;i++){game.balls=3;resolvePitch()}stop();render()}finally{Math.random=r;tactics=t;maybeChangePitcher=m}});
  assert.match(await page.locator('#batterToday').innerText(),/第1打席　四球/);
  await page.evaluate(()=>{const r=Math.random,t=tactics,m=maybeChangePitcher;const team=current().bat;try{Math.random=()=>.73;tactics=()=>false;maybeChangePitcher=()=>{};game.strikes=2;game.balls=0;resolvePitch();team.bat=18;stop();render()}finally{Math.random=r;tactics=t;maybeChangePitcher=m}});
  const text=await page.locator('#batterToday').innerText();assert.match(text,/第1打席　四球/);assert.match(text,/第2打席　三振/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');assert.deepEqual(errors,[]);
  if(process.env.FIXTURE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,`batter-today-${width}.png`),fullPage:true});
  console.log('BROWSER PASS '+width+'px: 8 park plates, actual walk/K history, no page overflow');await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
