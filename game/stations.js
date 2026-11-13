// Workshops with their own action (#013, Daniel 13.11.2026: „Kochen funktioniert anders als ein Gewehr zu bauen“; 1a gemütlich,
// kein Scheitern; 3c Waffen = Bauplan + freie Teile). Pure logic, no DOM: the windows are in game/play/station_ui.js.
//   quality  0 normal · 1 gut · 2 perfekt (skill only ever adds a bonus, doing nothing gives the normal result)
//   Kochen   a cooking bar runs, take it off in the good band → quality → stronger buff (Kochen & Craften › Herd)
//   Werkbank a blueprint (recipe with „Plätze“) takes weapon parts (Gegenstände › Waffenteil) → a weapon with its own values
//   Drohne   chips on AvA's board within an energy budget → AvA's bonuses (Kochen & Craften › Drohnen-Platine)
//   Ripperdoc a steady hand: the better the cut, the stronger the implant's perks (never worse flaws)
//   Foodtruck customers order dishes; served quick or their favourite = tip
//   Energie  a regulator in the green band = a little extra power for a while
import { stock, take } from './crafting.js';

export const QUALITY_NAMES = ['normal', 'gut', 'perfekt'];

// ---------- shared: timing → quality ----------
export function stationConfig(D) {
  const S = D.crafting?.stations || {};
  return {
    cook: { seconds: S.cook?.seconds ?? 4, good: S.cook?.good ?? [55, 90], perfect: S.cook?.perfect ?? [68, 80], bonus: S.cook?.bonus ?? [0, 25, 50], spice: S.cook?.spice ?? 10,
      spices: String(S.cook?.spices ?? 'gewuerzmischung, chili, sojasauce').split(',').map(s => s.trim()).filter(Boolean) },
    bench: { seconds: S.bench?.seconds ?? 1.6, good: S.bench?.good ?? 22, perfect: S.bench?.perfect ?? 8, bonus: S.bench?.bonus ?? [0, 5, 10], steps: S.bench?.steps ?? 2 },
    drone: { power: S.drone?.power ?? 6, slots: S.drone?.slots ?? 4, bonus: S.drone?.bonus ?? [0, 15, 30] },
    surgery: { seconds: S.surgery?.seconds ?? 2.2, good: S.surgery?.good ?? 18, perfect: S.surgery?.perfect ?? 7, bonus: S.surgery?.bonus ?? [0, 10, 20] },
    truck: { customers: S.truck?.customers ?? 4, patience: S.truck?.patience ?? 12, tip: S.truck?.tip ?? 30, favourite: S.truck?.favourite ?? 50, price: S.truck?.price ?? 100 },
    power: { seconds: S.power?.seconds ?? 6, band: S.power?.band ?? [45, 65], drift: S.power?.drift ?? 18, extra: S.power?.extra ?? 1, hours: S.power?.hours ?? 12, need: S.power?.need ?? 60 },
  };
}
// a position 0…100 on a bar against [lo, hi] bands → 0 | 1 | 2
export function bandQuality(pos, good, perfect) {
  if (pos >= perfect[0] && pos <= perfect[1]) return 2;
  if (pos >= good[0] && pos <= good[1]) return 1;
  return 0;
}
// distance from the mark (0 = dead on) against tolerances → 0 | 1 | 2
export function aimQuality(off, good, perfect) { off = Math.abs(off); return off <= perfect ? 2 : off <= good ? 1 : 0; }
// quality of several handgrips: the average, rounded down (one sloppy grip does not ruin a perfect build)
export const meanQuality = qs => qs.length ? Math.floor(qs.reduce((a, b) => a + b, 0) / qs.length + 0.34) : 0;

// ---------- Kochen: the quality of a dish → bonus on its buff ----------
// spice: one of „Gewürze“ added before the bar runs → +spice % on top
export function cookBonus(D, q, spiced = false) { const C = stationConfig(D).cook; return (C.bonus[q] ?? 0) + (spiced ? C.spice : 0); }
export function spicesOnHand(D, save) { const st = stock(D, save), C = stationConfig(D).cook; return C.spices.filter(id => (st[id] || 0) > 0 && D.items?.[id]); }

