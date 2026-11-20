// Werkstätten ausbauen (#078, Daniel 19.11.2026: „Bau bitte das ganze Fundament dafür und ermögliche den Ausbau von Werkstätten.
// Kennzeichne es dann mit Sternchen neben dem Titel der Werkstatt in der Rig-Ansicht und in der jeweiligen Werkstatt“). No DOM.
//
// Werkstätten › Ausbau: one row per step (★, ★★, ★★★): name, price (Δ + one kind of thing), hours of work, what it adds
// (faster %, stronger buff %, power ⚡) and optionally its own picture. Every built workshop remembers its step on the rig
// (`w.level`, 0 = as bought). The values add up over the steps.
import { stock, take } from './crafting.js';
import { advance, fitContainers } from './save.js';

export const STAR = '★';
export const stepsOf = (D, id) => (D.workshops?.[id]?.upgrades || []).filter(r => r && (r.name || r.deltas || r.item));
export const levelOf = w => Math.max(0, Math.floor(Number(w?.level) || 0));
export const stars = n => (n > 0 ? STAR.repeat(n) : '');
// „Werkbank ★★“
export const titleOf = (D, w) => { const n = D.workshops?.[w.id]?.name || w.id, s = stars(Math.min(levelOf(w), stepsOf(D, w.id).length)); return s ? `${n} ${s}` : n; };

// the workshop instance at a place (ui:at) on the rig
export function benchAt(save, place) {
  const [ui, at] = String(place || '').split(':').map(Number);
  return save?.rig?.units?.[ui]?.workshops?.find(w => w.at === at) || null;
}
// what the steps up to now add → { level, max, speed, quality, power, look, next }
export function upgradeOf(D, w) {
  const S = stepsOf(D, w?.id), level = Math.min(levelOf(w), S.length), out = { level, max: S.length, speed: 0, quality: 0, power: 0, rows: 0, look: null, next: S[level] || null };
  for (const r of S.slice(0, level)) { out.speed += Number(r.speed) || 0; out.quality += Number(r.quality) || 0; out.power += Number(r.power) || 0; out.rows += Number(r.rows) || 0; if (r.look) out.look = r.look; }
  return out;
}
// the best speed of all built workshops with this id (crafting does not know which of two benches is used, like synergy.speedOf)
export function speedOf(D, save, id) {
  let best = 0;
  for (const u of save?.rig?.units || []) for (const w of u.workshops || []) if (w.id === id) best = Math.max(best, upgradeOf(D, w).speed);
  return best;
}
// extra power of all upgrades on a rig (rig.budgets)
export const powerOf = (D, rig) => (rig?.units || []).reduce((n, u) => n + (u.workshops || []).reduce((k, w) => k + upgradeOf(D, w).power, 0), 0);

// can this one be taken a step further? → null or the reason
export function blocked(D, save, w) {
  const U = upgradeOf(D, w), r = U.next;
  if (!r) return U.max ? 'Voll ausgebaut' : 'Kein Ausbau';
  if ((Number(r.deltas) || 0) > (save.deltas || 0)) return `Zu wenig Δ (${r.deltas})`;
  if (r.item && (stock(D, save)[r.item] || 0) < (Number(r.count) || 1)) return `Braucht ${Number(r.count) || 1}× ${D.items?.[r.item]?.name || r.item}`;
  return null;
}
// what the next step costs and brings, for menus: „350 Δ · 2× Kabelbaum · 3 h“, „+15 % schneller · Buff +10 %“
export function costText(D, r) {
  if (!r) return '';
  return [r.deltas ? `${r.deltas} Δ` : null, r.item ? `${Number(r.count) || 1}× ${D.items?.[r.item]?.name || r.item}` : null, r.hours ? `${String(r.hours).replace('.', ',')} h` : null].filter(Boolean).join(' · ');
}
export function gainText(r) {
  if (!r) return '';
  return [r.speed ? `+${r.speed} % schneller` : null, r.quality ? `Buff +${r.quality} %` : null, r.power ? `${r.power > 0 ? '+' : ''}${r.power} ⚡` : null, r.rows ? `+${r.rows} ${r.rows === 1 ? 'Reihe' : 'Reihen'} Lager` : null].filter(Boolean).join(' · ') || 'neues Aussehen';
}
// do it: pay, the time passes, one star more → { ok, level, step } or { ok: false, why }
export function upgrade(D, save, place) {
  const w = benchAt(save, place);
  if (!w) return { ok: false, why: 'Keine Werkstatt' };
  const why = blocked(D, save, w);
  if (why) return { ok: false, why };
  const r = upgradeOf(D, w).next;
  save.deltas = (save.deltas || 0) - (Number(r.deltas) || 0);
  if (r.item) take(D, save, r.item, Number(r.count) || 1);
  if (r.hours) advance(save, Number(r.hours));
  w.level = levelOf(w) + 1;
  if (r.rows) fitContainers(D, save);   // #099 the Speziallager grows right away
  return { ok: true, level: w.level, step: r };
}
