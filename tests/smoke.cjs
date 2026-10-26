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
assert.match(html,/const base=\{LF:\[99,-5\],CF:\[200,-75\],RF:\[301,-5\],\.\.\.defensiveAlignment\(\)\.positions\}/,'first baseman must reset to active alignment');
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

const relayChoices=vm.runInContext(`(()=>{
 return {
  single:outfieldRelayDecision(false,null,null,'single'),
  double:outfieldRelayDecision(false,null,null,'double'),
  triple:outfieldRelayDecision(false,null,null,'triple'),
  scoringDouble:outfieldRelayDecision(true,null,null,'double'),
  home:outfieldRelayDecision(false,{safe:true},null,'single'),
  third:outfieldRelayDecision(false,null,{safe:false},'double'),
  sacrifice:outfieldRelayDecision(true,null,null,'fly')
 };
})()`,ctx);
for(const kind of ['single','double','triple','scoringDouble']){
 assert.equal(relayChoices[kind].throwAgain,false,kind+' must not throw uselessly to a base');
 assert.equal(relayChoices[kind].goal,null,kind+' should hold ball at relay');
}
assert.equal(relayChoices.home.throwAgain,true);
assert.deepEqual(Array.from(relayChoices.home.goal),[200,293]);
assert.equal(relayChoices.third.throwAgain,true);
assert.deepEqual(Array.from(relayChoices.third.goal),[77,169]);
assert.equal(relayChoices.sacrifice.throwAgain,true);
assert.deepEqual(Array.from(relayChoices.sacrifice.goal),[200,293]);
assert.match(html,/if\(relay\.throwAgain\)later\(atRelay\+relayPause/,'second throw must only be scheduled for a live play');
assert.match(html,/中継でボールを保持/,'routine relay must visibly end at cutoff');
console.log('OUTFIELD RELAY DECISION CHECKS PASS');

const linkedRelay=vm.runInContext(`(()=>{
 const point=[200,10],target=[200,293];
 const slow=extraBaseThrowTiming({flight:'fenceDouble',flightMs:1500},30,50,point,target);
 const fast=extraBaseThrowTiming({flight:'fenceDouble',flightMs:1500},90,50,point,target);
 const weak=extraBaseThrowTiming({flight:'groundThrough',flightMs:620},55,25,point,target);
 const strong=extraBaseThrowTiming({flight:'groundThrough',flightMs:620},55,95,point,target);
 const shallow=extraBaseThrowTiming({flight:'gapLiner',flightMs:850},55,60,point,target);
 const deep=extraBaseThrowTiming({flight:'overHead',flightMs:1230},55,60,point,target);
 return {slow,fast,weak,strong,shallow,deep};
})()`,ctx);
assert.ok(linkedRelay.slow.arrival>linkedRelay.fast.arrival,'slow fielder pickup should give runners longer');
assert.ok(linkedRelay.weak.arrival>linkedRelay.strong.arrival,'strong arm should deter extra bases');
assert.ok(linkedRelay.deep.arrival>linkedRelay.shallow.arrival,'deep ball should take longer to return');
assert.equal(linkedRelay.slow.pickup.release,linkedRelay.slow.pickup.flightMs+linkedRelay.slow.pickup.gather);
assert.match(html,/const pickup=outfieldPickupTiming\(targetInfo,targetInfo\?\.fielder\?\.field\?\?55\),release=pickup\.release/,'animation must share the timing model');
assert.match(html,/decideSingleAdvance\(r,0,landing,fieldArm,thirdBlocked,targetInfo,fieldSkill\)/,'runner choices must use fielding capability');
console.log('EXTRA-BASE / OUTFIELD RETURN LINKAGE CHECKS PASS');

const runnerChoreographyCases=vm.runInContext(`(()=>{
 return {
  holdSecond:runnerChoreography(0,1,55),
  holdThird:runnerChoreography(1,2,55),
  homeRun:runnerChoreography(1,3,55),
  chargeThird:runnerChoreography(0,2,65,{runnerArrival:1650,safe:true,base:'third'}),
  chargeHome:runnerChoreography(1,3,65,{runnerArrival:1770,safe:false,base:'home'})
 };
})()`,ctx);
assert.equal(runnerChoreographyCases.holdSecond.mode,'stop');
assert.equal(runnerChoreographyCases.holdThird.mode,'stop');
assert.ok(runnerChoreographyCases.holdSecond.segments[0].duration>runnerSegmentMs(55));
assert.equal(runnerChoreographyCases.homeRun.mode,'run');
assert.equal(runnerChoreographyCases.chargeThird.mode,'charge');
assert.equal(runnerChoreographyCases.chargeHome.mode,'charge');
assert.equal(runnerChoreographyCases.chargeThird.arrival,1650);
assert.equal(runnerChoreographyCases.chargeHome.arrival,1770);
assert.equal(runnerChoreographyCases.chargeHome.segments.at(-1).mode,'charge');
assert.match(html,/data-run-state/,'moving runner should expose chase/stop/charge state');
assert.match(html,/mode==='stop'\?1-\(1-t\)\*\(1-t\):mode==='charge'\?t\*t:t/,'stop and charge should have distinct frame-based easing');
console.log('RUNNER STOP AND CHARGE CHOREOGRAPHY CHECKS PASS');

const baseRounding=vm.runInContext(`(()=>{
 const bases=[[323,169],[200,47],[77,169],[200,293]],results=[];
 for(let i=0;i<3;i++){
  const start=bases[i],end=bases[i+1];
  const atStart=roundedBasePath(start,end,0);
  const atEnd=roundedBasePath(start,end,1);
  const mid=roundedBasePath(start,end,.5);
  const straight=[(start[0]+end[0])/2,(start[1]+end[1])/2];
  const deviation=Math.hypot(mid[0]-straight[0],mid[1]-straight[1]);
  const distBefore=Math.hypot(straight[0]-200,straight[1]-170);
  const distAfter=Math.hypot(mid[0]-200,mid[1]-170);
  results.push({atStart,atEnd,start,end,deviation,outside:distAfter>distBefore});
 }
 return results;
})()`,ctx);
for(const leg of baseRounding){
 assert.deepEqual(Array.from(leg.atStart),Array.from(leg.start),'rounded path starts on the bag');
 assert.deepEqual(Array.from(leg.atEnd),Array.from(leg.end),'rounded path ends on the next bag');
 assert.ok(leg.deviation>=11,'curve should be clearly visible on small screens');
 assert.ok(leg.outside,'runner should bend outward away from diamond interior');
}
assert.match(html,/moveRunnerRoundBase\(circle,destination,leg\.duration,leg\.mode,token\)/,'existing runners must use curved path');
assert.match(html,/moveRunnerRoundBase\(runner,second,560,'run',token\)/,'batter must round first on extra-base hits');
assert.match(html,/moveRunnerRoundBase\(runner,third,560,'run',token\)/,'batter must round second on triples');
assert.match(html,/if\(token!==animationToken\)return/,'curved movement must be cancellable');
console.log('ROUNDING BASEPATH GEOMETRY AND BATTER RUNNER CHECKS PASS');

const fieldingErrorVarieties=vm.runInContext(`(()=>{
 const results={tunnel:0,bobble:0,wildThrow:0},invalid=[];
 for(let i=0;i<10000;i++){
  const type=groundErrorType({arm:55});
  results[type]++;
  const direction={defender:'SS',point:[158,156]};
  const plan=groundErrorPlan(direction,type);
  if(!Number.isFinite(plan.target[0])||!Number.isFinite(plan.target[1]))invalid.push(type);
  if(type==='tunnel'&&!(plan.target[1]<plan.contact[1]))invalid.push('tunnel should pass behind infielder');
  if(type==='bobble'&&!(plan.target[0]<plan.contact[0]))invalid.push('bobble should move sideways');
  if(plan.contactMs<=0||plan.looseMs<=0)invalid.push('timing');
 }
 return {results,invalid};
})()`,ctx);
assert.ok(Object.values(fieldingErrorVarieties.results).every(n=>n>100),'all three error types must occur');
assert.equal(fieldingErrorVarieties.invalid.length,0,'error motion must be geometrically valid');
assert.match(html,/animateFieldingError\(errorType,p\.speed,errorPlan,direction\)/,'ground errors must use error-specific animation');
assert.match(html,/トンネル！/,'tunnel must be called distinctly');
assert.match(html,/はじいた！/,'bobble must be called distinctly');
console.log('GROUND FIELDING ERROR VARIETIES CHECKS PASS',JSON.stringify(fieldingErrorVarieties.results));

const extraOnErrors=vm.runInContext(`(()=>{
 const attempts={tunnel:0,bobble:0,wildThrow:0},invalid=[];
 for(const type of Object.keys(attempts)){
  for(let i=0;i<3000;i++){
   const runner={id:'lead',speed:55},batter={id:'batter',speed:55};
   const bases=[batter,runner,null],scored=[];
   const extra=groundErrorExtraAdvance(bases,type,scored);
   if(extra)attempts[type]++;
   if(bases[0]!==batter||scored.length||extra&&(bases[1]!==null||bases[2]!==runner))invalid.push(type);
  }
 }
 // The runner on third may score, but nobody may occupy the same base.
 const bases=[{id:'batter'},null,{id:'lead',speed:99}],scored=[];
 let gotHome=false;
 for(let i=0;i<2000&&!gotHome;i++){
  bases[2]={id:'lead',speed:99};scored.length=0;
  gotHome=!!groundErrorExtraAdvance(bases,'tunnel',scored);
 }
 return {attempts,invalid,gotHome,scoredCount:scored.length,thirdVacant:bases[2]===null};
})()`,ctx);
assert.equal(extraOnErrors.invalid.length,0,'error extra advances must preserve batter and base occupancy');
assert.ok(extraOnErrors.attempts.tunnel>extraOnErrors.attempts.wildThrow,'tunnel must allow more extra advances than wild throws');
assert.ok(extraOnErrors.attempts.wildThrow>extraOnErrors.attempts.bobble,'bobble should be easiest to recover');
assert.ok(extraOnErrors.gotHome&&extraOnErrors.scoredCount===1&&extraOnErrors.thirdVacant,'a runner on third may score safely when the ball gets away');
assert.match(html,/creditRuns\(scored,p,false\)/,'error-assisted runs must not credit RBI');
assert.match(html,/走者が追加進塁！/,'error extra advancement should appear in match commentary');
console.log('GROUND ERROR EXTRA ADVANCEMENT TESTS PASS',JSON.stringify(extraOnErrors.attempts));

const infieldRangeAudit=vm.runInContext(`(()=>{
 const direction={defender:'SS',point:[158,156]},strong={field:95,speed:95},weak={field:25,speed:25};
 const strongPlan=groundRangePlan(direction,strong,27),weakPlan=groundRangePlan(direction,weak,27);
 let stronger=0,weaker=0,disagreements=0;
 for(let off=-40;off<=40;off++){
  const a=groundRangePlan(direction,strong,off),b=groundRangePlan(direction,weak,off);
  if(a.reachable)stronger++;
  if(b.reachable)weaker++;
  if(a.reachable&&!b.reachable)disagreements++;
  if(b.reachable&&!a.reachable)throw Error('weak fielder covered more ground');
 }
 return {strongPlan,weakPlan,stronger,weaker,disagreements};
})()`,ctx);
assert.equal(infieldRangeAudit.strongPlan.reachable,true,'elite shortstop should reach difficult grounders');
assert.equal(infieldRangeAudit.weakPlan.reachable,false,'weak shortstop must miss the same grounder');
assert.ok(infieldRangeAudit.stronger>infieldRangeAudit.weaker,'better defense must cover more balls');
assert.ok(infieldRangeAudit.disagreements>0,'attribute differences must affect outcomes');
assert.match(html,/if\(!coverage\.reachable\)/,'ground balls beyond reach must be scored as hits rather than errors');
assert.match(html,/animateInfieldRangeChase\(coverage,true\)/,'missed grounders should have a chase animation');
console.log('INFIELD COVERAGE ATTRIBUTE CONTRAST CHECKS PASS',JSON.stringify({stronger:infieldRangeAudit.stronger,weaker:infieldRangeAudit.weaker}));

const outfieldRangeAudit=vm.runInContext(`(()=>{
 const base=Array.from({length:17},()=>({field:55,speed:55}));
 const strong=base.map(p=>({...p})),weak=base.map(p=>({...p}));
 strong[15]={field:95,speed:95};weak[15]={field:15,speed:15};
 const sample=[155,-83],elite=outfieldCoverage('fly',sample,strong),poor=outfieldCoverage('fly',sample,weak);
 const gap=[153,-85],centerPlus=base.map(p=>({...p}));centerPlus[15]={field:99,speed:99};
 const picked=outfieldCoverage('fly',gap,centerPlus);
 let strongCovers=0,weakCovers=0;
 for(let x=105;x<=205;x+=5)for(let y=-110;y<=-30;y+=10){
  const a=outfieldCoverage('fly',[x,y],strong),b=outfieldCoverage('fly',[x,y],weak);
  if(a.distance<=a.reach)strongCovers++;
  if(b.distance<=b.reach)weakCovers++;
 }
 return {eliteReach:elite.reach,poorReach:poor.reach,strongCovers,weakCovers,picked:picked.defender};
})()`,ctx);
assert.ok(outfieldRangeAudit.eliteReach>outfieldRangeAudit.poorReach,'elite centerfielder must have more range');
assert.ok(outfieldRangeAudit.strongCovers>outfieldRangeAudit.weakCovers,'fast skilled centerfielder should cover more gap balls');
assert.equal(outfieldRangeAudit.picked,'CF','fast centerfielder should take a gap ball');
assert.match(html,/const cover=outfieldCoverage\(type,point,current\(\)\.def\.players\)/,'outfield catches must select real covering defender');
assert.match(html,/hit\(p,contact\.gapMiss\?2:1,'liner',contact\)/,'missed gap liners must produce extra-base opportunities');
assert.match(html,/hit\(p,contact\.gapMiss\?2:1,'normal',contact\)/,'missed fly balls must produce extra-base opportunities');
console.log('OUTFIELD ATTRIBUTE / GAP COVERAGE TESTS PASS',JSON.stringify(outfieldRangeAudit));

const rollingGroundAudit=vm.runInContext(`(()=>{
 init();
 const kinds={groundThrough:0,gapLiner:0,overHead:0,fenceDouble:0};
 let issues=0,minRollingMs=Infinity;
 for(let i=0;i<5000;i++){
  const plan=outfieldHitPlan(i%2+1,'normal');
  kinds[plan.flight]++;
  if(plan.flight!=='groundThrough')continue;
  minRollingMs=Math.min(minRollingMs,plan.flightMs);
  const points=[0,.15,.31,.50,.67,.82,1].map(t=>groundRollPosition(plan,t));
  if(Math.abs(points[0][0]-200)>.01||Math.abs(points[0][1]-283)>.01)issues++;
  const last=points[points.length-1];
  if(Math.abs(last[0]-plan.rollEnd[0])>.01||Math.abs(last[1]-plan.rollEnd[1])>.01)issues++;
  if(points.some(p=>!p.every(Number.isFinite)||p[1]<outfieldFenceY(p[0])+8))issues++;
  if(points[3][1]>=points[2][1]||points[5][1]>=points[4][1])issues++;
 }
 return {kinds,minRollingMs,issues};
})()`,ctx);
assert.ok(rollingGroundAudit.kinds.groundThrough>400,'routine ground-ball hits must occur regularly');
assert.ok(rollingGroundAudit.minRollingMs>=1200,'grass roll should remain visible');
assert.equal(rollingGroundAudit.issues,0,'grounders must travel smoothly from the plate through grass');
assert.match(html,/groundRollPosition\(targetInfo\|\|\{point:target\},t\)/,'animation must sample grounder position on each frame');
assert.match(html,/flightMs:motion\.flightMs,defender:wing/,'ground balls past infielders must use strength-based rolling time');
console.log('VISIBLE OUTFIELD GROUND ROLL CHECKS PASS',JSON.stringify(rollingGroundAudit));

const noMagneticBall=vm.runInContext(`(()=>{
 const scenarios=[];
 for(let i=0;i<800;i++){
  const plan=outfieldHitPlan(i%2+1,'normal');
  if(plan.flight!=='groundThrough')continue;
  const origin=[plan.defender==='LF'?99:plan.defender==='CF'?200:301,-5];
  const pursuit=outfieldPursuitPlan('groundThrough',plan,origin,plan.flightMs);
  const rollEnd=groundRollPosition(plan,1);
  const timing=outfieldPickupTiming(plan,plan.fielder.field);
  scenarios.push({endpoint:rollEnd,pickup:pursuit.pickup,finish:pursuit.destination,
   rollMs:plan.flightMs,releaseMs:timing.release,atGrass:groundRollPosition(plan,.75)});
 }
 return scenarios;
})()`,ctx);
assert.ok(noMagneticBall.length>100,'ground ball cases must occur frequently');
for(const play of noMagneticBall){
 assert.deepEqual(Array.from(play.pickup),Array.from(play.endpoint),'fielder must meet the ball at its own roll endpoint');
 assert.deepEqual(Array.from(play.finish),Array.from(play.endpoint),'the ball must never chase the outfielder');
 assert.ok(play.releaseMs>play.rollMs,'ball must finish rolling before the throw begins');
}
assert.match(html,/groundRollPosition\(targetInfo,\.67\)/,'fielder should track the grounder across grass');
assert.match(html,/const from=\[Number\(ball\.getAttribute\('cx'\)\),Number\(ball\.getAttribute\('cy'\)\)\]/,'return throw must begin at current ball position');
assert.match(html,/requestAnimationFrame\(throwFrame\)/,'relay must animate frame by frame without SVG CSS snapping');
console.log('NATURAL OUTFIELD PICKUP / NO MAGNETIC BALL CHECKS PASS');

const grounderStrengthAudit=vm.runInContext(`(()=>{
 const strengths={hard:[],normal:[],soft:[]},counts={hard:0,normal:0,soft:0};
 const speeds=Object.fromEntries(Object.keys(strengths).map(k=>[k,grounderStrengthPlan(k).flightMs]));
 init();
 for(let i=0;i<6500;i++){
  const p=outfieldHitPlan(1,'normal');
  if(p.flight!=='groundThrough')continue;
  counts[p.strength]++;
  const roll=Math.hypot(p.rollEnd[0]-p.point[0],p.rollEnd[1]-p.point[1]);
  strengths[p.strength].push(roll);
  const origin=p.defender==='CF'?[200,-75]:p.defender==='LF'?[99,-5]:[301,-5];
  const pursuit=outfieldPursuitPlan('groundThrough',p,origin,p.flightMs);
  const end=groundRollPosition(p,1);
  if(Math.hypot(end[0]-pursuit.destination[0],end[1]-pursuit.destination[1])>.01)throw Error('pickup/roll mismatch');
 }
 const mean=a=>a.reduce((x,v)=>x+v,0)/a.length;
 return {counts,speeds,meanRoll:Object.fromEntries(Object.entries(strengths).map(([k,v])=>[k,mean(v)]))};
})()`,ctx);
assert.ok(Object.values(grounderStrengthAudit.counts).every(n=>150),'all grounder strengths must occur');
assert.ok(grounderStrengthAudit.speeds.hard<grounderStrengthAudit.speeds.normal);
assert.ok(grounderStrengthAudit.speeds.normal<grounderStrengthAudit.speeds.soft);
assert.ok(grounderStrengthAudit.meanRoll.hard>grounderStrengthAudit.meanRoll.normal);
assert.ok(grounderStrengthAudit.meanRoll.normal>grounderStrengthAudit.meanRoll.soft);
assert.match(html,/data-chase-direction/,'outfielders should distinguish forward vs back pursuit');
assert.match(html,/groundRollPosition\(targetInfo,\.67\)/,'fielder must move to a point on actual ball path');
console.log('GROUNDER SPEED AND OUTFIELD PURSUIT CONTRAST PASS',JSON.stringify(grounderStrengthAudit));

const softInfieldThrowAudit=vm.runInContext(`(()=>{
 const defender={field:55,speed:55,arm:55},slow={field:20,speed:20,arm:20};
 const direction={defender:'SS',point:[158,156]};
 const ball=[170,199];
 const softRange=groundRangePlan({...direction,point:ball,strength:'soft'},defender,0);
 const hardRange=groundRangePlan({...direction,point:ball,strength:'hard'},defender,0);
 const soft=groundPlayTimes({speed:55},{...direction,point:ball,strength:'soft'},defender);
 const hard=groundPlayTimes({speed:55},{...direction,point:ball,strength:'hard'},defender);
 const weak=groundPlayTimes({speed:55},{...direction,point:ball,strength:'soft'},slow);
 const pickup=outfieldPickupTiming({flight:'groundThrough',flightMs:1530},55);
 const relay=extraBaseThrowTiming({flight:'groundThrough',flightMs:1530},55,55,[140,-30],[200,293]);
 return {softRange,hardRange,soft,hard,weak,pickup,relay,normalRelease:fielderReleaseMs(55,55),
  weakRelease:fielderReleaseMs(20,20),quickRelease:fielderReleaseMs(65,65,true)};
})()`,ctx);
assert.ok(softInfieldThrowAudit.softRange.reachable,'ordinary infielder should charge a soft roller');
assert.ok(!softInfieldThrowAudit.hardRange.reachable,'same distant hard ball can get through');
assert.ok(softInfieldThrowAudit.soft.pickup>softInfieldThrowAudit.hard.pickup,'soft roller should take longer to field');
assert.ok(softInfieldThrowAudit.soft.arrive===softInfieldThrowAudit.soft.pickup+softInfieldThrowAudit.soft.releaseMs+softInfieldThrowAudit.soft.throwMs,'the umpire clock must include the release');
assert.ok(softInfieldThrowAudit.weakRelease>softInfieldThrowAudit.normalRelease,'weaker arms and gloves take longer to set and throw');
assert.ok(softInfieldThrowAudit.quickRelease<softInfieldThrowAudit.normalRelease,'relay transfers are quicker than ordinary set throws');
assert.ok(softInfieldThrowAudit.pickup.gather>=235,'outfielders must visibly gather before throwing');
assert.equal(softInfieldThrowAudit.relay.arrival,softInfieldThrowAudit.relay.pickup.release+softInfieldThrowAudit.relay.relay+softInfieldThrowAudit.relay.transfer+softInfieldThrowAudit.relay.second);
assert.match(html,/releaseMs=timing\?timing\.releaseMs:fielderReleaseMs\(\)/,'ground animation must use the same release clock as the decision');
assert.match(html,/secondThrowAt=firstArrival\+fielderReleaseMs\(65,65,true\)/,'double play must wait for second pivot release');
assert.match(html,/relayPause=fielderReleaseMs\(65,65,true\)/,'outfield relay animation must wait for transfer');
console.log('SOFT INFIELD CHARGE AND SHARED THROW CLOCKS PASS');

const arrivalMarkerAudit=vm.runInContext(`(()=>{
 const oldRunner={id:'existing'},newRunner={id:'newBatter'};
 const before=[oldRunner,null,null];
 const results={
  oldAtFirst:runnerMarkerVisible(oldRunner,0,before),
  oldTeleportSecond:runnerMarkerVisible(oldRunner,1,before),
  newAtFirstBeforeStaging:runnerMarkerVisible(newRunner,0,before)
 };
 const token=animationToken;
 stageRunnerArrival(newRunner.id,1250,token);
 results.newBeforeArrival=runnerMarkerVisible(newRunner,0,before);
 results.miniBaseHidden=pendingRunnerArrivals.has(newRunner.id);
 const pendingToken=pendingRunnerArrivals.get(newRunner.id);
 pendingRunnerArrivals.delete(newRunner.id);
 results.newAfterArrival=runnerMarkerVisible(newRunner,0,before);
 return {results,pendingToken,token};
})()`,ctx);
assert.equal(arrivalMarkerAudit.results.oldAtFirst,true,'stationary runner should remain visible');
assert.equal(arrivalMarkerAudit.results.oldTeleportSecond,false,'existing runner must not teleport to next base');
assert.equal(arrivalMarkerAudit.results.newBeforeArrival,false,'new batter marker must stay hidden while running');
assert.equal(arrivalMarkerAudit.results.miniBaseHidden,true,'mini diamond should share arrival gate');
assert.equal(arrivalMarkerAudit.results.newAfterArrival,true,'stationary marker can appear on actual arrival');
assert.equal(arrivalMarkerAudit.pendingToken,arrivalMarkerAudit.token,'arrival must be guarded by animation token');
assert.match(html,/if\(!runnerMarkerVisible\(game\.bases\[i\],i,beforeBases\)\)c\.setAttribute\('opacity','0'\)/,'main base overlay must gate marker visibility at render');
assert.match(html,/const occupied=\(game\?\.bases\|\|\[\]\)\.map\(p=>p&&!pendingRunnerArrivals\.has\(p\.id\)\?p:null\)/,'mini diamond should hide incoming batter');
assert.match(html,/stageRunnerArrival\(player\.id,arrival,token\)/,'batter animation must register arrival clock');
console.log('RUNNER MARKERS WAIT FOR BASE ARRIVAL PASS');

const batterFirstBaseRouteAudit=vm.runInContext(`(()=>{
 const first=[323,169],home=[200,283];
 const singleTouch=batterFirstRoute('through',.76);
 const singleOverrun=batterFirstRoute('through',1);
 const doubleTouch=batterFirstRoute('round',1);
 const approach=batterFirstRoute('round',.75);
 const straight=batterFirstRoute('straight',1);
 const start=batterFirstRoute('through',0);
 return {first,home,start,singleTouch,singleOverrun,doubleTouch,approach,straight};
})()`,ctx);
assert.deepEqual(Array.from(batterFirstBaseRouteAudit.start),batterFirstBaseRouteAudit.home,'all first-base routes start at home');
assert.deepEqual(Array.from(batterFirstBaseRouteAudit.singleTouch),batterFirstBaseRouteAudit.first,'single touches first before overrunning');
assert.ok(batterFirstBaseRouteAudit.singleOverrun[0]>323&&batterFirstBaseRouteAudit.singleOverrun[1]<169,'single must sprint through first into foul territory');
assert.deepEqual(Array.from(batterFirstBaseRouteAudit.doubleTouch),batterFirstBaseRouteAudit.first,'double must touch first without overrunning');
assert.deepEqual(Array.from(batterFirstBaseRouteAudit.straight),batterFirstBaseRouteAudit.first,'regular first-base approach should reach bag');
assert.ok(batterFirstBaseRouteAudit.approach[0]>200&&batterFirstBaseRouteAudit.approach[1]<283,'extra-base hit must take a curved approach');
assert.match(html,/later\(finishFirst\+overrunHold,\(\)=>moveRunnerRoundBase\(runner,first,returnMs,'stop',token\)\)/,'single returns to first after an overrun');
assert.match(html,/later\(finishFirst\+20,\(\)=>moveRunnerRoundBase\(runner,second,560,'run',token\)\)/,'extra-base hit must continue from first toward second');
assert.match(html,/stageRunnerArrival\(player\.id,finalArrival,token\)/,'fixed base marker must wait for final arrival');
assert.match(html,/if\(moving\?\.getAttribute\('data-runner-id'\)===String\(id\)\)moving\.setAttribute\('visibility','hidden'\)/,'sprite must disappear before stationary marker shows');
console.log('BATTER FIRST BASE RUN-THROUGH VS ROUNDING CHECKS PASS');

const cornerDepthAudit=vm.runInContext(`(()=>{
 const first=INFIELD_RANGE_ORIGINS['1B'],third=INFIELD_RANGE_ORIGINS['3B'];
 const nearFirst=groundRangePlan({defender:'1B',point:[282,154],strength:'normal'},{field:55,speed:55});
 const nearThird=groundRangePlan({defender:'3B',point:[118,154],strength:'normal'},{field:55,speed:55});
 return {first,third,nearFirst,nearThird};
})()`,ctx);
assert.deepEqual(Array.from(cornerDepthAudit.first),[282,149],'first baseman must play deeper than the bag');
assert.deepEqual(Array.from(cornerDepthAudit.third),[118,149],'third baseman must play deeper than the bag');
assert.ok(cornerDepthAudit.nearFirst.reachable&&cornerDepthAudit.nearThird.reachable,'corner fielders should cover balls near their normal depth');
assert.match(html,/\.\.\.\['1B','2B','SS','3B'\]\.map\(name=>\[name,\.\.\.defensiveAlignment\(\)\.positions\[name\]\]\)/,'initial infield rendering must use active alignment');
assert.match(html,/const base=\{LF:\[99,-5\],CF:\[200,-75\],RF:\[301,-5\],\.\.\.defensiveAlignment\(\)\.positions\}/,'fielder reset must use active alignment');
console.log('CORNER INFIELDERS STANDARD DEPTH PASS');

const situationalInfieldAudit=vm.runInContext(`(()=>{
 const team=runs=>({runs:[runs]});
 const state=(bases,outs,inning=4,defRuns=0,batRuns=0)=>({
  bases,outs,inning,half:0,ended:false,teams:[team(batRuns),team(defRuns)]
 });
 const normal=defensiveAlignment(state([null,null,null],1));
 const bunt=defensiveAlignment(state([{id:'a'},null,null],0));
 const infieldIn=defensiveAlignment(state([null,null,{id:'c'}],1));
 const twoOut=defensiveAlignment(state([null,null,{id:'c'}],2));
 const deep=defensiveAlignment(state([null,null,null],1,8,6,1));
 return {normal,bunt,infieldIn,twoOut,deep};
})()`,ctx);
assert.equal(situationalInfieldAudit.normal.name,'通常守備');
assert.equal(situationalInfieldAudit.bunt.name,'バント警戒');
assert.ok(situationalInfieldAudit.bunt.positions['1B'][1]>situationalInfieldAudit.normal.positions['1B'][1],'first baseman charges for bunt');
assert.ok(situationalInfieldAudit.bunt.positions['3B'][1]>situationalInfieldAudit.normal.positions['3B'][1],'third baseman charges for bunt');
assert.equal(situationalInfieldAudit.infieldIn.name,'前進守備');
assert.ok(situationalInfieldAudit.infieldIn.positions.SS[1]>situationalInfieldAudit.normal.positions.SS[1],'middle infielders come in with third runner and fewer than two outs');
assert.notEqual(situationalInfieldAudit.twoOut.name,'前進守備','do not automatically play in with two outs');
assert.equal(situationalInfieldAudit.deep.name,'深めの守備');
assert.ok(situationalInfieldAudit.deep.positions['1B'][1]<situationalInfieldAudit.normal.positions['1B'][1],'protect late lead with deeper defense');
assert.match(html,/applyDefensiveAlignment\(\);\s*showPitchResult\('投球中/,'defensive positions must update before the pitch');
assert.match(html,/const origin=infieldOrigin\(direction\.defender\)\|\|point/,'fielding clock must use shifted origin');
assert.match(html,/const pos=direction\.defender,origin=infieldOrigin\(pos\)\|\|direction\.point/,'coverage must use shifted origin');
console.log('SITUATIONAL DEFENSIVE ALIGNMENTS PASS');

const middleInfieldPositions=vm.runInContext(`(()=>{
 const mk=(bases,outs,inning=4,lead=0)=>({bases,outs,inning,half:0,ended:false,teams:[{runs:[0]},{runs:[lead]}]});
 const regular=defensiveAlignment(mk([null,null,null],1));
 const infieldIn=defensiveAlignment(mk([null,null,{id:'third'}],1));
 const bunt=defensiveAlignment(mk([{id:'first'},null,null],0));
 const deep=defensiveAlignment(mk([null,null,null],1,8,5));
 const SS=INFIELD_RANGE_ORIGINS.SS,second=INFIELD_RANGE_ORIGINS['2B'];
 const coverage=groundRangePlan({defender:'SS',point:[144,109],strength:'normal'},{field:55,speed:55});
 return {regular,infieldIn,bunt,deep,SS,second,coverage};
})()`,ctx);
assert.deepEqual(Array.from(middleInfieldPositions.SS),[143,107],'shortstop should be deeper and third-base side');
assert.deepEqual(Array.from(middleInfieldPositions.second),[257,132],'second baseman should be shallower and first-base side');
for(const alignment of [middleInfieldPositions.regular,middleInfieldPositions.infieldIn,middleInfieldPositions.bunt,middleInfieldPositions.deep]){
 assert.ok(alignment.positions.SS[0]<200&&alignment.positions['2B'][0]>200,'middle infielders must be on correct sides of second base');
 assert.ok(alignment.positions.SS[1]<alignment.positions['2B'][1],'shortstop should play deeper than second baseman');
}
assert.deepEqual(Array.from(middleInfieldPositions.coverage.origin),[143,107],'range origin must follow actual shortstop alignment');
assert.match(html,/\['P',200,203\],\['C',200,315\],\.\.\.\['1B','2B','SS','3B'\]\.map/,'initial visual positions must share alignment state');
console.log('MIDDLE INFIELD DEPTH AND ALIGNMENT CONSISTENCY PASS');

const middleShiftAudit=vm.runInContext(`(()=>{
 const player=bats=>({bats});
 const state=(first,outs,bats)=>({
  bases:[first?{id:'runner'}:null,null,null],outs,inning:3,half:0,ended:false,
  teams:[{bat:0,players:Array.from({length:14},(_,i)=>player(i===5?bats:'右打')),runs:[0]},{runs:[0]}]
 });
 const right=defensiveAlignment(state(false,1,'右打'));
 const left=defensiveAlignment(state(false,1,'左打'));
 const force=defensiveAlignment(state(true,1,'右打'));
 const twoOut=defensiveAlignment(state(true,2,'右打'));
 const forceLeft=defensiveAlignment(state(true,1,'左打'));
 return {right,left,force,twoOut,forceLeft};
})()`,ctx);
assert.ok(middleShiftAudit.left.positions.SS[0]>middleShiftAudit.right.positions.SS[0],'left batter shifts SS toward first-base side');
assert.ok(middleShiftAudit.left.positions['2B'][0]>middleShiftAudit.right.positions['2B'][0],'left batter shifts 2B toward first-base side');
assert.ok(middleShiftAudit.force.positions.SS[0]>middleShiftAudit.right.positions.SS[0],'runner on first shifts SS toward second');
assert.ok(middleShiftAudit.force.positions['2B'][0]<middleShiftAudit.right.positions['2B'][0],'runner on first shifts 2B toward second');
assert.deepEqual(Array.from(middleShiftAudit.twoOut.positions.SS),Array.from(middleShiftAudit.right.positions.SS),'no force-position shift with two outs');
assert.ok(middleShiftAudit.forceLeft.positions.SS[0]<200&&middleShiftAudit.forceLeft.positions['2B'][0]>200,'combined shift preserves correct sides');
assert.match(html,/const hitter=lineup\?\.\[\[5,6,7,8,9,10,11,12,13\]\[\(attacking\.bat\|\|0\)%9\]\]/,'alignment must use the actual upcoming batter');
console.log('MIDDLE INFIELD FORCE AND BATTER HANDEDNESS SHIFTS PASS');

const alignmentMovementAudit=vm.runInContext(`(()=>{
 const distances=[0,1,3,12,30,70],times=distances.map(alignmentMoveDuration);
 const el=(x,y)=>({style:{},attrs:{cx:String(x),cy:String(y)},
  getAttribute(k){return this.attrs[k]??null},setAttribute(k,v){this.attrs[k]=String(v)}});
 const nodes={};
 for(const name of ['1B','2B','SS','3B'])nodes[name]={circle:el(200,180),label:el(200,180)};
 const originalDocumentGet=document.getElementById;
 const originalGame=game;
 // Return the mocked field only for the movement audit.
 const layer={querySelector(selector){
  const match=selector.match(/^(circle|text)\[data-position="([^"]+)"\]$/);
  return match?nodes[match[2]]?.[match[1]==='circle'?'circle':'label']:null;
 }};
 document.getElementById=id=>id==='fielders'?layer:originalDocumentGet(id);
 game={bases:[null,null,null],outs:1,inning:1,half:0,ended:false,teams:[{bat:0,runs:[0],players:Array.from({length:14},()=>({bats:'右打'}))},{runs:[0]}]};
 const result=applyDefensiveAlignment(true);
 document.getElementById=originalDocumentGet;
 game=originalGame;
 return {times,result,flags:Object.fromEntries(Object.entries(nodes).map(([name,el])=>[name,el.circle.attrs['data-aligning']]))};
})()`,ctx);
assert.equal(alignmentMovementAudit.times[0],0,'no movement needed at identical coordinates');
assert.equal(alignmentMovementAudit.times[1],0,'subpixel or trivial shifts must not waste a pitch');
assert.ok(alignmentMovementAudit.times[2]>=250,'moderate shift takes visible time');
assert.ok(alignmentMovementAudit.times[5]<=650,'long shift must be bounded');
assert.ok(alignmentMovementAudit.result>=250,'fielder movement should delay pitch release');
assert.ok(Object.values(alignmentMovementAudit.flags).some(v=>v==='true'),'moved fielders should be tagged during repositioning');
assert.match(html,/const moveMs=applyDefensiveAlignment\(true\)/,'pitch must request animated repositioning');
assert.match(html,/if\(token!==animationToken\|\|!game\|\|game\.ended\)return;\s*startPitchMotion\(\)/,'pitch must start only after movement and token check');
assert.match(html,/flightTimer=setTimeout\(\(\)=>\{\s*flightTimer=null;\s*if\(token!==animationToken/,'pending movement must occupy cancellable flight timer');
console.log('PRE-PITCH INFIELD MOVEMENT AND TOKEN GUARDS PASS');

const secondCoverAudit=vm.runInContext(`(()=>{
 const oldGame=game;
 const roster=Array.from({length:20},()=>({field:55,arm:55}));
 roster[8]={field:87,arm:72};roster[9]={field:65,arm:81};
 game={half:0,teams:[{players:roster},{players:roster}]};
 const ss=secondBaseCoverPlan('SS');
 const second=secondBaseCoverPlan('2B');
 const third=secondBaseCoverPlan('3B');
 const ssRelay=groundSecondRelayPlan({defender:'SS',point:[158,156]},{arm:62});
 const secondRelay=groundSecondRelayPlan({defender:'2B',point:[242,155]},{arm:62});
 game=oldGame;
 return {ss,second,third,ssRelay,secondRelay};
})()`,ctx);
assert.equal(secondCoverAudit.ss.cover,'2B','SS grounder covered by second baseman');
assert.equal(secondCoverAudit.second.cover,'SS','2B grounder covered by shortstop');
assert.equal(secondCoverAudit.third.cover,'2B','3B grounder covered by second baseman');
assert.equal(secondCoverAudit.ss.fielding,87,'pivot fielder fielding should come from roster');
assert.equal(secondCoverAudit.second.arm,81,'pivot arm should come from roster');
assert.ok(secondCoverAudit.ssRelay.pickupToSecond>0&&secondCoverAudit.ssRelay.pivotRelease>0&&secondCoverAudit.ssRelay.secondToFirst>0,'realistic throw and transfer clocks');
assert.notEqual(secondCoverAudit.ssRelay.secondToFirst,secondCoverAudit.secondRelay.secondToFirst,'pivot throwing strength changes relay speed');
assert.match(html,/animateSecondBaseCover\(relay,firstArrival,holdUntil,token,outcome==='double'\)/,'animation uses second base pivot');
assert.match(html,/const dpArrival=relay\?quickTiming\.pickup\+quickTiming\.releaseMs\+relay\.pickupToSecond\+relay\.pivotRelease\+relay\.secondToFirst:Infinity/,'double play verdict uses quick fielding and actual pivot timing');
assert.match(html,/if\(outcome!=='force'\)showFirstCoverSprite/,'force play must not unnecessarily cover first');
console.log('SECOND BASE PIVOT AND DOUBLE PLAY RELAY PASS');

assert.match(html,/animateGround\('double',direction,p\.speed,fielder\.arm,quickTiming\)/,'double-play animation must use the same quick fielding clock as the call');
assert.match(html,/releaseMs:fielderReleaseMs\(fielder\.field,fielder\.arm,true\)/,'double-play turn needs a quick first release');
console.log('DOUBLE PLAY QUICK RELAY CLOCK PASS');

const pivotFootworkAudit=vm.runInContext(`(()=>{
 const plan={cover:'SS',base:[200,47],pivotRelease:220};
 const steps=secondPivotFootwork(plan,1100,2050);
 return {steps};
})()`,ctx);
assert.ok(pivotFootworkAudit.steps.approachEnd<pivotFootworkAudit.steps.receiveAt,'pivot must reach second before throw');
assert.equal(pivotFootworkAudit.steps.releaseAt,1320,'pivot must release after transfer time');
assert.deepEqual(Array.from(pivotFootworkAudit.steps.bag),[200,47],'pivot must step on second base');
assert.notDeepEqual(Array.from(pivotFootworkAudit.steps.exit),[200,47],'pivot must step off the bag to relay');
assert.match(html,/circle\.setAttribute\('data-pivot-phase','receive'\)/,'pivot visibly receives the ball');
assert.match(html,/circle\.setAttribute\('data-pivot-phase','transfer'\)/,'pivot transfer footwork present');
assert.match(html,/circle\.setAttribute\('data-pivot-phase','release'\)/,'pivot releases throw to first');
assert.match(html,/game\.forceOutVisual=\{id:b\[0\]\.id,speed:b\[0\]\.speed,outcome:'double'\}/,'double play preserves forced runner for animation');
assert.match(html,/animateForceAtSecond\(game\.forceOutVisual,firstArrival,holdUntil,token\)/,'forced runner visually runs toward second');
assert.match(html,/circle\.setAttribute\('data-run-state','slide'\)/,'runner slides into second');
assert.match(html,/sprite\.setAttribute\('data-first-phase','stretch'\)/,'first baseman stretches to receive');
assert.match(html,/sprite\.setAttribute\('data-first-phase','catch'\)/,'first baseman catches before call');
assert.match(html,/const moveBall=\(x,y,duration\)=>moveGroundFielder\(ball,null,\[x,y\],duration,token\)/,'infield throw uses animation frames instead of SVG CSS');
assert.match(html,/if\(outcome!=='force'\)showFirstCoverSprite\(firstCover,firstLabel,token,fieldMs,player,decisionMs,holdUntil,arrival\)/,'first baseman catch synchronized to first arrival');
console.log('PIVOT FOOTWORK, FORCE SLIDE, FIRST-BASE CATCH PASS');

const handedBatterAudit=vm.runInContext(`(()=>{
 const right=batterStancePlan({bats:'右打'});
 const left=batterStancePlan({bats:'左打'});
 const fallback=batterStancePlan({bats:'右打'});
 return {right,left,fallback};
})()`,ctx);
assert.equal(handedBatterAudit.right.hand,'右','right batter must have a right-hand label');
assert.equal(handedBatterAudit.left.hand,'左','left batter must have a left-hand label');
assert.ok(handedBatterAudit.right.position[0]<200&&handedBatterAudit.left.position[0]>200,'batter box must change sides of plate');
assert.ok(handedBatterAudit.right.batEnd[0]<0&&handedBatterAudit.left.batEnd[0]>0,'bat rests on mirrored shoulders');
assert.match(html,/id="battingStance"/,'actual batter SVG needed on field');
assert.match(html,/id="batterHandLabel"/,'batter side visible on field');
assert.match(html,/showBattingStance\(batter\(\)\)/,'render updates stance with current lineup');
assert.match(html,/else if\(x<\.70\)\{animateBatterSwing\(p\);foulBall\(p\)\}/,'foul ball includes swing');
assert.match(html,/else\{complete=true;animateBatterSwing\(p\);showPitchResult/,'ball in play includes swing');
assert.match(html,/if\(!force&&Date\.now\(\)<batterVisualLockedUntil\)return/,'swing should not turn into next batter mid-animation');
console.log('BATTING STANCE MIRROR AND SWING PASS');

const battingTransitionAudit=vm.runInContext(`(()=>{
 const left=batterStancePlan({bats:'左打'}),right=batterStancePlan({bats:'右打'});
 return {left,right};
})()`,ctx);
assert.ok(battingTransitionAudit.left.position[0]>200&&battingTransitionAudit.right.position[0]<200,'runner departs from real left or right batter box');
assert.match(html,/const atBat=batter\(\),stance=batterStancePlan\(atBat\)/,'runner departure must track actual batter and box');
assert.match(html,/moveGroundFielder\(runner,null,home,departureMs,token\)/,'runner moves from batting box to home plate before sprinting');
assert.match(html,/later\(departureMs,\(\)=>animateBatterFirstLeg\(runner,route,runningMs,token\)\)/,'first base sprint begins after departure phase');
assert.match(html,/const runningMs=Math\.max\(120,firstDuration-departureMs\)/,'first-base arrival timing retains original duration');
assert.match(html,/runner\.setAttribute\('visibility','hidden'\);\s*if\(stanceGroup\)stanceGroup\.setAttribute\('data-visual-phase','depart'\)/,'do not duplicate batter and runner at contact');
assert.match(html,/later\(75,\(\)=>\{if\(stanceGroup\)stanceGroup\.setAttribute\('visibility','hidden'\);runner\.setAttribute\('visibility','visible'\)\}\)/,'batter sprite hands off to runner on push-off');
assert.match(html,/batterRunnerOnField=true/,'runner activity blocks premature next batter');
assert.match(html,/batterRunnerOnField=false;\s*finishBatterVisual\(token\)/,'next batter appears after running animation finishes');
assert.match(html,/animateBatterTake\(p,'ball'\)/,'ball taken without swing');
assert.match(html,/animateBatterTake\(p,'strike'\)/,'called strike taken without swing');
assert.match(html,/animateBatterSwing\(p,false\);foulBall\(p\)/,'foul ball has a swing');
assert.match(html,/animateBatterSwing\(p,true\);showPitchResult\('インプレー'/,'ball in play locks next batter until action finishes');
console.log('BATTER BOX TO FIRST, CALLED PITCH, NEXT HITTER TRANSITION PASS');

const tenVisualImprovementsAudit=vm.runInContext(`(()=>{
 const type=PITCH_TYPES[0];
 return {pitchType:type.name,flight:type.flight};
})()`,ctx);
assert.ok(tenVisualImprovementsAudit.flight>0);
for(const id of ['pitcherLeg','pitcherArm','catcherCrouch','catcherGlove','catcherCall','batterKnees']){
 assert.ok(html.includes('id="'+id+'"'),'visual element missing: '+id);
}
assert.match(html,/pitchActionVisual\(type,ballToken\)/,'pitcher leg and arm animate during the flight');
assert.match(html,/catcherSetTarget\(ballToken\)/,'catcher sets target before the pitch');
assert.match(html,/batterReadyMotion\(ballToken\)/,'batting stance adjusts before delivery');
assert.match(html,/catcherReceiveVisual\('ball',animationToken\)/,'catcher receives a ball');
assert.match(html,/catcherReceiveVisual\('strike',animationToken\)/,'catcher receives called strike');
assert.match(html,/catcherReceiveVisual\('whiff',animationToken\)/,'catcher receives swung-through pitch');
assert.match(html,/else if\(x<\.755\)/,'new swing-and-miss branch');
assert.match(html,/game\.strikes\+\+;showPitchResult\('空振り！'/,'whiff adds a strike');
assert.match(html,/batterReactionVisual\('strikeout',p,animationToken\)/,'third strike reaction');
assert.match(html,/batterReactionVisual\('foul',player,token\)/,'foul balance reaction');
assert.match(html,/batterReactionVisual\(call,player,token\)/,'called pitch stance reaction');
assert.match(html,/if\(token!==animationToken\)return/,'visual timeout invalidation on stop');
console.log('TEN PITCHER CATCHER BATTER VISUAL FEATURES PASS');

const twentyRunnerVisualAudit=vm.runInContext(`(()=>{
 const leads=[0,1,2].map(i=>runnerLeadPlan(i,55));
 const fast=runnerLeadPlan(0,90),slow=runnerLeadPlan(0,20);
 const pickoff=[0,1,2].map(pickoffVisualPlan);
 const caught=stealPlayPlan(55,false),stolen=stealPlayPlan(55,true);
 return {leads,fast,slow,pickoff,caught,stolen};
})()`,ctx);
assert.equal(twentyRunnerVisualAudit.leads.length,3,'1: leads on three bases');
assert.ok(twentyRunnerVisualAudit.leads[0].lead[0]<323,'2: first runner leads toward second');
assert.ok(twentyRunnerVisualAudit.leads[1].lead[0]<200,'3: second runner leads toward third');
assert.ok(twentyRunnerVisualAudit.leads[2].lead[0]>77,'4: third runner leads toward home');
assert.ok(twentyRunnerVisualAudit.fast.extendMs<twentyRunnerVisualAudit.slow.extendMs,'5: speed affects lead');
assert.ok(twentyRunnerVisualAudit.fast.retreatMs<twentyRunnerVisualAudit.slow.retreatMs,'6: speed affects retreat');
assert.ok(twentyRunnerVisualAudit.leads[0].retreatMs>0,'7: runner returns after lead');
assert.ok(twentyRunnerVisualAudit.pickoff.every(p=>p.throwMs>0),'8: pickoff clock');
assert.deepEqual(Array.from(twentyRunnerVisualAudit.pickoff[0].base),[323,169],'9: first pickoff');
assert.deepEqual(Array.from(twentyRunnerVisualAudit.pickoff[1].base),[200,47],'10: second pickoff');
assert.deepEqual(Array.from(twentyRunnerVisualAudit.pickoff[2].base),[77,169],'11: third pickoff');
assert.ok(twentyRunnerVisualAudit.caught.catchAt<twentyRunnerVisualAudit.caught.runnerMs,'12: caught stealing throw first');
assert.ok(twentyRunnerVisualAudit.stolen.catchAt>twentyRunnerVisualAudit.stolen.runnerMs,'13: successful steal runner first');
assert.ok(html.includes('id="pitcherSet"'),'14: set graphic');
assert.ok(html.includes('id="pitcherGlance"'),'15: look at runner');
assert.ok(html.includes('id="catcherThrowSprite"'),'16: catcher throw graphic');
assert.ok(html.includes('data-steal-cover'),'17: second base cover');
assert.ok(html.includes('data-steal-phase'),'18: steal break/slide');
assert.ok(html.includes('data-steal-tag'),'19: tag result');
assert.ok(html.includes("'leadRunnerSprites','stealPlaySprites','pickoffSprites'"),'20: cancel cleanup');
assert.ok(html.includes('if(game.stealVisual)animateStealPlay(game.stealVisual)'),'steal motion called');
assert.ok(html.includes('if(game.stealVisual?.id===person.id||index===i'),'avoid duplicate runner');
assert.ok(html.includes('if(pickoff){'),'pickoff optional');
console.log('TWENTY RUNNER AND PICKOFF VISUAL FEATURES PASS');

const tacticalCleanupAudit=vm.runInContext(`(()=>{
 const before=clearTacticalVisuals.toString();
 const pause=$('pause').onclick.toString();
 const stopCode=stop.toString();
 const pickoff=animatePickoffReturn.toString();
 const stealGate=resolvePitch.toString();
 return {before,pause,stopCode,pickoff,stealGate};
})()`,ctx);
assert.ok(tacticalCleanupAudit.stopCode.includes('clearTacticalVisuals()'),'stop clears all tactical overlays');
assert.ok(tacticalCleanupAudit.pause.includes('clearTacticalVisuals()'),'pause clears all tactical overlays');
assert.ok(tacticalCleanupAudit.before.includes('pendingRunnerArrivals.has'),'cleanup preserves moving runner markers until arrival');
assert.ok(tacticalCleanupAudit.before.includes('data-steal-tag'),'cleanup clears old tag indicator');
assert.ok(tacticalCleanupAudit.before.includes('data-pickoff-cover'),'cleanup clears old pickoff indicator');
assert.ok(tacticalCleanupAudit.pickoff.includes('moveGroundFielder(bagCover,coverLabel,plan.base'),'pickoff fielder physically covers bag');
assert.ok(tacticalCleanupAudit.pickoff.includes('moveGroundFielder(bagCover,coverLabel,coverOrigin'),'fielder returns after pickoff');
assert.ok(tacticalCleanupAudit.stealGate.includes('game.stealVisual.inning===game.inning'),'stale inning steal animation not shown');
assert.ok(tacticalCleanupAudit.stealGate.includes('game.stealVisual.half===game.half'),'stale half inning steal animation not shown');
console.log('TACTICAL OVERLAY CLEANUP, PICKOFF COVER AND INNING GUARDS PASS');

const pickoffOrderingAudit=vm.runInContext(`(()=>{
 const body=pitch.toString();
 return {pickoff:body.indexOf('if(pickoff){'),snap:body.indexOf('applyDefensiveAlignment(false)'),normal:body.indexOf('const moveMs=applyDefensiveAlignment(true)'),returnAt:body.indexOf('return;')};
})()`,ctx);
assert.ok(pickoffOrderingAudit.pickoff>=0,'pickoff branch present');
assert.ok(pickoffOrderingAudit.snap>pickoffOrderingAudit.pickoff,'pickoff settles defense without a concurrent walking animation');
assert.ok(pickoffOrderingAudit.normal>pickoffOrderingAudit.snap,'normal pre-pitch reposition only follows non-pickoff branch');
console.log('PICKOFF AND DEFENSIVE REPOSITION MUST NOT OVERLAP PASS');
