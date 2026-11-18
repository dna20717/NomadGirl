// Bit-Farm und Worker (#060, Daniel 18.11.2026: „eine neue Werkstatt … ein Inventar, in dem man die AIs speichern kann. Entities, die
// dort gespeichert sind, können dann an bestimmten Werkbänken als Worker ausgewählt werden“; Antworten: Name „Bit-Farm“, Worker =
// „Charakter-Bonus“ (Bonus und Macke aus dem Charakter), Chill-Ecke: freundliches Duell, „Bindung steigt“). No DOM.
//
// The Entities live as items (`glitchling` with `e.g`, game/inventory.js) in the grid of a Bit-Farm (Werkstatt-Art `bitfarm`). One of
// them works at a workshop of the rig: `w.worker = <Entity id>` on the workshop instance (rig.units[].workshops[]). It works only while
// it is still in a Bit-Farm. Its bonus is its talent (Entities › Begabungen: stat, „{n}“ per bit × bits; full at its own workshop or
// „Auch als“, else Fremde Werkbank %), times its Bindung (+10 % per level, 0–5). Its Macke comes from its quirk's kind:
//   time („nur nachts“: only from 20 to 6 h; „Vollmond“: every 7th day nothing), weather (rain: nothing), neighbour (generator / drone in
//   the rig, other Entities at work: half), mood (one day in four: no mood, nothing), odd (distracted: −15 %).
import { config, effectOf } from './glitchlings.js';
import { storeKeyOf } from './save.js';
import { raining } from './rain.js';
import { clockHours } from './tank.js';

export const FARM = 'bitfarm';
export const BOND_MAX = 5;
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const fnOf = (D, w) => D.workshops?.[w?.id]?.function || null;

// every workshop instance of the rig → [{ ui, at, w, def }]
export function rigBenches(D, save) {
  const out = [];
  (save?.rig?.units || []).forEach((u, ui) => (u.workshops || []).forEach(w => out.push({ ui, at: w.at, w, def: D.workshops?.[w.id] || {} })));
  return out;
}
// the grids of all Bit-Farms → [key]
export const farmKeys = (D, save) => [...new Set(rigBenches(D, save).filter(b => b.def.function === FARM).map(b => storeKeyOf(D, save, b.ui, b.at)).filter(Boolean))];
// the Entities kept there → [{ g, e, key }]
export function farmEntities(D, save) {
  const out = [];
  for (const key of farmKeys(D, save)) for (const e of save?.inv?.grids?.[key]?.items || []) if (e.g) out.push({ g: e.g, e, key });
  return out;
}
const findG = (D, save, id) => farmEntities(D, save).find(x => x.g.id === id) || null;

// the workshops this Entity can work at: its own (Begabung › Werkbank, Auch als) first, then the others with a reduced effect
export function placesFor(D, save, g) {
  const C = config(D), t = C.talents.find(x => x.name === g.talent);
  return rigBenches(D, save).filter(b => b.def.function && b.def.function !== FARM && !['storage', 'tank'].includes(b.def.function))
    .map(b => { const own = !!t && [t.function, t.also].includes(b.def.function); return { ...b, own, effect: effectOf(C, t || g.talent, g.bits, own) }; })
    .sort((a, b) => Number(b.own) - Number(a.own));
}
export const workplaceOf = (D, save, id) => rigBenches(D, save).find(b => b.w.worker === id) || null;
export function assign(D, save, id, ui, at) {
  for (const b of rigBenches(D, save)) if (b.w.worker === id) delete b.w.worker;
  const b = rigBenches(D, save).find(x => x.ui === ui && x.at === at);
  if (!b || !findG(D, save, id)) return false;
  b.w.worker = id;
  return true;
}
export function unassign(D, save, id) { let n = 0; for (const b of rigBenches(D, save)) if (b.w.worker === id) { delete b.w.worker; n++; } return n > 0; }

