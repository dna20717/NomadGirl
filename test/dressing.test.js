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
import { levelTales, desertField, planBackWall, ageItems, rulesOf, ruleFrom, orderConfig } from '../engine/dressing_story.js';
import { roomStory } from '../engine/story.js';

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
    for (const it of l.plan.items.filter(i => i.hang === 'stand' && !i.debris)) for (let i = 0; i < it.w; i++) {   // debris (#159) is drawn flat on the floor
      const k = (it.x + i) + ',' + it.y;
      assert.ok(!at.has(k), `${where(l, it)} steht in ${at.get(k)?.name}`);
      at.set(k, it);
    }
    for (const it of l.plan.items.filter(i => i.hang === 'stand' && !i.ens && !i.debris)) for (let d = 1; d <= gap; d++)
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
      const things = l.plan.items.filter(it => it.room === r.key && it.hang === 'stand' && !it.debris).length;
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
  const o = dressingOverrides({ rooms: { r: { dressing: { density: 5, prefer: 'kiste' } } } }, null, 'r');
  assert.deepEqual({ scale: o.scale, density: o.density, prefer: o.prefer, avoid: o.avoid, sets: o.sets }, { scale: 1, density: 5, prefer: ['kiste'], avoid: [], sets: [] });
  // #160: the room brief steers it (must → preferred, never → forbidden, decay room over POI)
  const s = dressingOverrides({ pois: { p: { story: { decay: 3 } } }, rooms: { r: { story: { must: 'tisch, büro', never: 'grün', decay: 1 } } } }, 'p', 'r');
  assert.deepEqual([s.prefer, s.forbid, s.decay], [['tisch', 'büro'], ['grün'], 1]);
});

// ---------- #159 Stufe 2: Ordnung + Verfall, Raum-Geschichten, Wüste, Rückwand, Korrekturen ----------
const roomStoryRole = (poi, id) => roomStory(D.pois[poi], D.rooms[id]).role;

test('Ordnung: Läden, Büros und Lager zeigen Reihen im Takt; Verfall 3 stört sie, Verfall 0 nicht', () => {
  const D0 = { ...D, pois: Object.fromEntries(Object.entries(D.pois).map(([k, P]) => [k, { ...P, story: { ...P.story, decay: 0 } }])), rooms: Object.fromEntries(Object.entries(D.rooms).map(([k, r]) => [k, { ...r, story: { ...r.story, decay: undefined } }])) };
  const D3 = { ...D0, pois: Object.fromEntries(Object.entries(D0.pois).map(([k, P]) => [k, { ...P, story: { ...P.story, decay: 3 } }])) };
  let rows = 0, still = 0, aged = 0;
  for (const l of levels) {
    const p0 = planDressing({ D: D0, room: l.room, reg: l.reg, spots: l.spots, poiId: l.poi, seed: l.seed });
    const ord = p0.items.filter(i => i.ord);
    rows += ord.length;
    still += p0.items.filter(i => i.tilt || i.dx || i.debris).length;
    const p3 = planDressing({ D: D3, room: l.room, reg: l.reg, spots: l.spots, poiId: l.poi, seed: l.seed });
    aged += p3.items.filter(i => i.tilt || i.dx || i.debris).length + (ord.length - p3.items.filter(i => i.ord).length);
    // a row keeps its beat: the same thing, the same step
    const byRoom = new Map(); for (const it of ord) byRoom.set(it.room, [...(byRoom.get(it.room) || []), it]);
    for (const [k, r] of byRoom) { const xs = r.map(i => i.x).sort((a, b) => a - b), d = xs.slice(1).map((x, i) => x - xs[i]); assert.ok(new Set(r.map(i => i.name)).size === 1 && new Set(d).size <= 1, `${l.poi} ${k}: Reihe ohne Takt ${d}`); }
  }
  assert.ok(rows > 100, `nur ${rows} Dinge in Reihen`);
  assert.equal(still, 0, 'Verfall 0 kippt nichts');
  assert.ok(aged > rows * 0.3, `Verfall 3 stört zu wenig (${aged} von ${rows})`);
  const it = [{ x: 1, y: 1, w: 1, h: 1, hang: 'stand', ord: true }];
  ageItems(it, 0, 1); assert.ok(!it[0].tilt && !it[0].gone);
});

