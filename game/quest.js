// The red thread (#016, Daniel 14.11.2026: „Den roten Faden bitte auch mit aufnehmen“): one line that says what the search for AvA's
// cure needs next, taken from the mechanics (design.md: „Die Ziele kommen aus der Mechanik“). No DOM: browser and Node.
//   goal(D, save) → { kind: 'tank' | 'step' | 'ready' | 'done' | 'lost', text, sub, progress (0..1 of the way to the goal node) } | null
//   tank weak (below Spiel › Zielzeile › Tank zuerst unter) → the tank first; else the next node on the way to the goal (Endziel)
import { owned, status, have } from './techtree.js';
import { phase, hoursLeft } from './tank.js';

// all nodes the goal needs (itself included), parents before children
export function pathTo(D, goal) {
  const T = D.techtree || {}, out = [], seen = new Set();
  const visit = id => { if (seen.has(id) || !T[id]) return; seen.add(id); for (const r of T[id].requires || []) visit(r); out.push(id); };
  visit(goal);
  return out;
}
const costOf = n => (n?.cost || []).reduce((s, c) => s + (c.count || 0), 0);

export function progress(D, save, goal = goalId(D)) {
  const ids = pathTo(D, goal), all = ids.reduce((s, id) => s + costOf(D.techtree[id]), 0);
  return all ? ids.filter(id => owned(save, id)).reduce((s, id) => s + costOf(D.techtree[id]), 0) / all : 0;
}
export const goalId = D => D.game?.quest?.goal || 'heilmittel';

export function goal(D, save) {
  const Q = D.game?.quest || {};
  if (Q.enabled === false || !save) return null;
  const gid = goalId(D), G = D.techtree?.[gid];
  if (!G) return null;
  const p = progress(D, save, gid), name = G.name || gid;
  if (owned(save, gid)) return { kind: 'done', text: `${name}: gefunden`, sub: 'AvA ist frei.', progress: 1 };
  const t = save.tank;
  if (t?.dead) return { kind: 'lost', text: 'AvAs Tank ist still', sub: 'Die Suche ist in diesem Durchgang verloren.', progress: p };
  if (t && t.cond < (Q.tankWarn ?? 45)) {
    const ph = phase(D, save), days = Math.max(0, Math.round(hoursLeft(D, save) / 24));
    return { kind: 'tank', text: `AvAs Tank: ${Math.round(t.cond)} % · ${ph.name}`, sub: `Noch etwa ${days} ${days === 1 ? 'Tag' : 'Tage'} · Wartung am Cryo-Tank`, progress: p };
  }
  // the next step: the first node on the way whose parents are all owned; the one that can be bought now goes first
  const open = pathTo(D, gid).filter(id => !owned(save, id)).map(id => ({ id, st: status(D, save, id) })).filter(x => x.st.state !== 'locked');
  const next = open.find(x => x.st.state === 'ready') || open[0];
  if (!next) return null;
  const n = D.techtree[next.id];
  if (next.st.state === 'ready') return { kind: 'ready', text: `${name}: ${n.name || next.id} bereit`, sub: 'Freischalten im Warroom › Techtree', progress: p };
  const miss = next.st.miss || [];
  const r0 = miss[0] && D.resources?.[miss[0].resource];
  const sub = miss.map(c => `${c.count - c.have} ${D.resources?.[c.resource]?.name || c.resource}`).join(' · ') + (r0?.source ? ` (${r0.source})` : '');
  return { kind: 'step', text: `${name}: ${n.name || next.id}`, sub: 'Fehlt ' + sub, progress: p, node: next.id };
}
export { have };
