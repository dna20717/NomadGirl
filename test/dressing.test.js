// Set dressing by rules (#158, Daniel 21.11.2026: „Clutter wird manchmal zu gehäuft eingesetzt, manchmal falsch (ein Baum oben auf
// einem Hochhaus)“): every POI welded like the game for 8 seeds, planned like art.js drawRoom (engine/dressing.js), then checked:
// nothing floats, nothing overlaps, nothing from outside stands inside and the other way round, nothing on a roof or ledge without
// the place for it, the density per room stays in its frame, ways stay free, the same seed gives the same plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi } from '../engine/poi.js';
import { parseRoom } from '../engine/room.js';
import { regionMap, placeTypes, planDressing, dressingOverrides, fits, setPool, hullMap, tileCase, dressingConfig, splitList, STANDING } from '../engine/dressing.js';

const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
const D = p.data, SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];
const WALL = '#A^v%$', CARRY = WALL + '=';
const levels = [];
for (const poi of Object.keys(D.pois)) for (const seed of SEEDS) {
  const L = buildPoi(D, poi, seed);
  if (!L.def) continue;
  const room = parseRoom(L.def), reg = regionMap(D, { rooms: L.rooms, poiId: poi }), spots = placeTypes(room, reg);
  levels.push({ poi, seed, L, room, reg, spots, plan: planDressing({ D, room, reg, spots, poiId: poi, seed }) });
}
const where = (l, it) => `${l.poi} #${l.seed} ${it.name} (${it.x}, ${it.y})`;
// the rule an item was placed with (its set's Clutter-Regeln or the POI's Marken-Clutter)
const ruleOf = (l, it) => it.brand ? D.pois[l.poi].brandProps.find(b => b.name === it.name) : setPool(D, it.set).find(c => c.name === it.name && c.key === it.key)?.rule;

test('alle POIs × 8 Seeds werden eingerichtet', () => {
  assert.equal(levels.length, Object.keys(D.pois).length * SEEDS.length);
  for (const l of levels) assert.ok(l.plan.items.length > 0, `${l.poi} #${l.seed}: nichts eingerichtet`);
});

test('nichts schwebt: Stehendes auf Boden, Hängendes unter einer Decke, Wand-Dinge drinnen auf Augenhöhe', () => {
  for (const l of levels) {
    const ch = (x, y) => l.room.tiles[y]?.[x];
    for (const it of l.plan.items) {
      if (it.hang === 'stand') for (let i = 0; i < it.w; i++) {
        assert.ok(CARRY.includes(ch(it.x + i, it.y)), `${where(l, it)} schwebt (kein Boden)`);
        for (let k = 1; k <= it.h; k++) assert.equal(ch(it.x + i, it.y - k), '.', `${where(l, it)} steckt in etwas (${ch(it.x + i, it.y - k)})`);
      }
      if (it.hang === 'ceiling') assert.ok(WALL.includes(ch(it.x, it.y - 1)) && l.reg.inside(it.x, it.y), `${where(l, it)} hängt an nichts`);
      if (it.hang === 'wall') assert.ok(l.reg.inside(it.x, it.y) && CARRY.includes(ch(it.x, it.y + 2)), `${where(l, it)} hängt nicht an einer Rückwand`);
    }
  }
});

test('nichts überlappt, zwischen Einzelstücken bleibt eine Kachel Luft', () => {
  const gap = dressingConfig(D).minGap;
  for (const l of levels) {
    const at = new Map();
    for (const it of l.plan.items.filter(i => i.hang === 'stand')) for (let i = 0; i < it.w; i++) {
      const k = (it.x + i) + ',' + it.y;
      assert.ok(!at.has(k), `${where(l, it)} steht in ${at.get(k)?.name}`);
      at.set(k, it);
    }
    for (const it of l.plan.items.filter(i => i.hang === 'stand' && !i.ens)) for (let d = 1; d <= gap; d++)
      for (const x of [it.x - d, it.x + it.w - 1 + d]) { const o = at.get(x + ',' + it.y); assert.ok(!o || o === it, `${where(l, it)} lehnt an ${o?.name}`); }
  }
});

