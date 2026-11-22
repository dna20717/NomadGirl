// #173 Schacht-Motiv (engine/shaft.js): the rocket of Silo Zero stands in a column through the whole stack. Silo × 8 seeds: the column
// lies in the level, the motif reaches from under the yard to the floor of the Wow room, only air shows the shaft (walls and collision
// stay), most rooms see it, the landmark counts it, the segments stack top to bottom; other POIs stay without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi } from '../engine/poi.js';
import { shaftConfig, shaftInLevel, stackSegments } from '../engine/shaft.js';
import { landmarkViews } from '../engine/level_design.js';

const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
const D = p.data, SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];
const WALL = new Set(['#', 'A', '^', 'v', '%', '$', 'B']);

test('Silo Zero: Rakete vom ersten Innenraum bis zum Boden des Wow-Raums, nur Luft öffnet sich', () => {
  for (const seed of SEEDS) {
    const L = buildPoi(D, 'raketensilo', seed), sh = shaftInLevel(D, 'raketensilo', L), lay = L.def.layout;
    assert.ok(sh, `Seed ${seed}: kein Schacht`);
    const [W] = L.def.size;
    assert.ok(sh.x0 >= 1 && sh.x0 + sh.w <= W - 1, `Seed ${seed}: Säule im Level`);
    const yard = L.rooms[0];
    assert.equal(sh.top, yard.y + yard.h + 1, `Seed ${seed}: Spitze unter dem Hof`);
    const wow = L.rooms.find(r => r.wow);
    assert.equal(sh.foot, wow.y + wow.h - 1, `Seed ${seed}: Fuß auf dem Boden des Wow-Raums`);
    for (const c of sh.cells) { const [x, y] = c.split(',').map(Number); assert.ok(!WALL.has(lay[y][x]), `Seed ${seed}: ${c} ist Wand`); }
    // most main rooms under the yard see the hull (the rooms hang centred under each other)
    const mains = L.rooms.filter(r => r.band === 'main' && r.y >= sh.top - 1);
    const seen = mains.filter(r => { for (let x = sh.body[0]; x < sh.body[0] + sh.body[1]; x++) for (let y = r.y; y < r.y + r.h; y++) if (sh.cells.has(x + ',' + y)) return true; return false; });
    assert.ok(seen.length >= mains.length * 0.8, `Seed ${seed}: nur ${seen.length}/${mains.length} Räume sehen die Rakete`);
    // the landmark: every crossed room counts as seeing it, without a window
    const views = landmarkViews(D, 'raketensilo', L);
    for (const o of sh.rooms) assert.equal(views[o.room].how, 'shaft', `Seed ${seed}: Raum ${o.room}`);
    assert.ok(sh.trench.length >= 1, `Seed ${seed}: Flammengraben im Raum darunter`);
  }
});

test('Schacht-Motiv: Segmente von oben nach unten, Ringe im Takt, deterministisch', () => {
  const L = buildPoi(D, 'raketensilo', 1), sh = shaftInLevel(D, 'raketensilo', L);
  const h = { nose: 19, body: 9, ring: 8.5, engine: 23 }, segH = g => h[g.part];
  const plan = stackSegments(sh, segH);
  assert.equal(plan[0].part, 'nose'); assert.equal(plan.at(-1).part, 'engine');
  assert.equal(plan[0].y, sh.top);
  assert.ok(Math.abs(plan.at(-1).y + plan.at(-1).h - sh.foot) < 0.01, 'Heck endet am Fuß');
  for (let i = 1; i < plan.length; i++) assert.ok(Math.abs(plan[i].y - (plan[i - 1].y + plan[i - 1].h)) < 0.01, `lückenlos bei ${i}`);
  assert.ok(plan.filter(q => q.part === 'ring').length >= 3, 'Stufen-Ringe');
  assert.equal(plan[1].image, 'rocket_body_stripes', 'die erste Stufe beginnt mit ihrem Band');
  assert.deepEqual(stackSegments(sh, segH), plan);
  for (const s of D.pois.raketensilo.shaft.segments) assert.ok(D.assets[s.image]?.file, s.image);
});

test('Schacht-Motiv nur, wo es an ist; Ausrichten ändert nichts an Erreichbarkeit-relevanten Würfeln', () => {
  for (const [id, P] of Object.entries(D.pois)) if (id !== 'raketensilo') assert.equal(shaftConfig(P), null, id);
  assert.equal(shaftConfig({ shaft: { on: true } }), null, 'nebeneinander: aus');
  // aligned or not, the same rooms in the same order (only x and mirroring move)
  const off = { ...D, pois: { ...D.pois, raketensilo: { ...D.pois.raketensilo, shaft: { ...D.pois.raketensilo.shaft, align: false } } } };
  for (const seed of SEEDS) {
    const a = buildPoi(D, 'raketensilo', seed), b = buildPoi(off, 'raketensilo', seed);
    assert.deepEqual(a.rooms.filter(r => r.band === 'main').map(r => r.id), b.rooms.filter(r => r.band === 'main').map(r => r.id), `Seed ${seed}`);
  }
});
