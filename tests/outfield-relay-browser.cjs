'use strict';
const {chromium}=require('playwright'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.FIXTURE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?debug=plays');
 for(const play of ['relayLF','relayCF','relayRF','relayHome','relayThird','relayLF']){
  await page.selectOption('#debugPlay',play);
  await page.evaluate(()=>{window.samples=[];window.collect=true;const started=performance.now();function frame(now){
   const pos=el=>el?[+el.getAttribute('cx'),+el.getAttribute('cy')]:null;
   const nodes=Object.fromEntries(['LF','CF','RF','SS','2B','3B','C'].map(id=>{const el=document.querySelector('circle[data-position="'+id+'"]');return [id,{p:pos(el),phase:el?.getAttribute('data-fielding-phase'),relay:el?.getAttribute('data-relay-phase')}]}));
   samples.push({t:now-started,token:animationToken,ball:pos(document.querySelector('#ball')),glove:document.querySelector('#outfieldPickupGlove').getAttribute('visibility'),nodes});if(collect)requestAnimationFrame(frame)}requestAnimationFrame(frame)});
  await page.click('#debugStart');
  await page.waitForFunction(()=>document.querySelector('#outfieldPickupGlove').getAttribute('visibility')==='visible');
  if(process.env.FIXTURE_SCREENSHOT_DIR)await page.locator('svg.field').screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,play+'-pickup.png')});
  await page.waitForFunction(()=>[...document.querySelectorAll('circle[data-position]')].some(e=>e.getAttribute('data-relay-phase')==='receive'));
  if(process.env.FIXTURE_SCREENSHOT_DIR)await page.locator('svg.field').screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,play+'-relay.png')});
  await page.waitForTimeout(1700);await page.evaluate(()=>{collect=false});
  const samples=await page.evaluate(()=>samples),side=play==='relayLF'?'LF':play==='relayCF'?'CF':'RF',pivot=side==='LF'?'SS':'2B';
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const pickups=samples.filter(s=>s.glove==='visible'&&s.nodes[side].phase==='pickup');assert.ok(pickups.length>=1);assert.ok(pickups.every(s=>dist(s.ball,s.nodes[side].p)<.4),'ball/fielder coincide during actual pickup');
  const receives=samples.filter(s=>s.nodes[pivot].relay==='receive');assert.ok(receives.some(s=>dist(s.ball,s.nodes[pivot].p)<.5),'ball passes actual relay');
  const throwAt=samples.find(s=>s.nodes[side].phase==='throw');assert.ok(throwAt&&throwAt.t>pickups[0].t);
  let jump=0;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(a.token!==b.token||b.t-a.t>=40)continue;for(const id of [pivot,side])jump=Math.max(jump,dist(a.nodes[id].p,b.nodes[id].p));}assert.ok(jump<18,'no one-frame fielder jump');
  if(play==='relayHome'||play==='relayThird'){const base=play==='relayHome'?[200,293]:[77,169];assert.ok(samples.some(s=>dist(s.ball,base)<.5),'ball reaches correct onward base');}
  console.log('BROWSER RELAY PASS',JSON.stringify({play,frames:samples.length,pickupDistance:+Math.max(...pickups.map(s=>dist(s.ball,s.nodes[side].p))).toFixed(3),maxFielderFrameJump:+jump.toFixed(3)}));
 }
 await page.selectOption('#debugPlay','relayHome');await page.click('#debugStart');await page.waitForTimeout(1300);await page.selectOption('#debugPlay','pitch');await page.click('#debugRestart');await page.waitForTimeout(3000);assert.equal(await page.locator('#outfieldPickupGlove').getAttribute('visibility'),'hidden');assert.deepEqual(errors,[]);
 console.log('BROWSER SWITCH PASS; page errors 0');await page.close();
 for(const [width,height]of [[375,667],[390,844]]){
  const mobile=await browser.newPage({viewport:{width,height}});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await mobile.click('#start');await mobile.click('#pause');
  await mobile.evaluate(()=>{stop();render();playing=true;const info={flight:'gapLiner',point:[90,15],flightMs:850,defender:'LF',fielder:{field:55,arm:55}};animate(info.flight,info,55,1);animateOutfieldReturn('single',false,55,null,info)});
  await mobile.waitForTimeout(500);await mobile.click('#pause');
  const state=()=>({token:animationToken,p:[...document.querySelectorAll('circle[data-position]')].map(e=>[e.getAttribute('cx'),e.getAttribute('cy')])});
  const before=await mobile.evaluate(state);await mobile.waitForTimeout(2500);assert.deepEqual(await mobile.evaluate(state),before,'pause invalidates old relay timers');
  await mobile.click('#pause');await mobile.selectOption('#speed','2');assert.ok(await mobile.evaluate(()=>playing&&(timer!==null||flightTimer!==null)));await mobile.click('#pause');
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth));
  console.log('BROWSER MOBILE RELAY PAUSE/RESUME/SPEED PASS',width);await mobile.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