test('Ort passt: nichts von draußen drinnen und umgekehrt, nichts auf Dach oder Steg ohne passenden Ort', () => {
  for (const l of levels) for (const it of l.plan.items) {
    const s = it.hang === 'stand' ? l.spots.at(it.x, it.y) : l.spots.at(it.x, it.y, it.hang), rule = ruleOf(l, it) || {}, P = splitList(rule.place);
    assert.ok(s, `${where(l, it)} steht nicht auf einem Ort`);
    for (let i = 0; i < it.w; i++) if (it.hang === 'stand') assert.ok(fits(rule.place, l.spots.at(it.x + i, it.y)), `${where(l, it)}: Ort ${l.spots.at(it.x + i, it.y)?.type} passt nicht zu „${rule.place}“`);
    if (s.type === 'floor_in') assert.ok(!P.length || P.includes('floor_in') || (P.includes('corner') && !P.includes('floor_out')), `${where(l, it)} ist ein Draußen-Ding drinnen`);
    if (s.type === 'floor_out') assert.ok(!P.length || P.includes('floor_out') || (P.includes('corner') && !P.includes('floor_in')), `${where(l, it)} ist ein Drinnen-Ding draußen`);
    if (s.type === 'roof' || s.type === 'ledge') assert.ok(P.includes(s.type), `${where(l, it)} steht auf ${s.type} ohne passenden Ort`);
  }
});

test('kein Baum, Wrack oder Straßenschild auf Dächern oder drinnen', () => {
  const outdoorOnly = ['grün', 'wrack', 'straße', 'knochen'];
  for (const l of levels) for (const it of l.plan.items) {
    const tags = splitList(ruleOf(l, it)?.tags), s = l.spots.at(it.x, it.y);
    if (it.hang !== 'stand' || !tags.some(t => outdoorOnly.includes(t))) continue;
    const P = splitList(ruleOf(l, it)?.place);
    if (P.includes('floor_in')) continue;   // a potted plant, bones in a cave: allowed inside by its rule
    assert.equal(s.type, 'floor_out', `${where(l, it)} (${tags.join(', ')}) steht auf ${s.type}`);
  }
});

test('Dichte je Raum im Rahmen („bewohnt“: Budget aus Rolle und Bodenkacheln)', () => {
  for (const l of levels) {
    for (const r of l.plan.regions) {
      const things = l.plan.items.filter(it => it.room === r.key && it.hang === 'stand').length;
      assert.ok(things <= r.budget + 3, `${l.poi} #${l.seed} ${r.key}: ${things} Dinge, Budget ${r.budget}`);
    }
    const stand = l.plan.items.filter(i => i.hang === 'stand').length, floor = l.spots.list.filter(s => STANDING.has(s.type)).length;
    assert.ok(stand / floor < 0.5, `${l.poi} #${l.seed}: ${stand} Dinge auf ${floor} Bodenkacheln`);
  }
});

test('Laufwege frei: Start, Türen, Leitern, Schalter, Kisten, Ziel, Spawns, Sprungkanten, Durchgänge', () => {
  for (const l of levels) {
    const ch = (x, y) => l.room.tiles[y]?.[x];
    for (const it of l.plan.items.filter(i => i.hang === 'stand')) for (let i = 0; i < it.w; i++) {
      const x = it.x + i;
      assert.ok(!l.plan.keep.has(x + ',' + it.y), `${where(l, it)} steht auf einem Laufweg`);
      for (const dx of [-1, 0, 1]) assert.ok(!'LSCZD@'.includes(ch(x + dx, it.y - 1)) || ch(x + dx, it.y - 1) === '.', `${where(l, it)} steht an ${ch(x + dx, it.y - 1)}`);
    }
  }
});

