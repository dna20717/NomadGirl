// Boni-Bus (#066): all sources of a camp bonus in one place, the same numbers as before
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, repairSave } from '../game/save.js';
import { add } from '../game/inventory.js';
import { generate } from '../game/glitchlings.js';
import { farmKeys, assign, placesFor, workerBonus } from '../game/workers.js';
import { parts, mod, modFactor, modText } from '../game/mods.js';
import { bonuses as trophyBonuses } from '../game/achievements.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
function rig() {
  const s = newSave(D);
  s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'bitfarm', at: 0 }, { id: 'hydrokultur', at: 1 }] });
  return repairSave(JSON.parse(JSON.stringify(s)), D);
}

test('Ohne Quellen: nichts, Faktor 1', () => {
  const s = newSave(D);
  assert.deepEqual(parts(D, s, 'growth'), []); assert.equal(mod(D, s, 'fuel'), 0); assert.equal(modFactor(D, s, 'sleepHeal'), 1);
});

test('Gärtner in der Hydrokultur: der Bus nennt ihn und rechnet wie vorher (Trophäe × Synergie × Worker)', () => {
  const s = rig(), g = { ...generate(D, 4, 12)[0], talent: 'Gärtner', bits: 3, quirkKind: null, quirk: '', id: 'gaertner_t', name: 'Moss Hum' };
  add(D, s.inv.grids[farmKeys(D, s)[0]], 'items', 'glitchling', 1, { g });
  const b = placesFor(D, s, g).find(x => x.own); assign(D, s, g.id, b.ui, b.at);
  const P0 = parts(D, s, 'growth', { place: `${b.ui}:${b.at}`, synergy: 'speed' });
  assert.ok(P0.some(p => p.source === 'worker' && p.label === 'Moss Hum'));
  const old = (1 + Math.max(0, trophyBonuses(D, s).growth || 0) / 100) * (1 + workerBonus(D, s, 'growth') / 100) * (1 + (P0.find(p => p.source === 'synergy')?.value || 0) / 100);
  assert.ok(Math.abs(modFactor(D, s, 'growth', { place: `${b.ui}:${b.at}`, synergy: 'speed' }) - old) < 1e-9);
  assert.match(modText(P0, 'growth'), /Moss Hum \+\d/);
});
