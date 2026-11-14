// Salvage projects (#023, game/salvage.js): site per Durchgang, sections in order, building in from the camp, the test start,
// the LKW pulls the rig afterwards, parts in POI chests, the quest log line, a new Durchgang keeps what is built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, newCycle, swapTractor } from '../game/save.js';
import { give } from '../game/crafting.js';
import { ensureSites, siteOf, active, sections, progress, missing, install, finish, chestPart, here, sstate } from '../game/salvage.js';
import { questLog, trackedGoal, track } from '../game/quests.js';
import { hops } from '../game/worldmap.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => { const s = newSave(D); s.deltas = 400; return s; };
// put every part of the current section into the camp
const supply = (s, id) => { for (const m of missing(D, s, id)) give(D, s, m.item, m.need - m.have); };

test('Ab Spielstart offen: nur der LKW, Crawler und Fatbird erst danach', () => {
  const s = fresh();
  assert.deepEqual(active(D, s), ['lkw']);
  assert.equal(sections(D, 'lkw').map(x => x.name).join(','), 'Freilegen,Fahrwerk,Motor,Kabine & Tank');
});

test('Fundort je Durchgang: Straßen vom Start wie eingestellt, gleich bei gleicher Karte, Marke auf der Karte', () => {
  const s = fresh();
  ensureSites(D, s);
  const node = siteOf(s, 'lkw'), d = hops(s.map, s.map.start)[node];
  assert.ok(node && node !== s.map.start);
  const [lo, hi] = D.salvage.lkw.hops;
  assert.ok(d >= lo && d <= hi, `Abstand ${d}`);
  const again = siteOf(s, 'lkw'); ensureSites(D, s); assert.equal(siteOf(s, 'lkw'), again);
  assert.equal(s.map.wrecks[node].id, 'lkw');
  assert.equal(here(D, s), null, 'am Start steht kein Wrack');
  s.location = node;
  assert.equal(here(D, s), 'lkw');
});

test('Einbauen: nur der aktuelle Abschnitt, Teile verschwinden aus dem Lager, Abschnitte nacheinander', () => {
  const s = fresh();
  assert.equal(install(D, s, 'lkw').ok, false, 'ohne Teile');
  give(D, s, 'felge', 2);   // a part of a later section does not count yet
  assert.equal(install(D, s, 'lkw').ok, false);
  supply(s, 'lkw');
  const r = install(D, s, 'lkw');
  assert.ok(r.ok && r.sectionDone && r.section === 'Freilegen' && r.hours > 0);
  assert.equal(progress(D, s, 'lkw').current, 1);
  const before = progress(D, s, 'lkw').got;
  install(D, s, 'lkw');   // the two rims are there now
  assert.equal(progress(D, s, 'lkw').got, before + 2);
  assert.equal(missing(D, s, 'lkw').find(m => m.item === 'felge'), undefined);
});

test('Probestart: LKW wird Zugmaschine, Van bleibt als Basis, Crawler und Fatbird öffnen sich', () => {
  const s = fresh();
  ensureSites(D, s);
  for (let i = 0; i < 6 && !progress(D, s, 'lkw').ready; i++) { supply(s, 'lkw'); install(D, s, 'lkw'); }
  assert.ok(progress(D, s, 'lkw').ready);
  const res = finish(D, s, 'lkw', swapTractor);
  assert.ok(res.ok && res.tractor === 'lkw');
  assert.equal(s.rig.tractor, 'lkw');
  assert.equal(s.rig.units[0].id, 'lkw');
  assert.equal(s.base.node, siteOf(s, 'lkw'));
  assert.deepEqual(active(D, s).sort(), ['crawler', 'fatbird']);
  assert.ok(s.map.wrecks[siteOf(s, 'lkw')].done);
  // the van's workshops did not vanish: in the rig or on the scrapyard
  const all = [...s.rig.units.flatMap(u => u.workshops.map(w => w.id)), ...s.rig.spare.workshops];
  for (const w of newSave(D).rig.units.flatMap(u => u.workshops.map(x => x.id))) assert.ok(all.includes(w), w);
  // the crawler unlocks a mega rig
  for (let i = 0; i < 8 && !progress(D, s, 'crawler').ready; i++) { supply(s, 'crawler'); install(D, s, 'crawler'); }
  assert.equal(finish(D, s, 'crawler').megarig, 'crawler');
  assert.deepEqual(s.megarigs, ['crawler']);
});

test('Neuer Durchgang: Eingebautes und der LKW bleiben, der Fundort wird neu gewürfelt', () => {
  const s = fresh();
  ensureSites(D, s);
  supply(s, 'lkw'); install(D, s, 'lkw');
  const n = newCycle(D, s);
  assert.equal(progress(D, n, 'lkw').current, 1, 'Freilegen bleibt erledigt');
  for (let i = 0; i < 6 && !progress(D, n, 'lkw').ready; i++) { supply(n, 'lkw'); install(D, n, 'lkw'); }
  finish(D, n, 'lkw', swapTractor);
  const m = newCycle(D, n);
  assert.equal(m.rig.tractor, 'lkw', 'der LKW bleibt');
  assert.ok(sstate(m).done.lkw);
  ensureSites(D, m);
  assert.ok(siteOf(m, 'crawler'));
});

test('Beute: fehlende Teile in den Kisten ihrer Fundorte, im Tresor sicher, nichts wenn nichts fehlt', () => {
  const s = fresh();
  assert.equal(chestPart(D, s, 'tankstelle_km7', () => 0.99), null, 'Würfel zu hoch');
  const p = chestPart(D, s, 'tankstelle_km7', () => 0);
  assert.ok(p && ['bordwerkzeug', 'schrauben'].includes(p.id) && p.salvage === 'lkw');
  assert.equal(chestPart(D, s, 'ministerium', () => 0), null, 'Freilegen-Teile liegen nicht im Ministerium');
  assert.ok(chestPart(D, s, 'tankstelle_km7', () => 0.99, true), 'Tresor: sicher');
  supply(s, 'lkw');
  assert.equal(chestPart(D, s, 'tankstelle_km7', () => 0), null, 'alles schon da');
});

test('Questlog: Bergung als Zeile, verfolgt = Zielzeile mit dem nächsten Teil und seinem Fundort', () => {
  const s = fresh();
  const L = questLog(D, s);
  assert.equal(L.salvage[0].id, 'lkw');
  assert.ok(L.salvage[0].site);
  track(s, 'salvage:lkw');
  const g = trackedGoal(D, s);
  assert.equal(g.kind, 'salvage');
  assert.match(g.text, /LKW: Freilegen/);
  assert.match(g.sub, /Mile 7/);
});
