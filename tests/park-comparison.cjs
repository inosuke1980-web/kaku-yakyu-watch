'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'Game script missing');
function node(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},value:'random',disabled:false,textContent:'',
 replaceChildren(){},append(){},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},
 addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
const dom=new Map(),document={
 getElementById(id){if(!dom.has(id))dom.set(id,node());return dom.get(id)},
 createElement:node,createElementNS:node,querySelector:node,querySelectorAll:()=>[]
};
document.getElementById('category').value='high';
document.getElementById('parkType').value='grass';
document.getElementById('matchType').value='official';
const randomMath=Object.create(Math);let randomState=1;
randomMath.random=()=>{randomState=(randomState+0x6d2b79f5)|0;let t=randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
const ctx={document,Math:randomMath,Date,console,performance:{now:()=>0},
 localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
 setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},confirm:()=>true};
vm.createContext(ctx);
vm.runInContext(source,ctx);
vm.runInContext(`render=()=>{};renderRoster=()=>{};animate=()=>{};animateGround=()=>{};
animateFieldingError=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};
animateFlyLeadAndReturn=()=>{};log=()=>{};historyRender=()=>{};saveGame=()=>{};
let comparisonTriples=0;
const originalHitForComparison=hit;
hit=function(p,bases,style,info){if(bases===3)comparisonTriples++;return originalHitForComparison(p,bases,style,info)};`,ctx);
const shapes=['standard','wide','small','leftWide','rightWide','dome','grassPark','grassDome'];
const perPark=Number(process.env.PARK_GAMES||1000),data=[];
assert.ok(Number.isInteger(perPark)&&perPark>0&&perPark<=10000);
for(const shape of shapes){
 document.getElementById('parkShape').value=shape;
 const metric={shape,games:0,homeRuns:0,triples:0,hits:0,runs:0,plateAppearances:0,uncompleted:0,runMismatches:0};
 for(let n=0;n<perPark;n++){
  randomState=(0x5c9d4a71+Math.imul(n+1,0x9e3779b1))|0;
  vm.runInContext('comparisonTriples=0;init()',ctx);
  const result=vm.runInContext(`(()=>{
   let steps=0;
   while(!game.ended&&steps<10000){resolvePitch();steps++}
   return {ended:game.ended,steps,triples:comparisonTriples,
    teams:game.teams.map(t=>({hits:t.hits,runs:t.runs.reduce((sum,v)=>sum+(v||0),0),
     playerRuns:t.players.reduce((sum,p)=>sum+p.r,0),
     homers:t.players.reduce((sum,p)=>sum+p.hr,0),bat:t.bat}))}
  })()`,ctx);
  metric.games++;
  metric.plateAppearances+=result.teams.reduce((sum,t)=>sum+t.bat,0);
  metric.homeRuns+=result.teams.reduce((sum,t)=>sum+t.homers,0);
  metric.triples+=result.triples;
  metric.hits+=result.teams.reduce((sum,t)=>sum+t.hits,0);
  metric.runs+=result.teams.reduce((sum,t)=>sum+t.runs,0);
  if(!result.ended)metric.uncompleted++;
  for(const t of result.teams)if(t.runs!==t.playerRuns)metric.runMismatches++;
 }
 metric.homeRunsPerGame=+(metric.homeRuns/metric.games).toFixed(3);
 metric.triplesPerGame=+(metric.triples/metric.games).toFixed(3);
 metric.runsPerGame=+(metric.runs/metric.games).toFixed(3);
 data.push(metric);
 console.log(JSON.stringify(metric));
}
const byName=Object.fromEntries(data.map(d=>[d.shape,d]));
assert.equal(data.reduce((sum,x)=>sum+x.games,0),perPark*8);
assert.ok(data.every(d=>d.uncompleted===0&&d.runMismatches===0),'completed games and runs must agree');
assert.ok(byName.small.homeRuns>byName.wide.homeRuns,'small parks should yield more home runs');
assert.ok(byName.wide.triples>byName.small.triples,'wide parks should yield more triples');
const report={description:'Paired pseudo-random seeds across eight parks; same team generation seed, different live play paths.',perPark,totalGames:perPark*8,data};
const out=path.join(__dirname,'park-comparison-results.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log('PARK COMPARISON PASS; report='+out);
