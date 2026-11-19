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
import { benchAt, upgradeOf, stars } from './upgrades.js';
import { bonusParts } from './techtree.js';
import { gearStats, GEAR_KEYS } from './inventory.js';
import { implantBoosts } from './stations.js';

// the stats the bus knows (camp-side; Leyla's own values: gearParts below, #076)
export const MOD_STATS = [['growth', 'Wachstum', '%'], ['fuel', 'Spritersparnis', '%'], ['sleepHeal', 'Schlaf heilt', '%'], ['rest', 'Ruhe', '%'], ['perfect', 'Perfekt kochen', '%'],
  ['refund', 'Zutat zurück', '%'], ['power', 'Strom', ' ⚡'], ['sell', 'Mehr Δ aus Runs', '%'], ['loot', 'Extra-Beute', '%']];
const unitOf = stat => MOD_STATS.find(s => s[0] === stat)?.[2] ?? '%';

export function parts(D, save, stat, ctx = {}) {
  if (!save) return [];
  const out = [], push = (source, label, value) => { if (value) out.push({ source, label, value: Math.round(value * 10) / 10 }); };
  push('trophy', 'Trophäen', trophyBonuses(D, save)[stat] || 0);
  if (ctx.place && ctx.synergy) { const s = synergyAt(D, save, ctx.place); if (s?.effect === ctx.synergy) push('synergy', 'Synergie', s.bonus); }
  if (ctx.place && ctx.synergy) { const w = benchAt(save, ctx.place), U = w && upgradeOf(D, w); if (U?.level) push('upgrade', `Ausbau ${stars(U.level)}`, ctx.synergy === 'speed' ? U.speed : ctx.synergy === 'quality' ? U.quality : 0); }   // #078
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

// ---------- #076 (Daniel 19.11.2026: „Ausrüstung + Tank auch in den Bus“, Vorstufe Werte-Bildschirm) ----------
// Leyla's values (Ausrüstung › Werte: Schaden, Abwehr, Leben …) with their sources: every worn thing and implant, the Techtree
// (Leben, Schaden), the trophies on the stands, Markentreue. scene.applyGear takes the sums from here.
//   gearParts(D, save) → { stat: [{ source, label, value }] }      gearTotals(D, save) → { stat: sum, strain }
const LEYLA_TREE = ['health', 'damage'], NOT_LEYLA = ['tankDecay', 'droneBattery'];
export function gearParts(D, save) {
  const out = {}, push = (stat, source, label, value) => { if (value) (out[stat] ??= []).push({ source, label, value: Math.round(value * 10) / 10 }); };
  if (!save) return out;
  const boost = implantBoosts(D, save), wear = save.inv?.wear || {};
  for (const [slot, id] of Object.entries(wear)) {
    const g = gearStats(D, { [slot]: id }, boost), t = D.items?.[id], src = t?.category === 'implant' ? 'implant' : 'gear';
    for (const k of GEAR_KEYS) push(k, src, t?.name || id, g[k]);
  }
  for (const p of bonusParts(D, save)) if (p.source === 'techtree' && LEYLA_TREE.includes(p.stat)) push(p.stat, 'techtree', p.label, p.value);
  const tb = trophyBonuses(D, save); for (const k of GEAR_KEYS) if (!NOT_LEYLA.includes(k)) push(k, 'trophy', 'Trophäen', tb[k]);
  const b = brandSets(D, save); for (const x of b.list) if (x.on && GEAR_KEYS.includes(x.stat)) push(x.stat, 'brand', `Markentreue ${x.name}`, x.value);
  return out;
}
export function gearTotals(D, save) {
  const P = gearParts(D, save), out = { strain: gearStats(D, save?.inv?.wear || {}).strain || 0 };
  for (const k of GEAR_KEYS) out[k] = (P[k] || []).reduce((n, p) => n + p.value, 0);
  return out;
}
// the tank and AvA (Tank-Verfall, Rettung, Beschleuniger, AvA-Akku, Lebenszeichen) with their sources → { stat: [{ source, label, value }] }
export function tankParts(D, save) {
  const out = {};
  for (const p of bonusParts(D, save)) if (!LEYLA_TREE.includes(p.stat)) (out[p.stat] ??= []).push({ source: p.source, label: p.label, value: p.value });
  return out;
}
