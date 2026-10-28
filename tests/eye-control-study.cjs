'use strict';
// Research-only isolated VM experiment. Variants modify an in-memory copy of
// the pitch thresholds, never the production file or the RNG algorithm.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);
// Fixed-ability model is an independent replica; fail loudly if the source
// probabilities or count transitions it represents change in the future.
for(const pattern of [/clamp\(\.29\+\(pi\.control-p\.eye\)\*\.0015,\.17,\.42\)/,/else if\(x<\.54\)/,/else if\(x<\.70\)/,/else if\(x<\.755\)/,/if\(game\.strikes<2\)game\.strikes\+\+/,/game\.balls>=4/,/game\.strikes>=3/])assert.match(source,pattern);
function study(seed,games,variant,shape){
 const exact=(s,needle,replacement)=>{assert.equal(s.split(needle).length,2,`threshold changed: ${needle}`);return s.replace(needle,replacement)};
 let experimentalSource=source;
 if(variant!=='A'){
  assert.ok(['B','C'].includes(variant));
  const needle='clamp(.29+(pi.control-p.eye)*.0015,.17,.42)';
  const replacement=variant==='B'?'clamp(.29+(p.eye-pi.control)*.0015,.17,.42)':'clamp(.29,.17,.42)';
  experimentalSource=exact(experimentalSource,needle,replacement);
 }


 function node(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},value:'random',disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
 const dom=new Map(),document={getElementById(id){if(!dom.has(id))dom.set(id,node());return dom.get(id)},createElement:node,createElementNS:node,querySelector:node,querySelectorAll:()=>[]};
 document.getElementById('category').value='high';document.getElementById('parkType').value='grass';document.getElementById('parkShape').value=shape;document.getElementById('matchType').value='official';document.getElementById('dayNight').value='day';
 const randomMath=Object.create(Math);let state=seed|0;
 randomMath.random=()=>{state=(state+0x6d2b79f5)|0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
 class FixedDate extends Date {constructor(...a){super(...(a.length?a:[0]))}static now(){return 0}}
 const ctx={document,Math:randomMath,Date:FixedDate,performance:{now:()=>0},console,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},confirm:()=>true,experimentPitchNo:1};
 vm.createContext(ctx);vm.runInContext(experimentalSource,ctx);
 vm.runInContext(`render=()=>{};renderRoster=()=>{};animate=()=>{};animateGround=()=>{};animateFieldingError=()=>{};animateOutfieldReturn=()=>{};animateBaseRunners=()=>{};animateFlyLeadAndReturn=()=>{};log=()=>{};historyRender=()=>{};saveGame=()=>{};
 let observed=null;
 const take0=animateBatterTake,swing0=animateBatterSwing,foul0=foulBall;
 animateBatterTake=function(p,c){observed=c==='ball'?'ball':'called';return take0(p,c)};
 animateBatterSwing=function(p,inPlay){observed=inPlay?'fair':'swing';return swing0(p,inPlay)};
 foulBall=function(p){observed='foul';const prior=game.strikes;const r=foul0(p);if(prior===2&&game.strikes!==2)throw Error('two-strike foul changed count');return r};`,ctx);
 const sum={seed,games:0,pa:0,pitchedPA:0,zeroPitchPA:0,allPitches:0,completedPitches:0,abandonedPitches:0,abandonedPA:0,distribution:{},first:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},second:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},pitchResults:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},outcomes:{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0},abandonedResults:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},fouls:0,max:0,enginePA:0,enginePitches:0,runs:0,groups:{contactLow:{},contactHigh:{},eyeLow:{},eyeHigh:{},controlLow:{},controlHigh:{}},twoStrike:{completedPA:0,pitches:0,fouls:0,abandonedPitches:0,abandonedFouls:0},engineOutcomes:{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0}};
 for(let g=0;g<games;g++){
  vm.runInContext('init()',ctx);let pending=[],steps=0,twoPitches=0,twoFouls=0,ability=null;
  while(vm.runInContext('!game.ended',ctx)){
   assert.ok(++steps<10000,'game did not finish');
   const before=vm.runInContext(`(()=>{let p=batter(),t=current().bat;return {p,t,bat:t.bat,inning:game.inning,half:game.half,pitches:game.totalPitches,strikes:game.strikes,ability:{contact:p.contact,eye:p.eye,control:pitcher().control},stats:{ab:p.ab,h:p.h,hr:p.hr,bb:p.bb,k:p.k,sh:p.sh||0,sf:p.sf||0}}})()`,ctx);
   ctx.experimentPitchNo=pending.length+1;vm.runInContext('observed=null;resolvePitch()',ctx);
   const after=vm.runInContext('({observed,pitches:game.totalPitches,inning:game.inning,half:game.half,ended:game.ended})',ctx);
   const delta=after.pitches-before.pitches;assert.ok(delta===0||delta===1);
   if(delta){let kind=after.observed==='swing'?'whiff':after.observed;assert.ok(Object.hasOwn(sum.pitchResults,kind),`unknown pitch: ${kind}`);if(!pending.length)ability=before.ability;pending.push(kind);sum.allPitches++;if(before.strikes===2){twoPitches++;if(kind==='foul')twoFouls++;}}
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
  const totals=vm.runInContext(`({pa:game.teams.reduce((s,t)=>s+t.bat,0),pitches:game.totalPitches,runs:game.teams.reduce((s,t)=>s+t.runs.reduce((a,b)=>a+(b||0),0),0),teamRuns:game.teams.map(t=>[t.runs.reduce((a,b)=>a+(b||0),0),t.players.reduce((a,p)=>a+p.r,0)]),stats:game.teams.flatMap(t=>t.players).reduce((a,p)=>{for(const k of Object.keys(a))a[k]+=p[k]||0;return a},{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0})})`,ctx);
  for(const [score,playerRuns] of totals.teamRuns)assert.equal(score,playerRuns,'team score must match player runs');
  sum.enginePA+=totals.pa;sum.enginePitches+=totals.pitches;sum.games++;sum.runs+=totals.runs;
  for(const k of Object.keys(sum.engineOutcomes))sum.engineOutcomes[k]+=totals.stats[k];
 }
 const total=o=>Object.values(o).reduce((a,b)=>a+b,0);
 assert.equal(sum.pa,sum.enginePA);assert.equal(sum.allPitches,sum.enginePitches);assert.equal(sum.pa,sum.pitchedPA+sum.zeroPitchPA);
 assert.equal(sum.allPitches,sum.completedPitches+sum.abandonedPitches);assert.equal(total(sum.pitchResults),sum.completedPitches);assert.equal(total(sum.abandonedResults),sum.abandonedPitches);assert.equal(total(sum.first),sum.pitchedPA);assert.equal(total(sum.distribution),sum.pa);
 assert.equal(Object.entries(sum.distribution).reduce((s,[n,c])=>s+Number(n)*c,0),sum.completedPitches);
 assert.equal(total(sum.second),sum.pitchedPA-(sum.distribution[1]||0));
 assert.ok(sum.outcomes.ab<=sum.pa&&sum.outcomes.h<=sum.outcomes.ab&&sum.outcomes.hr<=sum.outcomes.h);
 assert.deepStrictEqual(sum.outcomes,sum.engineOutcomes,'per-PA totals must equal player records');
 assert.equal(sum.pitchResults.fair+sum.outcomes.k+sum.outcomes.bb+sum.zeroPitchPA,sum.pa,'fair, walks, strikeouts and no-pitch tactics account for completed PAs');
 for(const group of Object.values(sum.groups))if(group.pa){assert.ok(group.pa<=sum.pitchedPA);assert.ok(group.first+group.second<=group.pa);assert.ok(group.h<=group.ab&&group.ab<=group.pa);}
 return sum;
}
// Fixed ability experiment: direct replication of the verified result branches,
// with no tactics or fielding; compare sample rates with independent Markov theory.
function fixed(model,eye,control,seed,n){
 let state=seed|0;const rnd=()=>{state=(state+0x6d2b79f5)|0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
 const diff=model==='A'?control-eye:model==='B'?eye-control:0;
 const ball=Math.max(.17,Math.min(.42,.29+diff*.0015)),called=.54-ball,foul=.16,whiff=.055,fair=.245;
 assert.ok([ball,called,foul,whiff,fair].every(x=>x>=0));assert.ok(Math.abs(ball+called+foul+whiff+fair-1)<1e-12);
 let counts=[0,0,0,0,0],k=0,bb=0,pitches=0;
 for(let i=0;i<n;i++){let balls=0,strikes=0,done=false;while(!done){assert.ok(++pitches<100*n);let x=rnd();if(x<ball){counts[0]++;if(++balls===4){bb++;done=true}}else if(x<.54){counts[1]++;if(++strikes===3){k++;done=true}}else if(x<.70){counts[2]++;if(strikes<2)strikes++}else if(x<.755){counts[3]++;if(++strikes===3){k++;done=true}}else{counts[4]++;done=true}}}
 // Solve the exact absorbing chain: foul at two strikes is a self-loop.
 const memo=new Map();function solve(b,s){const key=b+','+s;if(memo.has(key))return memo.get(key);
  const nextBall=b===3?{k:0,bb:1,p:0}:solve(b+1,s);
  const nextStrike=s===2?{k:1,bb:0,p:0}:solve(b,s+1);
  const nextFoul=s===2?{k:0,bb:0,p:0}:nextStrike;
  const div=s===2?1-foul:1;
  const r={k:(ball*nextBall.k+(called+whiff)*nextStrike.k+foul*nextFoul.k)/div,bb:(ball*nextBall.bb+(called+whiff)*nextStrike.bb+foul*nextFoul.bb)/div,p:(1+ball*nextBall.p+(called+whiff)*nextStrike.p+foul*nextFoul.p)/div};memo.set(key,r);return r}
 const theory=solve(0,0);assert.equal(counts.reduce((a,b)=>a+b,0),pitches);
 [ball,called,foul,whiff,fair].forEach((p,i)=>assert.ok(Math.abs(counts[i]/pitches-p)<.006,'pitch frequencies agree with theory'));
 assert.ok(Math.abs(k/n-theory.k)<.012&&Math.abs(bb/n-theory.bb)<.012&&Math.abs(pitches/n-theory.p)<.04,'PA samples agree with Markov theory');
 return {model,eye,control,n,ball,called,foul,whiff,fair,k:k/n,bb:bb/n,avg:pitches/n,pitchRates:counts.map(x=>x/pitches),theory};
}
const n=30000;for(const model of ['A','B','C'])for(const axis of ['eye','control'])for(const value of [20,40,50,70,90]){const eye=axis==='eye'?value:50,control=axis==='control'?value:50;const result=fixed(model,eye,control,0x10372911,n);assert.deepStrictEqual(result,fixed(model,eye,control,0x10372911,n));console.log('FIXED '+JSON.stringify({axis,value,...result}));}
const seeds=[0x5c9d4a71,0x20310523,0x19390417],games=Number(process.env.STUDY_GAMES||100);assert.ok(Number.isInteger(games)&&games>0&&games<=500);
const runs=[];for(const variant of ['A','B','C'])for(const seed of seeds){const result=study(seed,games,variant,'standard');runs.push({variant,...result});console.log('GAME '+JSON.stringify({variant,...result}));}
for(const variant of ['A','B','C']){const result=study(seeds[0],games,variant,'standard');assert.deepStrictEqual(result,(({variant,...rest})=>rest)(runs.find(x=>x.variant===variant&&x.seed===seeds[0])));}
console.log('REPRODUCIBILITY, ACCOUNTING AND THEORY PASS');
