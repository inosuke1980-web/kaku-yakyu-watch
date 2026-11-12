'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const h=fs.readFileSync(require('node:path').join(__dirname,'debug-plays.cjs'),'utf8');
const scenario=new Function('require','__dirname',h.slice(0,h.indexOf('const normal=scenario('))+'\nreturn scenario;')(require,__dirname);
const f=scenario('?debug=plays'),run=s=>vm.runInContext(s,f.c);
const offsets={'1B':[7,-3],'2B':[11,-11],SS:[4,-20],'3B':[-7,-3]};
let prev=null;
for(const bats of ['右打','左打'])for(const bases of [0,1,2,3])for(const outs of [0,1,2]){
 const data=run(`(()=>{game.outs=${outs};game.bases=[${bases&1?'current().bat.players[1]':'null'},${bases&2?'current().bat.players[2]':'null'},null];batter().bats='${bats}';return {rule:defensiveAlignment().positions,draw:displayDefensiveAlignment().positions}})()`);
 for(const [pos,d] of Object.entries(offsets))assert.deepEqual(Array.from(data.draw[pos]),[data.rule[pos][0]+d[0],data.rule[pos][1]+d[1]]);
 if(prev)for(const pos of Object.keys(offsets)){const a=Math.hypot(...data.rule[pos].map((v,i)=>v-prev.rule[pos][i])),b=Math.hypot(...data.draw[pos].map((v,i)=>v-prev.draw[pos][i]));assert.ok(Math.abs(a-b)<1e-9,'constant offset preserves alignment movement distance');}
 prev=data;
}
assert.deepEqual(Array.from(run('INFIELD_NORMAL.SS')),[143,107]);assert.deepEqual(Array.from(run("INFIELD_NORMAL['2B']")),[257,107]);
f.c.Math=Object.create(Math);f.c.Math.random=()=>.5;
const before=run("(()=>{const d={defender:'SS',point:[158,156],strength:'normal'},f={field:55,speed:55,arm:55};return JSON.stringify([groundRangePlan(d,f),groundPlayTimes({speed:55},d,f)])})()");
run('globalThis.originalDisplay=displayDefensiveAlignment;displayDefensiveAlignment=()=>({positions:{SS:[0,0]}})');
assert.equal(run("(()=>{const d={defender:'SS',point:[158,156],strength:'normal'},f={field:55,speed:55,arm:55};return JSON.stringify([groundRangePlan(d,f),groundPlayTimes({speed:55},d,f)])})()"),before,'display coordinates never enter rule range/pickup');
run('displayDefensiveAlignment=originalDisplay');
console.log('INFIELD DISPLAY PASS: 24 configurations, all 4 offsets, movement clock invariance and rule independence');
