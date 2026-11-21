// Erzählschicht G1 (#167): Storylets mit Bedingungen und Ketten, Zeitschichten per Ersetzungs-Grammatik (deterministisch je Seed),
// Revierkrieg schreibt Schichten, Leylas Spuren verblassen über Tage und werden aufgeräumt, Tropes mit Bedingungen, Spielstände bleiben gültig.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeLoader } from '../tools/loader.js';
import { loadProject, validateProject } from '../engine/project.js';
import { CHANNELS, CONDITIONS, storyContext, holds, fits, eligible, pickStorylets, render, see, nextMemory, chainOrder, storyState, visit, fill } from '../engine/storylets.js';
import { timeLayers, expand, writeLayer, addTrace, traceFade, freshTraces, tidyTraces, occupantsFor, hoursOf } from '../engine/history.js';
import { planTropes, tropeSpots, tropeFits } from '../engine/tropes.js';
import { buildPoi } from '../engine/poi.js';
import { newSave, repairSave, newCycle, SAVE_VERSION } from '../game/save.js';
import { ensureMap } from '../game/worldmap.js';
import { takeover, gangWar } from '../game/turf_war.js';
import { talkPool } from '../game/radio.js';

const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
const D = p.data, S = D.storylets, POIS = Object.keys(D.pois);
const base = (o = {}) => ({ node: 'n1', poi: 'bunker_13', name: 'Bunker', kind: 'bunker', region: 'Salt Flats', landmark: true, event: 'flight', decay: 2, home: 'Rust Guard', owner: 'Rust Guard',
  residents: 'gang', layers: [], occupants: [], traces: [], cleaned: false, war: false, seen: {}, chain: 0, visits: 0, day: 1, cycle: 1, ...o });

test('Katalog: alle 13 POIs haben Zettel, einen Splitter, eine Stimme beim Betreten; Gerüchte für alle auf der Karte', () => {
  for (const poi of POIS) {
    const mine = Object.values(S).filter(s => (s.pois || []).includes(poi));
    assert.ok(mine.filter(s => s.channel === 'note').length >= 2, `${poi}: Zettel`);
    assert.equal(mine.filter(s => s.channel === 'splinter').length, 1, `${poi}: Splitter`);
    assert.ok(mine.some(s => ['announce', 'radio', 'ava'].includes(s.channel)), `${poi}: Durchsage/Funk/AvA`);
    if (poi !== 'raketensilo') assert.ok(mine.some(s => s.channel === 'rumor'), `${poi}: Gerücht`);
  }
  const ch = new Set(CHANNELS.map(c => c[0]));
  for (const [id, s] of Object.entries(S)) { assert.ok(ch.has(s.channel), `${id}: Kanal`); assert.ok(s.text, `${id}: Text`); }
  assert.ok(Object.keys(S).length >= 100);
});
test('Ton-Regeln: kein „Das ist nicht X. Das ist Y.“, nur bekannte Platzhalter, keine Erklärtexte über „bedeutet“', () => {
  const known = new Set(['place', 'gang', 'home', 'layer', 'first', 'day', 'region']);
  for (const [id, s] of Object.entries(S)) for (const t of [s.text, s.ava, s.title].filter(Boolean)) {
    assert.ok(!/(^|\.\s)(Das|Es|Er|Sie) (ist|war) (nicht|kein\w*) [^.]+\.\s*(Das|Es|Er|Sie) (ist|war) /.test(t), `${id}: Schema „nicht X, sondern Y“`);
    for (const [, k] of t.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(k), `${id}: Platzhalter {${k}}`);
    assert.ok(!/bedeutet|das heißt/i.test(t), `${id}: erklärt`);
  }
});
test('Prüfung: Storylets, Tropes, Zeitschichten ohne Fehler', () => {
  const r = validateProject(p).filter(x => x.level === 'error' && /storylets|tropes|history|Storylet|Trope|Zeitschicht/i.test(`${x.area} ${x.message}`));
  assert.deepEqual(r, []);
});

