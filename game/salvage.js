// Salvage projects (#023, design.md › Bergungsprojekt: der LKW): a wreck at a place rolled per Durchgang, rebuilt over several visits
// with parts that lie in other POIs. No DOM: browser and Node.
//
//   save.salvage = { sites: { <project>: { node, cycle } }, built: { <project>: { <row>: n } }, done: { <project>: { day, cycle } }, seen: { <project>: true } }
//   D.salvage[id] = { name, after, hops: [min, max], minCycle, tractor | megarig, steps: [{ step, item, count, where: [poi], hours }], chestChance, anywhere }
// Daniel, 14.11.2026: „Man muss mehrmals zurückgehen, bis er fertig ist“; „Keine Gefahr fürs Wrack“: what is built stays (also over a Durchgang).
import { unlocked } from './unlocks.js';   // #185
import { stock, take } from './crafting.js';
import { hops } from './worldmap.js';

export const sstate = save => { const S = (save.salvage ??= {}); S.sites ??= {}; S.built ??= {}; S.done ??= {}; S.seen ??= {}; return S; };
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// sections in order: rows with the same step name belong together
export function sections(D, id) {
  const out = [];
  for (const [i, r] of (D.salvage?.[id]?.steps || []).entries()) {
    if (!r?.item) continue;
    let s = out.find(x => x.name === (r.step || 'Teile'));
    if (!s) out.push(s = { name: r.step || 'Teile', rows: [] });
    s.rows.push({ i, ...r, count: r.count || 1 });
  }
  return out;
}

// available: the one before is done, the Durchgang has come; done ones stay done
export function open(D, save, id) {
  const x = D.salvage?.[id], S = sstate(save);
  if (!x || S.done[id] || !unlocked(D, save, 'megarigs')) return false;   // #185 Mega-Rigs & Bergung: ganz raus
  if (x.after && !S.done[x.after]) return false;
  return (save.cycle || 1) >= (x.minCycle || 1);
}
export const active = (D, save) => Object.keys(D.salvage || {}).filter(id => open(D, save, id));
export const isDone = (save, id) => !!sstate(save).done[id];

// the place of each open project in this Durchgang: rolled once per map from its seed, so the same map gives the same site
export function ensureSites(D, save) {
  const S = sstate(save), map = save.map;
  if (!map?.nodes?.length) return S.sites;
  const dist = hops(map, map.start), cycle = save.cycle || 1, taken = new Set();
  for (const id of Object.keys(D.salvage || {})) {
    const cur = S.sites[id];
    if (cur && cur.seed === map.seed && map.nodes.some(n => n.id === cur.node)) { taken.add(cur.node); continue; }
    const [lo, hi] = D.salvage[id].hops || [1, 2];
    let pool = map.nodes.filter(n => n.id !== map.start && dist[n.id] >= lo && dist[n.id] <= hi && !taken.has(n.id));
    if (!pool.length) pool = map.nodes.filter(n => n.id !== map.start && !taken.has(n.id)).sort((a, b) => Math.abs((dist[a.id] ?? 9) - lo) - Math.abs((dist[b.id] ?? 9) - lo)).slice(0, 3);
    pool.sort((a, b) => (a.id < b.id ? -1 : 1));
    const r = rng((map.seed ^ hashId(id)) >>> 0);
    const pick = pool[Math.floor(r() * pool.length)];
    if (pick) { S.sites[id] = { node: pick.id, cycle, seed: map.seed }; taken.add(pick.id); }
  }
  // the map shows the wrecks (map_render.js): { node: project name }, only for projects that are open or done
  map.wrecks = Object.fromEntries(Object.entries(S.sites).filter(([id]) => open(D, save, id) || (S.done[id] && unlocked(D, save, 'megarigs'))).map(([id, s]) => [s.node, { id, name: D.salvage[id]?.name || id, done: !!S.done[id] }]));
  return S.sites;
}
const hashId = s => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
export const siteOf = (save, id) => sstate(save).sites[id]?.node || null;
// the project whose wreck stands where the camp is (open or done: a done wreck site is the base)
export function here(D, save) {
  ensureSites(D, save);
  return Object.keys(D.salvage || {}).find(id => siteOf(save, id) === save.location && (open(D, save, id) || (isDone(save, id) && unlocked(D, save, 'megarigs')))) || null;
}

