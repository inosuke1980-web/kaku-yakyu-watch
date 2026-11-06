'use strict';
const {chromium}=require('playwright'),{pathToFileURL}=require('url'),path=require('path'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
for(const width of [375,390])for(const kind of ['strikeFirst','strikeThird','flyThird','groundSecond','doubleThird']){
 const p=await b.newPage({viewport:{width,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await p.click('#start');await p.click('#pause');
 const state=await p.evaluate(kind=>{stop();playing=true;game.bases=[null,null,null];game.balls=0;game.strikes=0;game.outs=kind==='strikeFirst'?0:kind==='groundSecond'||kind==='doubleThird'?1:2;let old=Math.random;let seq;
 if(kind.startsWith('strike')){game.strikes=2;seq=[.4]}
 else if(kind==='flyThird'){const a=batter(),pi=pitcher(),hc=clamp(.105+(a.contact-(pi.control+pi.stuff)/2)*.0013,.055,.23);seq=[.9,hc+.12];outfieldContact=()=>({defender:'RF',fielder:{name:'fixed',field:55,arm:55},label:'右翼',point:[245,-25],caught:true,type:'fly'})}
 else{game.balls=1;game.bases=[current().bat.players[1],null,null];game.bases[0].speed=5;batter().speed=5;for(const f of current().def.players){f.field=99;f.speed=99;f.arm=99}seq=[.99,.99,.35,.3,.99,.5,.5,.99,kind==='doubleThird'?.01:.99,.01,.99]}
 if(kind.startsWith('strike')||kind==='flyThird')tactics=()=>false;maybeChangePitcher=()=>{};let i=0;Math.random=()=>seq[i++]??.99;render();try{resolvePitch()}finally{Math.random=old};return {end:game.outs,half:game.half,defer:activeOutPlay.deferAt,force:game.forceOutVisual?.outcome}},kind);
 if(kind==='flyThird'){assert.equal(await p.locator('#outCall').isVisible(),false);await p.waitForTimeout(1050);assert.equal(await p.locator('#outCall').isVisible(),false)}
 if(kind==='groundSecond'||kind==='doubleThird')await p.waitForTimeout(1700);
 await p.waitForFunction(()=>!document.querySelector('#outCall').hidden,null,{timeout:6000});const label=await p.locator('#outCall').textContent();assert.equal(label,['strikeThird','flyThird','doubleThird'].includes(kind)?'チェンジ':'アウト',JSON.stringify({kind,state,label}));
 if(process.env.FIXTURE_SCREENSHOT_DIR)await p.screenshot({path:path.join(process.env.FIXTURE_SCREENSHOT_DIR,`out-${width}-${kind}.png`)});
 const dim=await p.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight}));assert.ok(dim.w<=dim.iw&&dim.h<=dim.ih+1,JSON.stringify(dim));assert.deepEqual(errors,[]);console.log('OUT BROWSER PASS',width,kind,JSON.stringify(state));await p.close();
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
