'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
function section(start,end){return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)))}
const ctx={Math};vm.createContext(ctx);
vm.runInContext('const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));\n'+section('function pitcherPose(t){','function pitchActionVisual')+section('function outfieldPursuitPlan(','// Describe what actually happened'),ctx);
let previous;
for(let i=0;i<=1000;i++){
 const pose=vm.runInContext(`pitcherPose(${i/1000})`,ctx);
 assert.equal(pose.length,8);assert.ok(pose.every(Number.isFinite));
 if(previous)assert.ok(pose.every((v,j)=>Math.abs(v-previous[j])<1),'pose moves continuously');
 previous=pose;
}
assert.deepEqual(Array.from(vm.runInContext('pitcherPose(0)',ctx)),Array.from(vm.runInContext('pitcherPose(1)',ctx)));
for(const flight of ['groundThrough','gapLiner','overHead','fenceDouble']){
 const info={flight,point:[100,-30],rollEnd:[102,-40],rebound:[110,-20],caught:false};
 ctx.info=info;
 const p=vm.runInContext('outfieldPursuitPlan(info.flight,info,[90,40],1000)',ctx);
 assert.deepEqual(Array.from(p.destination),flight==='groundThrough'?info.rollEnd:flight==='fenceDouble'?info.rebound:info.point);
 assert.ok(p.chaseMs<=1000);
}
assert.match(html,/at\(duration,\(\)=>\{nearest\.setAttribute\('data-fielding-phase','recover'\)/);
assert.match(html,/const started=performance\.now\(\)\+PITCH_WINDUP_MS/);
console.log('ANIMATION MOTION CHECKS PASS');
