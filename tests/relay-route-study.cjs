'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const sec=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i);return html.slice(i,j)};
const ctx={Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};vm.createContext(ctx);vm.runInContext(sec('function outfieldPickupTiming(', 'function decideSingleAdvance(')+sec('function fielderReleaseMs(', 'function groundPlayTimes(')+sec('function throwFlightMs(', '// Single:'),ctx);
for(const [side,p] of [['LF',[100,65]],['CF',[200,55]],['RF',[300,65]]]){
 ctx.p=p;const fixed=[200,116],candidate=[Math.round(p[0]+(200-p[0])*.35),116];const duration=(a,b,arm)=>{ctx.a=a;ctx.b=b;ctx.arm=arm;return vm.runInContext('throwFlightMs(arm,a,b)',ctx)};
 const pickup=vm.runInContext("outfieldPickupTiming({flight:'single',flightMs:830},55).release",ctx),relay=fixed,goal=[77,169],pause=vm.runInContext('fielderReleaseMs(65,65,true)',ctx);
 const base=duration(p,relay,55),candidateFirst=duration(p,candidate,55),baseFinal=duration(relay,goal,65),candidateFinal=duration(candidate,goal,65);
 const current=vm.runInContext("extraBaseThrowTiming({flight:'single',flightMs:830},55,55,p,[77,169]).arrival",ctx);assert.equal(current,pickup+base+pause+baseFinal);
 console.log(JSON.stringify({side,pickup:p,runnerNone:{field:side==='LF'?'SS':'2B',cutoff:fixed,firstDistance:+Math.hypot(p[0]-200,p[1]-116).toFixed(1),release:pickup,arrival:pickup+base},runnerFirst:{goal,secondDistance:+Math.hypot(123,53).toFixed(1),firstMs:base,secondMs:baseFinal,arrival:current},proposal:{cutoff:candidate,firstMs:candidateFirst,secondMs:candidateFinal,arrival:pickup+candidateFirst+pause+candidateFinal,assumption:'illustrative only'}}));
}
console.log('RELAY ROUTE STUDY PASS');
