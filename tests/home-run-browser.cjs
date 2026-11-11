'use strict';
const {chromium}=require('playwright'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
for(const [width,height] of [[375,667],[390,844]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-12T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-12T00:00:01Z'));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.evaluate(()=>{init();stop();saveGame=()=>{};globalThis.fixtureRealArrival=scoreRunnerArrived});
 const captures=[];
 async function snapshot(label){const value=await page.evaluate(()=>({elapsed:homeRunPresentation?.elapsed??null,arrived:homeRunPresentation?.arrived??false,banner:!$('homeRunBanner').hidden,title:$('homeRunTitle').textContent,kind:$('homeRunKind').textContent,score:$('scoreFlash').hidden?null:$('scoreFlash').textContent,visual:visualScoring?.scores,ball:[$('ball').getAttribute('cx'),$('ball').getAttribute('cy')],pitch:game.totalPitches,ended:game.ended,runners:[...document.querySelectorAll('[data-moving-runner]')].map(n=>[n.getAttribute('data-moving-runner'),n.getAttribute('cx'),n.getAttribute('cy'),n.getAttribute('visibility')])}));captures.push({label,...value});if(process.env.FIXTURE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,`hr-${width}-${label}.png`)});return value;}
 for(const [label,count,walkoff,speed] of [['solo',0,false,1],['two',1,false,1],['three',2,false,1],['grand',3,false,1],['walkoff',3,true,1],['double-speed',1,false,2],['quad-speed',3,false,4]]){
  await page.evaluate(({count,walkoff,speed})=>{
   stop();resetScoreFlash();game.ended=false;game.inning=walkoff?9:1;game.half=walkoff?1:0;game.outs=0;game.balls=game.strikes=0;game.totalPitches=0;
   for(const t of game.teams){t.bat=0;t.runs=Array.from({length:game.inning},()=>0);for(const p of t.players)p.speed=55}
   game.bases=[0,1,2].map(i=>i<count?current().bat.players[i+1]:null);playing=true;$('pause').disabled=$('next').disabled=false;$('pause').textContent='一時停止';$('speed').value=String(speed);render();
   drawPitch(PITCH_TYPES[0]);
  },{count,walkoff,speed});
  await page.clock.runFor(970);
  await page.evaluate(()=>{tactics=()=>false;maybeChangePitcher=()=>{};trySteal=()=>false;const real=Math.random;let i=0;Math.random=()=>[.9,0,.99,.5][i++]??.5;try{globalThis.fixtureHitter=batter();globalThis.fixtureHr=fixtureHitter.hr;resolvePitch()}finally{Math.random=real}
   globalThis.hrScores=[];const realArrival=fixtureRealArrival;scoreRunnerArrived=(id,token)=>{const had=visualScoring?.pending.has(id);realArrival(id,token);if(had&&!visualScoring?.pending.has(id))hrScores.push({id,at:homeRunPresentation?.elapsed,scores:visualScoring.scores.slice()})};
  });
  assert.equal(await page.evaluate(()=>fixtureHitter.hr-fixtureHr),1);
  await page.clock.runFor(1300);const flying=await snapshot(label+'-flight');assert.equal(flying.banner,false);assert.equal(flying.score,null);assert.equal(flying.pitch,1);
  await page.evaluate(()=>$('pause').onclick());const paused=await snapshot(label+'-paused-flight');await page.clock.runFor(700);const still=await snapshot(label+'-still-flight');assert.equal(still.elapsed,paused.elapsed);assert.deepEqual(still.ball,paused.ball);assert.deepEqual(still.runners,paused.runners);
  await page.evaluate(()=>$('pause').onclick());await page.clock.runFor(150);const edge=await snapshot(label+'-arrival');assert.equal(edge.banner,true);assert.ok(edge.elapsed>=1400);assert.match(edge.kind,new RegExp(['ソロ','2ラン','3ラン','満塁'][count]));if(count===3)assert.equal(edge.title,'満塁ホームラン！');
  await page.clock.runFor(180);const scored=await snapshot(label+'-first-score');if(count>=2)assert.ok(scored.visual[walkoff?1:0]>0);else assert.equal(scored.score,null);
  await page.evaluate(()=>$('pause').onclick());const shown=await snapshot(label+'-paused-banner');await page.clock.runFor(800);const held=await snapshot(label+'-held-banner');assert.equal(held.elapsed,shown.elapsed);assert.equal(held.banner,true);
  await page.evaluate(()=>{$('next').onclick();$('next').onclick();$('next').onclick()});await page.clock.runFor(2700);const done=await snapshot(label+'-done');assert.equal(done.banner,false);assert.equal(done.visual[walkoff?1:0],count+1);assert.equal(done.pitch,1);assert.equal(done.ended,walkoff);
  const scoring=await page.evaluate(()=>hrScores);assert.equal(new Set(scoring.map(x=>x.id)).size,count+1);assert.equal(scoring.length,count+1);assert.ok(scoring.every(x=>x.at>=1400));
  if(walkoff)assert.equal(await page.locator('#next').isDisabled(),true);
  const layout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,fieldScroll:document.querySelector('.field-card').scrollHeight>document.querySelector('.field-card').clientHeight+1}));assert.ok(layout.w<=layout.iw&&layout.h<=layout.ih+1&&!layout.fieldScroll,JSON.stringify(layout));
  console.log('HOME RUN BROWSER PASS',width,label,'unique scoring',JSON.stringify(scoring));
 }
 // New game cancels every pending HR frame, reservation and announcement.
 await page.evaluate(()=>{stop();game.ended=false;game.inning=1;game.half=0;game.bases=[null,null,null];beginVisualScoring();hit(batter(),4);init();stop();render()});await page.clock.runFor(5000);assert.equal(await page.locator('#homeRunBanner').isVisible(),false);
 assert.deepEqual(errors,[]);if(process.env.FIXTURE_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.FIXTURE_SCREENSHOT_DIR,`hr-${width}-frames.json`),JSON.stringify(captures,null,2));await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
