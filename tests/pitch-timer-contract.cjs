'use strict';
// Research-only adapter: extracts the actual pitch()/startPitchMotion() text,
// runs it with fake timers and the previous mock C1 controller; no game edits.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const begin=html.indexOf('function pitch(){'),end=html.indexOf('\nconst GROUND_DIRECTIONS=',begin);
assert.ok(begin>=0&&end>begin);const timerSource=html.slice(begin,end);
const contract=fs.readFileSync(path.join(__dirname,'pitch-contract-isolated.cjs'),'utf8');
const cut=contract.indexOf('function test() {');assert.ok(cut>0);
class Clock {
 constructor(){this.now=0;this.next=1;this.q=new Map();this.all=new Map()}
 set(fn,delay){const n=this.next++,item={fn,at:this.now+delay};this.q.set(n,item);this.all.set(n,item);return n}
 clear(n){this.q.delete(n)}
 step(){assert.ok(this.q.size);const [id,e]=[...this.q].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];this.q.delete(id);this.now=e.at;e.fn();return id}
 stale(id){this.all.get(id).fn()}
}
function setup(seed=19){
 const clock=new Clock(),m=Object.create(Math);let ordinaryDraws=0,forced=[];const rr=(()=>{let s=seed|0;return ()=>{s=(s+0x6d2b79f5)|0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}})();
 m.random=()=>{ordinaryDraws++;return forced.length?forced.shift():rr()};
 const scope={require,__dirname,console,Math:m,setTimeout:(f,d)=>clock.set(f,d),clearTimeout:n=>clock.clear(n)};vm.createContext(scope);
 vm.runInContext(contract.slice(0,cut)+'\nthis.makeFixture=fixture;',scope);
 const f=scope.makeFixture(seed);scope.f=f;scope.clock=clock;scope.events=[];scope.getDraws=()=>ordinaryDraws;
 vm.runInContext(`let game=f.g, flightTimer=null, animationToken=0, playing=false;
 game.ended=false;game.bases=[null,null,null];
 const PITCH_TYPES=[{name:'straight',speed:140,flight:320}],PITCH_WINDUP_MS=540;
 const $=()=>({textContent:''});const choose=a=>a[0],rnd=()=>0;
 let move=100,lead=0, pickoffDuration=300, tacticsCalls=0,tacticResult=false,drawn=null,applied=null;
 function applyDefensiveAlignment(){events.push('alignment');return move}
 function leadRunnerVisual(){events.push('lead');return lead}
 function animatePickoffReturn(){events.push('pickoff');return pickoffDuration}
 function showPitchResult(){ }
 function schedule(){events.push('schedule')}
 function drawPitch(type){animationToken++;const r=f.c.prepare(type.name,ability);drawn=f.c.draw();events.push('draw');return r}
 function resolvePitch(){applied=f.c.record;events.push('resolve');return f.c.commit()}
 ${timerSource}
 const originalStart=startPitchMotion;
 startPitchMotion=function(){tacticsCalls++;events.push('tactics');if(tacticResult){events.push('tactic-complete');return}return originalStart()};
 this.api={pitch:()=>pitch(),state:()=>({flightTimer,animationToken,drawn,applied,tacticsCalls,game:{...game,bases:game.bases.map(Boolean)}}),
 setBases:()=>{game.bases[0]={id:'runner'}},setMove:n=>move=n,setLead:n=>lead=n,setTactic:b=>tacticResult=b,
 cancel:()=>{clearTimeout(flightTimer);flightTimer=null;animationToken++;f.c.cancel()},
 pause:()=>{clearTimeout(flightTimer);flightTimer=null;animationToken++;f.c.pause()},
 resume:()=>{const old=f.c.draw(),token=++animationToken;drawn=old;events.push('resume');flightTimer=setTimeout(()=>{flightTimer=null;if(token!==animationToken)return;resolvePitch()},970)},
 switchPitcher:()=>{game.pitcherId='P2'},switchBatter:()=>{game.batterId='B2'},duplicate:()=>resolvePitch()};`,scope);
 return {clock,f,api:scope.api,events:scope.events,force:(...v)=>forced.push(...v),draws:scope.getDraws};
}
function run(){
 let s=setup();s.api.pitch();assert.equal(s.f.c.state,'empty');assert.deepEqual(s.events,['alignment']);s.clock.step();let a=s.api.state();assert.equal(s.f.c.state,'drawing');assert.deepEqual(s.events,['alignment','tactics','draw']);const data=a.drawn, c1draws=s.f.rng.draws;assert.equal(s.clock.now,190);s.clock.step();a=s.api.state();assert.strictEqual(a.applied,data);assert.equal(s.f.g.pitches,1);assert.equal(s.f.rng.draws,c1draws);assert.equal(s.clock.now,1160);
 // A, F and G: duplicate callback rejected by controller; next pitch gets new ID.
 const before=JSON.stringify(s.f.g);s.api.duplicate();assert.equal(JSON.stringify(s.f.g),before);s.api.pitch();s.clock.step();assert.notEqual(s.api.state().drawn.id,data.id);s.clock.step();assert.equal(s.f.g.pitches,2);
 // B: real pitch() branch uses its pickoff timer; no one-pitch data generated.
 s=setup();s.api.setBases();s.force(0);s.api.pitch();assert.equal(s.f.c.state,'empty');assert.equal(s.f.rng.draws,0);assert.deepEqual(s.events,['alignment','pickoff']);s.clock.step();assert.equal(s.f.g.pitches,0);s.force(.5,.9);s.api.pitch();s.clock.step();assert.equal(s.f.c.state,'drawing');
 // C: cancelled animation timer, including a deliberately late callback.
 s=setup();s.api.pitch();s.clock.step();let id=s.api.state().flightTimer, d=s.f.rng.draws;s.api.cancel();s.clock.stale(id);assert.equal(s.f.g.pitches,0);assert.equal(s.f.rng.draws,d);assert.equal(s.f.c.state,'cancelled');
 // D: resume uses mock timer, same data; old callback is rejected by token.
 s=setup();s.api.pitch();s.clock.step();id=s.api.state().flightTimer;const saved=s.api.state().drawn;d=s.f.rng.draws;s.api.pause();s.api.resume();s.clock.stale(id);assert.equal(s.f.g.pitches,0);assert.equal(s.api.state().flightTimer,null,'old callback clears the new timer handle before token check');s.clock.step();assert.strictEqual(s.api.state().applied,saved);assert.equal(s.f.g.pitches,1);assert.equal(s.f.rng.draws,d);
 // E: pitcher and batter changes invalidate the old timer's pending record.
 for(const change of ['switchPitcher','switchBatter']){s=setup();s.api.pitch();s.clock.step();d=s.f.rng.draws;s.api[change]();s.clock.step();assert.equal(s.f.g.pitches,0);assert.equal(s.f.c.state,'invalid');assert.equal(s.f.rng.draws,d)}
 // Actual pitch() waits for the longer lead/alignment delay before starting.
 s=setup();s.api.setBases();s.api.setMove(100);s.api.setLead(300);s.force(.5,.1);s.api.pitch();assert.deepEqual(s.events,['alignment','lead']);assert.equal(s.f.c.state,'empty');s.clock.step();assert.equal(s.clock.now,390);assert.equal(s.f.c.state,'drawing');
 // Tactic outcome is mocked, but adapter invokes it only once and does not create a pitch.
 s=setup();s.api.setTactic(true);s.api.pitch();s.clock.step();assert.equal(s.f.c.state,'empty');assert.equal(s.f.g.pitches,0);assert.equal(s.api.state().tacticsCalls,1);
 const repeat=()=>{const t=setup(77);t.api.pitch();t.clock.step();const record=JSON.stringify(t.api.state().drawn);t.clock.step();return [record,t.f.rng.draws,JSON.stringify(t.f.g)]};assert.deepEqual(repeat(),repeat());
 // Fault injection into a minimal nontransactional mock illustrates hazards,
 // not proof of production behavior or rollback.
 for(const stage of ['before','count','stats']){const state={balls:0,pitches:0,done:false};try{if(stage==='before')throw Error(stage);state.balls++;if(stage==='count')throw Error(stage);state.pitches++;if(stage==='stats')throw Error(stage);state.done=true}catch(e){assert.equal(e.message,stage)}assert.equal(state.done,false);assert.equal(state.balls,stage==='before'?0:1);assert.equal(state.pitches,stage==='stats'?1:0)}
 console.log('PASS A-G: existing pitch timing branches + isolated mock adapter; seeded replay; fault injection');
}
run();
