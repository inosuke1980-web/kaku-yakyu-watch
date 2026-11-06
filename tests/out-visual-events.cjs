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
for(const outs of [0,2]){
 const t=scenario('?debug=plays');vm.runInContext(`stop();playing=true;game.outs=${outs};game.strikes=2;game.balls=0;game.bases=[null,null,null];tactics=()=>false;maybeChangePitcher=()=>{};Math.random=()=>.4;resolvePitchCore();`,t.c);
 assert.equal(t.nodes.get('outCall').textContent,outs===2?'チェンジ':'アウト');assert.equal(t.nodes.get('outCall').hidden,false);t.advance(1250);assert.equal(t.nodes.get('outCall').hidden,true);
}
for(const outs of [0,2]){
 const t=scenario('?debug=plays');vm.runInContext(`stop();playing=true;game.outs=${outs};game.strikes=0;game.balls=0;game.bases=[null,null,null];tactics=()=>false;maybeChangePitcher=()=>{};const pp=pitcher(),bb=batter(),hc=clamp(.105+(bb.contact-(pp.control+pp.stuff)/2)*.0013,.055,.23);let n=0;Math.random=()=>[.9,hc+.12][n++]??.5;outfieldContact=()=>({defender:'RF',fielder:{name:'fixed',arm:55},label:'右翼',point:[245,-25],caught:true,type:'fly'});resolvePitchCore();`,t.c);
 assert.equal(t.nodes.get('outCall').hidden,true);t.advance(1200);assert.equal(t.nodes.get('outCall').hidden,true,'not before flight completion + 60ms');t.advance(20);assert.equal(t.nodes.get('outCall').textContent,outs===2?'チェンジ':'アウト');
}
console.log('OUT VISUAL: real resolution strikeouts and fly timing PASS');
