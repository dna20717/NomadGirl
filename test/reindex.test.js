// Unit indices in the savegame (Aufräumen 16.11.2026, game/reindex.js): when a unit leaves the rig outside the build draft, storages,
// decoration, string lights and garden keys move with their unit instead of pointing at the wrong one, storages of the leaver are
// rehomed (Camp-Lager, bundle by the van) instead of being lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, repairSave } from '../game/save.js';
import { removeUnits } from '../game/reindex.js';
import { add, count } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const storeWs = Object.entries(D.workshops).find(([, w]) => w.grid && w.ownStorage && !w.accept?.length && (w.places || 1) <= 2)[0];   // a Speziallager keeps its own grid (#041)
const item = Object.keys(D.items).find(id => D.items[id].category === 'junk') || Object.keys(D.items)[0];
// a rig: tractor, GONE (a container that will vanish from the data), container_20 with a storage holding one thing
function rig() {
  const s = newSave(D);
  s.rig.units.splice(1, 0, { kind: 'container', id: 'GONE', workshops: [] }, { kind: 'container', id: 'container_20', workshops: [{ id: storeWs, at: 0 }] });
  const [w, h] = D.workshops[storeWs].grid;
  s.inv.grids['store:2:0'] = { w, h, items: [] };
  add(D, s.inv.grids['store:2:0'], 'items', item, 1);
  s.rig.lights = [['2:0', 'mast:0']];
  s.garden = { '2:0': [{ crop: 1 }] };
  return s;
}
const things = (s, key) => count(s.inv.grids[key] || { items: [] }, 'items', item);

test('Spielstand-Reparatur: ein gelöschter Container verschiebt nichts, das Lager dahinter behält seinen Inhalt', () => {
  const raw = JSON.parse(JSON.stringify(rig()));
  const r = repairSave(raw, D);   // GONE is not in D
  const ui = r.rig.units.findIndex(u => u.id === 'container_20');
  assert.equal(ui, 1);
  assert.equal(things(r, 'store:1:0'), 1, 'der Inhalt zieht mit nach store:1:0');
  assert.equal(r.inv.grids['store:2:0'], undefined, 'kein verwaistes Raster');
  assert.deepEqual(r.rig.lights, [['1:0', 'mast:0']]);
  assert.ok(r.garden['1:0'] && !r.garden['2:0']);
});
test('removeUnits: das Lager einer Einheit, die geht, landet im Camp-Lager statt im Nichts', () => {
  const s = rig(), before = things(s, 'camp');
  removeUnits(D, s, [2]);   // container_20 with the full storage leaves
  assert.equal(things(s, 'camp') + (s.ground?.[s.location] || []).reduce((n, p) => n + count(p.grid, 'items', item), 0), before + 1);
  assert.equal(s.rig.lights.length, 0, 'die Lichterkette an ihr kommt ab');
  assert.equal(s.garden['2:0'], undefined);
});
