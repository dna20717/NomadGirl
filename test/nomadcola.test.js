// NomadCola (Daniel, 17.11.2026: „eine der elementaren Brands“; Produkte als Gegenstände und als Deko/Clutter, Kronkorken keine Währung):
// the drink and the empty can from the icon sheet, in the loot of gas stations; the machines as Deko and as Marken-Clutter at the gas station.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { DECOR_ARTS } from '../game/decor.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data, names = D.assets.icons_nomadcola.names;
test('Gegenstände: NomadCola (Buff), leere Dose, Kronkorken mit Bild und Marke; in der Tankstellen-Beute', () => {
  for (const id of ['nomadcola', 'leere_dose', 'kronkorken']) { const t = D.items[id]; assert.equal(t.look, 'icons_nomadcola', id); assert.equal(t.brand, 'nomadcola', id); assert.ok(t.icon < names.length, id); }
  assert.ok(D.buffs[D.items.nomadcola.buff]);
  assert.equal(D.items.kronkorken.value, 0, 'Kronkorken sind keine Währung');
  const loot = D.lootTables.kiste_tankstelle.entries.map(e => e.item);
  assert.ok(loot.includes('nomadcola') && loot.includes('leere_dose'));
});
test('Automaten als Deko (Bild aus dem Symbol-Raster) und als Marken-Clutter der Tankstelle', () => {
  assert.ok(DECOR_ARTS.some(([k]) => k === 'icon'));
  for (const id of ['cola_automat', 'cola_automat_retro', 'cola_automat_rost', 'cola_kuehlbox', 'cola_kiste']) { const d = D.decor[id]; assert.equal(d.art, 'icon'); assert.ok(d.icon < names.length, id); }
  const rows = D.pois.tankstelle_km7.brandProps;
  assert.ok(rows.some(r => /Automat/.test(r.name)));
  for (const r of rows) assert.ok(D.assets[r.look].names.includes(r.name), r.name);
});
