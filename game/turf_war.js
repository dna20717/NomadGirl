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