test('gleicher Seed, gleiche Einrichtung', () => {
  for (const l of levels.filter((_, i) => i % 8 === 0)) {
    const again = planDressing({ D, room: l.room, reg: l.reg, spots: l.spots, poiId: l.poi, seed: l.seed });
    assert.deepEqual(again.items.map(i => [i.x, i.y, i.name]), l.plan.items.map(i => [i.x, i.y, i.name]), `${l.poi} #${l.seed}`);
  }
});

test('Set je Gebäude-Hülle: ein Boden trägt das Set des Raums darauf; Autotiling erkennt Kappen, Unterseiten, Innenecken', () => {
  for (const l of levels.filter(l => l.seed === 1)) {
    const hull = hullMap(l.room, l.reg);
    for (const s of l.spots.list) if (STANDING.has(s.type) && WALL.includes(l.room.tiles[s.y][s.x]) && l.room.tiles[s.y - 1][s.x] === '.')
      assert.equal(hull(s.x, s.y), l.reg.idAt(s.x, s.y - 1), `${l.poi}: Boden (${s.x}, ${s.y})`);
  }
  const lay = ['.....', '.#...', '.##..', '#####'], solid = (x, y) => lay[y]?.[x] === '#' || y >= lay.length;
  assert.deepEqual(tileCase(solid, 1, 1), { top: true, under: false, capL: true, capR: true, innerL: false, innerR: false });
  assert.deepEqual(tileCase(solid, 2, 2), { top: true, under: false, capL: false, capR: true, innerL: true, innerR: false });
  assert.equal(tileCase(solid, 0, 3).innerR, true);
});

test('Ort-Typen: Dach über Räumen im Turm, Steg auf Plattformen, Boden draußen über dem Tunnel', () => {
  const by = t => levels.reduce((n, l) => n + l.spots.list.filter(s => s.type === t).length, 0);
  for (const t of ['floor_in', 'floor_out', 'roof', 'ledge', 'ceiling', 'wall']) assert.ok(by(t) > 0, `kein Ort ${t}`);
  const dh = levels.find(l => l.poi === 'delta_heights'), top = dh.L.rooms.find(r => r.id === 'hh_penthouse');
  if (top) assert.ok(dh.spots.list.some(s => s.type === 'roof' && s.x >= top.x && s.x < top.x + top.w), 'Penthouse ohne Dach');
  const km7 = levels.find(l => l.poi === 'tankstelle_km7'), vp = km7.L.rooms.find(r => r.id === 'vorplatz');
  assert.ok(km7.spots.list.some(s => s.type === 'floor_out' && s.y === vp.y + vp.h - 1), 'Vorplatz-Boden ist nicht draußen');
});

test('je POI und Raum überschreibbar (Dichte, Tags, Ensembles; Haken für #160 Story zuerst)', () => {
  const l = levels.find(l => l.poi === 'bunker_13'), poi = l.poi;
  const D0 = { ...D, pois: { ...D.pois, [poi]: { ...D.pois[poi], dressing: { density: 0 } } } };
  assert.equal(planDressing({ D: D0, room: l.room, reg: l.reg, spots: l.spots, poiId: poi, seed: l.seed }).items.filter(i => i.hang === 'stand').length, 0);
  const D2 = { ...D, pois: { ...D.pois, [poi]: { ...D.pois[poi], dressing: { sets: ['sandsack'] } } } };
  const ens = new Set(planDressing({ D: D2, room: l.room, reg: l.reg, spots: l.spots, poiId: poi, seed: l.seed }).items.map(i => i.ens).filter(Boolean));
  assert.ok([...ens].every(e => e === 'sandsack'), [...ens].join());
  assert.deepEqual(dressingOverrides({ rooms: { r: { dressing: { density: 5, prefer: 'kiste' } } } }, null, 'r'), { scale: 1, density: 5, prefer: ['kiste'], avoid: [], sets: [] });
});
