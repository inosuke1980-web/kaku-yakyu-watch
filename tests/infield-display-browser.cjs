'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const positions=['1B','2B','SS','3B'];
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 const out=process.env.FIXTURE_SCREENSHOT_DIR,report=[];
 for(const [width,height] of [[375,667],[390,844]]){
  const pages={};
  for(const [variant,file] of [['A',process.env.INFIELD_BASE_INDEX],['B',path.resolve(__dirname,'../index.html')]]){
   assert.ok(file,'INFIELD_BASE_INDEX is required');const p=await b.newPage({viewport:{width,height}});pages[variant]=p;
   await p.clock.install({time:new Date('2026-11-12T00:00:00Z')});await p.clock.pauseAt(new Date('2026-11-12T00:00:01Z'));await p.goto(pathToFileURL(file).href);
   await p.evaluate(()=>{const old=Math.random;let seed=123456789;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};$('category').value='high';$('parkShape').value='standard';$('parkType').value='grass';$('matchType').value='official';try{init();stop();render()}finally{Math.random=old}});
  }
  for(const hand of ['右打','左打'])for(const bases of [0,1,2,3]){
   const pair={};
   for(const variant of ['A','B']){
    const p=pages[variant];pair[variant]=await p.evaluate(({hand,bases})=>{stop();game.inning=1;game.half=0;game.outs=1;game.ended=false;game.bases=[bases&1?current().bat.players[1]:null,bases&2?current().bat.players[2]:null,null];batter().bats=hand;applyDefensiveAlignment(false);render();const read=pos=>{const e=document.querySelector('circle[data-position="'+pos+'"]');return [+e.getAttribute('cx'),+e.getAttribute('cy')]};return {players:Object.fromEntries(['1B','2B','SS','3B'].map(n=>[n,read(n)])),rule:defensiveAlignment().positions,batter:batter().name,park:game.parkShape,field:document.querySelector('.field-stage').getBoundingClientRect().height}}, {hand,bases});
    if(out)await p.screenshot({path:path.join(out,`infield-${variant}-${width}-${hand==='右打'?'R':'L'}-${bases}.png`)});
   }
   assert.equal(pair.A.batter,pair.B.batter);assert.deepEqual(pair.A.rule,pair.B.rule);assert.equal(pair.A.field,pair.B.field);assert.deepEqual(pair.A.park,pair.B.park);
   assert.ok(pair.B.players.SS[1]<pair.B.players['2B'][1]);for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.hypot(...pair.B.players[positions[i]].map((x,k)=>x-pair.B.players[positions[j]][k]))>=24);
   report.push({width,hand,bases,...pair});
  }
  await pages.A.close();const p=pages.B,errors=[];p.on('pageerror',e=>errors.push(e.message));
  const cases=[{name:'1B',d:.9},{name:'2B-gap',d:.6},{name:'SS-gap',d:.35},{name:'3B',d:.1},{name:'force',d:.35,q:.99,slow:true},{name:'double',d:.35,q:.01,slow:true},{name:'pickoff-1',special:'pickoff',base:0},{name:'pickoff-2',special:'pickoff',base:1},{name:'steal-safe',special:'steal',safe:true},{name:'steal-out',special:'steal',safe:false},{name:'infield-fly',special:'fly'}];
  for(const c of cases){
   const initial=await p.evaluate(c=>{
    stop();game.ended=false;game.inning=1;game.half=0;game.outs=c.slow?0:1;game.balls=1;game.strikes=0;game.totalPitches=0;for(const t of game.teams)t.runs=[0];batter().bats=c.name==='SS-gap'?'左打':'右打';batter().speed=c.slow?5:55;for(const f of current().def.players){f.field=c.slow?99:55;f.speed=c.slow?99:55;f.arm=c.slow?99:55}
    game.bases=c.slow?[current().bat.players[1],null,null]:[null,null,null];if(c.special==='pickoff'){game.bases[c.base]=current().bat.players[1]}if(c.special==='steal')game.bases[0]=current().bat.players[1];if(game.bases[0])game.bases[0].speed=c.slow?5:55;
    applyDefensiveAlignment(false);render();
    globalThis.infieldFrames=[];globalThis.collectInfield=true;const started=performance.now();function readFrame(now){const xy=pos=>{const e=document.querySelector('circle[data-position="'+pos+'"]');return [+e.getAttribute('cx'),+e.getAttribute('cy')]};infieldFrames.push({t:now-started,players:Object.fromEntries(['1B','2B','SS','3B'].map(n=>[n,xy(n)])),ball:[+$('ball').getAttribute('cx'),+$('ball').getAttribute('cy')],cover:[...document.querySelectorAll('#firstBaseCoverForeground circle')].map(e=>[+e.getAttribute('cx'),+e.getAttribute('cy')])});if(collectInfield)requestAnimationFrame(readFrame)}
    requestAnimationFrame(readFrame);const origins=Object.fromEntries(['1B','2B','SS','3B'].map(n=>{const e=document.querySelector('circle[data-position="'+n+'"]');return [n,[+e.getAttribute('cx'),+e.getAttribute('cy')]]}));
    if(c.special==='pickoff')animatePickoffReturn(c.base,animationToken);
    else if(c.special==='steal'){const r=game.bases[0];if(c.safe)game.bases=[null,r,null];render();animateStealPlay({id:r.id,speed:55,safe:c.safe})}
    else if(c.special==='fly')animate('fly',{type:'fly',point:[170,145],defender:'SS',fielder:{field:55,arm:55},caught:true},55,null);
    else {const original=Math.random,seq=[.99,.99,c.d,c.slow?.3:.5,.99,.5,.5,.99,c.q??.99,.01,.99];let i=0;Math.random=()=>seq[i++]??.99;try{resolvePitch()}finally{Math.random=original}}
    return {origins,force:game.forceOutVisual,log:game.events.slice(-2)};
   },c);
   if(c.slow)assert.equal(initial.force?.outcome,c.name);
   for(const target of [0,32,160,400,650,1000,1500,2300,3200]){
    const elapsed=await p.evaluate(()=>infieldFrames.at(-1)?.t||0);await p.clock.runFor(Math.max(0,target-elapsed));
    if(out)await p.screenshot({path:path.join(out,`infield-play-${width}-${c.name}-${target}.png`)});
   }
   const frames=await p.evaluate(()=>{collectInfield=false;return infieldFrames});assert.ok(frames.length>30);
   for(let i=1;i<frames.length;i++){const a=frames[i-1],z=frames[i];if(z.t-a.t<=25)for(const pos of positions){const jump=Math.hypot(...z.players[pos].map((x,k)=>x-a.players[pos][k]));assert.ok(jump<18,`${width} ${c.name} ${pos}: jump ${jump} at ${z.t}`)}}
   for(const pos of positions)assert.ok(Math.hypot(...frames.at(-1).players[pos].map((x,i)=>x-initial.origins[pos][i]))<1,`${c.name} ${pos} returns to displayed origin`);
   if(out)fs.writeFileSync(path.join(out,`infield-frames-${width}-${c.name}.json`),JSON.stringify({initial,frames}));console.log('INFIELD SEQUENCE PASS',width,c.name,frames.length);
  }
  await p.evaluate(()=>{stop();game.inning=12;game.ended=false;render()});const dims=await p.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,scroll:document.querySelector('.field-card').scrollHeight>document.querySelector('.field-card').clientHeight+1}));assert.ok(dims.w<=dims.iw&&dims.h<=dims.ih+1&&!dims.scroll);assert.deepEqual(errors,[]);await p.close();
 }
 if(out)fs.writeFileSync(path.join(out,'infield-comparison.json'),JSON.stringify(report,null,2));console.log('INFIELD A/B AND MOBILE PASS');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
