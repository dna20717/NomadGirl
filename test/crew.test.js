// Crew-Kern klein (#085): settlers from building blocks, taken in at the fire or on the road, a hidden trait that shows,
// jobs at workshops through the Boni-Bus
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { rollPerson, admit, campArrival, known, setJob, jobEffect, crewBonuses, heads, reject } from '../game/crew.js';
import { mod, parts } from '../game/mods.js';
import { generateEncounter } from '../game/road_events.js';
import { choose } from '../game/travel.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const cook = save => { const p = rollPerson(D, 42); p.skills = { kochen: 2 }; return admit(D, save, p); };

test('Bausteine: Name, Herkunft, 1–2 Fähigkeiten, eine sichtbare und eine verborgene Eigenheit; gleicher Seed, gleiche Person', () => {
  const a = rollPerson(D, 7), b = rollPerson(D, 7);
  assert.deepEqual(a, b);
  assert.ok(a.name && a.origin);
  const n = Object.keys(a.skills).length; assert.ok(n >= 1 && n <= 2);
  assert.equal(a.traits.length, 2);
  assert.equal(D.people.traits.find(t => t.id === a.traits[0]).hidden, false);
  assert.equal(D.people.traits.find(t => t.id === a.traits[1]).hidden, true);
  const k = known(D, a); assert.equal(k.traits.length, 1); assert.equal(k.hidden, true);
});
test('Am Feuer: ein Bewerber mit Chance; die verborgene Eigenheit zeigt sich nach ein paar Tagen', () => {
  const s = newSave(D);
  assert.equal(campArrival(D, s, () => 0.01).applicant, null, 'nicht am ersten Tag');
  s.day = 2;
  assert.equal(campArrival(D, s, () => 0.99).applicant, null);
  const r = campArrival(D, s, () => 0.01);
  assert.ok(r.applicant && s.applicant);
  reject(s); assert.equal(s.applicant, null);
  const p = cook(s);
  assert.equal(campArrival(D, s, () => 0.99).revealed.length, 0);
  s.day += D.people.revealDays;
  const r2 = campArrival(D, s, () => 0.99);
  assert.equal(r2.revealed[0].name, p.name); assert.ok(p.seen);
  assert.equal(known(D, p).traits.length, 2);
});
test('Job: die Köchin an der Kochnische bringt „Perfekt kochen“ in den Boni-Bus, an der Werkbank nichts', () => {
  const s = newSave(D), p = cook(s), units = s.rig.units, ui = units.findIndex(u => u.workshops?.some(w => w.id === 'kochnische')), at = units[ui].workshops.find(w => w.id === 'kochnische').at;
  assert.equal(mod(D, s, 'perfect'), 0);
  setJob(s, p.id, `${ui}:${at}`);
  assert.deepEqual(jobEffect(D, s, p), { skill: 'Kochen', level: 2, stat: 'perfect', value: 12 });
  assert.equal(mod(D, s, 'perfect'), 12);
  assert.ok(parts(D, s, 'perfect').some(x => x.source === 'crew' && x.label === p.name));
  const sl = units[ui].workshops.find(w => w.id === 'schlafkoje');
  setJob(s, p.id, `${ui}:${sl.at}`);
  assert.equal(jobEffect(D, s, p), null); assert.equal(crewBonuses(D, s).length, 0);
});
test('Auf der Reise: „Fragen, ob sie bleiben will“ nimmt jemanden in die Crew; Köpfe gegen Betten', () => {
  const s = newSave(D);
  const E = generateEncounter(D, () => 0.5, { save: s, situation: 'anhalter', danger: 1, mood: 'freundlich' });
  const o = E.options.find(x => x.recruit) || { recruit: true, result: '' };
  const r = choose(D, s, o, () => 0.99);
  assert.equal(s.crew.length, 1); assert.ok(r.joined && r.lines.some(l => /in der Crew/.test(l)));
  const H = heads(D, s); assert.equal(H.heads, 2); assert.ok(H.beds >= 1);
});
