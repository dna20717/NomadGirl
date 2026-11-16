// Lore › Marken (#045, game/brands.js): one source for the travel map, makers of implants and hair dyes, their Spielwerte work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBrands, valueOf, lootOf } from '../game/brands.js';
import { gearStats, rollLoot } from '../game/inventory.js';
import { mapConfig } from '../game/worldmap.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Reisekarte holt ihre Marken aus Lore › Marken (die acht von vorher, gleiche IDs)', () => {
  const ids = mapConfig(D).brands.map(b => b.id);
  for (const id of ['delta_petrol', 'neon_nudel', 'kessler', 'atomcola', 'motel_salzsee', 'ordnungsamt', 'kraehe', 'kilometerkoenig']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('chroma_kill'), 'Haarfarben-Marken stehen nicht auf der Karte');
  assert.ok(mapBrands(D).every(b => b.short && b.slogan && b.color));
  assert.equal(D.worldmap.brands, undefined, 'keine zweite Liste mehr');
});

test('Jedes Implantat und jedes Färbemittel hat einen Hersteller aus der Datenbank', () => {
  for (const [id, t] of Object.entries(D.items)) if (t.category === 'implant' || id.startsWith('faerbemittel_')) assert.ok(D.brands[t.brand], `${id}: ${t.brand}`);
  for (const c of D.leyla.signature.colors) assert.ok(D.brands[c.brand], c.name);
  const makers = new Set(Object.values(D.items).filter(t => t.category === 'implant').map(t => t.brand));
  assert.ok(makers.size >= 5, [...makers].join());
});

test('Qualität wirkt auf die Boni, nicht auf die Nachteile', () => {
  const t = D.items.tunnelblick_optik, q = 1 + (D.brands[t.brand].quality || 0) / 100, st = gearStats(D, { eyes: 'tunnelblick_optik' });
  assert.equal(st.ranged, Math.round(t.stats.ranged * q * 10) / 10);
  assert.equal(st.defense, t.stats.defense, 'Nachteil bleibt');
  const D2 = { ...D, brands: { ...D.brands, [t.brand]: { ...D.brands[t.brand], quality: 0 } } };
  assert.equal(gearStats(D2, { eyes: 'tunnelblick_optik' }).ranged, t.stats.ranged);
});

test('Tooltip-Werte = wirkende Werte (Qualität auf die Boni), jede Marke hat ein Logo im Raster (#046)', async () => {
  const { brandStats } = await import('../game/inventory.js');
  const t = D.items.herzpumpe, st = brandStats(D, t), q = 1 + D.brands[t.brand].quality / 100;
  assert.equal(st.health, Math.round(t.stats.health * q * 10) / 10);
  const L = D.assets[D.worldmap.logos], cells = L.grid[0] * L.grid[1];
  for (const [id, b] of Object.entries(D.brands)) assert.ok(b.icon != null && b.icon < cells, id);
  assert.equal(new Set(Object.values(D.brands).map(b => b.icon)).size, Object.keys(D.brands).length, 'jedes Logo nur einmal');
});

test('Jede Waffe hat einen Hersteller; Qualität wirkt auf den Schaden (Daniel, 16.11.2026)', async () => {
  const { brandWeapon } = await import('../game/brands.js');
  for (const [id, w] of Object.entries(D.weapons)) assert.ok(D.brands[w.brand], id);
  const w = D.weapons.schrotflinte, q = 1 + D.brands[w.brand].quality / 100;
  assert.equal(brandWeapon(D, w).damage, Math.max(1, Math.round(w.damage * q)));
  assert.equal(brandWeapon(D, D.weapons.bastlerdeck).damage, D.weapons.bastlerdeck.damage, 'ohne Schaden bleibt alles');
});

test('Preis und Beute: Faktoren der Marke', () => {
  const t = D.items.billig_kameraauge, b = D.brands[t.brand];
  assert.equal(valueOf(D, t), Math.round(t.value * b.price / 100));
  assert.equal(lootOf(D, t), b.loot / 100);
  // a table with only this implant at 0 % loot: nothing falls
  const D3 = { ...D, brands: { ...D.brands, [t.brand]: { ...b, loot: 0 } }, lootTables: { test: { rolls: [3, 3], entries: [{ item: 'billig_kameraauge', weight: 5 }, { item: 'schrott', weight: 1 }] } } };
  for (let i = 0; i < 20; i++) assert.ok(rollLoot(D3, 'test').every(e => e.id === 'schrott'));
});
