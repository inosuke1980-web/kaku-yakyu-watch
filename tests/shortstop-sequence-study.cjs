'use strict';
// Existing animation, pitch and scheduler functions under a virtual clock.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function sec(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i);return html.slice(i,j)}
function run(forceEarly){let now=0,timers=[],frames=[],events=[],max=0,prev=[143,107];
 const el=(x=0,y=0,pos='')=>({style:{},a:{cx:String(x),cy:String(y),'data-position':pos},setAttribute(k,v){this.a[k]=String(v)},getAttribute(k){return this.a[k]??'0'},append(){},replaceChildren(){},querySelector(){return null}});
 const ss=el(143,107,'SS'),two=el(257,107,'2B'),one=el(282,149,'1B'),third=el(118,149,'3B');const circles={SS:ss,'2B':two,'1B':one,'3B':third};const labels=Object.fromEntries(Object.keys(circles).map(k=>[k,el()]));
 const field={querySelector(s){let k=s.match(/data-position="([^\"]+)/)?.[1];return s.startsWith('circle')?circles[k]:labels[k]}};
 const layers={fielders:field,stealPlaySprites:el(),pickoffSprites:el(),runners:el(),speed:{value:'4'}};
 const ctx={Math:Object.create(Math),performance:{now:()=>now},Date:class extends Date{static now(){return now}},animationToken:1,playing:true,timer:null,flightTimer:null,animationHoldUntil:0,playTimers:[],game:{bases:[null,{id:'runner',speed:55},null],ended:false},
 document:{createElementNS:()=>el()},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),defensiveAlignment:()=>({positions:{SS:[143,107],'2B':[257,107],'1B':[282,149],'3B':[118,149]}}),
 $:id=>layers[id]||null,requestAnimationFrame:f=>frames.push(f),setTimeout:(f,d)=>{const o={at:now+Math.max(0,d),f};timers.push(o);return o},clearTimeout:id=>{timers=timers.filter(x=>x!==id)},showPitchResult:s=>events.push([now,s,+ss.a.cx,+ss.a.cy]),startPitchMotion:()=>events.push([now,'pitch-start'])};
 let rolls=[0,.9,.9];ctx.Math.random=()=>rolls.shift()??.9;
 vm.createContext(ctx);vm.runInContext(sec('function alignmentMoveDuration(', '// Position all three outfielders')+sec('const TACTICAL_BASES=', 'function leadRunnerVisual(')+sec('function pickoffVisualPlan(', 'function endHalf(')+sec('function moveGroundFielder(', 'function groundFirstCover(')+sec('function pitch(){','function startPitchMotion(){')+sec('function schedule(){','// Debug rehearsal'),ctx);
 function tick(to){while(now<to){now=Math.min(now+5,to);const due=timers.filter(x=>x.at<=now);timers=timers.filter(x=>x.at>now);due.forEach(x=>x.f());let batch=frames;frames=[];batch.forEach(x=>x(now));const p=[+ss.a.cx,+ss.a.cy];max=Math.max(max,Math.hypot(p[0]-prev[0],p[1]-prev[1]));prev=p;}}
 vm.runInContext("animateStealPlay({id:'runner',speed:55,safe:true});schedule()",ctx);tick(400);assert.deepEqual([+ss.a.cx,+ss.a.cy],[200,47]);const cover=[now,+ss.a.cx,+ss.a.cy];
 if(forceEarly){const p=[+ss.a.cx,+ss.a.cy];vm.runInContext('pitch()',ctx);const q=[+ss.a.cx,+ss.a.cy];return {cover,instantAt:now,before:p,after:q,jump:Math.hypot(q[0]-p[0],q[1]-p[1]),note:'forced early call; not normal schedule'}}
 tick(2400);const atPick=events.find(e=>e[1]==='牽制球！');assert.ok(atPick);assert.ok(max<3,'ordinary schedule has no large frame jump');assert.ok(Math.abs(atPick[0]-(1040-26+135+530+170+200))<10);const status={cover,pickoffAt:atPick[0],ssAtPickoff:atPick.slice(2),maxFrameDelta:max,events};
 tick(4500);status.finalSS=[+ss.a.cx,+ss.a.cy];status.events=events;return status;
}
const normal=run(false),early=run(true);assert.ok(early.jump>80);console.log('NORMAL '+JSON.stringify(normal));console.log('FORCED '+JSON.stringify(early));console.log('SHORTSTOP SCHEDULER STUDY PASS');
// Fault-injection control: two simultaneous movement requests on the same SS
// share one animationToken; instrument actual writes, not a normal-play claim.
{
 let now=0,frames=[],writes=[],owner='';
 const circle={style:{},a:{cx:'143',cy:'107'},getAttribute(k){return this.a[k]||'0'},setAttribute(k,v){this.a[k]=String(v);if(k==='cx')writes.push({at:now,owner,x:+v})}};
 const c={Math,performance:{now:()=>now},animationToken:1,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),requestAnimationFrame:f=>frames.push(f)};
 vm.createContext(c);vm.runInContext(sec('function moveGroundFielder(', 'function groundFirstCover('),c);c.circle=circle;
 vm.runInContext('moveGroundFielder(circle,null,[200,47],400,animationToken)',c);now=100;owner='old';let batch=frames.splice(0);batch.forEach(f=>f(now));
 vm.runInContext('moveGroundFielder(circle,null,[143,107],300,animationToken)',c);now=150;batch=frames.splice(0);batch.forEach((f,i)=>{owner=i===0?'old':'new';f(now)});
 const w=writes.filter(x=>x.at===150);assert.equal(w.length,2);assert.notEqual(w[0].x,w[1].x);
 console.log('OVERLAPPING FRAME CONTROL '+JSON.stringify(w));
}