// ---------- Werkbank: blueprint + weapon parts → the values of one weapon ----------
// Gegenstände › Waffenteil: part.slot (lauf, griff, magazin, visier, schaft, kern), part.damage/cooldown/range/reload/knockback (%),
// part.crit (+ %-points), part.magazine (+ shots), part.kind (only for melee / ranged, empty = both)
export const PART_SLOTS = [['lauf', 'Lauf'], ['griff', 'Griff'], ['schaft', 'Schaft'], ['magazin', 'Magazin'], ['visier', 'Visier'], ['klinge', 'Klinge'], ['kern', 'Kern']];
export const partOf = (D, id) => { const t = D.items?.[id]; return t?.category === 'weaponpart' && t.part?.slot ? t.part : null; };
export function partsFor(D, save, slot, kind) {
  const st = stock(D, save);
  return Object.keys(st).filter(id => { const p = partOf(D, id); return p && p.slot === slot && (!p.kind || !kind || p.kind === kind); });
}
// the sum of the parts plus the quality of the handgrips → mods { damage %, cooldown %, range %, reload %, knockback %, crit, magazine }
export function weaponMods(D, parts, q = 0) {
  const m = { damage: 0, cooldown: 0, range: 0, reload: 0, knockback: 0, crit: 0, magazine: 0 };
  for (const id of parts || []) { const p = partOf(D, id); if (!p) continue; for (const k of Object.keys(m)) m[k] += Number(p[k]) || 0; }
  m.damage += stationConfig(D).bench.bonus[q] ?? 0;
  for (const k of Object.keys(m)) if (!m[k]) delete m[k];
  return m;
}
// a weapon definition with the mods of one copy applied (the game's scene.weapon uses it)
export function applyMods(def, mods) {
  if (!def || !mods || !Object.keys(mods).length) return def;
  const pc = (v, k) => v == null ? v : Math.max(1, Math.round(v * (1 + (mods[k] || 0) / 100)));
  return { ...def, damage: pc(def.damage, 'damage'), cooldown: pc(def.cooldown, 'cooldown'), range: pc(def.range, 'range'), reloadTime: pc(def.reloadTime, 'reload'),
    knockback: pc(def.knockback, 'knockback'), critChance: def.critChance != null || mods.crit ? Math.max(0, (def.critChance || 0) + (mods.crit || 0)) : def.critChance,
    magazine: def.magazine != null ? Math.max(1, def.magazine + (mods.magazine || 0)) : def.magazine, mods };
}
// the values a weapon shows (for the bench preview and the tooltip): [label, base, now, better?]
export function weaponStats(def, mods) {
  const w = applyMods(def, mods) || {};
  const rows = [['Schaden', 'damage', true], ['Abklingzeit', 'cooldown', false], ['Reichweite', 'range', true], ['Krit-Chance', 'critChance', true], ['Magazin', 'magazine', true], ['Nachladen', 'reloadTime', false], ['Rückstoß', 'knockback', true]];
  return rows.filter(([, k]) => def?.[k] != null || w[k] != null).map(([label, k, up]) => ({ label, key: k, base: def?.[k] ?? 0, now: w[k] ?? 0, better: up ? (w[k] ?? 0) > (def?.[k] ?? 0) : (w[k] ?? 0) < (def?.[k] ?? 0) }));
}
// short text of mods for tooltips: „Schaden +12 % · Krit +5“
export function modsText(mods) {
  if (!mods) return '';
  const L = { damage: 'Schaden', cooldown: 'Abklingzeit', range: 'Reichweite', reload: 'Nachladen', knockback: 'Rückstoß' }, out = [];
  for (const [k, v] of Object.entries(mods)) {
    if (!v) continue;
    if (k === 'crit') out.push(`Krit ${v > 0 ? '+' : ''}${v}`); else if (k === 'magazine') out.push(`Magazin ${v > 0 ? '+' : ''}${v}`);
    else if (L[k]) out.push(`${L[k]} ${v > 0 ? '+' : ''}${v} %`);
  }
  return out.join(' · ');
}

