'use strict';
// Optional real Chromium check for the local debug replay. It observes SVG
// attributes on rendered animation frames; it does not simulate a live match.
const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FIXTURE_CHROMIUM_PATH?{executablePath:process.env.FIXTURE_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?debug=plays';await page.goto(url);await page.selectOption('#debugPlay','shortstop');
  const results=[];
  for(let i=0;i<3;i++){
   await page.click(i===1?'#debugRestart':'#debugStart');
   const a=await page.evaluate(()=>new Promise(resolve=>{const samples=[],start=performance.now();function frame(t){const ss=document.querySelector('circle[data-position="SS"]');samples.push({t:t-start,x:Number(ss.getAttribute('cx')),y:Number(ss.getAttribute('cy'))});if(t-start<6500)requestAnimationFrame(frame);else resolve(samples)}requestAnimationFrame(frame)}));
   assert.ok(a.length>100,'enough rendered frames');assert.ok(a.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
   const pairs=a.slice(1).map((v,n)=>({dt:v.t-a[n].t,d:Math.hypot(v.x-a[n].x,v.y-a[n].y)})),regular=pairs.filter(x=>x.dt>0&&x.dt<40);
   assert.ok(regular.length>50);const max=Math.max(...regular.map(x=>x.d));assert.ok(max<35,`unexpected large frame displacement: ${max}`);
   assert.ok(a.some(v=>Math.hypot(v.x-200,v.y-47)<3),'reached second base');results.push({frames:a.length,regularMax:Number(max.toFixed(2)),slowFrames:pairs.length-regular.length});
  }
  assert.deepEqual(errors,[]);console.log('SHORTSTOP CHROMIUM REPLAY PASS '+JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
