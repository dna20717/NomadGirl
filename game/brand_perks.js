// Markentreue und Influencer (#064, Daniel 18.11.2026: „Billboards auf der Reise sollen ab sofort einen Nachlass ermöglichen. Klickt man
// sie während der Fahrt an, erhält man den Buff „Influencer + Brand“ und damit einen ordentlichen Nachlass (20 Prozent) auf diese Brand in
// den nächsten xy Stunden“; dazu „Markentreue“: drei Teile derselben Marke = ein Set-Bonus). No DOM.
//   save.influencer = { brand, until (clock hours) }   one brand at a time; a new click replaces it
//   Lore › Marken › Markentreue: set.stat (a gear value, game/inventory.js GEAR_STATS), set.value, set.count (default 3)
import { clockHours } from './tank.js';

export function influencerConfig(D) {
  const I = D?.travel?.drive?.influencer || {};
  return { discount: Math.max(0, Math.min(90, I.discount ?? 20)), hours: Math.max(1, I.hours ?? 24),
    perfect: I.perfect ?? 150, edge: I.edge ?? 50, frame: Math.max(0.3, (I.frame ?? 100) / 100), scan: Math.max(0.3, I.scan ?? 1.4) };   // #115 Scan-Dauer
}
// #095 (Daniel 19.11.2026: „Billboard-Minigame darf gerne mehr Geschick-Komponente bekommen“): a snapshot through the viewfinder.
// off = how far the billboard's middle is from the viewfinder's middle, in half viewfinder widths (0 = dead centre, 1 = at its edge)
// → { grade: 'perfect' | 'good' | 'edge' | 'miss', name, factor (of the discount) }
export function shotGrade(D, off) {
  const C = influencerConfig(D), a = Math.abs(off);
  if (a <= 0.18) return { grade: 'perfect', name: 'Perfektes Foto', factor: C.perfect / 100 };
  if (a <= 0.5) return { grade: 'good', name: 'Gutes Foto', factor: 1 };
  if (a <= 1) return { grade: 'edge', name: 'Knapp im Bild', factor: C.edge / 100 };
  return { grade: 'miss', name: 'Verwackelt', factor: 0 };
}
// the running Influencer buff → { brand, name, until, left (h), discount } or null
export function influencer(D, save) {
  const I = save?.influencer;
  if (!I?.brand || !D?.brands?.[I.brand]) return null;
  const left = I.until - clockHours(save);
  return left > 0 ? { brand: I.brand, name: D.brands[I.brand].name, until: I.until, left, discount: I.discount ?? influencerConfig(D).discount } : null;
}
// a billboard was tapped → the buff (replaces another brand's) → { brand, name, hours, renewed }
export function becomeInfluencer(D, save, brand, factor = 1) {
  if (!D?.brands?.[brand]) return null;
  const C = influencerConfig(D), had = influencer(D, save), discount = Math.max(0, Math.min(90, Math.round(C.discount * factor)));
  save.influencer = { brand, until: clockHours(save) + C.hours, discount };   // #095 the photo decides how much
  return { brand, name: D.brands[brand].name, hours: C.hours, discount, renewed: had?.brand === brand };
}
// price factor for something of this brand (1 = full price, 0.8 = 20 % off)
export const brandDiscount = (D, save, brand) => { const I = brand && influencer(D, save); return I && I.brand === brand ? 1 - I.discount / 100 : 1; };

// ---------- Markentreue: what Leyla (and AvA) carry, by brand ----------
export function brandCounts(D, save) {
  const inv = save?.inv || {}, n = {};
  for (const k of ['melee', 'ranged', 'cyberdeck']) { const b = D.weapons?.[inv.slots?.[k]]?.brand; if (b) n[b] = (n[b] || 0) + 1; }
  for (const id of Object.values(inv.wear || {})) { const b = id && D.items?.[id]?.brand; if (b) n[b] = (n[b] || 0) + 1; }
  return n;
}
// the set bonuses that hold → [{ brand, name, n, need, stat, value }] and the gear values they add ({ stat: value })
export function brandSets(D, save) {
  const counts = brandCounts(D, save), list = [], stats = {};
  for (const [brand, n] of Object.entries(counts)) {
    const B = D.brands?.[brand], S = B?.set;
    if (!S?.stat || !S.value) continue;
    const need = Math.max(2, S.count ?? 3);
    list.push({ brand, name: B.name, n, need, stat: S.stat, value: S.value, on: n >= need });
    if (n >= need) stats[S.stat] = (stats[S.stat] || 0) + S.value;
  }
  return { list: list.sort((a, b) => b.n - a.n), stats };
}