// ---------- Drohnen-Platine: chips on AvA's board ----------
// Gegenstände › Chip für AvA: chip.stat (battery | spot | speed | rescue | loot), chip.value (%), chip.power (energy)
export const CHIP_STATS = [['battery', 'Akku (Plattform) %'], ['spot', 'Scheinwerfer %'], ['speed', 'Fliegt schneller %'], ['rescue', 'Rettung kostet weniger %'], ['loot', 'Extra-Beute %']];
export const chipOf = (D, id) => { const c = D.items?.[id]?.chip; return c?.stat ? c : null; };
export function chipsOnHand(D, save) { const st = stock(D, save); return Object.keys(st).filter(id => chipOf(D, id)); }
// the board in the save: save.droneBoard = { chips: [{ id, q }] }; → { used, max }
export function boardPower(D, chips) { return { used: (chips || []).reduce((n, c) => n + (chipOf(D, c.id)?.power ?? 1), 0), max: stationConfig(D).drone.power }; }
// what AvA's board gives: { battery, spot, speed, rescue, loot } in %
export function droneBonuses(D, save) {
  const out = {}, B = stationConfig(D).drone.bonus;
  for (const c of save?.droneBoard?.chips || []) { const x = chipOf(D, c.id); if (x) out[x.stat] = (out[x.stat] || 0) + x.value * (1 + (B[c.q || 0] ?? 0) / 100); }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  return out;
}
// put the board together: the chips on it are used up; chips taken off are lost (they burn in)
export function installBoard(D, save, chips) {
  const p = boardPower(D, chips), C = stationConfig(D).drone;
  if (p.used > p.max) return { ok: false, reason: `Zu viel Energie (${p.used} von ${p.max})` };
  if (chips.length > C.slots) return { ok: false, reason: `Nur ${C.slots} Plätze` };
  const st = stock(D, save), need = {};
  for (const c of chips) need[c.id] = (need[c.id] || 0) + 1;
  for (const [id, n] of Object.entries(need)) if ((st[id] || 0) < n) return { ok: false, reason: `Zu wenig ${D.items?.[id]?.name || id}` };
  for (const [id, n] of Object.entries(need)) take(D, save, id, n);
  save.droneBoard = { chips: chips.map(c => ({ id: c.id, q: c.q || 0 })) };
  return { ok: true, bonuses: droneBonuses(D, save) };
}

// ---------- Ripperdoc: the best operation per implant ----------
// save.implantQ = { item id: quality }; perks of that implant × (1 + bonus %), flaws stay as they are
export function implantBonus(D, save, id) { return stationConfig(D).surgery.bonus[save?.implantQ?.[id] || 0] ?? 0; }
export function implantBoosts(D, save) { const out = {}; for (const id of Object.keys(save?.implantQ || {})) out[id] = implantBonus(D, save, id); return out; }
export function noteSurgery(save, id, q) { save.implantQ ??= {}; save.implantQ[id] = Math.max(save.implantQ[id] || 0, q); }

// ---------- Foodtruck: customers at the counter ----------
// a queue rolled from the dishes Leyla has: each customer wants one dish (sometimes their favourite = a dish they love more)
export function rollCustomers(D, save, rnd = Math.random) {
  const C = stationConfig(D).truck, st = stock(D, save), dishes = Object.keys(st).filter(id => D.items?.[id]?.category === 'food');
  const names = ['Trucker Bo', 'Zwei Mechanikerinnen', 'Ein Kind mit Drohne', 'Grauer Pilger', 'Die Wache vom Tor', 'Neon-Nonne', 'Ein müder Kurier', 'Sandläufer', 'Frau mit Hund'];
  if (!dishes.length) return [];
  return Array.from({ length: C.customers }, (_, i) => {
    const want = dishes[Math.floor(rnd() * dishes.length)];
    return { name: names[Math.floor(rnd() * names.length)], want, favourite: rnd() < 0.35, patience: C.patience * (0.8 + rnd() * 0.4), i };
  });
}
// serve one customer: the dish goes, Δ in (value × price %, + tip if quick, + favourite) → { ok, deltas, tip }
export function serve(D, save, c, secondsWaited) {
  const C = stationConfig(D).truck, st = stock(D, save);
  if (!(st[c.want] > 0)) return { ok: false, reason: 'Ist aus' };
  take(D, save, c.want, 1);
  const base = Math.round((D.items[c.want].value || 10) * C.price / 100);
  const quick = secondsWaited <= c.patience * 0.5, tip = Math.round(base * ((quick ? C.tip : 0) + (c.favourite ? C.favourite : 0)) / 100);
  save.deltas = (save.deltas || 0) + base + tip;
  return { ok: true, deltas: base + tip, tip, quick };
}

// ---------- Energie: the regulator ----------
// save.powerBoost = { until: clock hour, extra } → extra ⚡ for a while (Rig budget adds it)
export function powerBoost(save, now) { const b = save?.powerBoost; return b && now < b.until ? b.extra || 0 : 0; }
// share of the time the needle stayed in the green band → boost when at least „need“ %
export function tuneResult(D, save, inBandShare, now) {
  const C = stationConfig(D).power, ok = inBandShare * 100 >= C.need;
  if (ok) save.powerBoost = { until: now + C.hours, extra: C.extra };
  return { ok, extra: ok ? C.extra : 0, hours: C.hours, share: Math.round(inBandShare * 100) };
}
