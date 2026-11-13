// Rain in the camp (#014, Daniel 13.11.2026: „Regen füllt sie“ for the cistern). Some days it rains for a few hours; which days
// and when is rolled from the day number and the seed of the save, so the same save always has the same weather. Camp › Regen:
// chance per day, how long, the sky it uses. No DOM.
import { clockHours } from './tank.js';

export function rainConfig(D) {
  const R = D.camp?.rain || {}, h = Array.isArray(R.hours) ? R.hours : [2, 6];
  return { enabled: R.enabled !== false, chance: R.chance ?? 30, hours: [Math.max(1, h[0] ?? 2), Math.max(h[0] ?? 2, h[1] ?? 6)], look: R.look || 'abendglut_regen' };
}
const hash = n => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const seedOf = save => (save.map?.seed ?? 7) | 0;

// the rain of one day: { from, to } in clock hours, or null for a dry day
export function rainOn(D, save, day) {
  const R = rainConfig(D);
  if (!R.enabled || R.chance <= 0) return null;
  const s = seedOf(save) * 7919 + day * 104729;
  if (hash(s + 1) * 100 >= R.chance) return null;
  const from = day * 24 + Math.floor(hash(s + 2) * 24), len = R.hours[0] + Math.round(hash(s + 3) * (R.hours[1] - R.hours[0]));
  return { from, to: from + len };
}
// does it rain at this clock hour?
export function rainingAt(D, save, h) {
  const d = Math.floor(h / 24);
  for (const day of [d - 1, d]) { const w = rainOn(D, save, day); if (w && h >= w.from && h < w.to) return true; }
  return false;
}
export const raining = (D, save) => rainingAt(D, save, clockHours(save));
// hours of rain between two clock hours (for things that grow or fill up in event time)
export function rainHours(D, save, a, b) {
  if (!(b > a)) return 0;
  let n = 0;
  for (let day = Math.floor(a / 24) - 1; day <= Math.floor(b / 24); day++) { const w = rainOn(D, save, day); if (w) n += Math.max(0, Math.min(b, w.to) - Math.max(a, w.from)); }
  return n;
}
