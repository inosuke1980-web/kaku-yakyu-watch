'use strict';
// Research-only isolated VM experiment. Variants modify an in-memory copy of
// the pitch thresholds, never the production file or the RNG algorithm.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);
function study(seed,games,variant,shape){
 const exact=(s,needle,replacement)=>{assert.equal(s.split(needle).length,2,`threshold changed: ${needle}`);return s.replace(needle,replacement)};
 let experimentalSource=source;
 if(variant==='C1'){
  const needle='const pskill=(pi.control+pi.stuff)/2,x=Math.random();let complete=false;';
  const replacement="const pskill=(pi.control+pi.stuff)/2;lastC1=pitchC(Math.random,p.eye,pi.control,p.contact,pi.stuff,game.balls,game.strikes,'C1');const x=({ball:0,called:.50,foul:.60,whiff:.72,fair:.90})[lastC1.outcome];let complete=false;";
  experimentalSource=exact(experimentalSource,needle,replacement);
 }else assert.equal(variant,'A');


 function node(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},value:'random',disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
 const dom=new Map(),document={getElementById(id){if(!dom.has(id))dom.set(id,node());return dom.get(id)},createElement:node,createElementNS:node,querySelector:node,querySelectorAll:()=>[]};
 document.getElementById('category').value='high';document.getElementById('parkType').value='grass';document.getElementById('parkShape').value=shape;document.getElementById('matchType').value='official';document.getElementById('dayNight').value='day';
 const randomMath=Object.create(Math);let state=seed|0;
 randomMath.random=()=>{state=(state+0x6d2b79f5)|0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
 class FixedDate extends Date {constructor(...a){super(...(a.length?a:[0]))}static now(){return 0}}
 const ctx={assert,document,Math:randomMath,Date:FixedDate,performance:{now:()=>0},console,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},confirm:()=>true,experimentPitchNo:1};
 vm.createContext(ctx);vm.runInContext(experimentalSource,ctx);
 const proto=fs.readFileSync(path.join(__dirname,'pitch-location-calibration.cjs'),'utf8');
 const from=proto.indexOf('function zoneAt('),to=proto.indexOf('function pitchLegacy(');assert.ok(from>=0&&to>from);
 vm.runInContext(proto.slice(from,to)+'\nlet lastC1=null;',ctx);
 vm.runInContext(`render=()=>{};renderRoster=()=>{};animate=()=>{};animateGround=()=>{};animateFieldingError=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};animateFlyLeadAndReturn=()=>{};log=()=>{};historyRender=()=>{};saveGame=()=>{};
 let observed=null,fairDispatch=null;
 const hit0=hit,line0=lineBall,fly0=flyBall,ground0=groundBall;
 hit=function(...a){if(!fairDispatch)fairDispatch='hit';return hit0(...a)};lineBall=function(...a){if(!fairDispatch)fairDispatch='liner';return line0(...a)};flyBall=function(...a){if(!fairDispatch)fairDispatch='fly';return fly0(...a)};groundBall=function(...a){if(!fairDispatch)fairDispatch='ground';return ground0(...a)};
 const take0=animateBatterTake,swing0=animateBatterSwing,foul0=foulBall;
 animateBatterTake=function(p,c){observed=c==='ball'?'ball':'called';return take0(p,c)};
 animateBatterSwing=function(p,inPlay){observed=inPlay?'fair':'swing';return swing0(p,inPlay)};
 foulBall=function(p){observed='foul';const prior=game.strikes;const r=foul0(p);if(prior===2&&game.strikes!==2)throw Error('two-strike foul changed count');return r};`,ctx);
 const sum={seed,games:0,pa:0,pitchedPA:0,zeroPitchPA:0,allPitches:0,completedPitches:0,abandonedPitches:0,abandonedPA:0,distribution:{},first:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},second:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},pitchResults:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},outcomes:{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0},abandonedResults:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},fouls:0,max:0,enginePA:0,enginePitches:0,runs:0,c1:{zone:0,outside:0,far:0,chase:0,chance:0,errorsLow:0,countLow:0,errorsHigh:0,countHigh:0,transitions:0,eyeLowN:0,eyeLowChase:0,eyeHighN:0,eyeHighChase:0,dispatch:{hit:0,liner:0,fly:0,ground:0}},groups:{contactLow:{},contactHigh:{},eyeLow:{},eyeHigh:{},controlLow:{},controlHigh:{}},twoStrike:{completedPA:0,pitches:0,fouls:0,abandonedPitches:0,abandonedFouls:0},engineOutcomes:{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0}};
 for(let g=0;g<games;g++){
  vm.runInContext('init()',ctx);let pending=[],steps=0,twoPitches=0,twoFouls=0,ability=null;
  while(vm.runInContext('!game.ended',ctx)){
   assert.ok(++steps<10000,'game did not finish');
   const before=vm.runInContext(`(()=>{let p=batter(),t=current().bat;return {p,t,bat:t.bat,inning:game.inning,half:game.half,pitches:game.totalPitches,balls:game.balls,strikes:game.strikes,ability:{contact:p.contact,eye:p.eye,control:pitcher().control},stats:{ab:p.ab,h:p.h,hr:p.hr,bb:p.bb,k:p.k,sh:p.sh||0,sf:p.sf||0}}})()`,ctx);
   ctx.experimentPitchNo=pending.length+1;vm.runInContext('observed=null;lastC1=null;fairDispatch=null;resolvePitch()',ctx);
   const after=vm.runInContext('({observed,lastC1,fairDispatch,pitches:game.totalPitches,balls:game.balls,strikes:game.strikes,inning:game.inning,half:game.half,ended:game.ended})',ctx);
   if(!after.ended)assert.ok(vm.runInContext('game.balls>=0&&game.balls<4&&game.strikes>=0&&game.strikes<3&&game.outs>=0&&game.outs<3&&new Set(game.bases.filter(Boolean).map(p=>p.id)).size===game.bases.filter(Boolean).length',ctx),'invalid live count, outs, or duplicate runner');
   const delta=after.pitches-before.pitches;assert.ok(delta===0||delta===1);
   if(delta){let kind=after.observed==='swing'?'whiff':after.observed;assert.ok(Object.hasOwn(sum.pitchResults,kind),`unknown pitch: ${kind}`);if(!pending.length)ability=before.ability;pending.push(kind);sum.allPitches++;if(before.strikes===2){twoPitches++;if(kind==='foul')twoFouls++;}}
   if(variant==='C1'&&delta){const pitch=after.lastC1;assert.ok(pitch,'C1 result missing');const kind=after.observed==='swing'?'whiff':after.observed;assert.equal(kind,pitch.outcome,'engine branch differs from C1 outcome');assert.equal(pitch.zone,Math.max(Math.abs(pitch.x),Math.abs(pitch.y))<=1?'zone':Math.max(Math.abs(pitch.x),Math.abs(pitch.y))<=1.7?'outside':'far');sum.c1[pitch.zone]++;if(pitch.zone!=='zone'){sum.c1.chance++;if(pitch.swing)sum.c1.chase++;if(before.ability.eye<=40){sum.c1.eyeLowN++;if(pitch.swing)sum.c1.eyeLowChase++;}if(before.ability.eye>=70){sum.c1.eyeHighN++;if(pitch.swing)sum.c1.eyeHighChase++;}}if(pitch.outcome==='fair'){assert.ok(Object.hasOwn(sum.c1.dispatch,after.fairDispatch),'fair result did not reach existing batted-ball functions');sum.c1.dispatch[after.fairDispatch]++;}else assert.equal(after.fairDispatch,null);const error=Math.hypot(pitch.x-pitch.targetX,pitch.y-pitch.targetY);if(before.ability.control<=40){sum.c1.errorsLow+=error;sum.c1.countLow++;}if(before.ability.control>=70){sum.c1.errorsHigh+=error;sum.c1.countHigh++;}
    if(after.inning===before.inning&&after.half===before.half&&!after.ended&&before.t.bat===before.bat){const expected=vm.runInContext(`nextCount(${before.balls},${before.strikes},'${pitch.outcome}')`,ctx);assert.equal(after.balls,expected.b);assert.equal(after.strikes,expected.s);sum.c1.transitions++;}
   }
   const endedPA=before.t.bat-before.bat;assert.ok(endedPA===0||endedPA===1);
   if(endedPA){
    if(pending.length){const last=pending[pending.length-1];
     assert.ok(['fair','ball','called','whiff'].includes(last),'completed pitch must be fair, fourth ball or third strike');
     if(last==='ball')assert.equal(before.p.bb-before.stats.bb,1,'ball-ended plate appearance must be a walk');
     if(last==='called'||last==='whiff')assert.equal(before.p.k-before.stats.k,1,'strike-ended plate appearance must be a strikeout');
    }
    sum.pa++;if(pending.length)sum.pitchedPA++;else sum.zeroPitchPA++;
    sum.distribution[pending.length]=(sum.distribution[pending.length]||0)+1;
    sum.max=Math.max(sum.max,pending.length);sum.completedPitches+=pending.length;
    pending.forEach(k=>{sum.pitchResults[k]++;if(k==='foul')sum.fouls++});
    if(pending[0])sum.first[pending[0]]++;if(pending[1])sum.second[pending[1]]++;
    for(const k of Object.keys(sum.outcomes))sum.outcomes[k]+=(before.p[k]||0)-before.stats[k];
    if(pending.length){
     for(const [name,field,cmp] of [['contactLow','contact',false],['contactHigh','contact',true],['eyeLow','eye',false],['eyeHigh','eye',true],['controlLow','control',false],['controlHigh','control',true]]){
      if(cmp?ability[field]>=70:ability[field]<=40){
       const group=sum.groups[name];group.pa=(group.pa||0)+1;group.pitches=(group.pitches||0)+pending.length;
       for(const [key,val] of Object.entries({first:pending[0]==='fair',second:pending[1]==='fair',k:before.p.k-before.stats.k,bb:before.p.bb-before.stats.bb,h:before.p.h-before.stats.h,ab:before.p.ab-before.stats.ab,six:pending.length>=6,eight:pending.length>=8,ten:pending.length>=10,foul:pending.filter(x=>x==='foul').length,whiff:pending.filter(x=>x==='whiff').length}))group[key]=(group[key]||0)+Number(val);
      }
     }
    }
    if(twoPitches){sum.twoStrike.completedPA++;sum.twoStrike.pitches+=twoPitches;sum.twoStrike.fouls+=twoFouls;}
    pending=[];twoPitches=0;twoFouls=0;ability=null;
   }else if(after.ended||after.inning!==before.inning||after.half!==before.half){
    if(pending.length){sum.abandonedPA++;sum.abandonedPitches+=pending.length;pending.forEach(k=>sum.abandonedResults[k]++);sum.twoStrike.abandonedPitches+=twoPitches;sum.twoStrike.abandonedFouls+=twoFouls;pending=[];twoPitches=0;twoFouls=0;ability=null;}
   }
  }
  const totals=vm.runInContext(`({pitcherPitches:game.teams.flatMap(t=>t.players).reduce((a,p)=>a+p.pitches,0),pa:game.teams.reduce((s,t)=>s+t.bat,0),pitches:game.totalPitches,runs:game.teams.reduce((s,t)=>s+t.runs.reduce((a,b)=>a+(b||0),0),0),teamRuns:game.teams.map(t=>[t.runs.reduce((a,b)=>a+(b||0),0),t.players.reduce((a,p)=>a+p.r,0)]),stats:game.teams.flatMap(t=>t.players).reduce((a,p)=>{for(const k of Object.keys(a))a[k]+=p[k]||0;return a},{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0})})`,ctx);
  assert.equal(totals.pitcherPitches,totals.pitches,'pitcher totals equal game total');
  for(const [score,playerRuns] of totals.teamRuns)assert.equal(score,playerRuns,'team score must match player runs');
  sum.enginePA+=totals.pa;sum.enginePitches+=totals.pitches;sum.games++;sum.runs+=totals.runs;
  for(const k of Object.keys(sum.engineOutcomes))sum.engineOutcomes[k]+=totals.stats[k];
 }
 const total=o=>Object.values(o).reduce((a,b)=>a+b,0);
 if(variant==='C1')assert.equal(sum.c1.zone+sum.c1.outside+sum.c1.far,sum.allPitches);assert.equal(sum.pa,sum.enginePA);assert.equal(sum.allPitches,sum.enginePitches);assert.equal(sum.pa,sum.pitchedPA+sum.zeroPitchPA);
 assert.equal(sum.allPitches,sum.completedPitches+sum.abandonedPitches);assert.equal(total(sum.pitchResults),sum.completedPitches);assert.equal(total(sum.abandonedResults),sum.abandonedPitches);assert.equal(total(sum.first),sum.pitchedPA);assert.equal(total(sum.distribution),sum.pa);
 assert.equal(Object.entries(sum.distribution).reduce((s,[n,c])=>s+Number(n)*c,0),sum.completedPitches);
 assert.equal(total(sum.second),sum.pitchedPA-(sum.distribution[1]||0));
 assert.ok(sum.outcomes.ab<=sum.pa&&sum.outcomes.h<=sum.outcomes.ab&&sum.outcomes.hr<=sum.outcomes.h);
 assert.deepStrictEqual(sum.outcomes,sum.engineOutcomes,'per-PA totals must equal player records');
 assert.equal(sum.pitchResults.fair+sum.outcomes.k+sum.outcomes.bb+sum.zeroPitchPA,sum.pa,'fair, walks, strikeouts and no-pitch tactics account for completed PAs');
 for(const group of Object.values(sum.groups))if(group.pa){assert.ok(group.pa<=sum.pitchedPA);assert.ok(group.first+group.second<=group.pa);assert.ok(group.h<=group.ab&&group.ab<=group.pa);}
 return sum;
}
const seeds=[0x5c9d4a71,0x20310523,0x19390417],games=Number(process.env.STUDY_GAMES||100);assert.ok(Number.isInteger(games)&&games>0&&games<=500);
for(const variant of ['A','C1'])for(const seed of seeds){const result=study(seed,games,variant,'standard');assert.deepStrictEqual(result,study(seed,games,variant,'standard'),'reproducibility');console.log(JSON.stringify({variant,...result}));}
console.log('C1 ENGINE INTEGRATION AND ACCOUNTING PASS');
