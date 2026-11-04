'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const text=fs.readFileSync(path.join(__dirname,'debug-plays.cjs'),'utf8');
const base=text.slice(0,text.indexOf('const normal=scenario('));
function harness(reverse=false){let source=base;
 if(reverse){const before='for(const [key,v] of [...timers])if(v.at<=time){timers.delete(key);v.f()}const callbacks=frames.splice(0);callbacks.forEach(f=>f(time));';const after='const callbacks=frames.splice(0);callbacks.forEach(f=>f(time));for(const [key,v] of [...timers])if(v.at<=time){timers.delete(key);v.f()}';assert.ok(source.includes(before));source=source.replace(before,after)}
 return new Function('require','__dirname',source+'\nreturn scenario;')(require,__dirname)('?debug=plays');
}
function fixture(reverse=false){const f=harness(reverse),n=f.nodes,c=f.c;
 const el=(x,y,pos)=>({style:{},a:{cx:''+x,cy:''+y,'data-position':pos},getAttribute(k){return this.a[k]||'0'},setAttribute(k,v){this.a[k]=''+v}});
 const origins={LF:[99,-5],CF:[200,-75],RF:[301,-5],SS:[143,107],'2B':[257,107],'1B':[282,149],'3B':[118,149],C:[200,315],P:[200,203]};
 const players=Object.fromEntries(Object.entries(origins).map(([k,v])=>[k,el(...v,k)])),labels=Object.fromEntries(Object.entries(origins).map(([k,v])=>[k,el(...v,k)]));
 const field={childNodes:Object.values(players),querySelectorAll:()=>Object.values(players),querySelector(s){const id=s.match(/data-position="([^"]+)"/)?.[1];return s.startsWith('text')?labels[id]:players[id]}};
 n.set('fielders',field);vm.runInContext('stop();animateBatterRun=()=>{};',c);for(const [k,v]of Object.entries(origins)){players[k].setAttribute('cx',v[0]);players[k].setAttribute('cy',v[1]);}
 c.Date=class extends Date{static now(){return 0}};vm.runInContext('animationHoldUntil=0',c);c.Math=Object.create(Math);c.Math.random=()=>{throw Error('visual consumed gameplay RNG')};
 return {...f,players,labels,origins,get:s=>vm.runInContext(s,c),xy:node=>[+node.getAttribute('cx'),+node.getAttribute('cy')]};
}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);let cases=0;
for(const reverse of [false,true])for(const [side,point]of [['LF',[90,15]],['CF',[200,-25]],['RF',[310,15]]])for(const goal of ['hold','third','home']){
 const f=fixture(reverse),{c,get,nodes:n,players}=f;c.info={flight:'gapLiner',flightMs:850,point,defender:side,fielder:{field:55,arm:55},nearMiss:true};c.play=goal==='hold'?null:{id:'fixed-runner',safe:false,wild:false};
 const snapshot=get('JSON.stringify([game.teams,game.bases,game.outs,game.totalPitches])');
 get(`const decision=outfieldRelayDecision(false,${goal==='home'?'play':'null'},${goal==='third'?'play':'null'},'single');const route=outfieldRelayVisualRoute('single',info,info.point,55,decision);animate(info.flight,info,55,1);animateOutfieldReturn('single',false,55,${goal==='home'?'play':'null'},info,${goal==='third'?'play':'null'});`);
 const route=get('route');assert.equal(get('animationHoldUntil'),get("Math.max(route.atGoal,game.crossPlayVisual?.runnerArrival||0)+430"),'existing completion deadline preserved');const relay=players[side==='LF'?'SS':'2B'];
 assert.equal(route.atRelay,get('outfieldPickupTiming(info,55).release+throwFlightMs(55,info.point,[200,116])'));
 if(goal!=='hold')assert.equal(route.atGoal,get('route.atRelay+fielderReleaseMs(65,65,true)+throwFlightMs(65,[200,116],decision.goal)'));
 f.advance(route.release-100+20);
 assert.ok(distance(f.xy(players[side]),point)<.2,'fielder at actual pickup');assert.ok(distance(f.xy(n.get('ball')),point)<.2,'resting ball at pickup');assert.ok(distance(f.xy(n.get('outfieldPickupGlove')),point)<.2);
 assert.equal(players[side].getAttribute('data-fielding-phase'),'pickup');assert.equal(n.get('outfieldPickupGlove').getAttribute('visibility'),'visible');
 f.advance(70);assert.equal(players[side].getAttribute('data-fielding-phase'),'pickup','not throwing early');
 f.advance(40);assert.equal(players[side].getAttribute('data-fielding-phase'),'throw');
 f.advance(route.atRelay+20-(route.release+30));
 assert.ok(distance(f.xy(n.get('ball')),route.cutoff)<.3,'ball actually passes new relay');assert.ok(distance(f.xy(relay),route.cutoff)<.2,'relay in position');
 assert.equal(relay.getAttribute('data-relay-phase'),'receive');
 if(goal!=='hold'){
  f.advance(route.relayPause+route.finalMs+5);
  const target=goal==='third'?[77,169]:[200,293];assert.ok(distance(f.xy(n.get('ball')),target)<.3,'onward ball arrives at verdict base');assert.ok(distance(f.xy(players[goal==='third'?'3B':'C']),target)<.2,'base covered');
 }
 f.advance(1400);assert.ok(distance(f.xy(relay),f.origins[side==='LF'?'SS':'2B'])<.2);
 if(goal==='hold')assert.ok(distance(f.xy(n.get('ball')),f.xy(relay))<.2,'held ball returns with relay');
 assert.equal(get('JSON.stringify([game.teams,game.bases,game.outs,game.totalPitches])'),snapshot,'visual does not alter results');
 console.log('ROUTE',JSON.stringify({reverse,side,goal,point,cutoff:route.cutoff,release:route.release,atRelay:route.atRelay,atGoal:route.atGoal}));cases++;
}
// Other single trajectories (including a fly without a flight property) must
// also complete recovery before the true pickup/glove frame.
for(const flight of ['groundThrough','overHead','fenceDouble','legacyFly']){
 const f=fixture();f.c.info={point:[245,-25],defender:'RF',fielder:{field:55,arm:55},flightMs:flight==='legacyFly'?undefined:1230,...(flight==='legacyFly'?{type:'fly'}:{flight}),rollEnd:[250,-20],rebound:[255,5]};
 f.get("const route=outfieldRelayVisualRoute('single',info,info.rebound||info.rollEnd||info.point,55,outfieldRelayDecision());animate(info.flight||'single',info,55,1);animateOutfieldReturn('single',false,55,null,info)");
 // Fixtures only supply trajectory-relevant endpoints, like the real generator.
 // Check the renderer's destination, not an assumed stationary fielder.
 f.advance(f.get('route.release')-80);
 const ball=f.xy(f.nodes.get('ball')),fielder=f.xy(f.players.RF);
 assert.ok(distance(ball,fielder)<.3,flight+' recovery matches ball');
}
// Candidate receiving points stay inside all eight existing park shapes.
{
 const f=fixture();for(const shape of f.get('Object.keys(PARK_SHAPES)'))for(const point of [[90,15],[200,-25],[310,15]])for(const goal of ['hold','third','home']){
  f.c.shape=shape;f.c.point=point;f.c.goal=goal;
  assert.ok(f.get("(()=>{game.parkShape=shape;const decision=outfieldRelayDecision(false,goal==='home'?{}:null,goal==='third'?{}:null);const p=outfieldRelayVisualRoute('single',{flightMs:850},point,55,decision).cutoff;return p.every(Number.isFinite)&&p[0]>=5&&p[0]<=395&&p[1]>=outfieldFenceY(p[0])+8&&p[1]<=293})()"));
 }
}
// An existing SS movement must stop writing after the relay owns that SS.
{
 const f=fixture(),{players}=f;f.c.actor=players.SS;
 f.get("moveGroundFielder(actor,null,[200,47],3000,animationToken)");f.advance(100);
 f.get("animateOutfieldReturn('single',false,55,null,{flight:'gapLiner',flightMs:850,point:[90,15],defender:'LF',fielder:{field:55,arm:55}})");f.advance(700);
 assert.ok(distance(f.xy(players.SS),[147.2,31.64])<.2,'old frame cannot overwrite relay');
 f.get("moveGroundFielder(actor,null,[130,120],200,animationToken)");f.advance(4000);assert.ok(distance(f.xy(players.SS),[130,120])<.2,'old return timer cannot overwrite new movement');
}
// A later ordinary double play still works after its 2B opted into relay ownership.
{
 const f=fixture();f.c.actor=f.players['2B'];
 f.get("moveGroundFielder(actor,null,[257,107],1,animationToken,{relayOwner:'outfield-relay'})");f.advance(10);
 f.get("game.forceOutVisual={id:'runner',speed:55,runnerAt:1400,forceCallAt:1445};animateGround('double',{defender:'SS',point:[158,156]},55,55,{pickup:650,releaseMs:345,runnerMs:2400})");f.advance(2300);
 assert.ok(distance(f.xy(f.nodes.get('ball')),[323,169])<.3,'normal double-play throw reaches first');
}
// Restart and switching invalidate old frames and timers; no saves or scores.
{
 const f=harness(),n=f.nodes;vm.runInContext("$('debugPlay')",f.c);const initial=vm.runInContext('JSON.stringify(game.teams)',f.c);
 for(const play of ['relayLF','relayCF','relayRF','relayHome','relayThird','relayLF']){
  n.get('debugPlay').value=play;n.get('debugStart').onclick();f.advance(1300);n.get('debugRestart').onclick();f.advance(5200);assert.equal(f.timers.size,0);
 }
 n.get('debugPlay').value='relayLF';n.get('debugStart').onclick();f.advance(1100);n.get('debugPlay').value='pitch';n.get('debugRestart').onclick();f.advance(6000);assert.equal(f.timers.size,0);assert.equal(f.saved,0);assert.equal(vm.runInContext('JSON.stringify(game.teams)',f.c),initial);
}
console.log('OUTFIELD RELAY MOTION PASS '+cases+' timed route cases, trajectories, ownership, restarts and no RNG');
