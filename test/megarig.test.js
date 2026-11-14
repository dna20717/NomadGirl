// Mega rigs (#022, engine/megarig.js): grid of places, stages, rooms in the hull, add-ons, reachability.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMegarig, megarigProblems, reach } from '../engine/megarig.js';
import { parseRoom } from '../engine/room.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Alle drei Fahrzeuge bauen sich in jeder Ausbaustufe ohne Probleme', () => {
  for (const id of ['lkw', 'crawler', 'fatbird']) {
    assert.ok(D.megarigs[id], id);
    assert.deepEqual(megarigProblems(D, id), [], id);
    for (let i = 0; i < D.megarigs[id].stages.length; i++) {
      const b = buildMegarig(D, id, i), r = parseRoom({ layout: b.layout });
      assert.equal(r.problems.filter(p => p[0] === 'error').length, 0, `${id} ${i}`);
      assert.ok(r.start, 'Leylas Start');
      assert.ok(b.pieces.filter(p => p.type === 'container' || p.type === 'room').every(p => p.reachable), `${id} ${i}: alles erreichbar`);
    }
  }
});

test('Ausbaustufen: Crawler wird länger und höher, Fatbird bleibt gleich groß (voll ist voll)', () => {
  const c = [0, 1, 2].map(i => buildMegarig(D, 'crawler', i));
  assert.ok(c[0].len < c[1].len && c[1].len < c[2].len);
  assert.ok(c[0].stories < c[2].stories);
  const mods = b => b.pieces.filter(p => p.type === 'container' || p.type === 'room').length;
  assert.ok(mods(c[0]) < mods(c[2]));
  const f = [0, 2].map(i => buildMegarig(D, 'fatbird', i));
  assert.equal(f[0].len, f[1].len);
  assert.ok(mods(f[0]) < mods(f[1]));
});

test('Platz-Raster: ein Modul belegt n × Platz Kacheln, Räume im Rumpf sind Container ohne Außenhaut', () => {
  const b = buildMegarig(D, 'crawler');
  const room = b.pieces.find(p => p.type === 'room');
  assert.equal(room.inside, true);
  assert.equal(room.w, D.containers[room.container].places * b.P);
  const box = b.pieces.find(p => p.type === 'container' && p.story === 2);
  assert.equal(box.inside, false);
  assert.equal((box.x - b.x0 - D.megarigs.crawler.hull.front) % b.P, 0);
  // the hull around a room is solid, the room itself is cut free
  const r = parseRoom({ layout: b.layout });
  assert.equal(r.tiles[room.floorRow - 2][room.x + 3], '.');
  assert.equal(r.tiles[room.floorRow][room.x + 3], '#');
});

test('Erreichbarkeit: ein Container ohne Unterbau wird gemeldet', () => {
  const data = JSON.parse(JSON.stringify(D));
  data.megarigs.crawler.modules.push({ container: 'container_10', place: 7, story: 4, from: 0 });   // story 4 over an empty place 7 (story 3)
  const b = buildMegarig(data, 'crawler', 2);
  assert.ok(b.problems.some(([k, t]) => k === 'warning' && /nicht erreichbar|keinen Weg/.test(t)), JSON.stringify(b.problems));
});

test('reach(): Leiter hoch, durch Plattform runter, Sprung bis 2 Kacheln', () => {
  const rows = ['.....', '..=..', '.....', '..H..', '..H..', '#####'].map(r => r.split(''));
  const seen = reach(rows, [0, 4]);
  assert.ok(seen.has('2,0'), 'auf der Plattform über der Leiter');
  const high = ['.....', '.###.', '.....', '.....', '.....', '#####'].map(r => r.split(''));
  assert.ok(!reach(high, [0, 4]).has('2,0'), 'zu hoch ohne Leiter');
});

test('Anbauteile: Bild-Ausschnitte aus dem LKW-Blatt, kletterbare Teile haben oben eine Plattform', () => {
  for (const [id, a] of Object.entries(D.rigAddons)) if (a.look) { assert.equal(a.look, 'truck_parts', id); assert.equal(a.crop.size.length, 2, id); }
  const b = buildMegarig(D, 'lkw'), mast = b.pieces.find(p => p.type === 'addon' && p.id === 'mast');
  const r = parseRoom({ layout: b.layout }), top = mast.base - mast.h;
  assert.equal(r.tiles[Math.round(top)][Math.round(mast.cx)], 'H');
  assert.ok(r.tiles[Math.round(top)].join('').includes('=H') || r.tiles[Math.round(top)].join('').includes('H='));
});
