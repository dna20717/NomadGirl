// Revierkrieg (#089, Daniel 19.11.2026: „#087–#091 Systeme bauen“; Ideenspeicher: „Ruf bei einer Gang senkt den bei ihren Rivalen;
// Reviere verschieben sich auf der Reisekarte, Fehden werden zu Fronten“). No DOM.
//   Rivalen      POI › Gang › Rivalen (both ways); Ruf spills over in reputation.js (addRep)
//   Übernahme    Leyla fights her way through a gang's place (no peace, at least one kill, vault cracked): the rival she stands best
//                with moves in (save.turfs[node] = gang). The place then has their colours, their peace, their jobs. Their own home
//                place falling back to them clears the entry.
//   Fronten      a road between two places of rival gangs; drawn on the travel map, a feud on the road there is likelier
import { rivalsOf, repOf, repConfig, gangOfPlace } from './reputation.js';

// who moves in after Leyla cleared `node` of `gang` → { node, from, to } or null (nothing changes when the gang has no rivals)
export function takeover(D, save, node, gang) {
  if (!gang || !node || !repConfig(D).takeover) return null;
  const R = rivalsOf(D, gang);
  if (!R.length) return null;
  const to = [...R].sort((a, b) => repOf(save, b) - repOf(save, a) || a.localeCompare(b))[0];
  const T = (save.turfs ??= {});
  T[node] = to;
  const home = (() => { const n = save.map?.nodes?.find(x => x.id === node), poi = n?.poi || D.locations?.[node]?.poi; return D.pois?.[poi]?.gang?.name || null; })();
  if (home === to) delete T[node];
  return { node, from: gang, to };
}
// the roads between rival gangs: [{ a, b, ga, gb }]
export function fronts(D, save) {
  const m = save?.map; if (!m) return [];
  const out = [];
  for (const [a, b] of m.edges || []) {
    const ga = gangOfPlace(D, save, a), gb = gangOfPlace(D, save, b);
    if (ga && gb && ga !== gb && rivalsOf(D, ga).includes(gb)) out.push({ a, b, ga, gb });
  }
  return out;
}
export const onFront = (D, save, a, b) => fronts(D, save).find(f => (f.a === a && f.b === b) || (f.a === b && f.b === a)) || null;

// #102 Gangs kämpfen selbst (Daniel 19.11.2026: „Alle paar Tage wechselt ein Ort an einer Front den Besitzer“): every Ruf › Krieg
// alle … Tage of Ereignis-Zeit one front may flip: the gang holding more places (plus luck) takes the other side's place. Leyla's own
// place stays as it is while she is there. save.turfWar = { at: absolute hour of the last check, log: [{ day, node, from, to }] }
// → [{ node, place, from, to }] (what changed since the last arrival)
export function gangWar(D, save, rnd = Math.random) {
  const C = repConfig(D), now = (save.day || 1) * 24 + (save.hour || 0), W = (save.turfWar ??= { at: now, log: [] });
  if (!C.takeover || !C.warEvery || !save.map) { W.at = now; return []; }
  const out = [], held = g => (save.map.nodes || []).filter(n => gangOfPlace(D, save, n.id) === g).length;
  let checks = Math.floor((now - W.at) / (24 * C.warEvery));
  while (checks-- > 0) {
    W.at += 24 * C.warEvery;
    if (rnd() * 100 >= C.warChance) continue;
    const F = fronts(D, save).filter(f => f.a !== save.location && f.b !== save.location);
    if (!F.length) break;
    const f = F[Math.floor(rnd() * F.length)], sa = held(f.ga) + rnd() * 2, sb = held(f.gb) + rnd() * 2;
    const [winner, loser, node] = sa >= sb ? [f.ga, f.gb, f.b] : [f.gb, f.ga, f.a];
    const T = (save.turfs ??= {}), n = save.map.nodes.find(x => x.id === node), home = D.pois?.[n?.poi || D.locations?.[node]?.poi]?.gang?.name || null;
    if (home === winner) delete T[node]; else T[node] = winner;
    const x = { day: Math.floor(W.at / 24), node, place: n?.name || D.locations?.[node]?.name || node, from: loser, to: winner };
    out.push(x); W.log = [...(W.log || []), x].slice(-12);
  }
  return out;
}