test('Raum-Geschichten: etwa 40 % der Räume, passend zu Rolle, nie der Wow-Raum', () => {
  let n = 0, all = 0;
  for (const l of levels) {
    const t = levelTales(D, l.poi, l.L, l.seed); n += t.size; all += l.L.rooms.length;
    for (const [i, id] of t) { const r = l.L.rooms[i], T = D.roomStories[id]; assert.ok(!r.wow && T, `${l.poi}: ${id} im Wow-Raum`); assert.ok(!T.roles?.length || T.roles.includes(roomStoryRole(l.poi, r.id)), `${l.poi} ${r.id}: ${id} passt nicht zur Rolle`); }
  }
  assert.ok(n / all > 0.2 && n / all < 0.55, `Quote ${Math.round(n / all * 100)} %`);
});

test('Die Wüste kriecht rein: Sand nimmt von den Eingängen nach innen ab, im Bunker fast nichts', () => {
  for (const l of levels.filter(l => l.seed === 1)) {
    const f = desertField(D, l.poi, l.L), tiles = l.L.def.layout;
    for (let y = 1; y < tiles.length - 1; y++) for (let x = 1; x < tiles[0].length - 1; x++) {
      const v = f.at(x, y); if (!v || v >= f.amp - 1e-6) continue;
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f.at(x + dx, y + dy) > v), `${l.poi}: Sand bei ${x},${y} ohne Weg nach draußen`);
    }
  }
  assert.ok(desertField(D, 'bunker_13', levels.find(l => l.poi === 'bunker_13').L).amp <= 0.05);
});

test('Rückwand-Ebene: ohne Kollision, nicht auf Leitern, Türen, Schaltern, Kisten; dunkler als die Spielebene', () => {
  for (const l of levels) {
    const items = planBackWall(D, l.room, l.reg, l.spots, l.seed), ch = (x, y) => l.room.tiles[y]?.[x];
    for (const b of items) for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
      const c = ch(b.x + dx, b.y + dy);
      assert.equal(c, '.', `${l.poi} #${l.seed}: ${b.kind} bei ${b.x + dx},${b.y + dy} auf „${c}“`);
      assert.ok(l.reg.inside(b.x + dx, b.y + dy), `${l.poi}: ${b.kind} draußen`);
    }
  }
  assert.ok(levels.reduce((n, l) => n + planBackWall(D, l.room, l.reg, l.spots, l.seed).length, 0) > 100, 'zu wenig Rückwand-Clutter');
  const dim = D.game?.dressing?.backDim ?? 42;
  assert.ok(dim >= 35 && dim <= 50, `Rückwand ${dim} % dunkler (Bibel 35–50)`);
});

test('Korrektur wirkt in allen Seeds: verboten in der Rolle, weg damit, zu viel hier', () => {
  const l = levels.find(l => l.poi === 'grossmarkt'), it = l.plan.items.find(i => i.hang === 'stand' && !i.debris && i.name);
  const role = l.plan.regions.find(r => r.key === it.room).role;
  const Dr = { ...D, dressingRules: { r1: ruleFrom('room', { thing: it.name, role }) } };
  for (const L2 of levels.filter(x => x.poi === 'grossmarkt')) {
    const p = planDressing({ D: Dr, room: L2.room, reg: L2.reg, spots: L2.spots, poiId: 'grossmarkt', seed: L2.seed });
    assert.ok(!p.items.some(i => i.name === it.name && p.regions.find(r => r.key === i.room)?.role === role), `Seed ${L2.seed}: ${it.name} steht noch in ${role}`);
  }
  const Dx = { ...D, dressingRules: { r1: ruleFrom('remove', { thing: it.name }) } };
  assert.ok(!planDressing({ D: Dx, room: l.room, reg: l.reg, spots: l.spots, poiId: 'grossmarkt', seed: l.seed }).items.some(i => i.name === it.name));
  assert.equal(rulesOf({ dressingRules: { a: ruleFrom('much', { role: 'shop' }) } }).density('shop'), 0.8);
  assert.ok(orderConfig(D)('shop'));
});
