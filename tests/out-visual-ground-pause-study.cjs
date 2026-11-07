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

const t=scenario('?debug=plays');vm.runInContext(`stop();playing=true;game.bases=[null,null,null];game.balls=1;game.strikes=0;game.outs=1;game.bases=[current().bat.players[1],null,null];game.bases[0].speed=5;batter().speed=5;for(const f of current().def.players){f.field=99;f.speed=99;f.arm=99}let seq=[.99,.99,.35,.3,.99,.5,.5,.99,.99,.01,.99],i=0;Math.random=()=>seq[i++]??.99;resolvePitch()`,t.c);
t.advance(200);t.nodes.get('pause').onclick();t.advance(1000);t.nodes.get('pause').onclick();t.advance(2500);assert.equal(t.nodes.get('outCall').textContent,'アウト','known failure: ground out visual is lost after pause');
