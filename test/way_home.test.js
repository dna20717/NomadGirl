// #175 Daniels Test (22.11.2026): „Aus dem Hochhaus kommt man nicht wieder raus, wenn man vorzeitig raus will“ and „Manche POI-Objekte
// wie Leichen sind etwas zu groß“. From every place Leyla gets to before the goal room a way home to the van exists (all POIs × 8 seeds,
// tools/reach_audit.mjs › homeAudit), the ladder of a one-way hole in the deep comes down from the landing, and the tropes have
// plausible heights next to Leyla (170 cm).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { homeAudit, reachMap, cycleOpts, RULES, rulesFrom } from '../tools/reach_audit.mjs';
import { SEEDS } from '../tools/level_audit.mjs';
import { tropeSizeIssues, TROPE_SIZES } from '../engine/tropes.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
Object.assign(RULES, rulesFrom(D));
const POIS = Object.keys(D.pois).filter(p => poiReady(D, p).ok);
const only = recipe => ({ ...D, pois: Object.fromEntries(Object.entries(D.pois).map(([k, P]) => [k, { ...P, cycles: { ...P.cycles, recipes: [{ recipe, weight: 1 }] } }])) });

test('Rückweg: von jedem Ort vor dem Zielraum zurück zum Van (alle POIs × 8 Seeds)', () => {
  const bad = [];
  for (const p of POIS) for (const s of SEEDS) for (const f of homeAudit(buildPoi(D, p, s))) bad.push(`${p} Seed ${s}: ${f.room} Kachel ${f.lx},${f.ly}`);
  assert.deepEqual(bad, []);
});

test('Rückweg: der Prüfer findet eine Einbahn ohne Rückweg (Hochhaus-Archiv ohne Tritte)', () => {
  // the Aktenarchiv before #175: a block 5 high, the steps only on one side → from the ladder side no way back
  const rooms = { ...D.rooms, hh_archiv: { ...D.rooms.hh_archiv, layout: D.rooms.hh_archiv.layout.map((r, y) => y === 7 ? r.slice(0, 8) + '..' + r.slice(10) : r) } };
  const L = buildPoi({ ...D, rooms }, 'delta_heights', 1);
  assert.ok(L.rooms.some(r => r.id === 'hh_archiv'));
  assert.ok(homeAudit(L).some(f => f.room === 'hh_archiv'), 'Befund im Archiv');
  assert.deepEqual(homeAudit(buildPoi(D, 'delta_heights', 1)), [], 'mit Tritten: Weg zurück');
});

test('Einbahn in der Tiefe: Leiter liegt oben bereit, unten herunterlassen, dann geht es wieder hinauf', () => {
  const O = only('oneWayDown');
  let n = 0;
  for (const p of POIS.filter(p => D.pois[p].stack === 'deep')) for (const s of SEEDS) {
    const L = buildPoi(O, p, s), lay = L.def.layout;
    for (const o of L.cycles.oneWays.filter(o => o.ladder)) {
      assert.ok(o.ladder.length >= 2 && o.ladder.every(([x, y]) => lay[y][x] === '.' && x === o.land[0]), `${p} ${s}: Loch offen, eine Spalte`);
      const opts = cycleOpts(L), keys = L.cycles.locks.map((_, i) => i), i = opts.lifts.findIndex(f => f.tiles === o.ladder);
      const down = reachMap(lay, { ...opts, start: o.land, keysHeld: keys });
      assert.ok(down.liftOpen.has(i), `${p} ${s}: Leiter kommt herunter`);
      assert.ok(down.near(...o.from), `${p} ${s}: von unten wieder oben am Loch`);
      n++;
    }
  }
  assert.ok(n >= 5, `${n} Einbahnen mit Leiter geprüft`);
});

// the size of a PNG from its header
const pngSize = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('Tropes: glaubwürdige Größen neben Leyla (Maßstab je Art, Leiche liegend 155–195 cm lang)', () => {
  const issues = [];
  for (const [id, t] of Object.entries(D.tropes)) {
    if (!t.image) continue;
    assert.ok(TROPE_SIZES[t.body], `${id}: Maßstab gesetzt`);
    const size = pngSize(path.join(root, D.assets[t.image].file));
    for (const m of tropeSizeIssues(t, size)) issues.push(`${id}: ${m}`);
  }
  assert.deepEqual(issues, []);
  // the check bites: the old sizes of #170 (sitting 130 cm, a body under a blanket 91 cm) are too big
  assert.ok(tropeSizeIssues({ image: 'x', body: 'sitting', cm: 130 }).length);
  assert.ok(tropeSizeIssues({ image: 'x', body: 'lying', cm: 91 }, [160, 81]).length);
  assert.deepEqual(tropeSizeIssues({ image: 'x', body: 'lying', cm: 84 }, [160, 81]), []);
});
