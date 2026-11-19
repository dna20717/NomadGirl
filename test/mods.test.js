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

// #076 Ausrüstung + Tank im Bus: dieselben Summen wie vorher (scene.applyGear, techtree.bonuses), jede Quelle mit Namen
import { gearParts, gearTotals, tankParts } from '../game/mods.js';
import { gearStats, GEAR_KEYS } from '../game/inventory.js';
import { implantBoosts } from '../game/stations.js';
import { bonuses as treeBonuses } from '../game/techtree.js';
import { brandSets } from '../game/brand_perks.js';
function oldGear(s) {   // the sum scene.applyGear built before #076
  const g = { ...gearStats(D, s.inv?.wear, implantBoosts(D, s)) };
  const b = treeBonuses(D, s); for (const k of GEAR_KEYS) if (b[k] && k !== 'tankDecay' && k !== 'droneBattery') g[k] = (g[k] || 0) + b[k];   // #110 every Leyla value from the tree
  const t = trophyBonuses(D, s); for (const k of GEAR_KEYS) if (t[k] && k !== 'tankDecay' && k !== 'droneBattery') g[k] = (g[k] || 0) + t[k];
  const m = brandSets(D, s).stats; for (const k of GEAR_KEYS) if (m[k]) g[k] = (g[k] || 0) + m[k];
  return g;
}
test('Ausrüstung im Bus: gleiche Werte wie applyGear, jede Quelle benannt', () => {
  const s = rig();
  const wearable = Object.entries(D.items).filter(([, t]) => t.wear);
  const bySlot = {}; for (const [id, t] of wearable) bySlot[t.wear] ??= id;
  s.inv.wear = { ...s.inv.wear, ...bySlot };
  s.nodes = Object.keys(D.techtree).filter(id => (D.techtree[id].bonus || []).some(b => ['health', 'damage'].includes(b.stat))).slice(0, 3);
  const old = oldGear(s), now = gearTotals(D, s);
  for (const k of GEAR_KEYS) assert.ok(Math.abs((old[k] || 0) - (now[k] || 0)) < 0.051, `${k}: ${old[k]} vs ${now[k]}`);
  assert.equal(now.strain, old.strain);
  const P = gearParts(D, s), labels = Object.values(P).flat().map(p => p.label);
  assert.ok(labels.includes(D.items[bySlot.armor].name), 'die Rüstung steht mit Namen drin');
  if (s.nodes.length) assert.ok(Object.values(P).flat().some(p => p.source === 'techtree'));
});
test('Tank im Bus: Quellen summieren sich zu techtree.bonuses', () => {
  const s = rig();
  s.nodes = Object.keys(D.techtree).filter(id => (D.techtree[id].bonus || []).some(b => /^tank/.test(b.stat))).slice(0, 4);
  const T = tankParts(D, s), B = treeBonuses(D, s);
  for (const [stat, list] of Object.entries(T)) assert.equal(list.reduce((n, p) => n + p.value, 0), B[stat]);
  assert.ok(Object.keys(T).length > 0);
});
