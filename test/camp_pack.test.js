// Camp-Paket (#008): solar with battery, the cistern, string lights, the power of the van, exterior clutter, the new raider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, solarState } from '../game/save.js';
import { budgets, slotCount } from '../game/rig.js';
import { level, tap } from '../game/cistern.js';
import { anchors, catenary, canHang, hang, unhang, lightsConfig } from '../game/string_lights.js';
import { loadProject, validateProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Strom: der Van liefert 2 ⚡, der Cryo-Tank braucht keinen', () => {
  const s = newSave(D), b = budgets(D, s.rig);
  assert.equal(D.workshops.cryotank.power, 0);
  assert.equal(b.power.made, 2);
  assert.ok(b.power.net >= 0, JSON.stringify(b.power));
});

test('Solar: ein Paneel je Container-Platz auf dem Dach, tagsüber Strom, nachts aus dem Akku', () => {
  const s = newSave(D);
  assert.equal(slotCount(D, s.rig, 'solar'), D.containers.container_10.places || 1);
  s.rig.parts = { ...(s.rig.parts || {}), solar: ['solarpaneel'] };
  const made = budgets(D, s.rig).power.made;
  assert.equal(made, 2 + (D.camp.solar.power ?? 1));
  s.day = 1; s.hour = 12; delete s.solar;
  let st = solarState(D, s);
  assert.ok(st.sun && st.live === st.made && st.panels === 1, JSON.stringify(st));
  s.hour = 18; st = solarState(D, s);   // six hours of sun: the battery is full
  assert.equal(st.charge, st.capacity);
  s.hour = 22; st = solarState(D, s);   // night: still power from the battery
  assert.ok(!st.sun && st.live === st.made && st.charge < st.capacity, JSON.stringify(st));
  s.day = 2; s.hour = 6; st = solarState(D, s);   // empty by the morning
  assert.equal(st.live, 0);
});

test('Zisterne: Wasser sammelt sich mit der Zeit, E füllt Flaschen ab, nie mehr als sie fasst', () => {
  const D = { ...P.data, camp: { ...P.data.camp, rain: { enabled: false } } };   // dry weather here; the rain has its own test (rain.test.js)
  const s = newSave(D), ws = Object.keys(D.workshops).find(k => D.workshops[k].function === 'cistern');
  assert.ok(ws && D.items.wasser, 'Zisterne und Frischwasser in den Daten');
  s.day = 1; s.hour = 8;
  assert.equal(level(D, s, ws, '1:0').full, 0);
  s.hour = 20;
  const L = level(D, s, ws, '1:0');
  assert.equal(L.full, Math.floor(12 * D.workshops[ws].cistern.perHour));
  const r = tap(D, s, ws, '1:0');
  assert.equal(r.got, L.full);
  assert.ok(level(D, s, ws, '1:0').water < 1);
  s.day = 9;
  assert.equal(level(D, s, ws, '1:0').full, D.workshops[ws].cistern.max);
});

test('Lichterketten: Andockpunkte an den Ecken, aufhängen kostet Δ, abnehmen gibt die Hälfte zurück', () => {
  const s = newSave(D), L = lightsConfig(D);
  const A = anchors([{ ui: 1, in0: 100, cell: 200, places: 2, inTop: 300, x0: 60, x1: 560 }]);
  assert.deepEqual(A.map(a => [a.id, a.x, a.y]), [['1:0', 96, 266], ['1:1', 504, 266]]);
  const c = catenary(A[0], A[1], L.sag, L.spacing);
  assert.ok(c.mid.y > A[0].y + L.sag && c.bulbs.length >= 8, 'hängt durch, Lampen in Abständen');
  s.deltas = 100;
  assert.match(canHang(D, s, '1:0', '1:0'), /anderen/);
  assert.ok(hang(D, s, '1:0', '1:1').ok);
  assert.equal(s.deltas, 100 - L.price);
  assert.match(canHang(D, s, '1:1', '1:0'), /schon/);
  s.deltas = 0;
  assert.match(hang(D, s, '0:0', '1:1').why, /kostet/);
  assert.ok(unhang(D, s, 0).ok);
  assert.equal(s.deltas, Math.floor(L.price * L.back / 100));
  assert.deepEqual(s.rig.lights, []);
});

test('Außenwände, Deko, Treppe, Companions, Tankstelle: alle Grafiken da, kein Gegner aus Code an der Tankstelle', () => {
  assert.deepEqual(validateProject(P).filter(m => m.kind === 'error'), []);
  for (const [id, w] of Object.entries(D.workshops)) if (!['engine', 'power'].includes(w.function)) assert.ok(!w.outside || D.assets[w.outside], id);
  assert.ok(D.workshops.kochnische.outside && D.workshops.cryotank.outside);
  assert.ok(D.camp.stairs.look && D.camp.deco.length >= 3);
  for (const c of ['schraube', 'onkel_sung']) assert.equal(D.assets[D.companions[c].look]?.kind, 'animation');
  for (const e of D.pois.tankstelle_km7.enemies) { const E = D.enemies[e]; assert.ok(E.kit || E.family === 'wildlife', `${e} braucht ein Aussehen`); }
});

test('Solar unter einem Stapel (#009): kein Sockel auf einem überbauten Dach, Paneele ohne Dach wandern auf den Schrottplatz', async () => {
  const { dropHomeless } = await import('../game/rig.js');
  const s = newSave(D);
  s.rig.parts = { solar: ['solarpaneel'] };
  assert.equal(slotCount(D, s.rig, 'solar'), 1);
  s.rig.units.push({ kind: 'crate', id: Object.keys(D.containers).find(k => D.containers[k].kind === 'crate') || 'holzkiste', workshops: [], level: 1 });
  assert.equal(slotCount(D, s.rig, 'solar'), 0);
  dropHomeless(D, s.rig);
  assert.deepEqual(s.rig.parts.solar, []);
  assert.ok(s.rig.spare.parts.includes('solarpaneel'));
});

test('Lichterketten überleben den Umbau (Daniel: „verschwinden, wenn man eine Werkstatt platziert oder neu baut“) und wandern mit ihrem Anhänger', async () => {
  const { act, buyWorkshop } = await import('../game/rig.js');
  const s = newSave(D);
  s.deltas = 5000;
  s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [] });
  s.rig.lights = [['0:0', '1:1'], ['1:0', '2:1']];
  assert.ok(act(D, s, d => buyWorkshop(D, d, 'werkbank')).ok);
  assert.deepEqual(s.rig.lights, [['0:0', '1:1'], ['1:0', '2:1']], 'Kaufen/Einbauen lässt die Ketten hängen');
  // the 10-foot container leaves (index 1): its strings come down, the 20-foot container moves up to index 1 and keeps its string end
  assert.ok(act(D, s, d => { d.rig.units.splice(1, 1); d.changes = (d.changes || 0) + 1; return { ok: true }; }).ok);
  assert.deepEqual(s.rig.lights, [], 'beide Ketten hingen am entfernten Container');
  s.rig.lights = [['0:1', '1:0']];
  assert.ok(act(D, s, d => { const u = d.rig.units.splice(1, 1)[0]; d.rig.units.push(u); d.changes = (d.changes || 0) + 1; return { ok: true }; }).ok);
  assert.deepEqual(s.rig.lights, [['0:1', `${s.rig.units.length - 1}:0`]], 'die Kette wandert mit ihrem Container');
});
