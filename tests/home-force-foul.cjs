'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync(path.join(__dirname,'debug-plays.cjs'),'utf8');
const scenario=new Function('require','__dirname',harness.slice(0,harness.indexOf('const normal=scenario('))+'\nreturn scenario;')(require,__dirname);
function seededScenario(){const old=Math.random;let seed=123456;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};try{return scenario('?debug=plays')}finally{Math.random=old}}
function fixture(outs=0,loaded=true,slow=false,fastThird=false){
 const f=seededScenario();f.c.Math=Object.create(Math);f.c.Math.random=()=>.5;
 vm.runInContext(`stop();game.outs=${outs};game.bases=[${loaded?'current().bat.players[6]':'null'},${loaded?'current().bat.players[7]':'null'},current().bat.players[8]];
 const actor=batter(),defPitcher=pitcher(),old=game.bases.slice(),runsBefore=total(game.half),outsBefore=defPitcher.outsPitched;
 actor.speed=55;old.filter(Boolean).forEach(p=>p.speed=55);${fastThird?'actor.speed=20;old[2].speed=90;':''}
 const direction={label:'三遊間のゴロ',defender:'SS',point:[158,156]};
 GROUND_DIRECTIONS.splice(0,GROUND_DIRECTIONS.length,direction);chooseGrounderStrength=()=> 'hard';
 groundDefender=()=>({field:50,speed:50,arm:55});
 ${slow?'const originalTimes=groundPlayTimes;groundPlayTimes=(...args)=>({...originalTimes(...args),pickup:1250,arrive:1990});':''}
 let drawn;animateGround=(...args)=>drawn=args;animateInfieldRangeChase=()=>{};animate=()=>{};animateOutfieldReturn=()=>{};
 groundBall(actor);`,f.c);
 return {f,get:s=>vm.runInContext(s,f.c)};
}
for(const outs of [0,1]){
 const {get}=fixture(outs);assert.equal(get('drawn[0]'),'homeForce');assert.equal(get('game.outs'),outs+1);
 assert.equal(get('defPitcher.outsPitched-outsBefore'),1);assert.equal(get('total(game.half)'),get('runsBefore'));
 assert.equal(get('actor.ab'),1);assert.equal(get('actor.h'),0);assert.equal(get('actor.rbi'),0);
 assert.deepEqual(Array.from(get('game.bases.map(p=>p.id)')),Array.from(get('[actor,old[0],old[1]].map(p=>p.id)')));
 assert.equal(get('game.homePlayOutId'),get('old[2].id'));
 assert.ok(get('drawn[4].homeForce.receiveAt+25<drawn[4].homeForce.runnerAt'));
 console.log('HOME FORCE',outs+' outs',JSON.stringify(get('drawn[4].homeForce')));
}
{const {get}=fixture(0,true,true);assert.notEqual(get('drawn?.[0]'),'homeForce');assert.equal(get('game.outs'),0);assert.equal(get('actor.h'),1,'late pickup remains infield hit');}
{const {get}=fixture(0,true,false,true);assert.notEqual(get('drawn?.[0]'),'homeForce');assert.equal(get('drawn[0]'),'out','fast lead runner: take first out');assert.equal(get('game.outs'),1);}
{const {get}=fixture(2);assert.equal(get('drawn[0]'),'out');assert.equal(get('game.outs'),3);assert.equal(get('total(game.half)'),get('runsBefore'));assert.equal(get('old[2].r'),0,'third out never scores');}
{const {get}=fixture(0,false);assert.equal(get('drawn[0]'),'out');assert.equal(get('game.outs'),1);}
// The production entry also completes exactly one PA and turns the inning
// on the third out without a run (not only a direct groundBall unit call).
{
 const f=seededScenario(),c=f.c;c.Math=Object.create(Math);c.Math.random=()=>.9;
 vm.runInContext("stop();game.outs=2;game.bases=current().bat.players.slice(6,9);game.bases.forEach(p=>p.speed=55);const actor=batter(),oldHalf=game.half,oldInning=game.inning,score=total(oldHalf),order=current().bat;actor.speed=55;tactics=()=>false;maybeChangePitcher=()=>{};groundDefender=()=>({field:50,speed:50,arm:55});chooseGrounderStrength=()=> 'hard';GROUND_DIRECTIONS.splice(0,4,{label:'三遊間のゴロ',defender:'SS',point:[158,156]});resolvePitch()",c);
 assert.equal(vm.runInContext('game.half',c),1);assert.equal(vm.runInContext('game.outs',c),0);assert.equal(vm.runInContext('total(oldHalf)',c),vm.runInContext('score',c));assert.equal(vm.runInContext('order.bat',c),1);assert.equal(vm.runInContext('actor.ab',c),1);
}
// Timing inequalities, not a blanket loaded-bases rule. Direction/arm/strength
// influence actual handling/throw clocks; this does not add any RNG draws.
{const {get}=fixture();assert.equal(get("groundHomeForcePlan(direction,{arm:55},{pickup:1100,releaseMs:345,arrive:1750,runnerMs:1553},{speed:90},0,true).forceOut"),false);}
assert.equal(fixture().get('JSON.stringify(drawn[4])'),fixture().get('JSON.stringify(drawn[4])'),'fixed seed replay');
// Run the actual animation with a virtual clock and actual fielder nodes.
{
 const f=seededScenario(),c=f.c,n=f.nodes;
 function el(x,y){return {style:{},a:{cx:''+x,cy:''+y},setAttribute(k,v){this.a[k]=''+v},getAttribute(k){return this.a[k]||'0'}}}
 const players={SS:el(143,107),C:el(200,315)};n.get('fielders').querySelector=s=>s.startsWith('circle')?players[s.match(/data-position="([^"]+)"/)[1]]:el(0,0);
 vm.runInContext("stop();const actor=batter();game.bases=[actor,null,null];animateBatterRun=()=>{};animateGround('homeForce',{defender:'SS',point:[158,156]},55,55,{pickup:520,releaseMs:345,runnerMs:1553,arrive:1240,homeForce:{throwMs:395,receiveAt:1260,runnerAt:1373,callAt:1418,decisionMs:1663}})",c);
 f.advance(490);assert.ok(+n.get('ball').getAttribute('cy')>156);assert.notEqual(n.get('pitchResult').textContent,'本塁封殺！');
 f.advance(770);assert.ok(Math.hypot(+n.get('ball').getAttribute('cx')-200,+n.get('ball').getAttribute('cy')-293)<1);assert.equal(+players.C.getAttribute('cy'),293);
 f.advance(150);assert.notEqual(n.get('pitchResult').textContent,'本塁封殺！');f.advance(10);assert.equal(n.get('pitchResult').textContent,'本塁封殺！');
 vm.runInContext('stop()',c);const before=n.get('ball').getAttribute('cy');f.advance(2000);assert.equal(n.get('ball').getAttribute('cy'),before,'cancel invalidates frames');
}
// Actual foul frames: no ReferenceError, both wings outside fair lines,
// counters preserved after two strikes, no extra RNG for the new trail.
for(const side of ['left','right'])for(const kind of ['ground','fly']){
 const f=seededScenario(),c=f.c,n=f.nodes;let draws=0;c.Math=Object.create(Math);c.Math.random=()=>{draws++;return .4};
 vm.runInContext(`stop();game.strikes=2;const p=batter();animateFoulBall(foulDestination('${side}','${kind}'))`,c);
 const initial=draws;f.advance(kind==='ground'?700:1100);assert.equal(draws,initial);
 const x=+n.get('ball').getAttribute('cx'),y=+n.get('ball').getAttribute('cy');
 assert.ok(x>=5&&x<=395&&y>0&&y<=293);assert.ok(side==='left'?x<200-(293-y):x>200+(293-y));
 assert.match(n.get('foulTrail').getAttribute('d'),/^M200.0 283.0 L/);
 vm.runInContext('foulBall(p)',c);assert.equal(vm.runInContext('game.strikes',c),2);assert.equal(draws-initial,4,'historical side/kind/y/margin draw count');
 vm.runInContext('stop()',c);assert.equal(n.get('foulTrail').attrs.d,'');
}
for(const side of [-17,0,16])for(const bats of ['右打','左打']){
 const f=seededScenario();vm.runInContext(`stop();batter().bats='${bats}';drawPitch({side:${side},drop:18,flight:470})`,f.c);
 for(let t=0;t<1050;t+=10){f.advance(10);const y=+f.nodes.get('ball').getAttribute('cy'),x=+f.nodes.get('ball').getAttribute('cx');if(y>=265)assert.ok(x>=197&&x<=205,'ball excludes both body columns');}
}
console.log('HOME FORCE / FOUL / PITCH DISPLAY PASS');