test('Bedingungen: jede Art einzeln, „nicht“ dreht um', () => {
  const C = base({ occupants: ['salzschuerfer'], traces: [{ kind: 'chest', fade: 1 }], cleaned: true, war: true, owner: 'Salt Dogs', seen: { a: 1 }, visits: 3, day: 5, cycle: 2, chain: 4 });
  const yes = [['event', 'flight,fight'], ['residents', 'gang'], ['owner', 'other'], ['owner', 'Salt Dogs'], ['layer', 'salzschuerfer'], ['trace', 'chest'], ['trace', 'any'], ['cleaned', ''], ['war', ''],
    ['seen', 'a'], ['visits', '3'], ['day', '5'], ['cycle', '2'], ['decay', '2'], ['region', 'Salt Flats'], ['kind', 'bunker'], ['landmark', '1'], ['chain', '4']];
  for (const [when, value] of yes) { assert.ok(holds(D, C, { when, value }), `${when}=${value}`); assert.ok(!holds(D, C, { when, value, not: true }), `nicht ${when}`); }
  const no = [['event', 'fire'], ['owner', 'home'], ['owner', 'none'], ['layer', 'karawane'], ['trace', 'boss'], ['seen', 'b'], ['visits', '4'], ['day', '6'], ['chain', '5'], ['landmark', '0']];
  for (const [when, value] of no) assert.ok(!holds(D, C, { when, value }), `nicht ${when}=${value}`);
  assert.equal(CONDITIONS.length, 16);
});
test('Storylets: POI nur am Wahrzeichen, Archetyp auch an gewürfelten Orten; einmal gefunden = weg; „Nach“ wartet', () => {
  const s = { channel: 'note', text: 'x', pois: ['bunker_13'] };
  assert.ok(fits(D, base(), { ...s, id: 'q' }));
  assert.ok(!fits(D, base({ landmark: false }), { ...s, id: 'q' }));
  assert.ok(fits(D, base({ landmark: false }), { ...s, archetype: true, id: 'q' }));
  assert.ok(!fits(D, base({ seen: { q: 1 } }), { ...s, id: 'q' }));
  assert.ok(fits(D, base({ seen: { q: 1 } }), { ...s, id: 'q', repeat: true }));
  assert.ok(!fits(D, base(), { ...s, id: 'q', after: 'r' }));
  assert.ok(fits(D, base({ seen: { r: 2 } }), { ...s, id: 'q', after: 'r' }));
  // a note bound to a layer only where that occupant lived
  assert.ok(!eligible(D, base(), 'note').some(([id]) => id === 'schicht_karawane'));
  assert.ok(eligible(D, base({ occupants: ['karawane'] }), 'note').some(([id]) => id === 'schicht_karawane'));
});
test('Auswahl deterministisch je Seed, Platzhalter gefüllt', () => {
  const C = base({ occupants: ['salzschuerfer', 'versprengte'] });
  const a = pickStorylets(D, C, 'note', 3, 11).map(x => x[0]), b = pickStorylets(D, C, 'note', 3, 11).map(x => x[0]);
  assert.deepEqual(a, b); assert.equal(new Set(a).size, 3);
  const many = new Set(); for (let k = 0; k < 30; k++) many.add(pickStorylets(D, C, 'note', 1, k)[0][0]);
  assert.ok(many.size >= 3, 'verschiedene Seeds, verschiedene Zettel');
  assert.equal(fill(D, base({ owner: 'Salt Dogs', home: 'Rust Guard', name: 'Bunker 27' }), '{gang} in {place}, vorher {home}'), 'Salt Dogs in Bunker 27, vorher Rust Guard');
  const R = render(D, base(), { ...S.zettel_himmel, id: 'zettel_himmel' });
  assert.equal(R.title, 'Kinderzeichnung'); assert.ok(R.important && R.ava);
});
test('Faden: 13 Erinnerungen als Kette, der nächste Splitter bringt die nächste', () => {
  const order = chainOrder(D);
  assert.equal(order.length, 13); assert.equal(order[0], 'faden_01'); assert.equal(order.at(-1), 'faden_13');
  const save = newSave(D);
  for (let i = 0; i < 13; i++) { const [id] = nextMemory(D, save); assert.equal(id, order[i]); assert.ok(see(save, id, D)); assert.ok(!see(save, id, D), 'zweimal zählt nicht'); }
  assert.equal(nextMemory(D, save), null);
  assert.deepEqual(save.story.chain, order);
  for (const id of order) assert.ok(S[id].ava, `${id}: AvA kommentiert`);
});

