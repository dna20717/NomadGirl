// Synergies of neighbouring workshops (#033, game/synergy.js): score = matching neighbour places / neighbour places, like
// Civilization or Dorfromantik; across container borders and stacks; on the mega grid; effects on time, power and buffs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { synergies, synergyAt, speedOf, links, cells } from '../game/synergy.js';
import { budgets } from '../game/rig.js';
import { activate } from '../game/mega.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const rigWith = (...units) => { const s = newSave(D); s.rig.units = [s.rig.units[0], ...units.map(([id, ws]) => ({ kind: 'container', id, workshops: ws.map(([w, at]) => ({ id: w, at })) }))]; return s; };

test('Werkbank allein: keine passenden Nachbarn, kein Bonus', () => {
  const s = rigWith(['container_40', [['werkbank', 0]]]);
  const x = synergyAt(D, s, '1:0');
  assert.equal(x.near, 0);
  assert.equal(x.bonus, 0);
  assert.equal(x.avail, 1);   // only the free place to its right counts (no places outside the rig)
});

test('Alle angrenzenden Plätze passend = voller Bonus, teilweise = anteilig', () => {
  const full = rigWith(['container_40', [['generator', 0], ['werkbank', 1], ['reaktor', 2]]]);
  assert.equal(synergyAt(D, full, '1:1').score, 1);
  assert.equal(synergyAt(D, full, '1:1').bonus, D.workshops.werkbank.synergy.max);
  const half = rigWith(['container_40', [['generator', 0], ['werkbank', 1], ['lagerregal', 2]]]);
  assert.equal(synergyAt(D, half, '1:1').score, 0.5);
  assert.equal(speedOf(D, half, 'werkbank'), D.workshops.werkbank.synergy.max / 2);
});

test('Nachbarn über die Containergrenze und im Stapel', () => {
  // two ground containers side by side: the first one's place 0 touches the second one's last place
  const s = rigWith(['container_10', [['werkbank', 0]]], ['container_10', [['generator', 0]]]);
  assert.equal(synergyAt(D, s, '1:0').near, 1);
  const st = rigWith(['container_10', [['werkbank', 0]]]);
  st.rig.units.push({ kind: 'container', id: 'container_10', level: 1, workshops: [{ id: 'reaktor', at: 0 }] });
  st.rig.units[2].id = 'container_20'; st.rig.units[2].workshops = [{ id: 'reaktor', at: 0 }];
  const C = cells(D, st.rig);
  assert.ok([...C.values()].some(c => c.ui === 2 && c.y === 1));
  assert.ok(synergyAt(D, st, '1:0').near >= 1);
});

test('Strom-Synergie zählt im Budget, Links zwischen Partnern', () => {
  const a = rigWith(['container_40', [['generator', 0], ['motorraum', 1]]]), b = rigWith(['container_40', [['generator', 0]]]);
  assert.ok(budgets(D, a.rig).power.made > budgets(D, b.rig).power.made - (D.workshops.motorraum.power > 0 ? 0 : 0));
  assert.equal(links(D, a).length, 1);
});

test('Mega-Rig: Nachbarn auf dem Raster, auch darüber', () => {
  const s = rigWith(['container_10', [['werkbank', 0]]], ['container_10', [['generator', 0]]]);
  s.megarigs = ['crawler'];
  activate(D, s, 'crawler');
  const [w, g] = [s.rig.units[1], s.rig.units[2]];
  w.pos = { place: 0, story: 0 }; g.pos = { place: 0, story: 1 };
  assert.equal(synergyAt(D, s, '1:0').near, 1);
});

test('Reihenschaltung: gleiche Werkstätten nebeneinander, ganzer Container = dicker Bonus (#034)', () => {
  const S = D.workshops.hydrokultur.synergy;
  const one = rigWith(['container_40', [['hydrokultur', 0]]]);
  assert.equal(synergyAt(D, one, '1:0').chain, 1);
  const two = rigWith(['container_40', [['hydrokultur', 0], ['hydrokultur', 1]]]);
  const t = synergyAt(D, two, '1:0');
  assert.equal(t.chain, 2); assert.equal(t.full, false);
  assert.equal(t.chainBonus, S.chain);
  const all = rigWith(['container_40', [['hydrokultur', 0], ['hydrokultur', 1], ['hydrokultur', 2]]]);
  const a = synergyAt(D, all, '1:1');
  assert.equal(a.chain, 3); assert.equal(a.full, true);
  assert.equal(a.chainBonus, S.chain * 2 + S.full);
  // the row goes on across the container border
  const across = rigWith(['container_10', [['hydrokultur', 0]]], ['container_10', [['hydrokultur', 0]]]);
  assert.equal(synergyAt(D, across, '1:0').chain, 2);
});

// #076 Gegenpaare (Daniel 19.11.2026): a noisy neighbour pulls the bonus down, into the minus; the link is drawn red
import { synergyText } from '../game/synergy.js';
test('Gegenpaare: Generator neben der Schlafkoje senkt den Buff, beide Seiten laut = Minus, rote Verbindung', () => {
  const both = rigWith(['container_40', [['generator', 0], ['schlafkoje', 1], ['reaktor', 2]]]);
  const x = synergyAt(D, both, '1:1');
  assert.equal(x.bad, 2); assert.equal(x.score, -1);
  assert.equal(x.bonus, -D.workshops.schlafkoje.synergy.max);
  assert.match(synergyText(x), /stört 2\/2 · Buff −30 %/);
  const mixed = rigWith(['container_40', [['generator', 0], ['schlafkoje', 1], ['chill_area', 2]]]);
  assert.equal(synergyAt(D, mixed, '1:1').score, 0);   // one friend, one foe
  assert.ok(links(D, both).some(l => l.foe), 'rote Linie');
  assert.ok(links(D, mixed).some(l => !l.foe), 'die Freunde bleiben türkis');
  const slow = rigWith(['container_40', [['zelle', 0], ['kochnische', 1], ['heavy_duty', 2]]]);
  assert.ok(synergyAt(D, slow, '1:1').bonus < 0, 'Kochen wird langsamer');
  assert.match(synergyText(synergyAt(D, slow, '1:1')), /langsamer/);
});
