// #174 Türen: the door planner (engine/doors.js) over every POI × 8 seeds: doorways in walls (lintel, floor, never at ladders or in shafts),
// deterministic per seed, states by decay, locked doors never cut off what the level needs, paired front doors, switched off = no doors.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { doorCandidates, doorAudit, doorConfig, rollState, cutsOff, doorLayout, DOOR_STATE_ROWS } from '../engine/doors.js';
import { reach } from '../engine/reach.js';
import { parseRoom } from '../engine/room.js';
import { SEEDS } from '../tools/level_audit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
const POIS = Object.keys(D.pois).filter(p => poiReady(D, p).ok);

test('Türen: jede Tür steht in einem Durchgang (Sturz, Boden), nie an Leitern oder im Schacht; Audit ohne Befunde', () => {
  let side = 0, front = 0, links = 0;
  for (const p of POIS) for (const s of SEEDS) {
    const L = buildPoi(D, p, s), lay = L.def.layout, at = `${p} Seed ${s}`;
    assert.deepEqual(doorAudit(D, p, L), [], at);
    for (const d of L.doors.side) {
      for (let y = d.y; y <= d.feet; y++) assert.equal(lay[y][d.x], '/', `${at}: ${d.id} im Layout`);
      assert.equal(lay[d.y - 1][d.x], '#', `${at}: ${d.id} Sturz`); assert.equal(lay[d.feet + 1][d.x], '#', `${at}: ${d.id} Boden`);
      assert.ok(d.feet - d.y + 1 >= 3, `${at}: ${d.id} hoch genug für Leyla`);
      assert.ok(D.doors[d.type], `${at}: Türsatz ${d.type}`);
    }
    assert.ok(!parseRoom(L.def).problems.some(([k]) => k === 'error'), `${at}: Layout ohne Fehler`);
    side += L.doors.side.length; front += L.doors.front.length; links += L.doors.links;
  }
  assert.ok(side > 100 && front > 100 && links > 20, `genug Türen: ${side} Profil, ${front} Rückwand, ${links} Paare`);
});

test('Türen: gleicher Seed = gleiche Türen; Zustände folgen dem Verfall', () => {
  for (const p of POIS) assert.deepEqual(buildPoi(D, p, 3).doors, buildPoi(D, p, 3).doors, p);
  const cfg = doorConfig(D), roll = decay => { const n = { open: 0, closed: 0, broken: 0, locked: 0 }; for (let i = 0; i < 2000; i++) n[rollState(cfg, decay, '', (i + 0.5) / 2000)]++; return n; };
  assert.ok(roll(3).broken > roll(0).broken * 3, 'Verfall 3 zerstört mehr');
  const sealed = { open: 0, closed: 0 }; for (let i = 0; i < 1000; i++) { sealed[rollState(cfg, 1, 'sealed', (i + 0.5) / 1000)] = (sealed[rollState(cfg, 1, 'sealed', (i + 0.5) / 1000)] || 0) + 1; }
  assert.ok(sealed.closed > roll(1).closed / 2, 'versiegelte Orte halten Türen öfter zu');
  assert.equal(DOOR_STATE_ROWS.length, 4);
});

test('Türen: verschlossene schneiden nie Schlüssel, Schalter, Tresor oder Abkürzung ab (auch wenn alle verschlossen wären)', () => {
  const all = { ...D, game: { ...D.game, doors: { ...D.game.doors, lockedMax: 6, states: [0, 1, 2, 3].map(decay => ({ decay, open: 0, closed: 0, broken: 0, locked: 100 })) } } };
  let locked = 0;
  for (const p of POIS) for (const s of SEEDS) {
    const L = buildPoi(all, p, s), at = `${p} Seed ${s}`;
    assert.ok(!cutsOff(L, L.doors.side), at);
    const R = reach(doorLayout(L, { locked: true }));
    for (let y = 0; y < L.def.layout.length; y++) for (let x = 0; x < L.def.layout[y].length; x++) if ('Z+'.includes(L.def.layout[y][x])) assert.ok(R.can(x, y), `${at}: ${L.def.layout[y][x]} bei ${x},${y}`);
    assert.ok(L.doors.side.filter(d => d.state === 'locked').length <= 6, at);
    assert.ok(!L.doors.side.some(d => d.kind === 'entrance' && d.state === 'locked'), `${at}: Eingänge nie verschlossen`);
    locked += L.doors.side.filter(d => d.state === 'locked').length;
  }
  assert.ok(locked > 10, `verschlossene Türen kommen vor (${locked})`);
});

test('Türen: Material passt zum Gebäudetyp (Mehrheit), Rückwand-Paare verbinden Seitenraum und Hauptraum', () => {
  const most = (p, ...mats) => { const n = {}; for (const s of SEEDS) for (const d of buildPoi(D, p, s).doors.side) n[d.material] = (n[d.material] || 0) + 1; const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]; return !top || mats.includes(top[0]); };
  assert.ok(most('bunker_13', 'steel', 'bulkhead', 'grate'), 'Bunker: Stahl/Schott');
  assert.ok(most('raketensilo', 'steel', 'bulkhead', 'grate'), 'Silo: Stahl/Schott/Gitter');
  assert.ok(most('pit6', 'grate', 'steel'), 'Zeche: Gitter/Stahl');
  assert.ok(most('grossmarkt', 'glass', 'shutter', 'steel'), 'Mall: Glas/Rolltor');
  for (const p of POIS) for (const s of SEEDS) {
    const L = buildPoi(D, p, s), F = L.doors.front;
    for (const f of F.filter(o => o.link != null)) {
      const g = F[f.link], bands = [f, g].map(o => L.rooms.find(r => r.id === o.room)?.band).sort();
      assert.equal(g.link, F.indexOf(f), `${p} ${s}: Paar gegenseitig`);
      assert.deepEqual(bands, ['branch', 'main'], `${p} ${s}: Seitenraum ↔ Hauptraum`);
    }
  }
});

test('Türen aus: kein „/“, keine Rückwand-Türen; Durchgänge finden sich auch in einem Hand-Layout', () => {
  const off = { ...D, game: { ...D.game, doors: { ...D.game.doors, enabled: false } } };
  for (const p of POIS) { const L = buildPoi(off, p, 2); assert.ok(!L.def.layout.some(r => r.includes('/')), p); assert.equal(L.doors.front.length, 0); }
  const lay = ['##########', '##########', '#....#...#', '#....#...#', '#........#', '#........#', '#........#', '##########'];
  const c = doorCandidates(lay, [{ x: 0, y: 0, w: 10, h: 8 }]);
  assert.equal(c.length, 1); assert.equal(c[0].x, 5); assert.equal(c[0].h, 3); assert.equal(c[0].y1, 6);
  // a low tunnel is no doorway
  assert.equal(doorCandidates(['############', '#..........#', '#..........#', '#..........#', '############'], [{ x: 0, y: 0, w: 12, h: 5 }]).length, 0);
});
