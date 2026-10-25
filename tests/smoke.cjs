const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(src,'script required');
const ids=new Map();
function mock(){return {style:{},children:[],childNodes:[],dataset:{},value:1,disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(){},getAttribute(){return '0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
const document={getElementById(id){if(!ids.has(id))ids.set(id,mock());return ids.get(id)},createElement:mock,createElementNS:mock,querySelector:mock,querySelectorAll:()=>[]};
document.getElementById('category').value='high';
const ctx={document,Math,Date,console,performance:{now:()=>0},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},confirm:()=>true};
vm.createContext(ctx);vm.runInContext(src,ctx);
vm.runInContext('render=()=>{};renderRoster=()=>{};animate=()=>{};animateGround=()=>{};animateFieldingError=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};animateFlyLeadAndReturn=()=>{};log=()=>{};historyRender=()=>{};saveGame=()=>{};',ctx);
const results={games:0,extraInnings:0,maxInning:0,violations:[],scores:0,tactics:{}};
for(let n=0;n<1000;n++){
 vm.runInContext('init()',ctx);let steps=0;
 const g=()=>vm.runInContext('game',ctx);
 const typ=g().t.kind;results.tactics[typ]=(results.tactics[typ]||0)+1;
 while(!g().ended&&steps++<10000){
  vm.runInContext('resolvePitch()',ctx);const x=g();
  if(!(x.outs>=0&&x.outs<=3&&x.balls>=0&&x.balls<=3&&x.strikes>=0&&x.strikes<=2)) results.violations.push('count:'+n+':'+steps);
  const bs=x.bases.filter(Boolean).map(p=>p.id);if(bs.length!==new Set(bs).size)results.violations.push('base duplication:'+n);
 }
 const x=g();if(!x.ended)results.violations.push('unfinished:'+n);else results.games++;
 results.maxInning=Math.max(results.maxInning,x.inning);if(x.inning>9)results.extraInnings++;
 const points=x.teams.map(t=>t.runs.reduce((a,b)=>a+(b||0),0));results.scores+=points[0]+points[1];
 if(points[0]===points[1])results.violations.push('tie:'+n);
 for(let j=0;j<2;j++){
  const t=x.teams[j];if(t.players.reduce((a,p)=>a+p.r,0)!==points[j])results.violations.push('run mismatch:'+n+':'+j);
  if(t.players.reduce((a,p)=>a+p.h,0)!==t.hits)results.violations.push('hit mismatch:'+n+':'+j);
 }
}
console.log(JSON.stringify({...results,violations:results.violations.slice(0,30)},null,2));
assert.equal(results.games,1000,'every game must finish');
assert.equal(results.violations.length,0,'invariants must hold');

const ability=vm.runInContext(`(()=>{
 const profiles=[['baseline',55,55,55],['fast',90,55,55],['poor',55,20,55],['great',55,90,55],['weakArm',55,55,20],['strongArm',55,55,90]];
 const output={};
 for(const [name,speed,field,arm] of profiles){
  init();const g=game,p=g.teams[0].players[5];p.speed=speed;
  for(const i of [7,8,9,10]){g.teams[1].players[i].field=field;g.teams[1].players[i].arm=arm;}
  let hits=0,errors=0;
  for(let i=0;i<5000;i++){
   g.bases=[null,null,null];g.outs=0;
   const oldH=p.h,oldE=g.teams[1].errors;
   groundBall(p);
   if(p.h>oldH)hits++;
   if(g.teams[1].errors>oldE)errors++;
  }
  output[name]={hits,errors};
 }
 return output;
})()`,ctx);
assert.ok(ability.fast.hits>ability.baseline.hits,'fast runners should get more infield hits');
assert.ok(ability.poor.hits>ability.great.hits,'poor fielding should allow more hits');
assert.ok(ability.poor.errors>ability.great.errors,'poor fielding should produce more errors');
assert.ok(ability.weakArm.hits>ability.strongArm.hits,'weak throws should permit more hits');
assert.ok(ability.fast.hits<1750,'fast runner infield hit rate should remain below 35%');
console.log('ABILITY CHECKS PASS',JSON.stringify(ability));

const outfield=vm.runInContext(`(()=>{
 const cases=[['weak',20,20],['average',55,55],['elite',90,90]],result={};
 for(const [name,speed,field] of cases){
  init();const players=game.teams[1].players;
  for(const i of [14,15,16]){players[i].speed=speed;players[i].field=field;}
  for(const kind of ['fly','liner']){
   let catches=0,drops=0;
   for(let j=0;j<5000;j++){const a=outfieldContact(kind);catches+=Number(a.caught);drops+=Number(a.dropped)}
   result[name+'_'+kind]={catches,drops};
  }
 }
 return result;
})()`,ctx);
assert.ok(outfield.elite_fly.catches>outfield.average_fly.catches,'elite outfielders should catch more flies');
assert.ok(outfield.average_fly.catches>outfield.weak_fly.catches,'weak outfielders should catch fewer flies');
assert.ok(outfield.elite_liner.catches>outfield.average_liner.catches,'elite outfielders should catch more liners');
assert.ok(outfield.average_liner.catches>outfield.weak_liner.catches,'weak outfielders should catch fewer liners');
console.log('OUTFIELD CHECKS PASS',JSON.stringify(outfield));

const scoreboard=vm.runInContext(`(()=>{
 init();
 const t=game.teams[0];t.runs[0]=null;
 render();
 const live=$('lines').innerHTML;
 const highlighted=live.includes('current-inning')&&live.includes('◀');
 const zeroLive=live.includes('>0</td>');
 // An empty top of first becomes 0 when its half-inning finishes.
 game.outs=3;endHalf();render();
 const zeroCommitted=t.runs[0]===0&&$('lines').innerHTML.includes('>0</td>');
 const currentHalf=game.half===1&&game.inning===1;
 return {highlighted,zeroLive,zeroCommitted,currentHalf};
})()`,ctx);
assert.ok(Object.values(scoreboard).every(Boolean),'inning display and score transitions must match');
console.log('SCOREBOARD CHECKS PASS',JSON.stringify(scoreboard));

const animationCases=vm.runInContext(`(()=>{
 init();let dives=0,nearMisses=0;
 for(let n=0;n<10000;n++){
  const c=outfieldContact('fly');
  if(c.diving) {if(!c.caught)throw Error('dive without catch');dives++}
  if(c.nearMiss) {if(c.caught||c.dropped)throw Error('near miss incompatible with catch/error');nearMisses++}
 }
 return {dives,nearMisses};
})()`,ctx);
assert.ok(animationCases.dives>0,'some difficult catches should use dive animation');
assert.ok(animationCases.nearMisses>0,'some missed flies should use near-miss animation');
console.log('OUTFIELD ANIMATION CASES PASS',JSON.stringify(animationCases));

const flyReturnCheck=vm.runInContext(`(()=>{
 init();const g=game;
 const batterNow=batter();
 const baseRunner=g.teams[0].players[6];g.bases=[baseRunner,null,null];g.outs=0;
 const sample={defender:'CF',label:'中堅',point:[200,-90],fielder:g.teams[1].players[15],caught:true,dropped:false,diving:false,atFence:false};
 const original=outfieldContact;
 outfieldContact=()=>sample;
 flyBall(batterNow);
 outfieldContact=original;
 return {caughtFlag:g.flyReturn===true,runnerRetained:g.bases[0]===baseRunner,outs:g.outs};
})()`,ctx);
assert.equal(flyReturnCheck.caughtFlag,true,'caught fly should request retreat animation');
assert.equal(flyReturnCheck.runnerRetained,true,'runners must not advance on routine caught fly');
assert.equal(flyReturnCheck.outs,1,'caught fly adds exactly one out');
console.log('FLY RETURN CHECKS PASS',JSON.stringify(flyReturnCheck));

const extraBase=vm.runInContext(`(()=>{
 const samples={fastWeak:0,slowStrong:0,fastWeakOut:0,slowStrongOut:0};
 const point=[200,-72];
 for(const profile of [
  {key:'fastWeak',runnerSpeed:90,arm:20},
  {key:'slowStrong',runnerSpeed:20,arm:90}
 ]){
  init();let g=game;
  const batter=g.teams[0].players[5],first=g.teams[0].players[6],outfielder=g.teams[1].players[15];
  first.speed=profile.runnerSpeed;outfielder.arm=profile.arm;
  for(let i=0;i<5000;i++){
   g.bases=[first,null,null];g.outs=0;g.homePlayOutId=null;g.thirdBasePlay=null;
   hit(batter,1,'normal',{point,defender:'CF',fielder:outfielder});
   if(g.bases[2]===first)samples[profile.key]++;
   if(g.thirdBasePlay&&!g.thirdBasePlay.safe)samples[profile.key+'Out']++;
  }
 }
 return samples;
})()`,ctx);
assert.ok(extraBase.fastWeak>extraBase.slowStrong,'faster runner against weak arm should take third more often');
assert.ok(extraBase.fastWeak+extraBase.fastWeakOut>0,'first-to-third attempts should occur');
console.log('EXTRA BASE CHECKS PASS',JSON.stringify(extraBase));
