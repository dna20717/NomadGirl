#!/usr/bin/env node
// Balancing-Simulation (#081, Daniel 19.11.2026: „Lass uns Balancing auch versionieren. Erarbeite bitte v1 durch einige Simulationen und
// identifiziere Choke Points, übermäßigen Grind und Imbalance“). No browser: the real game modules on the real data (or a Datenset).
//
// A typical player, day by day: one POI run a day (the real level of buildPoi with its seed: enemies, chests, secrets; the danger rises
// with the days), the loot of the real tables (rollLoot), the resources of Ranking › Ressourcen verdienen (earn), two crafts a day (their
// by-product), the real tank (decay per hour, rescue cost on a knock-out, maintenance with the recipes as soon as the parts are there),
// Techtree nodes as soon as they are affordable (the path to the Heilmittel first).
//   node tools/balance_sim.mjs [--set <id>] [--runs 60] [--days 40] [--json]
import { loadProject } from '../engine/project.js';
import { nodeLoader } from './loader.js';
import { applySet } from '../engine/sets.js';
import { buildPoi, rankRun } from '../engine/poi.js';
import { parseRoom } from '../engine/room.js';
import { newSave } from '../game/save.js';
import { rollLoot } from '../game/inventory.js';
import { earn } from '../game/earn.js';
import { update as tankUpdate, rescue, maintain, canMaintain } from '../game/tank.js';
import { bonuses } from '../game/techtree.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('--runs', 60)), DAYS = Number(arg('--days', 40)), SET = arg('--set', null), asJson = process.argv.includes('--json');

const loader = nodeLoader('projects/nomadgirl'), project = await loadProject(loader);
if (SET) await applySet(project, loader, SET);
const D = project.data;

// ---------- the player (assumptions, stated in docs/balancing.md) ----------
const P = { killShare: 0.85, chestShare: 0.9, secretShare: 0.4, craftsPerDay: 2, koByDanger: [0, 0.05, 0.1, 0.15, 0.22, 0.3], dangerEvery: 4, maxDanger: 4, runHours: D.camp?.clock?.runHours ?? 3 };
const RES = Object.fromEntries(Object.entries(D.resources || {}).filter(([, r]) => r.item).map(([id, r]) => [r.item, id]));   // item → resource id
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const levels = new Map();
function level(poi, seed) {
  const key = `${poi}:${seed}`;
  if (!levels.has(key)) {
    const L = buildPoi(D, poi, seed), R = L.def ? parseRoom(L.def) : null;
    levels.set(key, R ? { spawns: R.spawns.map(s => s.enemy).filter(id => D.enemies?.[id]), chests: (R.marks.C || []).length, secrets: (R.marks['%'] || []).length + (R.marks.$ || []).length, rooms: L.rooms.length } : null);
  }
  return levels.get(key);
}
const pois = Object.entries(D.pois || {}).filter(([, p]) => !p.hidden && !p.secret).map(([id, p]) => ({ id, danger: p.danger ?? 1 }));

