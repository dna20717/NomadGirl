// #168 G2 the cycle graph before the rooms (engine/cycles.js, welded by engine/poi.js): circles of about 7 rooms with one recipe each,
// keys from the story before their locks, one-way drops never into a dead end, the goal always reachable; all POIs × 8 seeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { planCycles, cycleConfig, RECIPES, CYCLES } from '../engine/cycles.js';
import { auditLevel, reachMap } from '../tools/reach_audit.mjs';
import { SEEDS } from '../tools/level_audit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
const POIS = Object.keys(D.pois).filter(p => poiReady(D, p).ok);
const find = (lay, c) => { const out = []; lay.forEach((r, y) => [...r].forEach((t, x) => { if (t === c) out.push([x, y]); })); return out; };

test('Graph: gleicher Seed = gleicher Plan, Kreise mit etwa 7 Räumen, der letzte ist der äußere', () => {
  for (const p of POIS) {
    const a = planCycles(D, p, 5, { count: 14, stack: D.pois[p].stack || null }), b = planCycles(D, p, 5, { count: 14, stack: D.pois[p].stack || null });
    assert.deepEqual(a, b, p);
    assert.equal(a.circles.length, 2, `${p}: 14 Räume = 2 Kreise`);
    assert.ok(a.circles.at(-1).outer && !a.circles[0].outer);
    assert.equal(a.circles[0].from, 0); assert.equal(a.circles.at(-1).to, 13);
    for (const c of a.circles) assert.ok(RECIPES.some(([k]) => k === c.recipe), c.recipe);
    assert.equal(planCycles(D, p, 5, { count: 5 }).circles.length, 1);
  }
  // the way back of the outer circle closes the plan: goal → start
  const g = planCycles(D, 'tankstelle_km7', 3, { count: 5 });
  assert.ok(g.edges.some(e => e.from === 4 && e.to === 0 && e.route === 'tunnel'));
});

test('Werkstatt-Werte: Räume je Kreis, feste Kreise, Rezepte erlaubt und Gewichte', () => {
  const with_ = cyc => ({ ...D, pois: { ...D.pois, ministerium: { ...D.pois.ministerium, cycles: { ...D.pois.ministerium.cycles, ...cyc } } } });
  assert.equal(planCycles(with_({ rooms: 3 }), 'ministerium', 1, { count: 12 }).circles.length, 4);
  assert.equal(planCycles(with_({ count: 3 }), 'ministerium', 1, { count: 12 }).circles.length, 3);
  for (let s = 1; s <= 20; s++) {
    const only = planCycles(with_({ recipes: [{ recipe: 'dangerReward', weight: 1 }] }), 'ministerium', s, { count: 12 });
    assert.ok(only.circles.every(c => c.recipe === 'dangerReward'));
    const none = planCycles(with_({ recipes: [{ recipe: 'lockKey', weight: 0 }, { recipe: 'doublePath', weight: 2 }] }), 'ministerium', s, { count: 12 });
    assert.ok(none.circles.every(c => c.recipe !== 'lockKey'));
  }
  assert.equal(planCycles(with_({ enabled: false }), 'ministerium', 1, { count: 12 }).circles.length, 0);
  assert.deepEqual(cycleConfig({ pois: { x: {} } }, 'x').weights, CYCLES.weights);
});

test('Schlüssel aus der Story: jeder POI hat ein Requisit, große POIs mehrere Kreise', () => {
  for (const p of POIS) assert.ok(D.pois[p].cycles?.keys?.length, `${p}: Schlüssel`);
  for (const p of ['raketensilo', 'ministerium']) for (const s of SEEDS) assert.ok(buildPoi(D, p, s).graph.circles.length >= 2, `${p} ${s}: mehrere Kreise`);
});

test('alle POIs × 8 Seeds: Kreise, Schloss nach seinem Schlüssel, Einbahn ohne Sackgasse, Ziel erreichbar', () => {
  const seen = new Set();
  for (const p of POIS) for (const s of SEEDS) {
    const L = buildPoi(D, p, s), lay = L.def.layout, G = L.graph, C = L.cycles, at = `${p} Seed ${s}`;
    assert.ok(G.circles.length >= 1, `${at}: kein Kreis`);
    assert.deepEqual(L.problems, [], at);
    assert.deepEqual(C.notes, [], `${at}: Rückfälle`);
    G.slots.forEach((sl, i) => assert.equal(sl.room, L.rooms.filter(r => r.band === 'main')[i].id, `${at}: Platzhalter ${i} aufgelöst`));
    for (const c of G.circles) seen.add(c.recipe);
    // every lock with its key, the key a '+' in the level, reachable while every lock is still shut
    const locks = G.circles.filter(c => c.recipe === 'lockKey');
    assert.equal(C.locks.length, locks.length, `${at}: Schlösser`);
    assert.equal(find(lay, '+').length, C.keys.length, `${at}: Schlüssel im Level`);
    for (const l of C.locks) {
      assert.ok(l.keyAt && lay[l.keyAt[1]][l.keyAt[0]] === '+', `${at}: Schlüssel liegt`);
      for (const [x, y] of l.tiles) assert.equal(lay[y][x], '|');
      const shut = reachMap(lay, { locks: C.locks.map(k => k === l ? { ...k, keyAt: null } : k), links: C.links });
      assert.ok(shut.near(...l.keyAt), `${at}: Schlüssel vor dem Schloss erreichbar`);
    }
    // the reach audit: everything reachable, every lock opens, no one-way into a dead end, the way home from the vault
    assert.deepEqual(auditLevel(L).map(f => `${f.kind} ${f.room}`), [], at);
  }
  assert.ok(seen.size >= 6, `alle sechs Rezepte kommen vor: ${[...seen].join(', ')}`);
});

test('Schloss sperrt wirklich: ohne Schlüssel kein Ziel (Rückweg nicht offen)', () => {
  let n = 0;
  for (const p of POIS) for (const s of SEEDS) {
    const L = buildPoi(D, p, s), C = L.cycles, outer = L.graph.circles.at(-1);
    if (!C.locks.length || ['doublePath', 'dangerReward'].includes(outer.recipe) || L.graph.circles.length > 1) continue;
    const lay = L.def.layout, z = find(lay, 'Z')[0];
    const noKey = reachMap(lay, { locks: C.locks.map(l => ({ ...l, keyAt: null })), links: C.links });
    assert.ok(!noKey.near(...z), `${p} ${s}: Ziel ohne Schlüssel erreichbar`);
    n++;
  }
  assert.ok(n >= 10, `${n} Level mit Schloss geprüft`);
});

test('Einbahn hinunter: kein Weg zurück nach oben, unten geht es weiter', () => {
  let n = 0;
  for (const p of POIS) for (const s of SEEDS) {
    const L = buildPoi(D, p, s), C = L.cycles;
    for (const o of C.oneWays) {
      const lay = L.def.layout, opts = { locks: C.locks.map(l => ({ ...l })), links: C.links };
      const up = reachMap(lay, { ...opts, start: o.land, keysHeld: C.locks.map((_, i) => i) });
      // from the landing she never stands at the top of the drop again by the same hole (the way up, if any, is around)
      assert.ok(!(lay[o.from[1] + 1]?.[o.from[0]] === 'H'), `${p} ${s}: Leiter im Einbahn-Loch`);
      assert.ok(find(lay, 'Z').some(z => up.near(...z)) || find(lay, 'L').some(l => up.near(...l)), `${p} ${s}: Sackgasse nach der Einbahn`);
      n++;
    }
  }
  assert.ok(n >= 5, `${n} Einbahnen geprüft`);
});
