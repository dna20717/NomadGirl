// Incidents on the road (#014, Daniel 13.11.2026: „Mehrere Etappen + Ereignisse (Panne, Händler, Hinterhalt)“). A drive is cut into
// legs (one road each); after every leg an encounter may happen (Reisen › Chance pro 10 km, more at night). An encounter
// (Welt › Encounter) tells what happens and offers choices; a choice costs or gives time, fuel, food, Δ, health, things.
// No DOM.
import { advance } from './save.js';
import { give, take, have } from './crafting.js';
import { rollLoot } from './inventory.js';

const isNight = (D, hour) => { const T = D.travel || {}, len = T.dayLength || 24, night = (T.nightShare ?? 40) / 100 * len; return hour >= len - night / 2 || hour < night / 2; };

// chance of an encounter on a leg of km kilometres (Reisen › Chance pro 10 km, nights × (1 + Gefahr nachts %))
export function encounterChance(D, km, hour) {
  const T = D.travel || {}, p = Math.max(0, Math.min(1, (T.encounterChance ?? 15) / 100 * (isNight(D, hour) ? 1 + (T.nightDanger ?? 0) / 100 : 1)));
  return 1 - Math.pow(1 - p, Math.max(0, km) / 10);
}
// roll the encounter of a leg → id or null (weights; „Tageszeit“ day / night / any; only encounters with choices)
export function rollEncounter(D, save, km, rnd = Math.random) {
  if (rnd() >= encounterChance(D, km, save.hour ?? 12)) return null;
  const night = isNight(D, save.hour ?? 12);
  const all = Object.entries(D.encounters || {}).filter(([, e]) => (e.options || []).length && (e.weight ?? 1) > 0 && (!e.time || e.time === 'any' || (e.time === 'night') === night));
  const total = all.reduce((n, [, e]) => n + (e.weight ?? 1), 0);
  let k = rnd() * total;
  for (const [id, e] of all) if ((k -= e.weight ?? 1) < 0) return id;
  return all[0]?.[0] || null;
}
// may this choice be taken? → reason or null (enough Δ, fuel, the thing it uses)
export function blocked(D, save, o) {
  if (o.deltas < 0 && (save.deltas || 0) < -o.deltas) return `Zu wenig Δ (${-o.deltas})`;
  if (o.fuel > 0 && (save.fuel || 0) < o.fuel) return 'Zu wenig Sprit';
  if (o.use && have(D, save, o.use) < (o.useCount || 1)) return `Braucht ${o.useCount || 1}× ${D.items?.[o.use]?.name || o.use}`;
  return null;
}
// take a choice → { lines: [what happened], things: [{ id, n }], health (% of max, negative = damage) }
export function choose(D, save, o, rnd = Math.random) {
  const lines = [], things = [];
  if (o.use) { take(D, save, o.use, o.useCount || 1); lines.push(`−${o.useCount || 1} ${D.items?.[o.use]?.name || o.use}`); }
  if (o.hours) { advance(save, o.hours); lines.push(`${o.hours > 0 ? '+' : ''}${o.hours} h`); }
  if (o.fuel) { save.fuel = Math.max(0, Math.round(((save.fuel || 0) - o.fuel) * 10) / 10); lines.push(`${o.fuel > 0 ? '−' : '+'}${Math.abs(o.fuel)} l Sprit`); }
  if (o.food) { save.food = Math.max(0, Math.round(((save.food || 0) - o.food) * 10) / 10); lines.push(`${o.food > 0 ? '−' : '+'}${Math.abs(o.food)} Vorräte`); }
  if (o.deltas) { save.deltas = Math.max(0, (save.deltas || 0) + o.deltas); lines.push(`${o.deltas > 0 ? '+' : '−'}${Math.abs(o.deltas)} Δ`); }
  if (o.item && D.items?.[o.item]) { const n = o.count || 1, rest = give(D, save, o.item, n); things.push({ id: o.item, n: n - rest }); }
  if (o.loot) for (const e of rollLoot(D, o.loot, rnd)) { if (e.a !== 'items') continue; const rest = give(D, save, e.id, e.n); things.push({ id: e.id, n: e.n - rest }); }
  for (const t of things) if (t.n > 0) lines.push(`+${t.n} ${D.items?.[t.id]?.name || t.id}`);
  if (o.health) { save.health = Math.max(1, Math.round((save.health ?? 100) - o.health)); lines.push(`−${o.health} Leben`); }
  return { lines, things, text: o.result || '' };
}
