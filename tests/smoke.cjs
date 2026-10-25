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

const foulChecks=vm.runInContext(`(()=>{
 init();const g=game,p=batter(),counts=[],sides={left:0,right:0},types={ground:0,fly:0};let badZones=0;
 for(const side of ['left','right'])for(const kind of ['ground','fly']){
  for(let i=0;i<2500;i++){
   const {point}=foulDestination(side,kind),[x,y]=point;
   const line=200+(side==='left'?-1:1)*(293-y);
   if(x<0||x>400||y<0||y>330||(side==='left'?x>=line:x<=line))badZones++;
   sides[side]++;types[kind]++;
  }
 }
 for(let strikes=0;strikes<=2;strikes++){
  g.strikes=strikes;const before={outs:g.outs,bats:g.teams[0].bat,atBats:p.ab,runs:g.teams[0].runs.slice(),bases:g.bases.slice()};
  foulBall(p);
  counts.push({before:strikes,after:g.strikes,unchanged:g.outs===before.outs&&g.teams[0].bat===before.bats&&p.ab===before.atBats&&g.teams[0].runs.every((v,i)=>v===before.runs[i])&&g.bases.every((v,i)=>v===before.bases[i])});
 }
 return {counts,sides,types,badZones};
})()`,ctx);
assert.equal(foulChecks.badZones,0,'every foul trajectory must land outside the field lines');
assert.ok(foulChecks.counts.every((x)=>x.unchanged&&x.after===Math.min(x.before+1,2)),'fouls must retain the at-bat and cap strikes at two');
assert.equal(foulChecks.sides.left,5000);
assert.equal(foulChecks.sides.right,5000);
console.log('FOUL TRAJECTORY AND COUNT CHECKS PASS',JSON.stringify(foulChecks));

const firstBaseCover=vm.runInContext(`(()=>{
 const outcomes=['out','safe','double','force'],positions=['1B','2B','SS','3B'];
 const plans=[];
 for(const position of positions)for(const outcome of outcomes){
  const p=groundFirstCover(position,outcome);
  plans.push({position,outcome,...p});
 }
 return plans;
})()`,ctx);
assert.equal(firstBaseCover.length,16);
assert.ok(firstBaseCover.every(x=>x.cover==='1B'&&x.needed),'first baseman must cover first on ground balls');
assert.ok(firstBaseCover.filter(x=>x.position==='1B').every(x=>x.backup==='2B'),'second baseman should be designated backup when first baseman fields ball');
assert.match(html,/const base=\{LF:\[99,-5\],CF:\[200,-75\],RF:\[301,-5\],SS:\[150,121\],'2B':\[250,121\],'1B':\[286,189\]\}/,'first baseman must reset after cover');
console.log('FIRST BASE COVER CHECKS PASS',JSON.stringify(firstBaseCover));

