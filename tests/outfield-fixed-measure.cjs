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

const q=scenario('?debug=plays'), c=q.c,n=q.nodes;
const el=(x,y,pos)=>({style:{},a:{cx:String(x),cy:String(y),'data-position':pos},setAttribute(k,v){this.a[k]=String(v)},getAttribute(k){return this.a[k]||'0'}});
const rf=el(301,-5,'RF'), second=el(257,107,'2B'),label=el(0,0,'label');
const field={querySelectorAll(){return [rf,second]},querySelector(s){return s.startsWith('text')?label:s.includes('2B')?second:rf}};n.set('fielders',field);c.animateBatterRun=()=>{};c.showPitchResult=(s)=>{c.lastCall=s};
c.info={type:'fly',point:[245,-25],defender:'RF',fielder:{field:55,arm:55},caught:true};
vm.runInContext("animate('fly',info,55);animateOutfieldReturn('fly',true,55,null,info)",c);
for(const t of [1104,1135,1150]){q.advance(t-(c.lastTime||0));c.lastTime=t;const ball=n.get('ball'),sh=n.get('ballShadow');const bx=+ball.getAttribute('cx'),by=+ball.getAttribute('cy'),gx=+sh.getAttribute('cx'),gy=+sh.getAttribute('cy'),x=+rf.getAttribute('cx'),y=+rf.getAttribute('cy');console.log(JSON.stringify({t,ball:[bx,by],ground:[gx,gy],fielder:[x,y],distance:Math.hypot(bx-x,by-y),groundDistance:Math.hypot(gx-x,gy-y),phase:rf.getAttribute('data-fielding-phase'),call:c.lastCall||''}));}
