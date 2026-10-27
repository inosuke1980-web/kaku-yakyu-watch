'use strict';
// Research-only isolated VM experiment. Variants modify an in-memory copy of
// the pitch thresholds, never the production file or the RNG algorithm.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);
function study(seed,games,variant){
 const exact=(s,needle,replacement)=>{assert.equal(s.split(needle).length,2,`threshold changed: ${needle}`);return s.replace(needle,replacement)};
 let experimentalSource=source;
 if(variant!=='A'){
  const params={B:`({ball:experimentPitchNo<=2?.03:0,called:experimentPitchNo<=2?.05:0,foul:experimentPitchNo<=2?.05:0,miss:experimentPitchNo<=2?.05:0})`,
   C:`({ball:0,called:0,foul:.05,miss:.05})`,
   D:`(()=>{const shift=game.strikes===2?.06:experimentPitchNo<=2?.03:0;const balls=game.balls===3?.02:0;return {ball:balls,called:balls,foul:balls+shift,miss:balls+shift}})()`}[variant];
  assert.ok(params,'unknown variant');
  experimentalSource=exact(experimentalSource,'const pskill=(pi.control+pi.stuff)/2,x=Math.random();let complete=false;',`const pskill=(pi.control+pi.stuff)/2,x=Math.random(),exp=${params};let complete=false;`);
  experimentalSource=exact(experimentalSource,"clamp(.29+(pi.control-p.eye)*.0015,.17,.42)","clamp(.29+(pi.control-p.eye)*.0015,.17,.42)+exp.ball");
  experimentalSource=exact(experimentalSource,'else if(x<.54)','else if(x<.54+exp.called)');
  experimentalSource=exact(experimentalSource,'else if(x<.70)','else if(x<.70+exp.foul)');
  experimentalSource=exact(experimentalSource,'else if(x<.755)','else if(x<.755+exp.miss)');
 }

 function node(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},value:'random',disabled:false,textContent:'',replaceChildren(){},append(){},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},showModal(){},close(){},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
 const dom=new Map(),document={getElementById(id){if(!dom.has(id))dom.set(id,node());return dom.get(id)},createElement:node,createElementNS:node,querySelector:node,querySelectorAll:()=>[]};
 document.getElementById('category').value='high';document.getElementById('parkType').value='grass';document.getElementById('parkShape').value='standard';document.getElementById('matchType').value='official';document.getElementById('dayNight').value='day';
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
 foulBall=function(p){observed='foul';return foul0(p)};`,ctx);
 const sum={seed,games:0,pa:0,pitchedPA:0,zeroPitchPA:0,allPitches:0,completedPitches:0,abandonedPitches:0,abandonedPA:0,distribution:{},first:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},second:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},pitchResults:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},outcomes:{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0},abandonedResults:{ball:0,called:0,whiff:0,foul:0,fair:0,other:0},fouls:0,max:0,enginePA:0,enginePitches:0,runs:0,engineOutcomes:{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0}};
 for(let g=0;g<games;g++){
  vm.runInContext('init()',ctx);let pending=[],steps=0;
  while(vm.runInContext('!game.ended',ctx)){
   assert.ok(++steps<10000,'game did not finish');
   const before=vm.runInContext(`(()=>{let p=batter(),t=current().bat;return {p,t,bat:t.bat,inning:game.inning,half:game.half,pitches:game.totalPitches,stats:{ab:p.ab,h:p.h,hr:p.hr,bb:p.bb,k:p.k,sh:p.sh||0,sf:p.sf||0}}})()`,ctx);
   ctx.experimentPitchNo=pending.length+1;vm.runInContext('observed=null;resolvePitch()',ctx);
   const after=vm.runInContext('({observed,pitches:game.totalPitches,inning:game.inning,half:game.half,ended:game.ended})',ctx);
   const delta=after.pitches-before.pitches;assert.ok(delta===0||delta===1);
   if(delta){let kind=after.observed==='swing'?'whiff':after.observed;assert.ok(Object.hasOwn(sum.pitchResults,kind),`unknown pitch: ${kind}`);pending.push(kind);sum.allPitches++;}
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
    pending=[];
   }else if(after.ended||after.inning!==before.inning||after.half!==before.half){
    if(pending.length){sum.abandonedPA++;sum.abandonedPitches+=pending.length;pending.forEach(k=>sum.abandonedResults[k]++);pending=[];}
   }
  }
  const totals=vm.runInContext(`({pa:game.teams.reduce((s,t)=>s+t.bat,0),pitches:game.totalPitches,runs:game.teams.reduce((s,t)=>s+t.runs.reduce((a,b)=>a+(b||0),0),0),stats:game.teams.flatMap(t=>t.players).reduce((a,p)=>{for(const k of Object.keys(a))a[k]+=p[k]||0;return a},{k:0,bb:0,h:0,hr:0,ab:0,sh:0,sf:0})})`,ctx);
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
 return sum;
}
const seeds=[0x5c9d4a71,0x20310523,0x19390417],games=Number(process.env.STUDY_GAMES||100);
assert.ok(Number.isInteger(games)&&games>0&&games<=500);
const runs=[];
for(const variant of ['A','B','C','D'])for(const seed of seeds){const result=study(seed,games,variant);runs.push({variant,...result});console.log(JSON.stringify({variant,...result}));}
const again=study(seeds[0],games,'A');assert.deepStrictEqual(again,(({variant,...rest})=>rest)(runs[0]),'same seed and conditions reproduce the baseline');
const againD=study(seeds[0],games,'D');assert.deepStrictEqual(againD,(({variant,...rest})=>rest)(runs[9]),'same seed and conditions reproduce the variant');
console.log('REPRODUCIBILITY AND ACCOUNTING PASS');
