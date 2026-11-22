// Hüllen G4 (#171): the building grammar around the welded rooms (engine/facade.js). Every POI × 8 seeds: the hull lies only on wall
// tiles and never opens a room, windows sit whole on the grid of their building (facade, back walls, landmark windows), the hull leaves
// collision and reachability alone, it is deterministic, and the skyline comes from the same grammar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi } from '../engine/poi.js';
import { solidRects, parseRoom } from '../engine/room.js';
import { planHull, hullAudit, hullConfig, hullWindowSpot, skylinePlan } from '../engine/facade.js';
import { landmarkViews } from '../engine/level_design.js';

const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
const D = p.data, SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];
const indoor = id => { const r = D.rooms[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };

test('jeder POI hat einen Gebäudetyp, die Hülle ist an', () => {
  for (const [id, P] of Object.entries(D.pois)) {
    assert.ok(D.hulls[P.hull?.type], `${id}: Gebäudetyp ${P.hull?.type}`);
    assert.ok(hullConfig(D, id).on, `${id}: Hülle an`);
  }
});

test('Hülle umschließt alle Innenräume, liegt nie auf Spielfläche, Fenster konsistent (alle POIs × 8 Seeds)', () => {
  for (const id of Object.keys(D.pois)) for (const seed of SEEDS) {
    const L = buildPoi(D, id, seed); if (!L.def) continue;
    const plan = planHull(D, id, L), lw = landmarkViews(D, id, L).filter(v => v.win).map(v => ({ room: v.room, win: v.win }));
    const f = hullAudit(D, id, L, plan, lw);
    assert.deepEqual(f, [], `${id} Seed ${seed}: ${f.slice(0, 3).map(x => x.text).join(' | ')}`);
    // every indoor room: no tile of its box border that is air … and every wall tile touching its air stays drawn (shell)
    const W = plan.W;
    for (const r of L.rooms) if (indoor(r.id)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (L.def.layout[y][x] === '#') continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(plan.cls[(y + dy) * W + x + dx] || 0, 0, `${id}/${seed}: Hülle an der Luft von ${r.id} (${x + dx},${y + dy})`);
    }
  }
});

test('Fenster der Fassade und der Räume liegen im selben Raster, Landmarken-Fenster auch', () => {
  let facade = 0, rooms = 0, land = 0;
  for (const id of Object.keys(D.pois)) for (const seed of SEEDS.slice(0, 4)) {
    const L = buildPoi(D, id, seed), plan = planHull(D, id, L);
    for (const w of plan.windows) {
      const b = plan.buildings[w.b];
      assert.ok(b.grid.rows.includes(w.y) && b.grid.axes.includes(w.x), `${id}: Fenster ${w.x},${w.y} im Raster`);
      if (w.where === 'facade') facade++; else { rooms++; assert.ok(indoor(L.rooms[w.room].id), `${id}: Raumfenster nur drinnen`); }
    }
    for (const v of landmarkViews(D, id, L)) if (v.win) {
      const b = plan.buildings.find(o => o.grid && o.rooms.includes(v.room));
      if (b) { land++; assert.ok(b.grid.rows.includes(v.win.y) && b.grid.axes.includes(v.win.x), `${id}/${seed}: Landmarken-Fenster im Raster`); }
    }
  }
  assert.ok(facade > 100 && rooms > 20 && land > 5, `Fenster: Fassade ${facade}, Räume ${rooms}, Landmarke ${land}`);
});

test('keine Kollision dazu, Erreichbarkeit unverändert: das Level bleibt Kachel für Kachel gleich', () => {
  for (const id of ['tankstelle_km7', 'delta_heights', 'bunker_13', 'metro_line4']) {
    const L = buildPoi(D, id, 3), before = JSON.stringify(solidRects(parseRoom(L.def)));
    planHull(D, id, L);
    assert.equal(JSON.stringify(solidRects(parseRoom(L.def))), before, id);
    assert.equal(L.def.layout.join('\n'), buildPoi(D, id, 3).def.layout.join('\n'), `${id}: Layout unverändert`);
  }
});

test('deterministisch: gleicher Seed, gleiche Hülle; anderer Seed, andere', () => {
  for (const id of ['grossmarkt', 'ministerium', 'delta_crude']) {
    const a = planHull(D, id, buildPoi(D, id, 5)), b = planHull(D, id, buildPoi(D, id, 5)), c = planHull(D, id, buildPoi(D, id, 8));
    assert.deepEqual([...a.cls], [...b.cls]); assert.deepEqual(a.parts, b.parts); assert.deepEqual(a.windows, b.windows);
    assert.notDeepEqual(JSON.stringify(a.parts), JSON.stringify(c.parts), `${id}: Seeds unterscheiden sich`);
  }
});

test('Grammatik je Gebäudetyp: Dach, Sockel, Kuppel, Erdhügel, Gittermast, Oberfläche, Schäden nach Verfall', () => {
  const kinds = id => { const pl = planHull(D, id, buildPoi(D, id, 1)); return { pl, k: new Set(pl.parts.map(q => q.roof || q.kind)) }; };
  assert.ok(kinds('grossmarkt').k.has('dome'), 'Mall: Kuppel über dem Wow-Raum');
  assert.ok(kinds('ministerium').k.has('gable') && kinds('ministerium').k.has('base'), 'Ministerium: Giebel, Sockel');
  assert.ok(kinds('delta_heights').k.has('fire'), 'Hochhaus: Feuertreppe');
  const bunker = kinds('bunker_13').pl; assert.ok(bunker.cls.includes(4) && bunker.parts.some(q => q.kind === 'portal'), 'Bunker: Erdhügel und Portal');
  assert.ok(kinds('funkmast_km31').k.has('lattice'), 'Funkmast: Gitter');
  for (const id of ['metro_line4', 'pit6', 'raketensilo', 'storm_drain9']) assert.ok(kinds(id).k.has('surface'), `${id}: Aufbauten über der Straße`);
  assert.ok(kinds('delta_crude').k.has('plant'), 'Raffinerie: Anlage');
  // decay: more damage on the facade with more Verfall
  const L = buildPoi(D, 'ministerium', 2), dmg = d => planHull(D, 'ministerium', L, { decay: d }).parts.filter(q => q.kind === 'crack' || q.kind === 'hole').length;
  assert.equal(dmg(0), 0); assert.ok(dmg(3) > dmg(1), `Verfall 3 > 1: ${dmg(3)} > ${dmg(1)}`);
});

test('hullWindowSpot: freie Rasterstelle im Raum oder null; außerhalb von Gebäuden kein Urteil', () => {
  const L = buildPoi(D, 'ministerium', 1), plan = planHull(D, 'ministerium', L);
  const i = L.rooms.findIndex(r => r.band === 'main' && indoor(r.id)), w = hullWindowSpot(plan, { ...L.rooms[i], i });
  assert.ok(w === null || plan.buildings.some(b => b.grid.axes.includes(w.x) && b.grid.rows.includes(w.y)));
  const deep = buildPoi(D, 'metro_line4', 1);
  assert.equal(hullWindowSpot(planHull(D, 'metro_line4', deep), { ...deep.rooms[1], i: 1 }), undefined);
});

test('Skyline aus derselben Grammatik: Stadt dicht und hoch, Canyon karg, deterministisch', () => {
  const city = skylinePlan(D, { region: 'Delta Ring', seed: 3, width: 2000, height: 300, far: false });
  const canyon = skylinePlan(D, { region: 'Crow Valley', seed: 3, width: 2000, height: 300, far: false });
  assert.equal(city.kind, 'city'); assert.equal(canyon.kind, 'canyon');
  assert.ok(city.list.length > canyon.list.length * 2, `${city.list.length} vs ${canyon.list.length}`);
  assert.deepEqual(skylinePlan(D, { region: 'Delta Ring', seed: 3, width: 2000 }), skylinePlan(D, { region: 'Delta Ring', seed: 3, width: 2000 }));
  assert.ok(skylinePlan(D, { seed: 1, width: 3000, far: true }).list.length > 15, 'BigCityDelta am Horizont');
});

test('#172 gemalte Module: Typ über Spiel › Hülle, POI über Typ, jedes Modul ein Bild-Asset mit Datei, Schalter aus = keine', async () => {
  const fs = await import('node:fs');
  for (const id of Object.keys(D.pois)) {
    const art = hullConfig(D, id).art;
    for (const [k, v] of Object.entries(art)) for (const a of Array.isArray(v) ? v : typeof v === 'string' ? [v] : []) {
      assert.equal(D.assets[a]?.kind, 'image', `${id}: Modul ${k} = ${a}`);
      assert.ok(fs.existsSync(new URL('../projects/nomadgirl/' + D.assets[a].file, import.meta.url)), `${a}: Datei`);
    }
  }
  const mall = hullConfig(D, 'grossmarkt').art;
  assert.ok(mall.wall && mall.window?.length && mall.ac?.length, 'Mall: Wand (Typ), Fenster (Typ), Klimagerät (gemeinsam)');
  const over = hullConfig({ ...D, pois: { ...D.pois, grossmarkt: { ...D.pois.grossmarkt, hull: { ...D.pois.grossmarkt.hull, art: { wall: 'facade_wall_metal' } } } } }, 'grossmarkt').art;
  assert.equal(over.wall, 'facade_wall_metal', 'POI überschreibt');
  assert.deepEqual(hullConfig({ ...D, game: { ...D.game, hull: { ...D.game.hull, modules: false } } }, 'grossmarkt').art, {});
  // the pediment in the proportion of the painted module (about 1 : 2.4), never wider than its volume
  for (const seed of [1, 2, 3]) for (const g of planHull(D, 'ministerium', buildPoi(D, 'ministerium', seed)).parts.filter(q => q.kind === 'gable')) assert.ok(g.w / g.h <= 2.41 + 1e-9 || g.h === 2, `Giebel ${g.w.toFixed(1)} × ${g.h.toFixed(1)}`);
});

test('Hülle aus: Spiel › Hülle › Hüllen an = aus, oder POI › Hülle an = aus', () => {
  const L = buildPoi(D, 'grossmarkt', 1);
  assert.equal(planHull({ ...D, game: { ...D.game, hull: { enabled: false } } }, 'grossmarkt', L, { decay: 1 }).on, false);
  assert.equal(planHull({ ...D, pois: { ...D.pois, grossmarkt: { ...D.pois.grossmarkt, hull: { type: 'mall', on: false } } } }, 'grossmarkt', L, { decay: 1 }).on, false);
});