{
 // Actually advance animation frames (instead of merely inspecting a cover plan).
 const groundSource=src.slice(src.indexOf('function moveGroundFielder('),src.indexOf('function animate(kind,'));
 assert.ok(groundSource.includes('function animateGround('),'ground animation source missing');
 function exerciseGroundCover(position,outcome='out'){
  let now=0,frames=[],timers=[];
  const element=(name,x,y)=>({style:{},attributes:{cx:String(x),cy:String(y),'data-position':name},
   setAttribute(k,v){this.attributes[k]=String(v)},
   getAttribute(k){return this.attributes[k]??null}});
  const coordinates={SS:[150,121],'1B':[286,189],'2B':[250,121],'3B':[114,189]};
  const circles=Object.fromEntries(Object.entries(coordinates).map(([k,p])=>[k,element(k,...p)]));
  const labels=Object.fromEntries(Object.entries(coordinates).map(([k,p])=>[k,element(k,p[0],p[1]+3)]));
  const field={querySelector(selector){const position=selector.match(/data-position="([^"]+)"/)?.[1];return selector.startsWith('circle')?circles[position]:labels[position]}};
  const ball=element('ball',200,203);
  const context={
   animationToken:1,playTimers:[],animationHoldUntil:0,Date,Math,console,
   performance:{now:()=>now},clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
   runnerFirstMs:()=>1550,throwFlightMs:()=>340,
   $:id=>id==='fielders'?field:id==='ball'?ball:null,
   requestAnimationFrame:cb=>{frames.push(cb)},
   setTimeout:(cb,delay)=>{timers.push({at:now+delay,cb});return timers.length},
   showPitchResult:()=>{},animateBatterRun:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(groundSource,context);
  vm.runInContext('animateGround('+JSON.stringify(outcome)+','+JSON.stringify({defender:position,point:position==='1B'?[290,182]:[158,156],label:'grounder'})+',55,55,{pickup:650,runnerMs:1550})',context);
  const advance=target=>{
   while(now<target){
    now=Math.min(now+20,target);
    const due=timers.filter(x=>x.at<=now);timers=timers.filter(x=>x.at>now);
    for(const task of due)task.cb();
    const callbacks=frames;frames=[];for(const callback of callbacks)callback(now);
   }
  };
  const where=()=>[Number(circles['1B'].getAttribute('cx')),Number(circles['1B'].getAttribute('cy'))];
  advance(1100);const onBag=where();
  advance(1750);const held=where();
  advance(2500);const restored=where();
  return {onBag,held,restored};
 }
 for(const [position,outcome] of [['SS','out'],['3B','safe'],['2B','double'],['SS','force'],['1B','out']]){
  const frames=exerciseGroundCover(position,outcome);
  assert.ok(Math.hypot(frames.onBag[0]-323,frames.onBag[1]-169)<1,position+'/'+outcome+': cover first by throw');
  assert.ok(Math.hypot(frames.held[0]-323,frames.held[1]-169)<1,position+'/'+outcome+': stay on the bag through verdict');
  assert.ok(Math.hypot(frames.restored[0]-286,frames.restored[1]-189)<1,position+'/'+outcome+': return to fielding position');
 }
 console.log('FIRST-BASE COVER ANIMATION FRAMES CHECKS PASS');
}

{
 // Foreground coverage is separate from normal fielders so it is never hidden
 // under an occupied first base marker. Test actual scheduled SVG movement.
 const begin=src.indexOf('function moveGroundFielder(');
 const finish=src.indexOf('function animate(kind,',begin);
 assert.ok(begin>=0&&finish>begin,'ground animation source required');
 const ground=src.slice(begin,finish);
 function runCover(defender){
  let now=0,frames=[],timers=[],token=1;
  function node(x,y){return {style:{},attrs:{cx:String(x),cy:String(y)},
   setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},textContent:''}}
  const first=node(286,189),label=node(286,192);
  const foreground={children:[],replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}};
  const context={animationToken:token,playTimers:[],Date,performance:{now:()=>now},
   $:()=>foreground,document:{createElementNS:()=>node(0,0)},
   requestAnimationFrame:fn=>frames.push(fn),
   setTimeout:(fn,delay)=>{timers.push({at:now+delay,fn});return timers.length},
   clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x))};
  vm.createContext(context);vm.runInContext(ground,context);
  context.showFirstCoverSprite(first,label,token,600,defender,1200,1800);
  const progress=(until)=>{
   while(now<until){now=Math.min(now+20,until);
    const due=timers.filter(t=>t.at<=now);timers=timers.filter(t=>t.at>now);
    for(const t of due)t.fn();
    const callbacks=frames;frames=[];for(const c of callbacks)c(now);
   }
  };
  progress(defender==='1B'?1000:700);
  const sprite=foreground.children[0];
  const onBag=[Number(sprite.getAttribute('cx')),Number(sprite.getAttribute('cy'))];
  const overlay=foreground.children.length===2;
  const originalHidden=first.getAttribute('opacity')==='0';
  progress(1750);
  const held=[Number(sprite.getAttribute('cx')),Number(sprite.getAttribute('cy'))];
  progress(2400);
  const restored=foreground.children.length===0&&first.getAttribute('opacity')==='1';
  return {onBag,held,overlay,originalHidden,restored};
 }
 for(const defender of ['SS','1B']){
  const result=runCover(defender);
  assert.ok(Math.hypot(result.onBag[0]-323,result.onBag[1]-169)<1,defender+' foreground first-base arrival');
  assert.ok(Math.hypot(result.held[0]-323,result.held[1]-169)<1,defender+' foreground hold on base');
  assert.ok(result.overlay&&result.originalHidden&&result.restored,defender+' foreground visibility and cleanup');
 }
 console.log('FOREGROUND FIRST-BASE COVER VISUAL CHECKS PASS');
}

