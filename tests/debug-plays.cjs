'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8'),src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function scenario(query){
 const nodes=new Map(),frames=[],timers=new Map();let time=0,id=0,saved=0;
 function element(){return {style:{},attrs:{},children:[],childNodes:[],dataset:{},hidden:true,value:'random',disabled:false,textContent:'',replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||'0'},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},set innerHTML(v){this._html=v},get innerHTML(){return this._html||''}}}
 const document={getElementById(k){if(!nodes.has(k))nodes.set(k,element());return nodes.get(k)},createElement:element,createElementNS:element,querySelector:element,querySelectorAll:()=>[]};
 const c={document,location:{search:query},URLSearchParams,Math,Date,console,performance:{now:()=>time},localStorage:{getItem:()=>null,setItem:()=>saved++,removeItem:()=>{}},setTimeout:(f,ms)=>{timers.set(++id,{f,at:time+ms});return id},clearTimeout:n=>timers.delete(n),requestAnimationFrame:f=>frames.push(f),confirm:()=>true};
 vm.createContext(c);vm.runInContext(src,c);
 function advance(ms){const end=time+ms;while(time<end){time=Math.min(end,time+10);for(const [key,v] of [...timers])if(v.at<=time){timers.delete(key);v.f()}const callbacks=frames.splice(0);callbacks.forEach(f=>f(time));}}
 return {c,nodes,advance,get saved(){return saved},timers};
}
const normal=scenario('');assert.equal(normal.nodes.get('playDebug')?.hidden??true,true);
const debug=scenario('?debug=plays'),n=debug.nodes;assert.equal(n.get('playDebug').hidden,false);
assert.ok(['start','pause','next'].every(id=>n.get(id).disabled));
const before=vm.runInContext('JSON.stringify(game.teams.map(t=>[t.runs,t.hits,t.errors]))',debug.c);
n.get('debugStart').onclick();debug.advance(540);assert.equal(n.get('ball').getAttribute('visibility'),'visible');
n.get('debugRestart').onclick();debug.advance(540);assert.equal(n.get('ball').getAttribute('visibility'),'visible');debug.advance(1200);
assert.equal(debug.saved,0);assert.equal(vm.runInContext('JSON.stringify(game.teams.map(t=>[t.runs,t.hits,t.errors]))',debug.c),before);
assert.equal(debug.timers.size,0);
n.get('debugPlay').value='single';n.get('debugStart').onclick();debug.advance(1000);assert.equal(n.get('battingStance').getAttribute('data-swing'),'yes');debug.advance(400);assert.notEqual(n.get('ball').getAttribute('cx'),'205');
n.get('debugRestart').onclick();debug.advance(200);n.get('debugPlay').value='pitch';n.get('debugStart').onclick();debug.advance(1100);assert.equal(n.get('battingStance').getAttribute('data-swing'),'no');
assert.equal(debug.saved,0);console.log('DEBUG PITCH AND SINGLE REPLAY PASS');
