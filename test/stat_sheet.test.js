// Werte-Bildschirm (#091): every value with its sources, the same sums the game uses (Boni-Bus)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { statSheet, valueText } from '../game/stat_sheet.js';
import { gearTotals, mod } from '../game/mods.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Leyla: Ausrüstung mit Quellen, Summe wie gearTotals, Malus rot', () => {
  const save = newSave(D);
  (save.inv ??= {}).wear = { ...(save.inv.wear || {}), armor: 'plattentraeger', head: 'gasmaske' };
  const S = statSheet(D, save), G = gearTotals(D, save);
  const def = S.leyla.find(r => r.stat === 'defense');
  assert.ok(def.parts.some(p => p.label === 'Plattenträger' || /Platten/.test(p.label)) && def.parts.some(p => /maske/i.test(p.label)));
  for (const r of S.leyla) if (r.parts.every(p => p.source !== 'buff')) assert.equal(r.total, Math.round(G[r.stat] * 10) / 10, r.stat);
  const spd = S.leyla.find(r => r.stat === 'speed');
  assert.ok(spd && spd.total < 0 && !spd.good, 'Tempo −3 ist ein Malus');
});
test('Buffs stehen als „nächster Run“ dabei', () => {
  const save = newSave(D); save.buffs = ['satt'];
  const r = statSheet(D, save).leyla.find(x => x.stat === 'health');
  assert.ok(r.parts.some(p => p.source === 'buff' && /nächster Run/.test(p.label) && p.value === 20));
});
test('Camp: gleiche Zahlen wie der Boni-Bus', () => {
  const save = newSave(D), S = statSheet(D, save);
  for (const r of S.camp) assert.equal(r.total, Math.round(mod(D, save, r.stat) * 10) / 10);
  assert.equal(valueText(12, '%'), '+12 %'); assert.equal(valueText(-1.5, '%'), '−1,5 %'); assert.equal(valueText(10, ' LP'), '+10 LP');
});
