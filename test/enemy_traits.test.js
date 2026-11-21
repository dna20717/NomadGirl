// Gegner-Bausteine (#139) and the shared throwing code (#140) without a browser: register and schema agree, the four enemies of the
// first slice sit in their gangs' POIs, the alarm point is a room character, lobs land where they should, explosions stop at walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, validateProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { AREAS } from '../engine/schema.js';
import { parseRoom } from '../engine/room.js';
import { TRAITS, traitsOf, fire } from '../game/play/traits/index.js';
import { TRAIT_IDS } from '../game/play/traits/ids.js';
import { Throwables, THROW_GRAVITY } from '../game/play/throwables.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Register und Schema kennen dieselben Bausteine, jeder hat seinen Abschnitt', () => {
  assert.deepEqual(Object.keys(TRAITS).sort(), [...TRAIT_IDS].sort());
  const A = AREAS.enemies, field = A.sections.flatMap(s => s.fields).find(f => f.key === 'traits');
  assert.equal(field.type, 'multi');
  for (const id of TRAIT_IDS) {
    const sec = A.sections.filter(s => s.when && s.when({ traits: [id] }) && !s.when({ traits: [] }));
    assert.equal(sec.length, 1, `Abschnitt für ${id}`);
    assert.ok(sec[0].fields.every(f => f.key.startsWith(TRAITS[id].key + '.')), `Felder von ${id} liegen unter ${TRAITS[id].key}.*`);
  }
});

test('Erste Scheibe: Visier, Brandsatz, Flickerin, Sirene mit ihren Bausteinen in den Gang-POIs, keine Hunde', () => {
  const want = { visier: ['sniper'], brandsatz: ['grenadier'], flickerin: ['medic', 'surrender'], sirene: ['alarm', 'coward'] };
  for (const [id, traits] of Object.entries(want)) {
    const e = D.enemies[id];
    assert.ok(e?.kit, id);
    assert.deepEqual(e.traits, traits);
    assert.ok(Object.values(D.pois).some(p => p.gang?.name && (p.enemies || []).includes(id)), `${id} steht in einem Gang-POI`);
  }
  assert.equal(D.enemies.brandsatz.throw.item, 'molotow');
  assert.ok(!Object.keys(D.enemies).some(id => /hund|hound|dog/i.test(id + D.enemies[id].name)), 'niemals Hunde (Daniel, 21.11.2026)');
  assert.deepEqual(validateProject(P).filter(m => m.kind === 'error'), []);
});

test('Alarmpunkt „!“ ist ein Raum-Zeichen, drei Räume haben eine Sirene', () => {
  const r = parseRoom({ layout: ['#####', '#.!.#', '#####'] });
  assert.deepEqual(r.marks['!'], [[2, 1]]);
  assert.equal(r.problems.filter(p => p[0] === 'error').length, 0);
  assert.ok(!r.solid(2, 1));
  const rooms = Object.values(D.rooms).filter(x => (x.layout || []).some(l => l.includes('!')));
  assert.ok(rooms.length >= 3, `${rooms.length} Räume mit Alarmpunkt`);
});

test('Bausteine: Vorgaben, Reihenfolge, Haken', () => {
  const e = { d: { traits: ['sniper', 'surrender', 'medic'], medic: { max: 1 } } };
  const list = traitsOf(e);
  assert.deepEqual(list.map(t => t.id), ['surrender', 'medic', 'sniper']);   // surrender first: a kneeling enemy does nothing else
  assert.equal(e.tc.medic.max, 1);
  assert.equal(e.tc.medic.reviveTime, 2200);
  assert.equal(e.tc.sniper.lock, 1400);
  assert.equal(e.tc.surrender.chance, 50);
  e.traits = [{ id: 'a', onHit: (x, t, dmg) => dmg * 2, think: () => false }, { id: 'b', think: () => true }];
  assert.equal(fire(e, 'onHit', 0, 5), 10);
  assert.equal(fire(e, 'think', 0, 16), true);
});

// a tiny scene: floor at y = 600, a wall from x = 500 to 540 up to y = 400
const scene = () => {
  const s = { leyla: null, enemies: [], log: [], covers: () => [], pointSolid: (x, y) => y >= 600 || (x >= 500 && x < 540 && y >= 400), fx: new Proxy({}, { get: () => () => {} }) };
  return s;
};
const make = s => Object.assign(Object.create(Throwables.prototype), { s, list: [], areas: [], rings: [], log: [], g: null, marks: null });

test('Wurf: der Bogen landet, wo er soll; die Landemarke sagt es vorher', () => {
  const T = make(scene()), v = Throwables.aim(100, 500, 400, 600);
  assert.ok(v.vy < 0, 'geht erst nach oben');
  const m = T.predict(100, 500, v.vx, v.vy, THROW_GRAVITY);
  assert.ok(Math.abs(m.x - 400) < 12, `landet bei ${Math.round(m.x)}`);
  assert.ok(Math.abs(m.y - 600) < 4);
});

test('Explosion: Schaden im Radius, nichts hinter der Wand', () => {
  const s = scene(), T = make(s), hits = [];
  const enemy = (id, x) => ({ id, x, chest: 540, alive: true, body: { left: x - 30, right: x + 30, top: 420, bottom: 600 }, hit: (t, dmg) => hits.push([id, dmg]) });
  s.enemies = [enemy('open', 640), enemy('behind', 440), enemy('far', 900)];
  const got = T.blast(600, 580, { radius: 160, damage: 30, friendly: true }, 0);
  assert.deepEqual(got, ['open']);
  assert.ok(hits[0][1] >= 15 && hits[0][1] <= 30, 'am Rand die Hälfte, in der Mitte voll');
  s.leyla = { alive: true, x: 440, chest: 540, body: { left: 410, right: 470, top: 420, bottom: 600 }, hurt: () => true };
  assert.deepEqual(T.blast(600, 580, { radius: 200, damage: 30, friendly: false }, 0), [], 'Leyla hinter der Wand bleibt heil');
});
