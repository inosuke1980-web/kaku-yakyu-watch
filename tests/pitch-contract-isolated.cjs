'use strict';
// Isolated contract experiment: no production hooks, DOM, timers or save data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, 'pitch-location-calibration.cjs'), 'utf8');
const start = code.indexOf('function zoneAt('), end = code.indexOf('function pitchLegacy(');
assert.ok(start >= 0 && end > start);
const ctx = {assert, Math};
vm.createContext(ctx);
vm.runInContext('const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));\n' + code.slice(start, end) + '\nthis.model={pitchC,nextCount};', ctx);
const {pitchC, nextCount} = ctx.model;
function random(seed) {
  let state = seed | 0, draws = 0;
  return {next() { draws++; state = (state + 0x6d2b79f5) | 0; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }, get draws() {return draws;}};
}
const clone = o => JSON.parse(JSON.stringify(o));
const freeze = o => { if(o && typeof o === 'object') {Object.values(o).forEach(freeze); Object.freeze(o);} return o; };
const keys = ['gameId','epoch','pitcherId','batterId','inning','half','outs','balls','strikes'];
function context(game) { return Object.fromEntries(keys.map(k => [k,game[k]])); }
function equalContext(a,b) {return keys.every(k=>a[k]===b[k]);}
// IDs are unique within a caller-supplied game/session namespace; epoch must be
// incremented whenever any other game situation affecting a pitch changes.
function createController(rng, game) {
  let seq=0, rec=null, state='empty';
  function valid() {
    if(!rec || !['ready','drawing'].includes(state)) return false;
    if(!equalContext(rec.context, context(game))) {state='invalid'; return false;}
    return true;
  }
  return {
    get state() {return state;}, get record() {return rec;},
    prepare(type, ability) {
      if(['ready','drawing'].includes(state)) throw Error('pending pitch exists');
      const p=pitchC(()=>rng.next(), ability.eye, ability.control, ability.contact, ability.stuff, game.balls, game.strikes, 'C1');
      rec=freeze({id:`${game.gameId}:${++seq}`, context:context(game), type,
        target:{x:p.targetX,y:p.targetY}, actual:{x:p.x,y:p.y}, zone:p.zone, swing:p.swing, outcome:p.outcome});
      state='ready'; return rec;
    },
    draw() {if(!valid()) throw Error('stale pitch'); state='drawing'; return rec;},
    pause() {if(!valid() || state!=='drawing') throw Error('not drawing'); state='ready';},
    cancel() {if(['ready','drawing'].includes(state)) state='cancelled';},
    commit() {
      if(!valid()) return false;
      // Compute a complete new mock state before committing. Real engine
      // side effects need their own atomic or idempotent adapter.
      const n=nextCount(game.balls,game.strikes,rec.outcome);
      const next={...game,pitches:game.pitches+1,playerPitches:game.playerPitches+1,
        balls:n.end?0:n.b, strikes:n.end?0:n.s, pa:game.pa+(n.end?1:0),
        walks:game.walks+(n.end==='walk'?1:0), strikeouts:game.strikeouts+(n.end==='strikeout'?1:0),
        fairs:game.fairs+(n.end==='fair'?1:0), epoch:game.epoch+1};
      state='committed'; Object.assign(game,next); return true;
    }
  };
}
function fixture(seed=19) {const g={gameId:'fixture-game',epoch:1,pitcherId:'P1',batterId:'B1',inning:1,half:0,outs:0,balls:0,strikes:0,pitches:0,playerPitches:0,pa:0,walks:0,strikeouts:0,fairs:0};const rng=random(seed);return {g,rng,c:createController(rng,g)};}
const ability={eye:50,control:50,contact:50,stuff:50};
function test() {
  let {g,rng,c}=fixture(), rec=c.prepare('straight',ability), draws=rng.draws;
  assert.equal(c.state,'ready'); assert.throws(()=>c.prepare('curve',ability)); assert.strictEqual(c.draw(),rec); assert.equal(c.state,'drawing');
  assert.strictEqual(c.draw(),rec); assert.equal(rng.draws,draws); assert.equal(c.commit(),true); assert.equal(c.state,'committed');
  assert.equal(g.pitches,1); assert.equal(g.playerPitches,1); const committed=clone(g);
  assert.equal(c.commit(),false); assert.deepEqual(g,committed); assert.equal(rng.draws,draws);
  // Cancel before generation, and after generation before rendering.
  ({g,rng,c}=fixture()); const original=clone(g); c.cancel(); assert.equal(rng.draws,0); assert.deepEqual(g,original);
  rec=c.prepare('curve',ability); draws=rng.draws; c.cancel(); assert.equal(c.state,'cancelled');
  assert.equal(c.commit(),false); assert.throws(()=>c.draw()); assert.deepEqual(g,original); assert.equal(rng.draws,draws);
  // A cancellation does not rewind already-consumed random values.
  let next=c.prepare('curve',ability); assert.notEqual(next.id,rec.id); assert.ok(rng.draws>draws);
  // A stopped in-flight pitch can also be discarded without a state update.
  ({g,rng,c}=fixture()); rec=c.prepare('curve',ability); c.draw(); draws=rng.draws; const beforeCancel=clone(g); c.cancel(); assert.equal(c.commit(),false); assert.deepEqual(g,beforeCancel); assert.equal(rng.draws,draws);
  // Pause and redraw share the exact immutable object, without consuming RNG.
  ({g,rng,c}=fixture()); rec=c.prepare('slider',ability); c.draw(); draws=rng.draws;
  const snapshot=JSON.stringify(rec); c.pause(); assert.equal(c.state,'ready'); assert.throws(()=>c.prepare('curve',ability)); assert.strictEqual(c.draw(),rec);
  assert.equal(JSON.stringify(rec),snapshot); assert.equal(rng.draws,draws); assert.ok(Object.isFrozen(rec.actual));
  assert.throws(()=>{rec.actual.x=999},TypeError); assert.equal(c.commit(),true);
  // Each context mutation rejects old display and commit, even if count is unchanged.
  for(const change of [x=>x.pitcherId='P2',x=>x.batterId='B2',x=>x.inning++,x=>x.half=1,x=>x.outs++,x=>x.balls++,x=>x.strikes++,x=>x.epoch++,x=>x.gameId='new-game']) {
    ({g,rng,c}=fixture()); rec=c.prepare('straight',ability); const d=rng.draws; change(g); const before=clone(g);
    assert.equal(c.commit(),false); assert.equal(c.state,'invalid'); assert.throws(()=>c.draw());
    assert.deepEqual(g,before); assert.equal(rng.draws,d);
  }
  // Pickoff and lead are non-pitch operations; generation is deferred until done.
  ({g,rng,c}=fixture()); assert.equal(c.state,'empty'); g.epoch++; assert.equal(rng.draws,0);
  rec=c.prepare('straight',ability); assert.equal(g.pitches,0); assert.equal(c.commit(),true); assert.equal(g.pitches,1);
  // Many consecutive IDs are unique even after terminal states.
  ({g,rng,c}=fixture()); const ids=new Set(); for(let i=0;i<1000;i++){rec=c.prepare('straight',ability); assert.ok(!ids.has(rec.id));ids.add(rec.id);c.cancel();} assert.equal(ids.size,1000);
  // Sample outcomes/terminal count contracts with no added RNG at commit.
  let kinds=new Set(); for(let seed=1;seed<=500;seed++) {({g,rng,c}=fixture(seed));g.balls=3;g.strikes=2;rec=c.prepare('straight',ability);kinds.add(rec.outcome);const d=rng.draws;c.draw();assert.equal(c.commit(),true);assert.equal(rng.draws,d);
    assert.equal(g.walks,Number(rec.outcome==='ball'));assert.equal(g.strikeouts,Number(['called','whiff'].includes(rec.outcome)));assert.equal(g.fairs,Number(rec.outcome==='fair'));
    if(rec.outcome==='foul'){assert.equal(g.strikes,2);assert.equal(g.balls,3);assert.equal(g.pa,0);}
  } assert.deepEqual([...kinds].sort(),['ball','called','fair','foul','whiff']);
  // Identical seed and calls yield identical record and draw count.
  const x=fixture(2026), y=fixture(2026);assert.deepEqual(x.c.prepare('curve',ability),y.c.prepare('curve',ability));assert.equal(x.rng.draws,y.rng.draws);
  return 'PASS: A-G, 1000 unique IDs, all outcomes, context invalidation, repeat seed';
}
console.log(test());
