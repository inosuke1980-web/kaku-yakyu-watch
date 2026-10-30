'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const sec=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i);return html.slice(i,j)};
assert.ok(html.includes("showPitchResult(visual.safe?'盗塁成功！':'アウト',visual.safe?'ball':'strike')"));
let now=0,frames=[],timers=[];
const el=(x,y,pos)=>({style:{},attr:{cx:String(x),cy:String(y),'data-position':pos},setAttribute(k,v){this.attr[k]=String(v)},getAttribute(k){return this.attr[k]??'0'}});
const names={SS:el(143,107,'SS'),'2B':el(257,107,'2B'),LF:el(95,45,'LF'),CF:el(200,-76,'CF'),RF:el(305,45,'RF')}, labels=Object.fromEntries(Object.keys(names).map(n=>[n,el(0,0,n)])),ball=el(200,283,'ball');
const field={querySelector(s){const n=s.match(/data-position="([^"]+)/)?.[1];return s.startsWith('circle')?names[n]:labels[n]},querySelectorAll(){return Object.values(names)}};
const ctx={Math,performance:{now:()=>now},Date,animationToken:1,playTimers:[],animationHoldUntil:0,game:{},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
 $:id=>id==='fielders'?field:id==='ball'?ball:null,defensiveAlignment:()=>({positions:{SS:[143,107],'2B':[257,107]}}),
 requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{timers.push({at:now+ms,fn});return timers.length},
 outfieldPickupTiming:info=>({release:info.flightMs+200}),throwFlightMs:()=>400,fielderReleaseMs:()=>200,showPitchResult:()=>{}};
vm.createContext(ctx);vm.runInContext(sec('function alignmentMoveDuration(', '// Position all three outfielders')+sec('function moveGroundFielder(', 'function groundFirstCover(')+sec('function outfieldRelayDecision(', '// Compact broadcast-style'),ctx);
function tick(t){while(now<t){now=Math.min(now+10,t);let due=timers.filter(x=>x.at<=now);timers=timers.filter(x=>x.at>now);due.forEach(x=>x.fn());const batch=frames;frames=[];batch.forEach(x=>x(now));}}
const xy=e=>[+e.getAttribute('cx'),+e.getAttribute('cy')];
// Actual shortstop motion interpolator: fixed ground-ball approach and return.
vm.runInContext("moveGroundFielder($('fielders').querySelector('circle[data-position=\"SS\"]'),null,[158,156],650,animationToken)",ctx);
let prev=xy(names.SS),max=0;for(let t=10;t<=650;t+=10){tick(t);const p=xy(names.SS);max=Math.max(max,Math.hypot(p[0]-prev[0],p[1]-prev[1]));prev=p;}assert.ok(max<2);assert.deepEqual(xy(names.SS),[158,156]);
vm.runInContext("moveGroundFielder($('fielders').querySelector('circle[data-position=\"SS\"]'),null,[143,107],350,animationToken)",ctx);tick(1000);assert.deepEqual(xy(names.SS),[143,107]);
// Real alignment code called with false snaps directly; reproduce at a plausible
// second-base cover position. This does not establish the user's observed play.
names.SS.setAttribute('cx',200);names.SS.setAttribute('cy',47);const before=xy(names.SS);vm.runInContext('applyDefensiveAlignment(false)',ctx);const after=xy(names.SS),jump=Math.hypot(after[0]-before[0],after[1]-before[1]);assert.ok(jump>80);assert.deepEqual(after,[143,107]);
// Actual relay code: instrument targets by looking at motion endpoints and ball
// at receipt. Same fake timing and same landing used for each controlled case.
for(const [pos,point] of [['LF',[100,65]],['CF',[200,55]],['RF',[300,65]]]){
 now=0;frames=[];timers=[];for(const [n,p] of Object.entries({SS:[143,107],'2B':[257,107],LF:[95,45],CF:[200,-76],RF:[305,45]})){names[n].setAttribute('cx',p[0]);names[n].setAttribute('cy',p[1]);}ball.setAttribute('cx',point[0]);ball.setAttribute('cy',point[1]);
 ctx.info={defender:pos,point,flightMs:800};vm.runInContext("animateOutfieldReturn('single',false,55,null,info)",ctx);tick(650);const who=pos==='LF'?'SS':'2B';assert.deepEqual(xy(names[who]),[200,116]);tick(1400);assert.deepEqual(xy(ball),[200,116]);
 console.log(JSON.stringify({case:pos,landing:point,relay:who,cutoff:[200,116],throw:'pickup to cutoff; holds',atRelay:1400}));
}
console.log(JSON.stringify({groundApproachMax10ms:max,alignmentSnapFrom:before,to:after,distance:jump}));console.log('SHORTSTOP AND RELAY STUDY PASS');