test('Zeitschichten: 1–3 Zwischenbesitzer, deterministisch je Seed, letzte Schicht = heute, Grammatik aufgelöst', () => {
  for (const poi of POIS) {
    const node = { id: poi, poi, name: D.pois[poi].name };
    const save = { map: { seed: 1234 }, cycle: 1, day: 1 };
    const L = timeLayers(D, node, save), L2 = timeLayers(D, node, save);
    assert.deepEqual(L, L2, `${poi}: gleicher Seed, gleiche Schichten`);
    const rolled = L.filter(l => l.by === 'roll');
    const sealed = ['sealed', 'orderly'].includes(D.pois[poi].story.eventKind);
    assert.ok(rolled.length >= 1 && rolled.length <= (sealed ? 1 : 3), `${poi}: ${rolled.length} Schichten`);
    assert.equal(L.at(-1).by, 'home');
    if (D.pois[poi].gang?.name) assert.ok(L.at(-1).text.includes(D.pois[poi].gang.name), `${poi}: heute`);
    for (const l of L) assert.ok(l.text && !/[#{}]/.test(l.text), `${poi}: ${l.text}`);
    // each layer's ending names who came next (rationalised afterwards)
    rolled.forEach((l, i) => { const next = rolled[i + 1]?.name || D.pois[poi].gang?.name; if (next && !/Viecher|von unten|niemand|Sand/.test(l.text)) assert.ok(l.text.includes(next), `${poi}: „${l.text}“ nennt ${next}`); });
    for (const l of rolled) assert.ok(occupantsFor(D, poi).some(o => o.id === l.occupant), `${poi}: ${l.occupant} passt nicht`);
  }
  const node = { id: 'x', poi: 'tankstelle_km7' }, seen = new Set();
  for (let k = 0; k < 20; k++) seen.add(timeLayers(D, node, { map: { seed: k } }).map(l => l.occupant).join(','));
  assert.ok(seen.size >= 5, 'andere Durchgänge, andere Geschichte');
  assert.ok(expand(D, 'when.first', {}, () => 0));
});
test('Revierkrieg schreibt neue Schichten: Leylas Übernahme und die Gangs selbst', () => {
  const save = newSave(D); ensureMap(D, save);
  const node = save.map.nodes.find(n => n.poi === 'tankstelle_km7').id;
  save.rep = { 'Neon Rats': 30 };
  takeover(D, save, node, 'Yellow Vultures');
  let L = timeLayers(D, save.map.nodes.find(n => n.id === node), save);
  assert.equal(L.at(-1).by, 'leyla'); assert.match(L.at(-1).text, /Neon Rats/); assert.match(L.at(-1).text, /Yellow Vultures/);
  const C = storyContext(D, save, node);
  assert.ok(C.war && C.owner === 'Neon Rats');
  assert.ok(eligible(D, C, 'ava').some(([id]) => id === 'ava_revierkrieg'));
  assert.ok(eligible(D, C, 'place').some(([id]) => id === 'ort_revierkrieg'));
  // the gangs fight on their own: every flipped front writes a war layer
  const s2 = newSave(D); ensureMap(D, s2); s2.turfWar = { at: 0, log: [] }; s2.day = 40;
  const flips = gangWar({ ...D, roadEvents: { ...D.roadEvents, rep: { ...(D.roadEvents?.rep || {}), warEvery: 1, warChance: 100 } } }, s2, () => 0.3);
  assert.ok(flips.length >= 1, 'mindestens eine Front dreht');
  for (const f of flips) assert.ok((s2.story?.layers?.[f.node] || []).some(l => l.by === 'war' && l.gang === f.to), `${f.node}: Schicht`);
  writeLayer(s2, 'z', { by: 'war', gang: 'A', from: 'B' }); assert.equal(s2.story.layers.z.length, 1);
});
test('Leylas Spuren: frisch, verblassen über die Tage, dann aufgeräumt (neue Schicht)', () => {
  const save = newSave(D); ensureMap(D, save); save.day = 3; save.hour = 18;
  const node = save.map.nodes.find(n => n.poi === 'bunker_13')?.id || save.map.nodes[0].id;
  assert.ok(addTrace(save, node, { kind: 'chest', room: 'kantine', rx: 3, ry: 5 }));
  assert.equal(addTrace(save, node, { kind: 'chest', room: 'kantine', rx: 3, ry: 5 }), null, 'dieselbe Kiste nur einmal');
  addTrace(save, node, { kind: 'boss', room: 'kommando', rx: 4, ry: 6 });
  const t = save.story.traces[node][0], C = { history: { traces: { cleanupDays: 4, fadeTo: 35 } } };
  assert.equal(traceFade(C, t, save), 1);
  const at = h => ({ day: Math.floor(h / 24), hour: h % 24 });
  const f1 = traceFade(C, t, at(hoursOf(save) + 24)), f3 = traceFade(C, t, at(hoursOf(save) + 72));
  assert.ok(f1 < 1 && f3 < f1 && f3 >= 0.35, `${f1} ${f3}`);
  assert.equal(traceFade(C, t, at(hoursOf(save) + 96)), 0);
  assert.equal(freshTraces(D, save, node).length, 2);
  assert.ok(eligible(D, storyContext(D, save, node), 'ava').some(([id]) => id === 'ava_boss'));
  save.day += 2; assert.deepEqual(tidyTraces(D, save), []);
  save.day += 3; const done = tidyTraces(D, save);
  assert.deepEqual(done, [{ node, n: 2 }]);
  assert.equal(save.story.traces[node], undefined);
  const C2 = storyContext(D, save, node);
  assert.ok(C2.cleaned && !C2.traces.length);
  assert.match(timeLayers(D, save.map.nodes.find(n => n.id === node), save).at(-1).text, /aufgeräumt|umgebaut/);
  assert.ok(eligible(D, C2, 'note').some(([id]) => id === 'zettel_neue_ordnung'));
});

test('Tropes: Bedingungen, Gore-Grenze, nur auf festem Boden, nie im ersten Raum, deterministisch', () => {
  for (const [id, t] of Object.entries(D.tropes)) {
    if (t.image) assert.ok(D.assets[t.image], `${id}: Bild ${t.image}`);
    if (t.note) assert.equal(S[t.note]?.channel, 'note', `${id}: Zettel`);
  }
  const C = base({ event: 'fight' });
  assert.ok(tropeFits(D, D.tropes.letzte_stellung, C, 'hall'));
  assert.ok(!tropeFits(D, D.tropes.letzte_stellung, base({ event: 'orderly', residents: 'empty' }), 'hall'));
  assert.ok(!tropeFits({ ...D, history: { ...D.history, gore: 1 } }, D.tropes.letzte_stellung, C, 'hall'), 'Gore 2 über der Grenze');
  assert.ok(!tropeFits(D, D.tropes.neue_ordnung, C, 'hall'), 'Neue Ordnung erst nach dem Aufräumen');
  assert.ok(tropeFits(D, D.tropes.neue_ordnung, base({ cleaned: true }), 'hall'));
  let total = 0;
  for (const poi of POIS) for (const seed of [3, 9]) {
    const L = buildPoi(D, poi, seed); if (!L?.def) continue;
    const ctx = storyContext(D, null, poi), A = planTropes(D, poi, L, seed, ctx), B = planTropes(D, poi, L, seed, ctx);
    assert.deepEqual(A, B, `${poi}/${seed}`);
    assert.ok(A.length <= (D.history.tropesPerLevel ?? 3));
    for (const t of A) {
      assert.ok(t.room > 0, `${poi}: nicht im ersten Raum`);
      const tiles = L.def.layout;
      for (let k = 0; k < t.w; k++) { assert.equal(tiles[t.y][t.x + k], '.'); assert.ok('#A'.includes(tiles[t.y + 1][t.x + k]), `${poi}: Boden unter ${t.id}`); }
      if (D.rooms[L.rooms[t.room].id]?.type === 'wow' || L.rooms[t.room].wow) assert.ok(D.tropes[t.id].wow, `${t.id} im Wow-Raum`);
    }
    total += A.length;
  }
  assert.ok(total >= 20, `Tropes über alle POIs: ${total}`);
  assert.deepEqual(tropeSpots(['#####', '#...#', '#...#', '#####'], { x: 0, y: 0, w: 5, h: 4 }, 3), [[1, 2]]);
});

test('Spielstand: alte Stände bekommen eine leere Story, ein neuer Durchgang behält nur den Faden', () => {
  const old = newSave(D); delete old.story;
  const s = repairSave(JSON.parse(JSON.stringify(old)), D);
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.story, { seen: {}, chain: [], shards: {}, traces: {}, layers: {}, visits: {} });
  const broken = repairSave({ ...JSON.parse(JSON.stringify(old)), story: { seen: null, chain: 'x', traces: 5 } }, D);
  assert.ok(Array.isArray(broken.story.chain) && typeof broken.story.traces === 'object');
  see(s, 'faden_01', D); see(s, 'zettel_himmel', D); addTrace(s, 'a', { kind: 'chest' }); visit(s, 'a');
  const c = newCycle(D, s);
  assert.deepEqual(c.story.chain, ['faden_01']); assert.ok(c.story.seen.faden_01 != null);
  assert.equal(c.story.seen.zettel_himmel, undefined); assert.ok(!c.story.traces || !Object.keys(c.story.traces).length);
  assert.equal(nextMemory(D, c)[0], 'faden_02');
  assert.ok(storyState(c).visits);
});
test('Radio: Gerüchte aus den Storylets für Orte, die Leyla nicht kennt', () => {
  const save = newSave(D); ensureMap(D, save);
  const pool = talkPool(D, save, D.radio.stations[0], () => 0.4);
  const unseen = save.map.nodes.filter(n => !save.map.visited.includes(n.id) && n.poi && n.poi !== 'raketensilo');
  assert.ok(unseen.length && pool.tip.some(t => unseen.some(n => t.includes(n.name))), pool.tip.slice(0, 3));
  assert.ok(!pool.tip.some(t => /\{\w+\}/.test(t)));
});
