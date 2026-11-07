'use strict';
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url'),path=require('node:path'),assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const [width,height] of [[375,667],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-07T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-07T00:00:01Z'));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?debug=plays');
  await page.evaluate(()=>{stop();playing=false;render()});
  const text=await page.locator('#batterToday').innerText();assert.match(text,/ミート/);assert.match(text,/球威/);assert.doesNotMatch(text,/変化球/);
  const swapped=await page.evaluate(()=>{const old=[batter().name,pitcher().name];current().bat.bat++;current().def.pitcher=1;renderBatterResults();return {old,now:[batter().name,pitcher().name],text:$('batterToday').innerText}});
  for(let i=0;i<2;i++){assert.notEqual(swapped.old[i],swapped.now[i]);assert.ok(swapped.text.includes(swapped.now[i]));}
  // Exercise real verdict branches, retaining all normal hit/fielding animation.
  for(const hand of ['右打','左打'])for(const kind of ['take','calledK','whiff','swingK','foul','hit','ground','fly']){
   await page.evaluate(({hand,kind})=>{
    stop();game.ended=false;game.inning=1;game.half=0;game.outs=0;game.balls=0;game.strikes=kind.endsWith('K')?2:0;game.bases=[null,null,null];current().bat.bat=0;batter().bats=hand;
    tactics=()=>false;trySteal=()=>false;maybeChangePitcher=()=>{};
    const rolls=kind==='take'||kind==='calledK'?[.45]:kind==='whiff'||kind==='swingK'?[.72]:kind==='foul'?[.6]:kind==='hit'?[.9,0,.5]:kind==='ground'?[.9,.99]:[.9,clamp(.105+(batter().contact-(pitcher().control+pitcher().stuff)/2)*.0013,.055,.23)+.15];let i=0;Math.random=()=>rolls[i++]??.5;
    render();resolvePitchCore();
   },{hand,kind});
   const frames=[];
   for(const delta of [0,60,80,80,180]){
    if(delta)await page.clock.runFor(delta);
    frames.push(await page.evaluate(()=>({bat:[$('batterBat').getAttribute('x2'),$('batterBat').getAttribute('y2')],body:$('batterJersey').getAttribute('transform'),phase:$('battingStance').getAttribute('data-visual-phase'),swing:$('battingStance').getAttribute('data-swing'),ball:[$('ball').getAttribute('cx'),$('ball').getAttribute('cy')]})));
    if(process.env.FIXTURE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,`player-${width}-${hand==='右打'?'R':'L'}-${kind}-${frames.length}.png`)});
   }
   const taken=kind==='take'||kind==='calledK';
   if(taken){assert.deepEqual(frames[0].bat,frames[1].bat);assert.equal(frames[0].swing,'no');assert.ok(!frames[0].body);}
   else {assert.equal(frames[0].swing,'yes');assert.notDeepEqual(frames[0].bat,frames[2].bat);assert.match(frames[1].body,/rotate/);assert.equal(frames[3].swing,'no');}
   console.log('VERDICT FRAMES',width,hand,kind,JSON.stringify(frames));
  }
  // Restore ordinary watch mode for full-screen layout and extra innings.
  await page.evaluate(()=>{stop();history.replaceState(null,'',location.pathname);game.ended=false;game.inning=12;game.half=0;game.bases=[current().bat.players[6],null,null];render()});
  const layout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,fieldScroll:$('batterToday').closest('.field-card').scrollHeight>$('batterToday').closest('.field-card').clientHeight+1,abilities:$('batterToday').getBoundingClientRect().height,field:document.querySelector('.field-stage').getBoundingClientRect().height}));
  assert.ok(layout.w<=layout.iw&&layout.h<=layout.ih+1&&!layout.fieldScroll,JSON.stringify(layout));assert.ok(layout.field>=180);
  if(process.env.FIXTURE_SCREENSHOT_DIR){await page.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,`player-layout-${width}.png`)});fs.writeFileSync(path.join(process.env.FIXTURE_SCREENSHOT_DIR,`player-layout-${width}.json`),JSON.stringify(layout));}
  assert.deepEqual(errors,[]);console.log('PLAYER BROWSER PASS',width,JSON.stringify(layout));await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
