// Die Zelle: Gefangene (#079, Daniel 19.11.2026: „Ist zunächst die Grundlage, um Gefangene transportieren zu können. Also ein spezielles
// Inventar. Bau aber die Auftragsart direkt mit ein. Gefangene können in Auseinandersetzungen durch Events beschädigt werden oder auch in
// Dialogen als Ressource zum Einsatz kommen (mit Auswirkungen auf Ruf, produziert Dunkelheit)“). No DOM.
//
// A prisoner is a thing in the inventory (Gegenstand `gefangener`, Kategorie „Gefangener“) with its person on it:
//   e.p = { id, name, gang, hp (0–100), day (caught) }
// Caught in a POI: a raider beaten in melee stays down tied up with Ereignis-Baukasten › Gefangene › Chance; he lies there like loot.
// The Zelle (Werkstatt, Funktion „Zelle“) is the special inventory that takes only prisoners; outside of it they suffer each day.
// On the road: incidents hurt them (a failed risky answer, „Unruhe im Laderaum“), answers use one (Lösegeld, verkaufen, laufen lassen)
// with Ruf for their gang and Dunkelheit (save.dark, the hidden resource; the skill tree comes with #080).
// Auftragsart „Kopfgeld“: a quest that wants prisoners delivered (Quests › Liefern: Gefangener, optional Gang).
import { addRep } from './reputation.js';

export const PRISONER = 'gefangener';
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function prisonerConfig(D) {
  const P = D?.roadEvents?.prisoners || {};
  return { chance: P.chance ?? 35, perDay: P.perDay ?? 1, outside: P.outside ?? 15, useDark: P.useDark ?? 2, hurt: P.hurt ?? 25,
    names: (P.names?.length ? P.names : ['Rattenzahn', 'Kurbel', 'Mo', 'Funke', 'Schnalle', 'Grizzly', 'Pfeife', 'Lotte', 'Bolzen', 'Kiesel', 'Tacker', 'Nadel']) };
}
// a new prisoner from a beaten enemy → the loot entry { a, id, n, p }
export function capture(D, enemy, gang, seed = Math.random()) {
  const C = prisonerConfig(D), h = hash(`${enemy?.id}:${seed}`), name = C.names[h % C.names.length];
  return { a: 'items', id: PRISONER, n: 1, p: { id: `p${h.toString(36)}`, name, gang: gang || null, hp: 100, from: enemy?.d?.name || enemy?.id || '' } };
}
// does this beaten enemy stay down as a prisoner? raiders only, beaten in melee, by chance
export function capturable(D, enemy, lastHit, rnd = Math.random) {
  return enemy?.d?.family === 'raider' && enemy.d.behavior !== 'boss' && lastHit?.kind === 'melee' && rnd() * 100 < prisonerConfig(D).chance;
}

// every prisoner Leyla has, wherever → [{ e, key, grid }]
export function prisoners(save) {
  const out = [];
  for (const [key, g] of Object.entries(save?.inv?.grids || {})) for (const e of g?.items || []) if (e.p && e.id === PRISONER) out.push({ e, key, grid: g });
  return out;
}
export const cellKeys = (D, save, keyOf) => (save?.rig?.units || []).flatMap((u, ui) => (u.workshops || []).filter(w => D.workshops?.[w.id]?.function === 'cell').map(w => keyOf(D, save, ui, w.at))).filter(Boolean);

// Dunkelheit (hidden resource, #079/#080)
export const darkOf = save => Math.max(0, Math.floor(save?.dark || 0));
export function addDark(save, n) { save.dark = Math.max(0, (save.dark || 0) + n); return darkOf(save); }

const drop = (x) => { const i = x.grid.items.indexOf(x.e); if (i >= 0) x.grid.items.splice(i, 1); };
// hurt every prisoner (an incident, a failed fight) → [{ name, died }]; a dead prisoner is gone and leaves Dunkelheit behind
export function hurtAll(D, save, n) {
  const out = [];
  for (const x of prisoners(save)) {
    x.e.p.hp = Math.max(0, (x.e.p.hp ?? 100) - n);
    const died = x.e.p.hp <= 0;
    if (died) { drop(x); addDark(save, prisonerConfig(D).useDark); }
    out.push({ name: x.e.p.name, died });
  }
  return out;
}
// a day passes (the camp): prisoners in the Zelle make Dunkelheit, those elsewhere (backpack, trunk, Camp-Lager) suffer
export function dayTick(D, save, cells, days = 1) {
  const C = prisonerConfig(D), out = { dark: 0, hurt: [] };
  if (days <= 0) return out;
  for (const x of prisoners(save)) {
    if (cells.includes(x.key)) { out.dark += C.perDay * days; continue; }
    x.e.p.hp = Math.max(0, (x.e.p.hp ?? 100) - C.outside * days);
    if (x.e.p.hp <= 0) { drop(x); out.dark += C.useDark; out.hurt.push({ name: x.e.p.name, died: true }); } else out.hurt.push({ name: x.e.p.name, died: false });
  }
  addDark(save, out.dark);
  return out;
}
// the day the camp last counted (save.cellDay): call on arriving in the camp
export function catchUp(D, save, cells) {
  const d = save.day ?? 1, last = save.cellDay ?? d;
  save.cellDay = d;
  return dayTick(D, save, cells, d - last);
}

// an answer uses one (o.prisoner: 'ransom' = back to his gang, 'sell' = to the rivals, 'free' = let him go): the healthiest first,
// of the asked gang if there is one → { name, gang, dark } or null
export function usePrisoner(D, save, o) {
  const list = prisoners(save).sort((a, b) => (b.e.p.hp ?? 0) - (a.e.p.hp ?? 0));
  const x = (o.gang && list.find(y => y.e.p.gang === o.gang)) || list[0];
  if (!x) return null;
  drop(x);
  const dark = o.prisoner === 'free' ? 0 : (o.dark ?? prisonerConfig(D).useDark);
  addDark(save, dark);
  // his gang: back for ransom = they owe Leyla (+), sold to others = they hate her (−); a gang of his own counts even without a situation gang
  const g = x.e.p.gang, rep = o.prisoner === 'ransom' ? 5 : o.prisoner === 'sell' ? -15 : o.prisoner === 'free' ? 3 : 0;
  const r = g && rep ? addRep(D, save, g, rep) : null;
  return { name: x.e.p.name, gang: g, dark, rep: r };
}
// for the tooltip and lists: „Kurbel · Yellow Vultures · 80 %“
export const prisonerLine = p => [p?.name, p?.gang, p ? `${Math.round(p.hp ?? 100)} %` : null].filter(Boolean).join(' · ');
