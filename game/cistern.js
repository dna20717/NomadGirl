// The cistern in the rig (#008, Daniel, 13.11.2026: „eine Zisterne-Werkbank, an der man Wasser über Zeit sammelt“).
// Water collects in event time (Werkstätten › Zisterne: per hour, maximum); E at the bench fills it into bottles (an item) and
// gives them to the camp inventories. No DOM.
//
//   save.cistern['<unit>:<place>'] = { water, at }   water in bottles, at = clock hour of the last look
import { clockHours } from './tank.js';
import { give } from './crafting.js';
import { rainHours } from './rain.js';

export function cisternOf(D, ws) { const C = D.workshops?.[ws]?.cistern || {}; return { item: C.item || 'wasser', perHour: Math.max(0, C.perHour ?? 0.25), max: Math.max(1, C.max ?? 8), rain: Math.max(1, C.rain ?? 6) }; }

// how much water is in it now (fills up lazily since the last look; while it rains (game/rain.js) „Bei Regen“ times faster, #014)
export function level(D, save, ws, place) {
  const S = (save.cistern ??= {}), key = Array.isArray(place) ? place.join(':') : String(place), C = cisternOf(D, ws), now = clockHours(save);
  const t = (S[key] ??= { water: 0, at: now });
  const dt = Math.max(0, now - t.at), wet = rainHours(D, save, t.at, now);
  t.water = Math.min(C.max, t.water + (dt + wet * (C.rain - 1)) * C.perHour); t.at = now;
  return { water: t.water, full: Math.floor(t.water), max: C.max, item: C.item, perHour: C.perHour, rain: C.rain, fill: t.water / C.max };
}

// fill every whole bottle into the camp inventories (backpack, chest, storage) → { got, left }
export function tap(D, save, ws, place) {
  const L = level(D, save, ws, place), key = Array.isArray(place) ? place.join(':') : String(place);
  if (!L.full || !D.items?.[L.item]) return { got: 0, left: 0, item: L.item };
  const rest = give(D, save, L.item, L.full), got = L.full - rest;
  save.cistern[key].water -= got;
  return { got, left: 0, item: L.item };
}
