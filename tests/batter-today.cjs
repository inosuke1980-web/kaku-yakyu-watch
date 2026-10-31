'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync(require('node:path').join(__dirname,'debug-plays.cjs'),'utf8');
const scenario=new Function('require','__dirname',harness.slice(0,harness.indexOf("const normal=scenario("))+'\nreturn scenario;')(require,__dirname);
const f=scenario('?debug=plays'),c=f.c;const get=s=>vm.runInContext(s,c);c.Math=Object.create(Math);let queue=[];c.Math.random=()=>queue.shift()??.5;
get("const originalTactics=tactics;tactics=()=>false;maybeChangePitcher=()=>{};trySteal=()=>false;animate=()=>{};animateOutfieldReturn=()=>{};animateGround=()=>{};animateBaseRunners=()=>{};animateFlyLeadAndReturn=()=>{};const firstTeam=current().bat;const firstPlayer=batter();");
function pitch(values,setup=''){queue=values.slice();get(setup+';resolvePitch()')}
function last(){return get('todayPlateResults(firstPlayer).at(-1)')}
pitch([0]);assert.equal(get('todayPlateResults(firstPlayer).length'),0,'unfinished PA not recorded');
pitch([.5],"game.strikes=2");assert.equal(last(),'見逃し三振');assert.equal(get('firstPlayer.k'),1);
get('firstTeam.bat=9;game.outs=0;game.balls=3;game.strikes=0');pitch([0]);assert.equal(last(),'四球');assert.equal(get('firstPlayer.ab'),1,'walk not charged AB');
get('firstTeam.bat=18;game.bases=[null,null,null];game.outs=0;game.balls=game.strikes=0');pitch([.9,0,.1]);assert.equal(last(),'単打');assert.equal(get('firstPlayer.h'),1);
assert.deepEqual(Array.from(get('todayPlateResults(firstPlayer)')),['見逃し三振','四球','単打']);
// Actual sacrifice decision, with fixed random inputs, preserves AB.
get('firstTeam.bat=27;game.outs=0;game.balls=game.strikes=0;game.bases=[firstTeam.players[6],null,null];tactics=originalTactics');pitch([0,0]);assert.equal(last(),'犠打');assert.equal(get('firstPlayer.ab'),2);
// Different player object in the same lineup slot starts a separate display history.
get("firstTeam.bat=36;game.outs=0;game.bases=[null,null,null];game.balls=game.strikes=0;tactics=()=>false;const substitute={...firstPlayer,id:'substitute-unique',name:'代打テスト',ab:0,h:0,k:0,bb:0,sh:0,sf:0};firstTeam.players[5]=substitute;game.strikes=2");pitch([.73]);assert.deepEqual(Array.from(get('todayPlateResults(substitute)')),['三振']);assert.equal(get('todayPlateResults(firstPlayer).length'),4);
get("$('detail').showModal=()=>{};renderBatterResults();detail(firstPlayer)");assert.match(f.nodes.get('detailBody').innerHTML,/第4打席　犠打/);
get('render();render()');assert.equal(get('todayPlateResults(firstPlayer).length'),4,'render never adds result');
get('init();stop()');assert.equal(get('todayPlateResults(firstPlayer).length'),0,'new game clears display cache');
for(const [roll,label] of [[.8,'二塁打'],[.93,'三塁打'],[.99,'本塁打']]){
 const z=scenario('?debug=plays');z.c.Math=Object.create(Math);let q=[.9,0,roll];z.c.Math.random=()=>q.shift()??.5;
 vm.runInContext("tactics=()=>false;maybeChangePitcher=()=>{};trySteal=()=>false;animate=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};const actor=batter();resolvePitch()",z.c);
 assert.equal(vm.runInContext('todayPlateResults(actor)[0]',z.c),label);
}
{
 const z=scenario('?debug=plays');z.c.Math=Object.create(Math);let q=[.9,.25,0];z.c.Math.random=()=>q.shift()??.5;
 vm.runInContext("tactics=()=>false;maybeChangePitcher=()=>{};trySteal=()=>false;animate=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};animateFlyLeadAndReturn=()=>{};outfieldContact=()=>({caught:true,defender:'CF',fielder:{name:'中堅手',arm:55}});const actor=batter();actor.contact=50;pitcher().control=pitcher().stuff=50;game.bases[2]=current().bat.players[6];resolvePitch()",z.c);
 assert.equal(vm.runInContext('todayPlateResults(actor)[0]',z.c),'犠飛');assert.equal(vm.runInContext('actor.ab',z.c),0);
}
console.log('BATTER TODAY PASS: incomplete, called K, BB, hit, sacrifice, replacement, repeat render, reset');
