'use strict';
// Isolated sensitivity prototype: no production game or saved state is changed.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
for(const x of ["clamp(.29+(pi.control-p.eye)*.0015,.17,.42)",'else if(x<.54)','else if(x<.70)','else if(x<.755)'])assert.ok(source.includes(x),'baseline changed: '+x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function rng(seed){let state=seed|0;return ()=>{state=(state+0x6d2b79f5)|0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
// Abstract normalized coordinates: |x|<=1 and |y|<=1 is a strike.
// No claim that these coordinates are the game's existing SVG strike zone.
function zoneAt(x,y){const r=Math.max(Math.abs(x),Math.abs(y));return r<=1?'zone':r<=1.7?'outside':'far'}
function nextCount(b,s,outcome){if(outcome==='fair')return {b,s,end:'fair'};if(outcome==='ball')return b===3?{b:4,s,end:'walk'}:{b:b+1,s,end:null};if(outcome==='called'||outcome==='whiff')return s===2?{b,s:3,end:'strikeout'}:{b,s:s+1,end:null};if(outcome==='foul')return {b,s:Math.min(2,s+1),end:null};throw Error('unknown result')}
function pitchC(rand,eye,control,contact,stuff,b,s){
 // Fixed intentional target choice. Better control shrinks both-axis dispersion;
 // the choice to aim outside is retained for every level.
 const targetStrike=rand()<clamp(.60+(b===3?.04:0),0,1),sign=rand()<.5?-1:1;
 const targetX=targetStrike?(rand()-.5)*1.7:sign*1.60,targetY=(rand()-.5)*.65;
 const spread=.64-control*.0032;
 const x=targetX+(rand()+rand()-1)*spread,y=targetY+(rand()+rand()-1)*spread;
 const zone=zoneAt(x,y),swingProb=zone==='zone'?clamp(.65+(s===2?.04:0),0,1):zone==='outside'?clamp(.33-(eye-50)*.003,0,1):clamp(.11-(eye-50)*.0015,0,1);
 const swing=rand()<swingProb;let outcome;
 if(!swing)outcome=zone==='zone'?'called':'ball';
 else{
  const whiff=clamp((zone==='zone'?.12:zone==='outside'?.23:.38)+(stuff-contact)*.001,.04,.55);
  const foul=zone==='zone'?.33:zone==='outside'?.37:.38;
  const z=rand();outcome=z<whiff?'whiff':z<whiff+foul?'foul':'fair';
 }
 return {targetStrike,targetX,targetY,x,y,zone,swing,swingProb,outcome,spread};
}
function pitchLegacy(rand,eye,control,model){const diff=model==='A'?control-eye:eye-control,cut=clamp(.29+diff*.0015,.17,.42),x=rand();return {zone:null,swing:null,outcome:x<cut?'ball':x<.54?'called':x<.70?'foul':x<.755?'whiff':'fair'}}
function simulate(model,eye,control,seed,n){const random=rng(seed),m={model,eye,control,pa:0,pitches:0,zones:{zone:0,outside:0,far:0},swings:{zone:0,outside:0,far:0},outcomes:{ball:0,called:0,whiff:0,foul:0,fair:0},walk:0,strikeout:0,early:0,six:0,max:0};
 for(let i=0;i<n;i++){let b=0,s=0,num=0,ending=null;while(!ending){assert.ok(num<1000,'unending PA');const p=model==='C'?pitchC(random,eye,control,50,50,b,s):pitchLegacy(random,eye,control,model);num++;m.pitches++;m.outcomes[p.outcome]++;
  if(model==='C'){assert.equal(zoneAt(p.x,p.y),p.zone);assert.ok(p.outcome!=='called'||(!p.swing&&p.zone==='zone'));assert.ok(p.outcome!=='ball'||(!p.swing&&p.zone!=='zone'));assert.ok(!['foul','whiff','fair'].includes(p.outcome)||p.swing);m.zones[p.zone]++;if(p.swing)m.swings[p.zone]++;}
  const next=nextCount(b,s,p.outcome);if(s===2&&p.outcome==='foul')assert.equal(next.s,2);b=next.b;s=next.s;ending=next.end;
 }
 m.pa++;if(ending==='walk')m.walk++;if(ending==='strikeout')m.strikeout++;if(ending==='fair'&&num<=2)m.early++;if(num>=6)m.six++;m.max=Math.max(m.max,num);
 }
 assert.equal(Object.values(m.outcomes).reduce((a,b)=>a+b,0),m.pitches);assert.equal(m.walk+m.strikeout+m.outcomes.fair,m.pa);
 if(model==='C')assert.equal(Object.values(m.zones).reduce((a,b)=>a+b,0),m.pitches);
 return m;
}
// Controlled decisions test: same target location and random draw for all eyes.
for(const zoneX of [1.2,2])for(const s of [0,2]){const prob=e=>zoneX===1.2?clamp(.33-(e-50)*.003,0,1):clamp(.11-(e-50)*.0015,0,1);assert.ok(prob(20)>prob(50)&&prob(50)>prob(90));}
assert.ok(.64-90*.0032<.64-50*.0032&&.64-50*.0032<.64-20*.0032);
for(let i=1;i<=5000;i++){
 const low=pitchC(rng(i),20,50,50,50,0,0),mid=pitchC(rng(i),50,50,50,50,0,0),high=pitchC(rng(i),90,50,50,50,0,0);
 assert.deepStrictEqual([low.x,low.y,low.zone],[high.x,high.y,high.zone]);
 if(low.zone!=='zone')assert.ok(Number(low.swing)>=Number(mid.swing)&&Number(mid.swing)>=Number(high.swing),'eye cannot increase chase for the same pitch and draw');
 const loose=pitchC(rng(i),50,20,50,50,0,0),precise=pitchC(rng(i),50,90,50,50,0,0);
 assert.equal(loose.targetStrike,precise.targetStrike);assert.equal(loose.targetX,precise.targetX);assert.equal(loose.targetY,precise.targetY);
 assert.ok(Math.hypot(precise.x-precise.targetX,precise.y-precise.targetY)<=Math.hypot(loose.x-loose.targetX,loose.y-loose.targetY)+1e-12);
}
assert.deepEqual(nextCount(3,2,'ball'),{b:4,s:2,end:'walk'});assert.deepEqual(nextCount(2,2,'called'),{b:2,s:3,end:'strikeout'});assert.deepEqual(nextCount(2,2,'whiff'),{b:2,s:3,end:'strikeout'});assert.deepEqual(nextCount(2,2,'foul'),{b:2,s:2,end:null});
const seeds=[0x5c9d4a71,0x20310523,0x19390417],n=Number(process.env.STUDY_PA||20000);assert.ok(Number.isInteger(n)&&n>1000&&n<=100000);
const results=[];for(const model of ['A','B','C'])for(const eye of [20,50,90])for(const control of [20,50,90])for(const seed of seeds){const result=simulate(model,eye,control,seed,n);if(seed===seeds[0])assert.deepStrictEqual(result,simulate(model,eye,control,seed,n));results.push(result);console.log(JSON.stringify(result));}
if(n>=10000){
 const group=(eye,control)=>results.filter(x=>x.model==='C'&&x.eye===eye&&x.control===control);
 const rate=(group,key,denominator)=>group.reduce((s,x)=>s+key(x),0)/group.reduce((s,x)=>s+denominator(x),0);
 for(const control of [20,50,90]){const chase=e=>rate(group(e,control),x=>x.swings.outside+x.swings.far,x=>x.zones.outside+x.zones.far);assert.ok(chase(20)>chase(50)&&chase(50)>chase(90));}
 for(const eye of [20,50,90]){const zone=c=>rate(group(eye,c),x=>x.zones.zone,x=>x.pitches);assert.ok(zone(20)<zone(50)&&zone(50)<zone(90));}
}
console.log('FIXED SEED, PROBABILITY, COORDINATE AND COUNT TESTS PASS');
