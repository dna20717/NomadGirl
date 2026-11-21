// #169 G3 Leben (engine/ecosystem.js): the simulation between visits is deterministic, bounded, recovers, never empties a place for good,
// the Revierkrieg sets the owner; camps sit in the right rooms (all POIs × 8 seeds); the director never sends help in a calm phase, an
// Atempause or the first seconds of the Wow room.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { lifeConfig, initLife, simulate, stepDay, recordLosses, planLife, attitude, factionOf, lifeAt, repairLife, newDirector, directorStep, mayReinforce, musicLayer, wantsWave, LIFE } from '../engine/ecosystem.js';
import { auditLife, SEEDS } from '../tools/level_audit.mjs';
import { repairSave, newSave } from '../game/save.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
const POIS = Object.keys(D.pois).filter(p => poiReady(D, p).ok);
const C = lifeConfig(D);

test('Simulation: gleicher Seed und gleiche Tage = gleicher Zustand, auch in Schritten', () => {
  for (const p of POIS) {
    const a = simulate(D, p, initLife(D, p, { seed: 11 }), 25), b = initLife(D, p, { seed: 11 });
    for (const d of [3, 4, 9, 17, 25]) simulate(D, p, b, d);
    assert.deepEqual(a, b, p);
  }
  const differ = POIS.filter(p => JSON.stringify(simulate(D, p, initLife(D, p, { seed: 1 }), 30).camps) !== JSON.stringify(simulate(D, p, initLife(D, p, { seed: 2 }), 30).camps));
  assert.ok(differ.length >= POIS.length / 2, `andere Seeds, andere Welt: ${differ.length}`);
});

test('Simulation: beschränkt (Stärke, Lager, Nester) über 120 Tage', () => {
  for (const p of POIS) for (const seed of [1, 5, 9]) {
    const S = initLife(D, p, { seed });
    for (let d = 0; d < 120; d++) {
      stepDay(D, p, S);
      assert.ok(S.camps.length <= C.sim.maxCamps, `${p} ${d}: ${S.camps.length} Lager`);
      assert.ok(S.camps.filter(c => c.type === 'nest').length <= Math.max(C.sim.maxNests, 1), `${p}: Nester`);
      for (const c of S.camps) assert.ok(c.strength >= 0 && c.strength <= Math.max(C.sim.maxStrength, C.sim.nestMax), `${p}: Stärke ${c.strength}`);
      assert.ok(S.log.length <= 24);
    }
  }
});

test('Simulation: Verluste bleiben sichtbar und erholen sich langsam', () => {
  const S = initLife(D, 'bunker_13', { seed: 4 }), id = S.camps[0].id;
  recordLosses(D, S, { [id]: 2 });
  const hit = S.camps.find(c => c.id === id).strength;
  assert.ok(hit <= 50, `nach 2 Kills geschwächt: ${hit}`);
  assert.equal(S.losses, 2);
  simulate(D, 'bunker_13', S, S.day + 1);
  const one = S.camps.find(c => c.id === id)?.strength;
  assert.ok(one > hit && one < 100, `einen Tag später erholt, aber nicht ganz: ${one}`);
  simulate(D, 'bunker_13', S, S.day + 10);
  assert.ok(S.camps.find(c => c.id === id)?.strength >= 100, 'nach elf Tagen wieder voll');
});

test('Simulation: nie leer gefegt für immer', () => {
  for (const p of POIS) {
    const S = initLife(D, p, { seed: 3 });
    let empty = 0, maxEmpty = 0;
    for (let d = 0; d < 80; d++) {
      if (d % 9 === 0) recordLosses(D, S, Object.fromEntries(S.camps.map(c => [c.id, 9])));   // Leyla wipes everything now and then
      stepDay(D, p, S);
      empty = S.camps.length ? 0 : empty + 1; maxEmpty = Math.max(maxEmpty, empty);
    }
    assert.ok(maxEmpty < C.sim.refillDays + 1, `${p}: ${maxEmpty} Tage leer`);
    assert.ok(S.log.some(l => l.kind === 'gone' || l.kind === 'settle' || l.kind === 'moved'), `${p}: es tut sich was`);
  }
});

