// #174 Türen: what the door planner puts into every POI (side doors by kind and state, front doors, paired entrances) and the door audit.
//   node tools/doors_stats.mjs [--seeds 8] [--poi id] [--verbose]
import path from 'path';
import { fileURLToPath } from 'url';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from './loader.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { doorAudit } from '../engine/doors.js';

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const seeds = +(opt('--seeds') || 8), only = opt('--poi'), verbose = args.includes('--verbose');
const D = (await loadProject(nodeLoader(path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl')))).data;
let bad = 0;
for (const poi of Object.keys(D.pois)) {
  if (only && poi !== only) continue;
  if (!poiReady(D, poi).ok) continue;
  const n = { seam: 0, entrance: 0, inner: 0, hand: 0, open: 0, closed: 0, broken: 0, locked: 0, front: 0, links: 0 }, types = {}, finds = [];
  for (let s = 1; s <= seeds; s++) {
    const L = buildPoi(D, poi, s);
    for (const d of L.doors.side) { n[d.kind]++; n[d.state]++; types[d.type] = (types[d.type] || 0) + 1; }
    n.front += L.doors.front.length; n.links += L.doors.links;
    for (const f of L.doors.front) types['F:' + f.type] = (types['F:' + f.type] || 0) + 1;
    for (const f of doorAudit(D, poi, L)) finds.push(`Seed ${s}: ${f.what} · ${f.text}`);
    if (verbose) console.log(poi, s, L.doors.side.map(d => `${d.kind}/${d.type}/${d.state}@${d.x},${d.feet}`).join(' '));
  }
  bad += finds.length;
  console.log(`${poi}: Profil ${n.seam + n.entrance + n.inner + n.hand} (Naht ${n.seam}, Eingang ${n.entrance}, innen ${n.inner}, Hand ${n.hand}) · offen ${n.open} zu ${n.closed} zerstört ${n.broken} verschlossen ${n.locked} · Rückwand ${n.front} (Paare ${n.links}) · ${Object.entries(types).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const f of finds) console.log('  ' + f);
}
console.log(bad ? `${bad} Befunde` : 'Türen: keine Befunde');
process.exitCode = bad ? 1 : 0;