function simulate(seed) {
  const rnd = mulberry(seed), save = newSave(D);
  save.tank ??= { cond: D.tank?.start ?? 100, at: (save.day ?? 1) * 24 + save.hour, dead: false, rescues: 0, since: 1 };
  const stock = {}, got = {}, add = (id, n) => { stock[id] = (stock[id] || 0) + n; got[id] = (got[id] || 0) + n; };
  const out = { nodes: {}, deltas: [], tankMin: 100, tankDead: null, kos: 0, maint: 0, perDay: [], resPerDay: {} };
  const path = ['lebenszeichen', 'wartungsklappe', 'thermohuelle', 'notreserve', 'kuehlkreislauf', 'stasis', 'heilmittel'].filter(id => D.techtree?.[id]);
  const others = Object.keys(D.techtree || {}).filter(id => !path.includes(id));
  const have = res => stock[D.resources?.[res]?.item] || 0;
  const pay = n => { for (const c of D.techtree[n].cost || []) stock[D.resources[c.resource].item] -= c.count || 0; };
  const affordable = n => (D.techtree[n].cost || []).every(c => have(c.resource) >= (c.count || 0));
  const unlocked = n => [...(D.techtree[n].requires || [])].every(r => save.nodes?.includes(r));
  save.nodes = [];
  for (let day = 1; day <= DAYS; day++) {
    const res0 = Object.fromEntries(Object.keys(RES).map(i => [i, got[i] || 0]));
    // the run: the danger rises with the days
    const want = Math.min(P.maxDanger, 1 + Math.floor((day - 1) / P.dangerEvery)), pool = pois.filter(p => p.danger === want);
    const poi = (pool.length ? pool : pois)[Math.floor(rnd() * (pool.length || pois.length))], lseed = 1 + Math.floor(rnd() * 1e6), L = level(poi.id, lseed);
    if (L) {
      const runStock = {}, put = (id, n) => { runStock[id] = (runStock[id] || 0) + n; };
      let deltas = 0, kills = 0, secrets = 0;
      const extra = Math.floor(L.spawns.length * 0.25 * Math.max(0, poi.danger - 1));   // Gefahr: +25 % enemies per step
      for (const id of [...L.spawns, ...L.spawns.slice(0, extra)]) {
        if (rnd() > P.killShare) continue;
        const e = D.enemies[id]; kills++;
        const [a, b] = e.deltas || [0, 0]; deltas += a + Math.floor(rnd() * (b - a + 1));
        for (const t of (e.loot ? rollLoot(D, e.loot, rnd) : [])) if (t.a === 'items') put(t.id, t.n);
        for (const t of earn(D, 'kill', { family: e.family, boss: e.behavior === 'boss' }, rnd)) put(t.id, t.n);
      }
      const tbl = D.pois[poi.id].loot;
      for (let c = 0; c < L.chests; c++) { if (rnd() > P.chestShare) continue; for (const t of rollLoot(D, tbl, rnd)) if (t.a === 'items') put(t.id, t.n); for (const t of earn(D, 'chest', {}, rnd)) put(t.id, t.n); }
      for (let i = 0; i < L.secrets; i++) if (rnd() < P.secretShare) { secrets++; for (const t of earn(D, 'secret', {}, rnd)) put(t.id, t.n); }
      const grade = rankRun(D.ranking, { seconds: 300, par: 300, kills, killsMax: L.spawns.length + extra, secrets, secretsMax: L.secrets })?.grade || 'C';
      for (const t of earn(D, 'rank', { grade }, rnd)) put(t.id, t.n);
      save.hour += P.runHours;
      if (rnd() < P.koByDanger[poi.danger] ?? 0.3) { out.kos++; tankUpdate(D, save); rescue(D, save); }   // the backpack is gone
      else { for (const [id, n] of Object.entries(runStock)) add(id, n); const bonus = (D.ranking?.grades || []).find(g => g.grade === grade)?.bonus || 0; save.deltas += Math.round(deltas * (1 + bonus / 100)); }
    }
    // crafting: the by-products (Werkbank: Technik, Küche: Bio)
    for (let i = 0; i < P.craftsPerDay; i++) for (const t of earn(D, 'craft', { function: i % 2 ? 'kitchen' : 'craft' }, rnd)) add(t.id, t.n);
    // the rest of the day passes (sleep until morning)
    save.day += 1; save.hour = 7;
    tankUpdate(D, save);
    // tank care: the best recipe the parts allow, until it is fine again
    const care = Object.values(D.recipes || {}).filter(r => r.tank > 0 && (r.discovery || []).includes('start')).sort((a, b) => b.tank - a.tank);
    for (let guard = 0; guard < 6 && !save.tank.dead && save.tank.cond < 75; guard++) {
      const r = care.find(r => (r.ingredients || []).every(i => (stock[i.item] || 0) >= (i.count || 1)) && canMaintain(D, save, r).ok);
      if (!r) break;
      for (const i of r.ingredients || []) stock[i.item] -= i.count || 1;
      maintain(D, save, r); out.maint++;
    }
    // the Techtree: the path first, then the rest
    for (const n of [...path, ...others]) if (!save.nodes.includes(n) && unlocked(n) && affordable(n)) { pay(n); save.nodes.push(n); out.nodes[n] ??= day; }
    out.tankMin = Math.min(out.tankMin, save.tank.cond);
    if (save.tank.dead && out.tankDead == null) out.tankDead = day;
    out.deltas.push(save.deltas);
    for (const i of Object.keys(RES)) (out.resPerDay[RES[i]] ??= []).push((got[i] || 0) - res0[i]);
  }
  out.got = got;
  return out;
}

