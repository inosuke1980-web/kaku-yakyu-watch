const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(src,'script required');
const ids=new Map();
function mock(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},value:1,disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
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
 const redUnderline=live.includes('class="attack-team"')&&!live.includes(' ◀');
 const blankLive=live.includes('class="live-score"></td>');
 t.runs[0]=2;render();
 const scoreAppears=$('lines').innerHTML.includes('class="live-score">2</td>');
 // The previous half only becomes zero when three outs complete it.
 t.runs[0]=null;game.outs=3;endHalf();render();
 const zeroCommitted=t.runs[0]===0&&$('lines').innerHTML.includes('>0</td>');
 const newHalfUnderlined=$('lines').innerHTML.includes('class="attack-team"');
 const currentHalf=game.half===1&&game.inning===1;
 return {redUnderline,blankLive,scoreAppears,zeroCommitted,newHalfUnderlined,currentHalf};
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

const gameContext=vm.runInContext(`(()=>{
 const output={};
 const cases=[['early',0,3,0],['cautious',0,8,0],['twoOut',2,8,0],['protect',1,8,1],['chase',2,8,-1]];
 for(const [label,outs,inning,diff] of cases){
  init();const g=game;g.outs=outs;g.inning=inning;g.half=0;
  g.teams[0].runs[0]=Math.max(0,diff);g.teams[1].runs[0]=Math.max(0,-diff);
  const runner=g.teams[0].players[6];runner.speed=60;
  let attempts=0;
  for(let i=0;i<4000;i++){
   const decision=decideSingleAdvance(runner,0,[200,-40],60,false);
   attempts+=Number(!!decision.attempt);
  }
  output[label]=attempts;
 }
 return output;
})()`,ctx);
assert.ok(gameContext.cautious<gameContext.early,'late close game with no outs should protect runners');
assert.ok(gameContext.twoOut>gameContext.early,'two outs should increase first-to-third attempts');
assert.ok(gameContext.chase>gameContext.protect,'late trailing team with two outs should push harder than protecting a lead');
console.log('GAME CONTEXT RUNNING CHECKS PASS',JSON.stringify(gameContext));

const safeRunning=vm.runInContext(`(()=>{
 const profiles=[['slowStrong',20,90],['average',55,55],['fastWeak',90,20]];
 const data={};
 for(const [name,speed,arm] of profiles){
  init();game.half=0;game.inning=8;game.outs=2;game.teams[0].runs[0]=0;game.teams[1].runs[0]=1;
  const runner=game.teams[0].players[6];runner.speed=speed;
  let attempts=0,retired=0;
  for(let i=0;i<5000;i++){
   const d=decideSingleAdvance(runner,0,[200,-40],arm,false);
   attempts+=Number(!!d.attempt);retired+=Number(!!d.thirdOut);
  }
  data[name]={attempts,retired};
 }
 return data;
})()`,ctx);
assert.equal(safeRunning.slowStrong.attempts,0,'hopeless first-to-third attempts must be suppressed');
assert.ok(safeRunning.fastWeak.attempts>safeRunning.average.attempts,'fast runners versus weaker arms should advance more');
assert.ok(safeRunning.fastWeak.retired<=safeRunning.fastWeak.attempts,'outs cannot exceed attempts');
console.log('SAFE RUNNING CHECKS PASS',JSON.stringify(safeRunning));

const closePlayTimes=vm.runInContext(`(()=>{
 const cases=[
  crossPlayClock({id:'A',base:'third',safe:true},1900),
  crossPlayClock({id:'B',base:'third',safe:false},1900),
  crossPlayClock({id:'C',base:'home',safe:true,wild:true},2200),
  crossPlayClock({id:'D',base:'home',safe:false},2200)
 ];
 return cases.map(x=>({safe:x.safe,wild:x.wild,base:x.base,runnerFirst:x.runnerArrival<x.throwArrival,throwFirst:x.throwArrival<x.runnerArrival}));
})()`,ctx);
assert.equal(closePlayTimes.length,4);
for(const x of closePlayTimes){
 assert.equal(x.runnerFirst,x.safe,'safe play should show runner reaching base ahead of throw');
 assert.equal(x.throwFirst,!x.safe,'out play should show throw arriving before runner');
}
console.log('CLOSE PLAY TIMING CHECKS PASS',JSON.stringify(closePlayTimes));

