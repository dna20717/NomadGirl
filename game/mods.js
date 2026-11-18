// Boni-Bus (#066, Daniel 18.11.2026, Eleganz-Prüfung Punkt 1: „Boni ohne gemeinsamen Bus“): every source of a camp-side bonus in one
// place, with where each point comes from. No DOM. Before, every call site asked the sources it knew (garden: trophies × synergy ×
// worker; travel: worker; sleep: worker …); now they ask the bus, and new sources join here once.
//
//   parts(D, save, stat, ctx)   → [{ source, label, value }]   (value in the stat's unit, usually %)
//   mod(D, save, stat, ctx)     → sum of the values (chances: Koch „perfekt“ %, Schweißer „zurück“ %)
//   modFactor(D, save, stat, ctx) → Π (1 + value / 100) (rates: growth, heal; the same numbers the sites multiplied before)
//   modText(list)               → „Gärtner +24 % · Synergie +10 %“
//   ctx: { place: '<unit>:<at>' } for the synergy of one workshop, { synergy: 'speed' | 'quality' } which kind counts for this stat
import { bonuses as trophyBonuses } from './achievements.js';
import { workers } from './workers.js';
import { brandSets } from './brand_perks.js';
import { synergyAt } from './synergy.js';

// the stats the bus knows (camp-side; Leyla's gear values stay in scene.applyGear)
export const MOD_STATS = [['growth', 'Wachstum', '%'], ['fuel', 'Spritersparnis', '%'], ['sleepHeal', 'Schlaf heilt', '%'], ['rest', 'Ruhe', '%'], ['perfect', 'Perfekt kochen', '%'],
  ['refund', 'Zutat zurück', '%'], ['power', 'Strom', ' ⚡'], ['sell', 'Mehr Δ aus Runs', '%'], ['loot', 'Extra-Beute', '%']];
const unitOf = stat => MOD_STATS.find(s => s[0] === stat)?.[2] ?? '%';

export function parts(D, save, stat, ctx = {}) {
  if (!save) return [];
  const out = [], push = (source, label, value) => { if (value) out.push({ source, label, value: Math.round(value * 10) / 10 }); };
  push('trophy', 'Trophäen', trophyBonuses(D, save)[stat] || 0);
  if (ctx.place && ctx.synergy) { const s = synergyAt(D, save, ctx.place); if (s?.effect === ctx.synergy) push('synergy', 'Synergie', s.bonus); }
  for (const k of workers(D, save)) if (k.stat === stat) push('worker', k.g.name, k.value);
  const b = brandSets(D, save); for (const x of b.list) if (x.on && x.stat === stat) push('brand', `Markentreue ${x.name}`, x.value);
  return out;
}
export const mod = (D, save, stat, ctx) => parts(D, save, stat, ctx).reduce((n, p) => n + p.value, 0);
export const modFactor = (D, save, stat, ctx) => parts(D, save, stat, ctx).reduce((f, p) => f * (1 + p.value / 100), 1);
export function modText(list, stat = '') {
  const u = unitOf(stat);
  return list.map(p => `${p.label} ${p.value > 0 ? '+' : ''}${String(p.value).replace('.', ',')}${u === '%' ? ' %' : u}`).join(' · ');
}