test('Revierkrieg setzt den Besitzer, das Ökosystem füllt die Details', () => {
  const S = initLife(D, 'bunker_13', { seed: 2 });
  assert.equal(S.owner, 'Rust Guard');
  simulate(D, 'bunker_13', S, S.day + 1, { owner: 'Salt Dogs' });
  assert.equal(S.owner, 'Salt Dogs');
  assert.ok(S.camps.filter(c => c.type === 'gang_camp').every(c => c.gang === 'Salt Dogs' && c.strength <= C.sim.takeover + C.sim.recover), JSON.stringify(S.camps));
  assert.ok(S.log.some(l => l.kind === 'owner' && l.gang === 'Salt Dogs'));
  // the savegame: the owner from save.turfs (game side), lifeAt simulates to today
  const save = { day: 1, map: { seed: 5 }, cycle: 1 };
  const a = lifeAt(D, save, 'n1', 'bunker_13', 'Rust Guard');
  save.day = 6;
  const b = lifeAt(D, save, 'n1', 'bunker_13', 'Salt Dogs');
  assert.equal(a, b); assert.equal(b.day, 6); assert.equal(b.owner, 'Salt Dogs');
});

test('Beziehungen: Rivalen kämpfen, Plünderer fliehen vor Mutanten, Kleinvieh flieht vor allen', () => {
  const owner = 'Rust Guard';
  assert.equal(factionOf(D, { family: 'raider', gang: 'Rust Guard', owner }), 'home');
  assert.equal(factionOf(D, { family: 'raider', gang: 'Salt Dogs', owner }), 'rival');
  assert.equal(factionOf(D, { family: 'raider', gang: 'Neon Rats', owner }), 'gang');
  assert.equal(factionOf(D, { family: 'mutant', owner }), 'mutants');
  assert.equal(attitude(C, 'home', 'rival'), 'fight');
  assert.equal(attitude(C, 'rival', 'home'), 'fight');
  assert.equal(attitude(C, 'home', 'gang'), 'avoid');
  assert.equal(attitude(C, 'raiders', 'mutants'), 'flee');
  assert.equal(attitude(C, 'mutants', 'home'), 'fight');
  assert.equal(attitude(C, 'critters', 'mutants'), 'flee');
  assert.equal(attitude(C, 'home', 'home', { gangA: owner, gangB: owner }), 'ignore');
  assert.equal(attitude(C, 'mutants', 'mutants'), 'ignore');
  // a row with gang names wins
  const C2 = { ...C, relations: [{ from: 'Rust Guard', to: 'Salt Dogs', attitude: 'avoid' }, ...C.relations] };
  assert.equal(attitude(C2, 'home', 'rival', { gangA: 'Rust Guard', gangB: 'Salt Dogs' }), 'avoid');
});

test('Lager im Level: alle POIs × 8 Seeds, nie an Nähten, in Atempausen, im Wow-Raum, im Eingang', () => {
  for (const p of POIS) for (const seed of SEEDS) {
    const L = buildPoi(D, p, seed);
    assert.deepEqual(auditLife(D, p, L, seed), [], `${p} ${seed}`);
    const plan = planLife(D, p, L, initLife(D, p, { seed }), seed);
    assert.ok(plan.camps.length >= 1, `${p} ${seed}: kein Lager (${plan.unplaced})`);
    for (const c of plan.camps) { assert.ok(c.members.length >= 1, `${p}: ${c.id} leer`); assert.ok(c.route[0] <= c.cx && c.route[1] >= c.cx); }
    // specialists (boss, sirens, medics …) keep their places
    const sym = new Map((L.def.spawns || []).map(s => [s.symbol, s.enemy])), special = e => D.enemies[e]?.behavior === 'boss' || (D.enemies[e]?.traits || []).length;
    const count = lay => lay.join('').split('').filter(ch => sym.has(ch) && special(sym.get(ch))).length;
    assert.equal(count(plan.layout), count(L.def.layout), `${p}: Spezialisten bleiben`);
  }
});