// ---------- many players → medians ----------
const runs = Array.from({ length: RUNS }, (_, i) => simulate(1000 + i));
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (a, q) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };
const nodes = Object.keys(D.techtree || {});
const report = {
  set: SET || 'Standard', runs: RUNS, days: DAYS, assumptions: P,
  nodes: Object.fromEntries(nodes.map(n => [n, { median: med(runs.map(r => r.nodes[n])), p90: pct(runs.map(r => r.nodes[n]), 0.9), reached: runs.filter(r => r.nodes[n] != null).length / RUNS }])),
  tank: { deadShare: runs.filter(r => r.tankDead != null).length / RUNS, deadMedian: med(runs.map(r => r.tankDead)), minMedian: med(runs.map(r => r.tankMin)), maintPerRun: med(runs.map(r => r.maint)) },
  kos: med(runs.map(r => r.kos)),
  deltas: { start: D.economy?.startDeltas ?? 0, day10: med(runs.map(r => r.deltas[9])), day20: med(runs.map(r => r.deltas[19])), end: med(runs.map(r => r.deltas[DAYS - 1])) },
  resPerDay: Object.fromEntries(Object.entries(runs[0].resPerDay).map(([k]) => [k, Math.round(runs.reduce((n, r) => n + r.resPerDay[k].reduce((a, b) => a + b, 0), 0) / RUNS / DAYS * 10) / 10])),
  heilmittelCost: Object.fromEntries((D.techtree.heilmittel?.cost || []).map(c => [c.resource, c.count])),
  treeCost: nodes.reduce((m, n) => { for (const c of D.techtree[n].cost || []) m[c.resource] = (m[c.resource] || 0) + (c.count || 0); return m; }, {}),
};
if (asJson) console.log(JSON.stringify(report, null, 1));
else {
  console.log(`Balancing-Simulation · ${report.set} · ${RUNS} Spieler × ${DAYS} Tage`);
  console.log('Techtree (Tag, Median / 90 %, erreicht):');
  for (const [n, x] of Object.entries(report.nodes)) console.log(`  ${n.padEnd(16)} ${String(x.median ?? '–').padStart(3)} / ${String(x.p90 ?? '–').padStart(3)}  ${Math.round(x.reached * 100)} %`);
  console.log(`Ressourcen je Tag: ${Object.entries(report.resPerDay).map(([k, v]) => `${k} ${v}`).join(' · ')}   ganzer Baum kostet: ${Object.entries(report.treeCost).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`Tank: tot in ${Math.round(report.tank.deadShare * 100)} % (Median Tag ${report.tank.deadMedian ?? '–'}), tiefster Stand ${Math.round(report.tank.minMedian)} %, Pflege ${report.tank.maintPerRun}×`);
  console.log(`k.o. je Spieler: ${report.kos} · Δ Start ${report.deltas.start}, Tag 10 ${report.deltas.day10}, Tag 20 ${report.deltas.day20}, Ende ${report.deltas.end}`);
}
