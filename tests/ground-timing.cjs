'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const source=html.slice(html.indexOf('function moveGroundFielder('),html.indexOf('function animate(kind,'));
function run(outcome){
 let now=0,frames=[],timers=[],calls=[];
 const el=(x,y)=>({style:{},a:{cx:String(x),cy:String(y)},setAttribute(k,v){this.a[k]=String(v)},getAttribute(k){return this.a[k]||'0'}});
 const positions={SS:[150,121],'1B':[286,189],'2B':[250,121]};
 const players=Object.fromEntries(Object.entries(positions).map(([k,p])=>[k,el(...p)])),labels=Object.fromEntries(Object.entries(positions).map(([k,p])=>[k,el(...p)]));
 const ball=el(200,283),field={querySelector(s){const id=s.match(/data-position="([^"]+)"/)?.[1];return s.startsWith('circle')?players[id]:labels[id]}};
 const context={Math,Date,animationToken:1,playTimers:[],animationHoldUntil:0,game:{forceOutVisual:{runnerAt:1400,forceCallAt:1445}},
 performance:{now:()=>now},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),runnerFirstMs:()=>1550,throwFlightMs:()=>340,fielderReleaseMs:()=>225,
 current:()=>({def:{players:Array.from({length:20},()=>({field:55,arm:55}))}}),
 $:id=>id==='fielders'?field:id==='ball'?ball:null,requestAnimationFrame:f=>frames.push(f),setTimeout:(f,ms)=>{timers.push({at:now+ms,f});return timers.length},showPitchResult:s=>calls.push({at:now,s}),animateBatterRun:()=>{}};
 vm.createContext(context);vm.runInContext(source,context);
 vm.runInContext(`animateGround('${outcome}',{defender:'SS',point:[158,156]},55,55,{pickup:650,releaseMs:345,runnerMs:2000})`,context);
 function advance(t){while(now<t){now=Math.min(t,now+5);const due=timers.filter(x=>x.at<=now);timers=timers.filter(x=>x.at>now);due.forEach(x=>x.f());const f=frames;frames=[];f.forEach(x=>x(now));}}
 const receive=650+345+340,call=Math.max(receive+70,1445),label=outcome==='double'?'二塁アウト！':'二塁封殺！';
 advance(receive-5);assert.ok(!calls.some(x=>x.s===label),'no call before ball arrival');
 advance(receive+10);assert.ok(Math.hypot(+ball.getAttribute('cx')-200,+ball.getAttribute('cy')-47)<1,'ball reaches second');
 assert.equal(players['2B'].getAttribute('data-pivot-phase'),'receive');
 advance(call-5);assert.ok(!calls.some(x=>x.s===label),'no call before scheduled verdict');
 advance(call);assert.ok(calls.some(x=>x.s===label&&x.at>=receive));
 if(outcome==='double'){advance(receive+225+50);assert.ok(+ball.getAttribute('cx')>200,'relay toward first starts after pivot');}
 console.log(outcome,JSON.stringify({release:995,receive,runner:1400,call}));
}
run('force');run('double');console.log('GROUND TIMING PASS');
