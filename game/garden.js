// Hydroponics in the rig (Daniel, 12.11.2026: „eine Hydrokultur, … dass man erkennen kann, welche Pflanzen da wachsen“).
// Every pot of a workshop with function „garden“ grows one crop in event time (Werkstätten › Hydrokultur: Töpfe, Sorten).
// Stage 0 sprout … 3 ripe; E at the bench harvests what is ripe into the camp inventories and plants anew. No DOM.
//
//   save.garden['<unit>:<place>'] = [hour planted, …]   one entry per pot (clock hours: day * 24 + hour)
import { clockHours } from './tank.js';
import { give } from './crafting.js';
import { bonuses as trophyBonuses } from './achievements.js';

export const STAGES = 4;

export function potsOf(D, ws) { return D.workshops?.[ws]?.garden?.pots || []; }
export function cropOf(D, ws, pot) {
  const G = D.workshops?.[ws]?.garden || {}, crops = G.crops || [];
  return crops[Math.max(0, Math.min(crops.length - 1, (Number(pot.crop) || 1) - 1))] || null;
}

// the pots of one bench, planted at the current hour the first time we look
export function bed(D, save, ws, place) {
  const G = (save.garden ??= {}), key = Array.isArray(place) ? place.join(':') : String(place), n = potsOf(D, ws).length, now = clockHours(save);
  const b = (G[key] ??= []);
  while (b.length < n) b.push(now);
  b.length = n;
  return b;
}

// 0 … STAGES-1 (ripe), and how far it is (0 … 1)
export function stage(D, save, ws, place, i) {
  const pot = potsOf(D, ws)[i], c = pot && cropOf(D, ws, pot);
  if (!c) return { stage: 0, p: 0 };
  const fast = 1 + Math.max(0, trophyBonuses(D, save).growth || 0) / 100;   // Goldene Gießkanne (#012)
  const p = Math.max(0, Math.min(1, (clockHours(save) - bed(D, save, ws, place)[i]) * fast / Math.max(0.1, c.hours || 24)));
  return { stage: p >= 1 ? STAGES - 1 : Math.min(STAGES - 2, Math.floor(p * (STAGES - 1))), p, crop: c };
}

export function ripe(D, save, ws, place) { return potsOf(D, ws).map((_, i) => stage(D, save, ws, place, i)).filter(s => s.stage === STAGES - 1).length; }

// harvest every ripe pot: its crop into the camp inventories (backpack, chest, storage), the pot starts again; → { got: [{ id, n }], left }
export function harvest(D, save, ws, place) {
  const b = bed(D, save, ws, place), now = clockHours(save), got = {}, left = {};
  potsOf(D, ws).forEach((pot, i) => {
    const s = stage(D, save, ws, place, i);
    if (s.stage !== STAGES - 1 || !s.crop?.item || !D.items?.[s.crop.item]) return;
    const n = s.crop.count || 1, rest = give(D, save, s.crop.item, n);
    got[s.crop.item] = (got[s.crop.item] || 0) + n - rest;
    if (rest) left[s.crop.item] = (left[s.crop.item] || 0) + rest;
    b[i] = now;
  });
  return { got: Object.entries(got).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n })), left: Object.entries(left).map(([id, n]) => ({ id, n })) };
}

// hours until the next pot is ripe (for the menu), null = something is ripe already
export function nextRipe(D, save, ws, place) {
  let best = Infinity;
  potsOf(D, ws).forEach((pot, i) => { const s = stage(D, save, ws, place, i); if (s.stage === STAGES - 1) best = 0; else if (s.crop) best = Math.min(best, (1 - s.p) * (s.crop.hours || 24)); });
  return best === Infinity ? null : best;
}