// the Macke today → { factor (0–1), why }
export function flawOf(D, save, g, others = 0) {
  const q = String(g.quirk || '').toLowerCase(), day = save?.day ?? 1, h = clockHours(save) % 24;
  switch (g.quirkKind) {
    case 'time':
      if (q.includes('vollmond')) return day % 7 === 0 ? { factor: 0, why: 'Vollmond: macht nur Fehler' } : { factor: 1, why: '' };
      return h >= 20 || h < 6 ? { factor: 1, why: '' } : { factor: 0, why: 'schläft bis 20 Uhr' };
    case 'weather': return raining(D, save) ? { factor: 0, why: 'es regnet' } : { factor: 1, why: '' };
    case 'neighbour': {
      const has = fn => rigBenches(D, save).some(b => b.def.function === fn);
      if (q.includes('generator')) return has('power') ? { factor: 0.5, why: 'hasst den Generator' } : { factor: 1, why: '' };
      if (q.includes('drohne')) return has('drone') ? { factor: 0.5, why: 'Angst vor der Drohne' } : { factor: 1, why: '' };
      return others > 0 ? { factor: 0.5, why: 'eifersüchtig auf die anderen' } : { factor: 1, why: '' };
    }
    case 'mood': return hash(`${g.id}:${day}`) % 4 === 0 ? { factor: 0, why: 'keine Lust heute' } : { factor: 1, why: '' };
    case 'odd': return { factor: 0.85, why: 'lenkt sich ab' };
    default: return { factor: 1, why: '' };
  }
}
export const bondOf = g => Math.max(0, Math.min(BOND_MAX, Math.floor(g?.bond || 0)));

// the Entities at work now → [{ g, ui, at, w, def, own, stat, base, value, flaw }]
export function workers(D, save) {
  const C = config(D), list = [];
  for (const b of rigBenches(D, save)) {
    if (!b.w.worker) continue;
    const x = findG(D, save, b.w.worker);
    if (!x) continue;   // taken out of the farm: does not work
    const t = C.talents.find(y => y.name === x.g.talent), own = !!t && [t.function, t.also].includes(b.def.function), e = effectOf(C, t || x.g.talent, x.g.bits, own);
    list.push({ g: x.g, ui: b.ui, at: b.at, w: b.w, def: b.def, own, stat: e.stat, base: e.value });
  }
  for (const k of list) {
    k.flaw = flawOf(D, save, k.g, list.length - 1);
    k.value = Math.round(k.base * (1 + 0.1 * bondOf(k.g)) * k.flaw.factor * 10) / 10;
  }
  return list;
}
// the sum of one stat over all Entities at work (perfect, refund, growth, power, fuel, sleepHeal, rest, freshness …), in its unit
export const workerBonus = (D, save, stat) => workers(D, save).filter(k => k.stat === stat).reduce((n, k) => n + k.value, 0);
// stats that already do something in the game (the others are shown with „wirkt bald“)
export const WORKING_STATS = ['perfect', 'refund', 'growth', 'power', 'fuel', 'sleepHeal', 'rest'];
// for the power budget (game/rig.js budgets has only the rig): kept on the rig when workers change or the camp is built
export function syncWorkers(D, save) {
  if (!save?.rig) return 0;
  const p = Math.floor(workerBonus(D, save, 'power'));
  if (p) save.rig.workerPower = p; else delete save.rig.workerPower;
  return p;
}

// Bindung: a friendly duel in the Chill-Ecke, once a day per Entity → { bond, up }
export function befriend(D, save, id, won) {
  const x = findG(D, save, id);
  if (!x) return null;
  const day = save.day ?? 1;
  if (x.g.bondDay === day) return { bond: bondOf(x.g), up: false };
  x.g.bondDay = day;
  const before = bondOf(x.g);
  x.g.bond = Math.min(BOND_MAX, (x.g.bond || 0) + (won ? 1 : 0.5));
  return { bond: bondOf(x.g), up: bondOf(x.g) > before };
}