test('Lager: Stärke macht die Leute, ein Spähtrupp kommt als Rivale', () => {
  const L = buildPoi(D, 'bunker_13', 3), S = initLife(D, 'bunker_13', { seed: 3 });
  const full = planLife(D, 'bunker_13', L, S, 3).camps.reduce((n, c) => n + c.members.length, 0);
  for (const c of S.camps) c.strength = 30;
  const weak = planLife(D, 'bunker_13', L, S, 3).camps.reduce((n, c) => n + c.members.length, 0);
  assert.ok(weak < full, `${weak} < ${full}`);
  S.camps.push({ id: 'cx', type: 'patrol', gang: 'Salt Dogs', pos: 0.5, strength: 100, age: 0, low: 0, ttl: 2 });
  const pat = planLife(D, 'bunker_13', L, S, 3).camps.find(c => c.id === 'cx');
  assert.ok(pat, 'Spähtrupp steht im Level');
  assert.equal(pat.faction, 'rival'); assert.equal(pat.gang, 'Salt Dogs');
});

test('Regie: Aufbau → Spitze → Ruhe → Aufbau, Musik-Schicht folgt', () => {
  const R = C.director, st = newDirector();
  assert.equal(st.phase, 'build'); assert.equal(musicLayer(st, R), 'calm');
  for (let i = 0; i < 200 && st.phase === 'build'; i++) directorStep(st, { dt: 100, engaged: 3 }, R);
  assert.equal(st.phase, 'peak'); assert.equal(musicLayer(st, R), 'combat');
  for (let i = 0; i < 600 && st.phase === 'peak'; i++) directorStep(st, { dt: 100, engaged: 0 }, R);
  assert.equal(st.phase, 'relax'); assert.equal(musicLayer(st, R), 'calm');
  assert.equal(mayReinforce(st, {}, R), false, 'keine Verstärkung in der Ruhe');
  for (let i = 0; i < 600 && st.phase === 'relax'; i++) directorStep(st, { dt: 100 }, R);
  assert.equal(st.phase, 'build');
  directorStep(st, { dt: 100, engaged: 1 }, R);
  for (let i = 0; i < 40; i++) directorStep(st, { dt: 100, engaged: 2 }, R);
  if (st.phase === 'build') assert.equal(musicLayer(st, R), st.tension > R.calm ? 'tension' : 'calm');
  assert.ok(st.log.length >= 3);
});

test('Regie: nie Verstärkung in Atempausen und nicht in den ersten Sekunden im Wow-Raum', () => {
  const R = C.director, st = newDirector();
  assert.equal(mayReinforce(st, {}, R), true);
  assert.equal(mayReinforce(st, { rest: true }, R), false);
  assert.equal(mayReinforce(st, { wow: true, inRoom: R.wowGrace - 1 }, R), false);
  assert.equal(mayReinforce(st, { wow: true, inRoom: R.wowGrace + 1 }, R), true);
  directorStep(st, { dt: 100, rest: true }, R);
  assert.equal(st.phase, 'relax', 'die Atempause zwingt die Ruhe');
  // a wave only after a long lull, only in a fighting room, at most „Wellen je Run“
  const w = newDirector();
  for (let i = 0; i < (R.lull + 2) * 10; i++) directorStep(w, { dt: 100 }, R);
  assert.equal(wantsWave(w, { arena: true }, R), true);
  assert.equal(wantsWave(w, { arena: true, rest: true }, R), false);
  assert.equal(wantsWave(w, { arena: false }, R), false);
  w.waves = R.maxWaves; assert.equal(wantsWave(w, { arena: true }, R), false);
});

test('Spielstand: alte Stände bekommen ein leeres Leben, kaputte Orte fallen weg', () => {
  const s = repairSave({ ...newSave(D), life: undefined }, D);
  assert.deepEqual(s.life, {});
  const t = repairSave({ ...newSave(D), life: { a: { camps: 'kaputt' }, b: initLife(D, 'bunker_13', { seed: 1 }) } }, D);
  assert.deepEqual(Object.keys(t.life), ['b']);
  assert.deepEqual(repairLife({ life: [] }).life, {});
  assert.ok(LIFE.campTypes.length >= 4);
});