const gestureContract=vm.runInContext(`(()=>{
 init();
 const before={outs:game.outs,runs:game.teams.map(t=>t.runs.reduce((sum,v)=>sum+(v||0),0)),errors:game.teams.map(t=>t.errors)};
 const safe=crossPlayClock({id:'slide-safe',base:'third',safe:true},1900);
 const out=crossPlayClock({id:'slide-out',base:'home',safe:false},2100);
 const wild=crossPlayClock({id:'slide-wild',base:'home',safe:true,wild:true},2200);
 animateClosePlayGestures(safe);animateClosePlayGestures(out);animateClosePlayGestures(wild);
 const after={outs:game.outs,runs:game.teams.map(t=>t.runs.reduce((sum,v)=>sum+(v||0),0)),errors:game.teams.map(t=>t.errors)};
 return {safeFirst:safe.runnerArrival<safe.throwArrival,outFirst:out.throwArrival<out.runnerArrival,wildFirst:wild.runnerArrival<wild.throwArrival,unchanged:JSON.stringify(before)===JSON.stringify(after)};
})()`,ctx);
assert.ok(Object.values(gestureContract).every(Boolean),'sliding/tag rendering must respect calls without mutating scores or outs');
console.log('SLIDING AND TAG CHECKS PASS',JSON.stringify(gestureContract));

const seasons=vm.runInContext(`(()=>{
 const results={spring:0,autumn:0,combined:0,crossPrefecture:0};
 document.getElementById('matchType').value='official';
 for(let i=0;i<3000;i++){
  const t=tournament();
  if(t.kind==='春季大会')results.spring++;
  if(t.kind==='秋季大会')results.autumn++;
  if(t.kind.includes('春季・秋季'))results.combined++;
  if((t.kind==='春季大会'||t.kind==='秋季大会')&&t.p!==t.q)results.crossPrefecture++;
 }
 return results;
})()`,ctx);
assert.ok(seasons.spring>0&&seasons.autumn>0,'spring and autumn must both appear');
assert.equal(seasons.combined,0,'combined season label must not appear');
assert.equal(seasons.crossPrefecture,0,'prefectural season tournaments must use schools from the same prefecture');
console.log('SEASON TOURNAMENT CHECKS PASS',JSON.stringify(seasons));

const ballparks=vm.runInContext(`(()=>{
 const result={};
 for(const style of ['grass','clayInfield','allDirt']){
  applyParkStyle(style);
  result[style]={
   surface:document.getElementById('parkSurface').getAttribute('fill'),
   infield:document.getElementById('infieldGrass').getAttribute('fill'),
   mowing:document.getElementById('parkMowing').getAttribute('visibility')
  };
 }
 return result;
})()`,ctx);
assert.notEqual(ballparks.grass.surface,ballparks.allDirt.surface,'dirt and grass surfaces must differ');
assert.notEqual(ballparks.grass.infield,ballparks.clayInfield.infield,'mixed park must have a dirt infield');
assert.equal(ballparks.allDirt.mowing,'hidden','dirt fields must not have mowing stripes');
const geometry=html.match(/<path id="foulLines" d="([^"]+)"/)?.[1];
assert.equal(geometry,'M200 293 L12 105 M200 293 L388 105','foul lines end at fence/pole coordinates');
assert.match(html,/<line data-pole="left" x1="12" y1="105"/);
assert.match(html,/<line data-pole="right" x1="388" y1="105"/);
console.log('BALLPARK GEOMETRY AND SURFACE CHECKS PASS',JSON.stringify(ballparks));

const mobileScoreboard=vm.runInContext(`(()=>{
 init();const g=game;
 g.inning=11;
 for(const team of g.teams){while(team.runs.length<11)team.runs.push(null)}
 render();
 const markup=$('lines').innerHTML;
 return {
  extendedInnings:markup.includes('>10</th>')&&markup.includes('>11</th>'),
  fixedStats:markup.includes('sticky-stat stat-r')&&markup.includes('sticky-stat stat-h')&&markup.includes('sticky-stat stat-e'),
  blankCurrent:markup.includes('class="live-score"></td>'),
  battingTeam:markup.includes('class="attack-team"')
 };
})()`,ctx);
assert.ok(Object.values(mobileScoreboard).every(Boolean),'mobile scoreboard must support extension and sticky RHE');
assert.match(html,/class="scoreboard-scroll" id="lines"/,'scoreboard should use a horizontal scroll container');
assert.match(html,/\.scoreboard-scroll \.stat-r\{right:60px\}/,'R column must remain sticky');
console.log('MOBILE SCOREBOARD CHECKS PASS',JSON.stringify(mobileScoreboard));