const outfieldHitVarieties=vm.runInContext(`(()=>{
 init();const totals={groundThrough:0,gapLiner:0,overHead:0,fenceDouble:0};
 let invalid=0,rolling=0;
 for(let i=0;i<3000;i++){
  const plan=outfieldHitPlan(i%2?1:2,'normal');
  totals[plan.flight]++;
  if(plan.flight==='groundThrough'){
   if(!plan.rollEnd||plan.rollEnd[1]>plan.point[1])invalid++;
   rolling++;
  }
  if([plan.point,plan.rollEnd].filter(Boolean).some(point=>point[1]<outfieldFenceY(point[0])+11.9))invalid++;
  if(!plan.fielder||!['LF','CF','RF'].includes(plan.defender))invalid++;
 }
 const liner=outfieldHitPlan(2,'liner');
 return {totals,invalid,rolling,liner:liner.flight};
})()`,ctx);
assert.ok(Object.values(outfieldHitVarieties.totals).every(n=>n>0),'all three hit varieties should appear');
assert.equal(outfieldHitVarieties.invalid,0,'ball landing and roll locations should match the hit type');
assert.equal(outfieldHitVarieties.liner,'gapLiner','liner hit should have a low trajectory');
assert.match(html,/function outfieldHitDescription\(/,'trajectory-specific commentary should exist');
console.log('OUTFIELD HIT VARIETIES CHECKS PASS',JSON.stringify(outfieldHitVarieties));

const broadcastMini=vm.runInContext(`(()=>{
 init();const g=game;
 const names=g.teams.map(t=>miniTeamName(t.name));
 const start=miniScoreMarkup();
 g.teams[0].runs[0]=2;g.balls=2;g.strikes=1;g.outs=1;
 renderMiniScore();const live=$('miniScore').innerHTML;
 g.outs=3;endHalf();renderMiniScore();const other=$('miniScore').innerHTML;
 g.ended=true;renderMiniScore();const final=$('miniScore').innerHTML;
 return {names,start,live,other,final};
})()`,ctx);
assert.match(html,/id="miniScore" class="mini-score"/,'field mini scoreboard must exist');
assert.match(html,/\.field-header\{display:flex;justify-content:space-between/,'score must have a separate field header');
assert.match(html,/<div class="field-header"><h2>グラウンド<\/h2><div class="field-score-row"><div id="miniScore"/,'scoreboard belongs in the field header before the SVG');
assert.match(html,/\.mini-score\{position:static/,'scoreboard must use normal layout rather than overlay');
assert.doesNotMatch(html,/\.mini-score\{position:absolute/,'mini scoreboard must never cover the field');
assert.equal((html.match(/id="miniScore"/g)||[]).length,1,'there should only be one mini-scoreboard');
assert.match(broadcastMini.start,/1回表/);
assert.match(broadcastMini.live,/1回表/);
assert.match(broadcastMini.live,/mini-points">2<\/span>/);
assert.equal((broadcastMini.live.match(/mini-lamp active ball/g)||[]).length,2);
assert.equal((broadcastMini.live.match(/mini-lamp active strike/g)||[]).length,1);
assert.equal((broadcastMini.live.match(/mini-lamp active out/g)||[]).length,1);
assert.match(broadcastMini.other,/1回裏/);
assert.match(broadcastMini.final,/試合終了/);
assert.ok(broadcastMini.names.every(n=>n.length<=4));
console.log('BROADCAST MINI SCOREBOARD CHECKS PASS');

const miniBases=vm.runInContext(`(()=>{
 init();const g=game,items=[];
 for(let mask=0;mask<8;mask++){
  g.bases=[0,1,2].map(i=>(mask&(1<<i))?g.teams[0].players[i+5]:null);
  const html=miniBaseDiamond();
  const lit=(html.match(/mini-base [^"]* occupied/g)||[]).length;
  const baseValues=[...html.matchAll(/data-base="([123])"/g)].map(m=>Number(m[1]));
  items.push({mask,lit,baseValues,label:html.match(/aria-label="([^"]+)"/)?.[1]});
 }
 return items;
})()`,ctx);
assert.equal(miniBases.length,8);
for(const b of miniBases){
 assert.equal(b.lit,[0,1,2].filter(i=>b.mask&(1<<i)).length,'base lamp count should match actual occupancy');
 assert.deepEqual(Array.from(b.baseValues),[2,3,1],'diamond should use physical second/third/first order');
 assert.ok(b.label?.startsWith('走者'),'base occupancy must have a readable label');
}
assert.match(html,/class="mini-diamond"/,'mini diamond must be styled');
console.log('MINI BASE DIAMOND ALL EIGHT SITUATIONS PASS');

const outfieldPursuit=vm.runInContext(`(()=>{
 const origin=[99,-5];
 return {
  deep:outfieldPursuitPlan('overHead',{flight:'overHead',point:[95,-108]},origin,1230),
  roller:outfieldPursuitPlan('groundThrough',{flight:'groundThrough',point:[102,18],rollEnd:[111,-55]},origin,620),
  shortFly:outfieldPursuitPlan('fly',{point:[100,28],caught:true},origin,1150),
  sideways:outfieldPursuitPlan('linerOut',{point:[162,-5],caught:false},origin,550)
 };
})()`,ctx);
assert.equal(outfieldPursuit.deep.type,'back');
assert.equal(outfieldPursuit.deep.latePickup,true);
assert.ok(outfieldPursuit.deep.pickup[1]>outfieldPursuit.deep.destination[1],'outfielder should trail a ball over his head');
assert.deepEqual(Array.from(outfieldPursuit.roller.destination),[111,-55],'outfielder must chase rolling ball rather than stop at first bounce');
assert.equal(outfieldPursuit.shortFly.type,'forward');
assert.equal(outfieldPursuit.shortFly.caught,true);
assert.equal(outfieldPursuit.sideways.type,'lateral');
assert.match(html,/moveGroundFielder\(nearest,label,point,ms,token\)/,'outfield chases should use frame-based movement');
console.log('OUTFIELD PURSUIT DIRECTION AND PICKUP CHECKS PASS');

const fenceIntegrity=vm.runInContext(`(()=>{
 init();
 let violations=0,closest=999,homerCount=0;
 for(let i=0;i<10000;i++){
  const plan=outfieldHitPlan(i%3+1);
  const contact=outfieldContact(i%2?'fly':'liner');
  for(const point of [plan.point,plan.rollEnd,contact.point].filter(Boolean)){
   const margin=point[1]-outfieldFenceY(point[0]);
   closest=Math.min(closest,margin);
   if(margin<11.9)violations++;
  }
  const home=outfieldHomerTarget(40+i%320);
  if(home[1]>=outfieldFenceY(home[0]))violations++;
  else homerCount++;
 }
 return {violations,closest,homerCount};
})()`,ctx);
assert.equal(fenceIntegrity.violations,0,'only home runs should land beyond the curved outfield fence');
assert.ok(fenceIntegrity.closest>=11.9,'fair hits must retain a visible gap before the wall');
assert.equal(fenceIntegrity.homerCount,10000);
assert.match(html,/M12 171 L12 82 Q25 -80 200 -122 Q375 -80 388 82/,'stadium and fence calculation should have corresponding control points');
console.log('CURVED FENCE HIT / HOME RUN SEPARATION CHECKS PASS',JSON.stringify(fenceIntegrity));

const wallRebound=vm.runInContext(`(()=>{
 init();
 let doubles=0,invalid=0;
 const samples=[];
 for(let i=0;i<10000;i++){
  const p=outfieldHitPlan(2,'normal');
  if(p.flight!=='fenceDouble')continue;
  doubles++;
  if(Math.abs(p.point[1]-outfieldFenceY(p.point[0])-12)>.01)invalid++;
  if(!p.rebound||p.rebound[1]<=outfieldFenceY(p.rebound[0])+12)invalid++;
  if(p.rebound[1]<=p.point[1])invalid++;
  if(p.flightMs<1200||p.wallAt<=0||p.wallAt>=1)invalid++;
  if(samples.length<3)samples.push({wall:p.point,bounce:p.rebound});
  const pursuit=outfieldPursuitPlan('fenceDouble',p,[p.point[0],-5],p.flightMs);
  if(!pursuit.latePickup||pursuit.destination[0]!==p.rebound[0]||pursuit.destination[1]!==p.rebound[1])invalid++;
 }
 return {doubles,invalid,samples};
})()`,ctx);
assert.ok(wallRebound.doubles>1000&&wallRebound.doubles<5000,'fence doubles should be an occasional extra-base hit');
assert.equal(wallRebound.invalid,0,'wall strikes, bounces and retrieval must follow the physical fence');
assert.match(html,/showPitchResult\('フェンス直撃！','play'\)/,'wall impact should be announced during animation');
assert.match(html,/targetInfo\.rebound\|\|targetInfo\.rollEnd\|\|targetInfo\.point/,'relay should start at recovered ball position');
console.log('FENCE DOUBLE REBOUND CHECKS PASS',JSON.stringify(wallRebound));
