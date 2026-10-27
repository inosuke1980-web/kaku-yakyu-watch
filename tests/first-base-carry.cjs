'use strict';
// Exercise the real ground animation with one clock for timers and frames.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const src=html.slice(html.indexOf('function batterFirstRoute('),html.indexOf('function animate(kind,'));
function exercise(outcome,runnerMs){
 let now=0,frames=[],timers=[],calls=[];
 const el=(x,y)=>({style:{},a:{cx:String(x),cy:String(y)},setAttribute(k,v){this.a[k]=String(v)},getAttribute(k){return this.a[k]??null}});
 const first=el(282,149),label=el(282,152),ball=el(200,283),runner=el(200,283);
 const field={querySelector(s){return s.startsWith('circle')?first:label}};
 const ctx={Math,Date,animationToken:1,playTimers:[],animationHoldUntil:0,batterRunnerOnField:false,game:{bases:[],forceOutVisual:null},
 performance:{now:()=>now},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),runnerFirstMs:()=>1550,throwFlightMs:()=>340,fielderReleaseMs:()=>225,
 batter:()=>({id:'batter'}),batterStancePlan:()=>({position:[200,283]}),finishBatterVisual:()=>{},
 $:id=>({fielders:field,ball,batterRunner:runner})[id]||null,
 requestAnimationFrame:f=>frames.push(f),setTimeout:(f,ms)=>{timers.push({at:now+ms,f});return timers.length},
 showPitchResult:s=>calls.push({at:now,s})};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 vm.runInContext(`animateGround('${outcome}',{defender:'1B',point:[290,182]},55,55,{pickup:650,arrive:875,releaseMs:345,runnerMs:${runnerMs}})`,ctx);
 function advance(t){while(now<t){now++;const due=timers.filter(x=>x.at<=now);timers=timers.filter(x=>x.at>now);due.forEach(x=>x.f());const f=frames;frames=[];f.forEach(x=>x(now));}}
 const xy=e=>[+e.getAttribute('cx'),+e.getAttribute('cy')];
 const near=(a,b,eps=.11)=>assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<=eps,`${a} vs ${b}`);
 advance(649);assert.notEqual(first.getAttribute('data-first-phase'),'carry');
 advance(650);assert.equal(first.getAttribute('data-first-phase'),'carry');near(xy(first),[290,182]);near(xy(ball),xy(first));
 for(const elapsed of [1,25,56,112,169,224]){
  advance(650+elapsed);const t=elapsed/225, progress=t*t*(3-2*t);
  near(xy(first),[290+33*progress,182-13*progress]);near(xy(ball),xy(first),.001);
 }
 advance(875);near(xy(first),[323,169]);near(xy(ball),xy(first));assert.equal(first.getAttribute('data-first-phase'),'bag');
 const decision=Math.max(875,runnerMs)+110;
 advance(decision-1);assert.equal(calls.filter(x=>x.s==='一塁アウト！'||x.s==='内野安打！').length,0);
 advance(decision);assert.ok(calls.some(x=>x.at===decision&&x.s===(outcome==='out'?'一塁アウト！':'内野安打！')));
 if(outcome==='safe')near(xy(runner),[323,169]);else near(xy(runner),[309,183]);
 console.log(outcome,JSON.stringify({pickup:650,bag:875,runnerMs,decision}));
}
// groundBall's existing rule: safe iff runnerMs + 25 < arrive.
assert.equal(1100+25<875,false);assert.equal(800+25<875,true);
exercise('out',1100);exercise('safe',800);
console.log('FIRST BASE CARRY PASS');
