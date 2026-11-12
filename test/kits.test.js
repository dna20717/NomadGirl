// Raider-Bausatz (#004): Daten des Bausatzes, Waffen „In der Hand“, Waffen in der Beute, Farbtausch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollLoot } from '../game/inventory.js';
import { swapper, weaponClass, kitAssets } from '../game/play/enemy_kit.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Bausatz Raider: jede Waffenklasse hat Alarm, Gehen, Rennen, Ducken, Angriff, Treffer; Tod für alle', () => {
  const K = D.kits.raider;
  for (const c of ['light', 'heavy', 'pistol', 'long'])
    for (const s of ['alert', 'walk', 'run', 'crouch', 'attack', 'hit'])
      assert.ok(K.poses.some(p => p.class === c && p.state === s && D.assets[p.look]?.kind === 'animation'), `${c}/${s}`);
  assert.ok(K.poses.some(p => p.class === 'any' && p.state === 'death'));
  // every frame of a weapon class knows grip and angle (the weapon is set there)
  for (const p of K.poses.filter(p => p.class !== 'any')) {
    const a = D.assets[p.look];
    assert.equal(a.layers.length, a.frames, p.look);
    assert.ok(a.layers.every(l => l.grip && Number.isFinite(l.angle) && l.head), p.look);
  }
  assert.ok(K.heads.length >= 5 && K.heads.every(h => D.assets[h.look]?.kind === 'image'));
});

test('Raider-Waffen: Leyla könnte sie benutzen (Art, Werte, Symbol, Größe, Zerlegen) und der Bausatz weiß, wie man sie hält', () => {
  for (const id of ['machete', 'nagelkeule', 'rohrhammer', 'nagelpistole', 'rohrpistole', 'schrotflinte', 'sturmgewehr']) {
    const w = D.weapons[id];
    assert.ok(['melee', 'ranged'].includes(w.kind) && w.damage > 0 && w.cooldown > 0 && w.size && w.value, id);
    assert.ok(w.look && Number.isInteger(w.icon), `${id}: Symbol`);
    assert.ok(w.salvage?.length, `${id}: Zerlegen`);
    assert.ok(w.held?.class && w.held.grip && w.held.tip && w.held.cm, `${id}: In der Hand`);
    if (w.kind === 'ranged') assert.ok(w.magazine && w.ammo && w.projectileSpeed, `${id}: Magazin, Munition`);
  }
  assert.equal(weaponClass(D.weapons.rohrhammer), 'heavy');
  assert.equal(weaponClass(D.weapons.sturmgewehr), 'long');
  assert.equal(weaponClass(D.weapons.karambit), 'light');   // without "In der Hand": from the kind
  assert.equal(D.weapons.rohrhammer.hands, 2);
});

test('Beutetabellen können Waffen enthalten', () => {
  const T = { lootTables: { t: { rolls: [3, 3], entries: [{ weapon: 'nagelkeule', weight: 1 }] } }, weapons: D.weapons, items: D.items };
  const out = rollLoot(T, 't', () => 0.1);
  assert.deepEqual(out, [{ a: 'weapons', id: 'nagelkeule', n: 1 }, { a: 'weapons', id: 'nagelkeule', n: 1 }, { a: 'weapons', id: 'nagelkeule', n: 1 }]);
  assert.ok(D.lootTables.pluenderer_beute.entries.some(e => e.weapon === 'rohrpistole'));
});

test('Farbtausch: Haut und Gang-Farbe wechseln, Taschen und Leder bleiben', () => {
  const K = D.kits.raider, to = { skin: '#55342a', gang: '#20d6c7' };
  const swap = swapper(K.swaps.map(r => ({ ...r, to: to[r.group] })));
  const skin = swap(214, 150, 110), magenta = swap(160, 30, 120), pouch = swap(70, 52, 38), black = swap(30, 28, 34);
  assert.ok(skin && skin[0] < 150, `Haut dunkler: ${skin}`);
  assert.ok(magenta && magenta[1] > magenta[0], `Magenta wird Cyan: ${magenta}`);
  assert.equal(pouch, null); assert.equal(black, null);
});

test('Laden: der Bausatz lädt nur die Animationen der Waffenklasse, dazu Kopf, Waffenbild, Hände', () => {
  const { ids, extra } = kitAssets(D, [D.enemies.brecher]);
  assert.ok([...ids].every(id => !id.startsWith('raider_pistol')));
  assert.ok(ids.has('raider_heavy_attack') && ids.has('raider_none_death') && ids.has('raider_head_gasmask') && ids.has('icons_raider_weapons'));
  assert.ok(extra.some(([k]) => k === 'raider_heavy_attack#hands'));
});
