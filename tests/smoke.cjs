const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(src,'script required');
const ids=new Map();
function mock(){return {style:{},children:[],childNodes:[],dataset:{},value:1,disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(){},getAttribute(){return '0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
const document={getElementById(id){if(!ids.has(id))ids.set(id,mock());return ids.get(id)},createElement:mock,createElementNS:mock,querySelector:mock,querySelectorAll:()=>[]};
const ctx={document,Math,Date,console,performance:{now:()=>0},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},confirm:()=>true};
vm.createContext(ctx);vm.runInContext(src,ctx);
vm.runInContext('render=()=>{};renderRoster=()=>{};animate=()=>{};animateGround=()=>{};animateFieldingError=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};log=()=>{};historyRender=()=>{};saveGame=()=>{};',ctx);
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
