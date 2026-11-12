'use strict';
// Compare every pitch's rule state, player records and RNG draw count against
// the requested published base. No large transcripts are written to the repo.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const baseline=process.env.HR_BASE_INDEX;if(!baseline)throw Error('HR_BASE_INDEX must point to the requested base index.html');
function engine(file){
 const src=fs.readFileSync(file,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const nodes=new Map();function el(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},value:'random',disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this.html=v},get innerHTML(){return this.html||''}}}
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)},createElement:el,createElementNS:el,querySelector:el,querySelectorAll:()=>[]};
 for(const [k,v] of Object.entries({category:'high',parkType:'grass',parkShape:'standard',matchType:'official',dayNight:'day'}))document.getElementById(k).value=v;
 let seed=123456789,draws=0;const randomMath=Object.create(Math);randomMath.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-11-12T00:00:00Z']))}static now(){return 1794441600000}}
 const c={document,Math:randomMath,Date:FixedDate,performance:{now:()=>0},console,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},confirm:()=>true};vm.createContext(c);vm.runInContext(src,c);
 vm.runInContext('render=()=>{};renderRoster=()=>{};log=()=>{};historyRender=()=>{};saveGame=()=>{};',c);
 return {run:s=>vm.runInContext(s,c),draws:()=>draws};
}
const a=engine(baseline),b=engine(path.join(__dirname,'../index.html'));
const state=`JSON.stringify({inning:game.inning,half:game.half,outs:game.outs,balls:game.balls,strikes:game.strikes,pitch:game.pitch,totalPitches:game.totalPitches,bases:game.bases.map(p=>p?.id??null),ended:game.ended,pitchText:document.getElementById('pitchResult').textContent,teams:game.teams.map(t=>({bat:t.bat,pitcher:t.pitcher,runs:t.runs,hits:t.hits,errors:t.errors,players:t.players,plateResults:t.players.map(p=>todayPlateResults(p))}))})`;
let total=0,hrs=0;
for(let n=0;n<20;n++){
 a.run('init()');b.run('init()');assert.equal(a.run(state),b.run(state),'initial state');
 let pitch=0;
 while(!a.run('game.ended')){assert.ok(++pitch<10000);a.run('resolvePitch()');b.run('resolvePitch()');assert.equal(a.draws(),b.draws(),`RNG game ${n} pitch ${pitch}`);assert.equal(a.run(state),b.run(state),`state game ${n} pitch ${pitch}`);total++;}
 hrs+=a.run('game.teams.reduce((n,t)=>n+t.players.reduce((s,p)=>s+p.hr,0),0)');
}
assert.ok(hrs>0);console.log('HOME RUN ENGINE PARITY PASS',JSON.stringify({games:20,steps:total,homeRuns:hrs,randomDraws:a.draws()}));
