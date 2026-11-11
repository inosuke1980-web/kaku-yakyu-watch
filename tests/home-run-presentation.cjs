'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const harness=fs.readFileSync(require('node:path').join(__dirname,'debug-plays.cjs'),'utf8');
const scenario=new Function('require','__dirname',harness.slice(0,harness.indexOf('const normal=scenario('))+'\nreturn scenario;')(require,__dirname);
for(const count of [0,1,2,3]){
 const f=scenario('?debug=plays'),run=s=>vm.runInContext(s,f.c);
 run(`stop();playing=true;game.outs=0;game.bases=[0,1,2].map((x)=>x<${count}?current().bat.players[x+1]:null);globalThis.before=game.bases.slice();globalThis.runs=new Map(before.filter(Boolean).map(p=>[p.id,p.r]));beginVisualScoring();globalThis.hitter=batter();globalThis.hrBefore=hitter.hr;hit(hitter,4);animateBaseRunners(before,runs,game.half,game.inning);`);
 assert.equal(run('total(0)'),count+1);assert.equal(run('hitter.hr-hrBefore'),1);
 f.advance(1300);assert.equal(f.nodes.get('homeRunBanner').hidden,true);assert.equal(f.nodes.get('scoreFlash').hidden,true);
 run('controlHomeRunPresentation()');const elapsed=run('homeRunPresentation.elapsed');f.advance(1000);assert.equal(run('homeRunPresentation.elapsed'),elapsed);
 run('controlHomeRunPresentation(true)');run('controlHomeRunPresentation(true)');f.advance(180);
 assert.equal(f.nodes.get('homeRunBanner').hidden,false);assert.equal(f.nodes.get('homeRunName').textContent,run('hitter.name'));
 assert.match(f.nodes.get('homeRunKind').textContent,new RegExp(['ソロ','2ラン','3ラン','満塁'][count]));
 f.advance(3200);assert.equal(f.nodes.get('homeRunBanner').hidden,true);assert.equal(run('visualScoring.pending.size'),0);assert.equal(run('visualScoring.scores[0]'),count+1);
 console.log('HOME RUN PASS',count+1,'runs, late banner, pause/step and unique scoring');
}
const w=scenario('?debug=plays'),r=s=>vm.runInContext(s,w.c);
r("stop();playing=true;game.inning=9;game.half=1;for(const t of game.teams)t.runs=[0,0,0,0,0,0,0,0,0];game.bases=[current().bat.players[1],current().bat.players[2],current().bat.players[3]];const old=game.bases.slice(),runs=new Map(old.map(p=>[p.id,p.r]));beginVisualScoring();hit(batter(),4);animateBaseRunners(old,runs,1,9)");
assert.equal(r('game.ended'),true);w.advance(1500);assert.equal(w.nodes.get('homeRunBanner').hidden,false);w.advance(3000);assert.equal(r('visualScoring.pending.size'),0);assert.equal(r('visualScoring.scores[1]'),4);assert.equal(w.nodes.get('homeRunBanner').hidden,true);
console.log('WALKOFF GRAND SLAM PASS: ended rules preserve ball, runners and announcement');
