'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.FIXTURE_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.click('#start');await page.click('#pause');
 await page.evaluate(()=>{
  stop();window.beforeRandom=Math.random;window.beforeStrength=chooseGrounderStrength;window.beforeDefender=groundDefender;window.beforeDirections=GROUND_DIRECTIONS.slice();
  game.bases=[current().bat.players[6],current().bat.players[7],current().bat.players[8]];game.outs=0;game.balls=game.strikes=0;
  game.bases.forEach(p=>p.speed=55);batter().speed=55;render();
  GROUND_DIRECTIONS.splice(0,4,{label:'三遊間のゴロ',defender:'SS',point:[158,156]});chooseGrounderStrength=()=> 'hard';groundDefender=()=>({field:50,speed:50,arm:55});
  Math.random=()=>.9;
  window.samples=[];window.startSample=performance.now();
  function frame(now){const pos=e=>[+e.getAttribute('cx'),+e.getAttribute('cy')];samples.push({t:now-startSample,ball:pos(document.querySelector('#ball')),catcher:pos(document.querySelector('circle[data-position="C"]')),ss:pos(document.querySelector('circle[data-position="SS"]')),call:document.querySelector('#pitchResult').textContent});if(now-startSample<4200)requestAnimationFrame(frame)}requestAnimationFrame(frame);
  startPitchMotion();
 });
 await page.waitForFunction(()=>game.forceOutVisual?.outcome==='home');
 const plan=await page.evaluate(()=>({plan:game.forceOutVisual,out:game.outs,bases:game.bases.map(p=>p?.id),runs:game.teams.map(t=>t.runs.reduce((a,b)=>a+(b||0),0))}));assert.equal(plan.out,1);
 for(const [delay,name] of [[300,'pickup-approach'],[300,'secured'],[450,'throw']]){
  await page.waitForTimeout(delay);
  if(process.env.FIXTURE_SCREENSHOT_DIR)await page.locator('svg').first().screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,'home-force-'+name+'.png')});
 }
 await page.waitForFunction(()=>document.querySelector('#pitchResult').textContent==='本塁封殺！');
 if(process.env.FIXTURE_SCREENSHOT_DIR)await page.locator('svg').first().screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,'home-force-call.png')});
 await page.waitForFunction(()=>samples.length&&samples.at(-1).t>=4200);
 const samples=await page.evaluate(()=>samples);const firstCall=samples.findIndex(p=>p.call==='本塁封殺！');assert.ok(firstCall>0);
 const received=samples.slice(0,firstCall+1).find(p=>Math.hypot(p.ball[0]-200,p.ball[1]-293)<1&&Math.hypot(p.catcher[0]-200,p.catcher[1]-293)<1);assert.ok(received,'actual receiver on home before call');
 console.log('BROWSER HOME FORCE PASS',JSON.stringify({plan,samples:samples.length,receive:received,call:samples[firstCall]}));
 await page.evaluate(()=>{Math.random=beforeRandom;chooseGrounderStrength=beforeStrength;groundDefender=beforeDefender;GROUND_DIRECTIONS.splice(0,GROUND_DIRECTIONS.length,...beforeDirections);stop()});
 for(const side of ['left','right']){
  await page.evaluate(side=>{stop();animateFoulBall({side,kind:'fly',point:side==='left'?[60,200]:[340,200]})},side);
  await page.waitForTimeout(550);assert.ok((await page.locator('#foulTrail').getAttribute('d')).includes('L'));
  if(process.env.FIXTURE_SCREENSHOT_DIR)await page.locator('svg').first().screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,'foul-'+side+'.png')});
  await page.waitForTimeout(650);assert.equal(await page.locator('#pitchResult').textContent(),'ファウル！');
 }
 for(const bats of ['右打','左打']){
  await page.evaluate(bats=>{stop();batter().bats=bats;showBattingStance(batter(),true);drawPitch({side:16,drop:3,flight:470})},bats);
  for(const [delay,name] of [[570,'release'],[210,'mid'],[230,'arrival']]){
   await page.waitForTimeout(delay);
   if(process.env.FIXTURE_SCREENSHOT_DIR)await page.locator('svg').first().screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,'pitch-'+bats+'-'+name+'.png')});
  }
 }
 // Also run the ordinary automatic path, not just injected fixed outcomes.
 await page.evaluate(()=>{stop();init()});await page.waitForFunction(()=>game.totalPitches>=8,{},{timeout:35000});
 await page.evaluate(()=>stop());assert.deepEqual(errors,[]);console.log('BROWSER ORDINARY AUTO PASS',await page.evaluate(()=>({pitches:game.totalPitches,inning:game.inning})), 'page errors 0');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