// how far: per row built / needed, the current section, what is missing there and where it may lie
export function progress(D, save, id) {
  const S = sstate(save), built = S.built[id] || {}, secs = sections(D, id), have = stock(D, save);
  let total = 0, got = 0, current = null;
  const out = secs.map((s, si) => {
    const rows = s.rows.map(r => { const b = Math.min(r.count, built[r.i] || 0); total += r.count; got += b; return { ...r, built: b, have: have[r.item] || 0, name: D.items?.[r.item]?.name || r.item, whereNames: (r.where || []).map(p => D.pois?.[p]?.name || p) }; });
    const done = rows.every(r => r.built >= r.count);
    if (!done && current === null) current = si;
    return { name: s.name, rows, done };
  });
  const finished = !!S.done[id];
  return { id, name: D.salvage?.[id]?.name || id, sections: out, current: finished ? null : current, total, got, share: total ? got / total : 1, ready: !finished && current === null && total > 0, finished };
}
// parts still missing in the current section (for the quest line and the loot)
export function missing(D, save, id) {
  const P = progress(D, save, id);
  if (P.current === null) return [];
  return P.sections[P.current].rows.filter(r => r.built < r.count).map(r => ({ item: r.item, name: r.name, need: r.count - r.built, have: r.have, where: r.where || [], whereNames: r.whereNames }));
}

// build in what the camp inventories hold for the current section → { ok, built: [{ item, n }], hours, sectionDone, ready }
export function install(D, save, id) {
  const S = sstate(save), P = progress(D, save, id);
  if (!open(D, save, id) || P.current === null) return { ok: false, built: [], hours: 0 };
  const built = (S.built[id] ??= {}), sec = P.sections[P.current], got = [];
  let hours = 0;
  for (const r of sec.rows) {
    const need = r.count - r.built;
    if (need <= 0) continue;
    const n = take(D, save, r.item, need);
    if (!n) continue;
    built[r.i] = (built[r.i] || 0) + n;
    hours += (r.hours ?? 1) * n / r.count;
    got.push({ item: r.item, name: r.name, n });
  }
  const after = progress(D, save, id);
  return { ok: got.length > 0, built: got, hours: Math.round(hours * 10) / 10, sectionDone: after.sections[P.current].done, section: sec.name, ready: after.ready };
}

// the last step (Probestart): unlocks the reward. The tractor: the Van stays at the site as the base (design.md), the new one pulls the rig.
export function finish(D, save, id, swapTractor = null) {
  const x = D.salvage?.[id], S = sstate(save);
  if (!x || !progress(D, save, id).ready) return { ok: false };
  S.done[id] = { day: save.day ?? 1, cycle: save.cycle || 1 };
  const out = { ok: true, text: x.finale || '', tractor: null, megarig: null };
  if (x.tractor && D.tractors?.[x.tractor]) {
    if (save.mega?.active && save.mega.bay) save.mega.bay.tractor = x.tractor;   // aboard a mega rig: the new tractor waits in the loading bay (Aufräumen 16.11.)
    else swapTractor?.(D, save, x.tractor); save.base = { node: siteOf(save, id), tractor: 'van' }; out.tractor = x.tractor;
  }
  if (x.megarig) { (save.megarigs ??= []).includes(x.megarig) || save.megarigs.push(x.megarig); out.megarig = x.megarig; }
  ensureSites(D, save);
  return out;
}

// a chest in a POI run: maybe one missing part of an open project that lies here (or anywhere, half the chance); vault = sure
export function chestPart(D, save, poi, rnd = Math.random, sure = false) {
  if (!save) return null;
  for (const id of active(D, save)) {
    const x = D.salvage[id];
    const here = missing(D, save, id).filter(m => m.have < m.need && (m.where.includes(poi) || x.anywhere));
    if (!here.length) continue;
    const local = here.filter(m => m.where.includes(poi)), pool = local.length ? local : here;
    const chance = (x.chestChance ?? 30) * (local.length ? 1 : 0.5);
    if (!sure && rnd() * 100 >= chance) continue;
    const m = pool[Math.floor(rnd() * pool.length)];
    return { a: 'items', id: m.item, n: 1, salvage: id };
  }
  return null;
}

// the quest line: the next missing part, where to find it
export function goal(D, save, id) {
  const P = progress(D, save, id);
  if (P.finished) return null;
  if (P.ready) return { kind: 'salvage', text: `${P.name}: Probestart`, sub: 'Zum Wrack fahren und starten', progress: 1 };
  const m = missing(D, save, id)[0], sec = P.sections[P.current];
  const node = save.map?.nodes?.find(n => n.id === siteOf(save, id));
  if (m && m.have >= m.need) return { kind: 'salvage', text: `${P.name}: ${sec.name}`, sub: `Teile da · einbauen am Wrack${node ? ` (${node.name})` : ''}`, progress: P.share };
  return { kind: 'salvage', text: `${P.name}: ${sec.name}`, sub: m ? `${m.name} ${m.have}/${m.need}${m.whereNames.length ? ` · ${m.whereNames.join(', ')}` : ''}` : '', progress: P.share };
}
