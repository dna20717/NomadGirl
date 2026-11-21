// Story zuerst (#160, Daniel 21.11.2026: „Ich möchte, dass vor dem ersten Design die Story des POI oder des Raumes feststeht und von
// dort aus gestaltet wird.“): every POI has its story, every room a brief with a key image, must / never name known clutter, rolled
// places on the travel map inherit their archetype, roomStory hands role, decay, must and never to the dressing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeLoader } from '../tools/loader.js';
import { loadProject, validateProject } from '../engine/project.js';
import { roomStory, placeStory, placeLine, storyTags, eventKind, roleFromFunction } from '../engine/story.js';
import { generateMap } from '../game/worldmap.js';
import { splitList } from '../engine/dressing.js';

const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
const D = p.data;
const FIELDS = ['before', 'people', 'event', 'era', 'decay', 'today', 'goal', 'tone', 'joke', 'wound', 'keyImage', 'shard'];

test('alle 13 POIs haben eine vollständige Story mit Epoche aus der Weltchronik', () => {
  assert.equal(Object.keys(D.pois).length, 13);
  for (const [id, P] of Object.entries(D.pois)) {
    for (const f of FIELDS) assert.ok(P.story?.[f] != null && P.story[f] !== '', `${id}: story.${f} fehlt`);
    assert.ok(D.chronicle[P.story.era], `${id}: Epoche ${P.story.era} nicht in der Weltchronik`);
    assert.ok(P.story.decay >= 0 && P.story.decay <= 3, `${id}: Verfall ${P.story.decay}`);
    assert.ok(eventKind(P.story), `${id}: Art des Ereignisses`);
  }
  // Bibel › Verfall, von Daniel bestätigt
  assert.deepEqual(['ministerium', 'grossmarkt', 'bunker_13', 'tankstelle_km7'].map(k => D.pois[k].story.decay), [1, 2, 2, 3]);
});

test('Weltchronik: fünf Epochen 1–5', () => {
  assert.deepEqual(Object.values(D.chronicle).map(e => e.number).sort(), [1, 2, 3, 4, 5]);
  for (const e of Object.values(D.chronicle)) assert.ok(e.name && e.description && e.traces);
});

test('alle Räume haben einen Raum-Steckbrief mit Schlüsselbild; Pflicht und Verbot kennt das Clutter', () => {
  const known = storyTags(D);
  for (const [id, R] of Object.entries(D.rooms)) {
    for (const f of ['function', 'moment', 'today', 'keyImage']) assert.ok(R.story?.[f], `${id}: story.${f} fehlt`);
    const must = splitList(R.story.must), never = splitList(R.story.never);
    assert.ok(must.length >= 2 && must.length <= 4, `${id}: ${must.length} Pflicht-Dinge`);
    for (const t of [...must, ...never]) assert.ok(known.has(t), `${id}: „${t}“ kennt kein Clutter`);
    assert.ok(!must.some(t => never.includes(t)), `${id}: Pflicht und Verbot zugleich`);
  }
});

test('Prüfung warnt bei fehlendem Schlüsselbild und unbekanntem Pflicht-Ding', () => {
  const q = { ...p, data: { ...D, rooms: { ...D.rooms, x: { name: 'X', size: [10, 5], story: { must: 'tisch, einhorn' } } } } };
  const msgs = validateProject(q).filter(m => String(m.where || m.path || m.text || '').length >= 0).map(m => m.text || m.message || String(m));
  assert.ok(msgs.some(t => /Schlüsselbild/.test(t)), 'Schlüsselbild');
  assert.ok(msgs.some(t => /einhorn/.test(t)), 'Pflicht-Ding');
});

test('roomStory liefert Rolle, Verfall (Raum vor POI), Pflicht, Verbote und Bewohner', () => {
  const s = roomStory(D.pois.delta_heights, D.rooms.hh_penthouse);
  assert.equal(s.role, D.rooms.hh_penthouse.role);
  assert.equal(s.decay, 1);   // Penthouse 1 im eingestürzten Turm (3)
  assert.equal(roomStory(D.pois.delta_heights, D.rooms.hh_buero).decay, 3);
  assert.deepEqual(s.must, splitList(D.rooms.hh_penthouse.story.must));
  assert.deepEqual(s.never, splitList(D.rooms.hh_penthouse.story.never));
  assert.equal(s.residents.kind, 'gang'); assert.equal(s.residents.gang, D.pois.delta_heights.gang.name);
  assert.equal(roomStory(D.pois.storm_drain9, D.rooms.kn_nest).residents.kind, 'nest');
  // a room without a role takes it from „Funktion früher“
  assert.equal(roomStory({}, { story: { function: 'Kantine mit Essensausgabe' } }).role, 'living');
  assert.equal(roleFromFunction('Lager hinter dem Verkaufsraum'), 'storage');
  // owner from the turf war
  assert.equal(roomStory(D.pois.tankstelle_km7, D.rooms.lager, { owner: 'Neon Rats' }).residents.gang, 'Neon Rats');
  for (const [pid, P] of Object.entries(D.pois)) for (const r of P.rooms) {
    const x = roomStory(P, D.rooms[r]);
    assert.ok(x.role && x.decay >= 0 && x.decay <= 3 && x.must.length && x.keyImage, `${pid}/${r}`);
  }
});

test('gewürfelte Orte erben die Archetyp-Story ihrer POI-Art, Region färbt, Besitzer setzt Heute', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(D, seed);
    const rolled = map.nodes.filter(n => !n.landmark && n.poi);
    assert.ok(rolled.length > 5, `Seed ${seed}: ${rolled.length} gewürfelte Orte`);
    for (const n of rolled) {
      const S = placeStory(D, n, { turfs: {} });
      assert.equal(S.archetype, n.poi);
      assert.equal(S.event, D.pois[n.poi].story.event);
      assert.ok(S.line && S.line.length > 10, `${n.name}: kein Satz`);
      assert.ok(!S.line.includes(D.pois[n.poi].name), `${n.name}: Satz nennt das Wahrzeichen`);
      assert.ok(S.decay >= D.pois[n.poi].story.decay - 1 && S.decay <= 3);
      if (n.region && D.worldmap.regionStory?.some(r => r.region === n.region)) assert.ok(S.tint, `${n.name}: keine Färbung für ${n.region}`);
    }
  }
  const n = { id: 'n1', poi: 'tankstelle_km7', region: 'Salt Flats', danger: 3, landmark: false };
  const S = placeStory(D, n, null, 'Salt Dogs');
  assert.equal(S.decay, 3); assert.match(S.today, /Salt Dogs/); assert.match(S.tint, /Salz/);
  assert.equal(placeStory(D, n, null, D.pois.tankstelle_km7.gang.name).today, D.pois.tankstelle_km7.story.today);
  assert.ok(!placeLine(D.pois.bunker_13, { id: 'x' }).includes('Rust Guard'));
});
