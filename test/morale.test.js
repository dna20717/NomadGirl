// Rig-Moral (#100, game/morale.js): sources, traits, drift by Ereignis-Zeit, levels, jobs, crisis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, advance } from '../game/save.js';
import { rollPerson, admit, crewBonuses, setJob, jobEffect } from '../game/crew.js';
import { morale, moraleTarget, tickMorale, levelOf, jobFactor } from '../game/morale.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const withCrew = (n = 1, traits = null) => {
  const s = newSave(D);
  for (let i = 0; i < n; i++) { const p = rollPerson(D, 100 + i); if (traits) p.traits = traits; admit(D, s, p); }
  return s;
};

test('Ohne Crew keine Moral', () => {
  const s = newSave(D);
  assert.equal(morale(D, s), null);
  assert.equal(tickMorale(D, s), null);
  assert.equal(jobFactor(D, s), 1);
});

test('Quellen: Betten, Vorräte, Eigenheiten (Feinschmecker doppelt, Hamster verborgen)', () => {
  const s = withCrew(1, []);
  const T = moraleTarget(D, s), labels = T.parts.map(p => p.label);
  assert.ok(labels.includes('Grundstimmung'));
  s.food = 0;
  const hungry = moraleTarget(D, s).target;
  s.food = 50;
  assert.ok(moraleTarget(D, s).target > hungry, 'Vorräte heben die Moral');
  const g = withCrew(1, ['feinschmecker']); g.food = 50;
  const plain = withCrew(1, []); plain.food = 50;
  assert.ok(moraleTarget(D, g).target > moraleTarget(D, plain).target, 'Feinschmecker: Essen zählt doppelt');
  const h = withCrew(1, ['frohnatur', 'hamster']); h.food = 50;
  assert.ok(moraleTarget(D, h).parts.some(p => p.label === 'Vorräte verschwinden' && p.value < 0));
});

test('Die Moral wandert pro Tag zum Ziel, keine Sprünge', () => {
  const s = withCrew(2, []); s.food = 50;
  const first = tickMorale(D, s);
  assert.equal(first.value, first.target);
  s.morale.value = 10;
  advance(s, 24);
  const m = tickMorale(D, s);
  assert.ok(m.value > 10 && m.value <= 10 + 15 + 0.5, `ein Tag = höchstens 15 Punkte (${m.value})`);
});

test('Stufen wirken auf Jobs: Hochstimmung stärker, Krise nichts, in der Krise geht jemand', () => {
  assert.equal(levelOf(D, 80).id, 'high'); assert.equal(levelOf(D, 50).id, 'stable'); assert.equal(levelOf(D, 30).id, 'tense'); assert.equal(levelOf(D, 5).id, 'crisis');
  const s = withCrew(3, []); s.food = 50;
  // a job that brings something
  const units = s.rig.units, place = units.flatMap((u, ui) => (u.workshops || []).map(w => `${ui}:${w.at}`)).find(pl => s.crew.some(p => jobEffect(D, s, p, pl)));
  if (place) {
    const p = s.crew.find(x => jobEffect(D, s, x, place)); setJob(s, p.id, place);
    tickMorale(D, s);
    s.morale.value = 90; const hi = crewBonuses(D, s)[0]?.value;
    s.morale.value = 50; const mid = crewBonuses(D, s)[0]?.value;
    s.morale.value = 5; const none = crewBonuses(D, s).length;
    assert.ok(hi > mid, `Hochstimmung ${hi} > stabil ${mid}`);
    assert.equal(none, 0);
  }
  tickMorale(D, s); s.morale.value = 0; s.food = 0;
  advance(s, 24 * 5);
  const r = tickMorale(D, s, () => 0);   // every roll leaves
  assert.ok(r.left.length >= 1 && s.crew.length < 3, 'in der Krise verlässt jemand das Rig');
});
