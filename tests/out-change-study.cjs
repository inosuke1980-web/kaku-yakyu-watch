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
const trial=scenario('?debug=plays');
const c=trial.c;vm.runInContext(`
 stop();playing=false;game.outs=2;game.balls=0;game.strikes=0;game.bases=[current().bat.players[6],null,null];
 tactics=()=>false;maybeChangePitcher=()=>{};
 let calls=0;Math.random=()=>[0,0,.999][calls++]??0;
 let realAnimate=animateStealPlay;let seen=0;animateStealPlay=v=>{seen++;return realAnimate(v)};
 const before=game.half;resolvePitchCore();
 globalThis.stealTest={before,after:game.half,outs:game.outs,visual:game.stealVisual,animations:seen};`,c);
assert.equal(c.stealTest.visual.safe,false);assert.notEqual(c.stealTest.before,c.stealTest.after);assert.equal(c.stealTest.animations,0);
console.log('THIRD OUT STEAL NORMAL RESOLUTION: visual record created; animation not invoked after endHalf',JSON.stringify(c.stealTest));
const fly=scenario('?debug=plays');
vm.runInContext(`
 stop();playing=false;game.outs=2;game.balls=0;game.strikes=0;game.bases=[null,null,null];
 tactics=()=>false;maybeChangePitcher=()=>{};
 const hitter=batter(),fixedPitcher=pitcher(),skill=(fixedPitcher.control+fixedPitcher.stuff)/2;
 const hc=clamp(.105+(hitter.contact-skill)*.0013,.055,.23);let roll=0;Math.random=()=>[.9,hc+.12][roll++]??.5;
 outfieldContact=()=>({defender:'RF',fielder:{name:'fixed',arm:55},label:'右翼',point:[245,-25],caught:true,type:'fly'});
 const startHalf=game.half;resolvePitchCore();
 globalThis.flyTest={startHalf,endHalf:game.half,ball:[$('ball').getAttribute('cx'),$('ball').getAttribute('cy')],timers:playTimers.length};`,fly.c);
assert.notEqual(fly.c.flyTest.startHalf,fly.c.flyTest.endHalf);assert.deepEqual(Array.from(fly.c.flyTest.ball),['200','283']);
console.log('THIRD OUT FLY: internal half changes while ball remains at start',JSON.stringify(fly.c.flyTest));
const geometry=scenario('?debug=plays');
vm.runInContext(`
 game.bases=[null,null,null];game.outs=0;const original=defensiveAlignment;
 const direction={defender:'SS',point:[158,156],strength:'normal'},fielder={field:55,speed:55,arm:55},batterSample={speed:55};
 Math.random=()=>.5;
 const base=groundRangePlan(direction,fielder);const timeA=groundPlayTimes(batterSample,direction,fielder);
 defensiveAlignment=()=>({positions:{...original().positions,SS:[base.origin[0]+30,base.origin[1]]}});
 const shifted=groundRangePlan(direction,fielder);const timeB=groundPlayTimes(batterSample,direction,fielder);
 globalThis.geometryTest={base,shifted,timeA,timeB};`,geometry.c);
assert.notEqual(geometry.c.geometryTest.base.distance,geometry.c.geometryTest.shifted.distance);
assert.notEqual(geometry.c.geometryTest.timeA.pickup,geometry.c.geometryTest.timeB.pickup);
console.log('POSITION DEPENDENCY: moving SS origin changes calculated range distance and pickup clock',JSON.stringify(geometry.c.geometryTest));
