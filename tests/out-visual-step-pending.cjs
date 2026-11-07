'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8'),src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function scenario(query){
 const nodes=new Map(),frames=[],timers=new Map();let time=0,id=0,saved=0;
 function element(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},hidden:true,value:'random',disabled:false,textContent:'',replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
 const document={getElementById(k){if(!nodes.has(k))nodes.set(k,element());return nodes.get(k)},createElement:element,createElementNS:element,querySelector:element,querySelectorAll:()=>[]};
 const c={document,location:{search:query},URLSearchParams,Math:Object.create(Math),Date,console,performance:{now:()=>time},localStorage:{getItem:()=>null,setItem:()=>saved++,removeItem:()=>{}},setTimeout:(f,ms)=>{timers.set(++id,{f,at:time+ms});return id},clearTimeout:n=>timers.delete(n),requestAnimationFrame:f=>frames.push(f),confirm:()=>true};
 vm.createContext(c);vm.runInContext(src,c);
 function advance(ms){const end=time+ms;while(time<end){time=Math.min(end,time+10);for(const [key,v] of [...timers])if(v.at<=time){timers.delete(key);v.f()}const callbacks=frames.splice(0);callbacks.forEach(f=>f(time));}}
 return {c,nodes,advance,get saved(){return saved},timers};
}
const t=scenario('?debug=plays');vm.runInContext(`stop();playing=true;game.outs=2;game.strikes=0;game.balls=0;game.bases=[null,null,null];tactics=()=>false;maybeChangePitcher=()=>{};const pp=pitcher(),bb=batter(),hc=clamp(.105+(bb.contact-(pp.control+pp.stuff)/2)*.0013,.055,.23);let n=0;Math.random=()=>[.9,hc+.12][n++]??.5;outfieldContact=()=>({defender:'RF',fielder:{name:'fixed',arm:55},label:'右翼',point:[245,-25],caught:true,type:'fly'});resolvePitchCore();`,t.c);
t.advance(500);t.nodes.get('pause').onclick();
const atPause=[t.nodes.get('ball').getAttribute('cx'),t.nodes.get('ball').getAttribute('cy')];
const pitches=vm.runInContext('game.totalPitches',t.c);
t.nodes.get('next').onclick();t.nodes.get('next').onclick();
assert.equal(vm.runInContext('!!pendingCaughtFly',t.c),true,'one-pitch step must preserve the unfinished fly');
assert.equal(vm.runInContext('game.totalPitches',t.c),pitches,'no new pitch while fly is pending');
t.advance(300);assert.equal(t.nodes.get('outCall').hidden,true,'no call before catch');
assert.notDeepEqual([t.nodes.get('ball').getAttribute('cx'),t.nodes.get('ball').getAttribute('cy')],atPause,'flight resumes');
t.advance(500);assert.equal(t.nodes.get('outCall').textContent,'チェンジ');assert.equal(t.nodes.get('outCall').hidden,false);
assert.equal(vm.runInContext('game.totalPitches',t.c),pitches,'no new pitch during catch');
console.log('PENDING FLY STEP PASS');
const u=scenario('?debug=plays');vm.runInContext(`stop();playing=true;game.outs=2;game.strikes=0;game.balls=0;game.bases=[null,null,null];tactics=()=>false;maybeChangePitcher=()=>{};const pp=pitcher(),bb=batter(),hc=clamp(.105+(bb.contact-(pp.control+pp.stuff)/2)*.0013,.055,.23);let n=0;Math.random=()=>[.9,hc+.12][n++]??.5;outfieldContact=()=>({defender:'RF',fielder:{name:'fixed',arm:55},label:'右翼',point:[245,-25],caught:true,type:'fly'});resolvePitchCore();`,u.c);
u.advance(500);u.nodes.get('pause').onclick();const count=vm.runInContext('n',u.c);u.nodes.get('next').onclick();u.advance(100);u.nodes.get('pause').onclick();const frozen=[u.nodes.get('ball').getAttribute('cx'),u.nodes.get('ball').getAttribute('cy')];u.advance(1000);assert.deepEqual([u.nodes.get('ball').getAttribute('cx'),u.nodes.get('ball').getAttribute('cy')],frozen,'manual step pauses flight');assert.equal(u.nodes.get('outCall').hidden,true);u.nodes.get('pause').onclick();u.advance(700);assert.equal(u.nodes.get('outCall').textContent,'チェンジ');assert.equal(vm.runInContext('n',u.c),count,'manual step does not draw RNG');
console.log('PENDING FLY STEP PAUSE/RESUME PASS');
