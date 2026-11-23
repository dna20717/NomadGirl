// Händler + Vorschuss (#182, Daniel 23.11.2026 aus Feedback FB-2: „Wir brauchen eine Möglichkeit Deltas zu verdienen OHNE POI zu
// grinden. Geld borgen beim Onkel und Items verkaufen an Schraube (viel schlechtere Preise zum Start, aber besser als nichts)“).
// No DOM; the window is game/play/trade_ui.js.
//
// Händler (Werkstatt › Händler, data/traders.json): one window for every trader (Daniel: „Ein Fenster für alle Händler“); Schraube first.
//   Leyla sells from the camp inventories (Lager, Kiste, Rucksack) and buys into them. Three brakes (Daniel: all three):
//   rate      the trader pays rate % of the value; it starts low and grows with the Δ traded with him (Kundschaft) and the Boni-Bus 'sell'
//   cash      a Tageskasse: he only has so many Δ per day (filled again over night, Leyla's purchases go into it)
//   satiety   every piece of the same thing sold lowers his price for it by step %, it recovers by recover % per day
//   stock     his goods change every day (rolled from his table, the things Leyla sold him stay until the next day)
// save.trade = { <key>: { day, cash, stock: [{ id, n }], sold: { item: pieces }, volume, ctx } }
// #183 three kinds (Händler › Art): camp (a figure in the camp, key = id), road (a stand on the road, opened from an incident:
//   key = id@road, fresh every time, brand goods, prices with Ruf, mood, danger, Influencer), place (at places of the travel map:
//   key = id@<node>, own goods and till per place, only by day / by night, a chance per place and Durchgang).
//
// Vorschuss (Wirtschaft › Vorschuss): Onkel Sung gives an advance without interest and without a deadline; Leyla picks an amount up to a
//   limit that grows with every advance paid back; a new one only once the old one is paid. A fixed share of every run's payout goes
//   back to him until nothing is left (Daniel: „Ein fester Anteil“).
// save.debt = { lender, amount (left), taken, day } | null; save.debtsPaid = number of advances paid back
import { valueOf } from './brands.js';
import { stock as campStock, take, give } from './crafting.js';
import { mod } from './mods.js';
import { pay, earn } from './pricing.js';
import { gangOfPlace } from './reputation.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = s => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// ---------- traders ----------
const split = key => { const k = String(key), i = k.indexOf('@'); return i < 0 ? [k, null] : [k.slice(0, i), k.slice(i + 1)]; };
const isNight = save => { const h = save?.hour ?? 12; return h >= 20 || h < 5; };
export function traderConfig(D, key) {
  const [id, where] = split(key), t = D.traders?.[id];
  if (!t) return null;
  const at = t.at || {};
  const [r0, r1] = t.rate || [35, 70];
  return {
    id, key: String(key), where, kind: t.kind || (t.keeper ? 'camp' : 'place'), brandStock: t.brandStock ?? 0,
    brand: t.brand || null, at: { pois: at.pois || [], regions: (Array.isArray(at.regions) ? at.regions : String(at.regions || '').split(',')).map(x => x.trim()).filter(Boolean), chance: at.chance ?? 100, time: at.time || 'any' },
    name: t.name || id, keeper: t.keeper || null, greeting: t.greeting || '', rate: [r0, Math.max(r0, r1)], rateEvery: Math.max(1, t.rateEvery ?? 100),
    markup: t.markup ?? 130, cash: t.cash ?? 300, step: t.satiety?.step ?? 15, recover: t.satiety?.recover ?? 15, floor: t.satiety?.floor ?? 20,
    buys: t.buys?.length ? t.buys : null, count: t.stockCount || [6, 10], table: (t.stock || []).filter(r => r?.item && D.items?.[r.item]),
  };
}
export const traderOf = (D, keeper) => Object.keys(D.traders || {}).find(id => D.traders[id].keeper === keeper && (D.traders[id].kind || 'camp') === 'camp') || null;

function rollStock(D, C, seed, ctx = null) {
  const rnd = rng(hash(`${C.key}:${seed}`)), out = [], [a, b] = C.count;
  const pool = [...C.table];
  const n = Math.min(pool.length, a + Math.floor(rnd() * (b - a + 1)));
  for (let i = 0; i < n && pool.length; i++) {
    const sum = pool.reduce((s, r) => s + Math.max(0, r.chance ?? 50), 0);
    let r = rnd() * sum, k = 0;
    for (; k < pool.length - 1; k++) { r -= Math.max(0, pool[k].chance ?? 50); if (r <= 0) break; }
    const row = pool.splice(k, 1)[0], [lo, hi] = row.count || [1, 1];
    out.push({ id: row.item, n: lo + Math.floor(rnd() * (Math.max(lo, hi) - lo + 1)) });
  }
  // #183 a brand's own goods (the Karawane, the Markenstand): up to brandStock things the brand makes
  const brand = ctx?.brand || C.brand;
  if (C.brandStock && brand) {
    const mine = Object.keys(D.items || {}).filter(id => { const t = D.items[id]; return t.brand === brand && (t.value || 0) > 0 && !(t.tags || []).some(x => x === 'quest' || x === 'trophy') && !out.some(o => o.id === id); });
    for (let i = 0; i < C.brandStock && mine.length; i++) out.unshift({ id: mine.splice(Math.floor(rnd() * mine.length), 1)[0], n: 1 });
  }
  return out;
}

// the trader's state for today: a new day = new goods, a full till, satiety recovers
export function traderState(D, save, key) {
  const C = traderConfig(D, key);
  if (!C) return null;
  save.trade ??= {};
  const day = save.day ?? 1, id = C.key;
  let T = save.trade[id];
  if (!T) T = save.trade[id] = { day: null, cash: C.cash, stock: [], sold: {}, volume: 0 };
  if (!T.ctx && C.kind === 'place' && C.where) { const node = save.map?.nodes?.find(n => n.id === C.where); T.ctx = { gang: gangOfPlace(D, save, C.where) || null, danger: node?.danger || 1, scale: (D.roadEvents?.scale ?? 25) / 100 }; }
  if (T.day !== day && T.day !== 'road') {
    const days = T.day == null ? 0 : Math.max(1, day - T.day);
    for (const k of Object.keys(T.sold)) { T.sold[k] = Math.max(0, T.sold[k] - days * C.recover / Math.max(1, C.step)); if (T.sold[k] <= 0.001) delete T.sold[k]; }
    T.day = day; T.cash = C.cash; T.stock = rollStock(D, C, day, T.ctx);
  }
  return T;
}

// what he pays right now, in %: grows by 1 % per rateEvery Δ traded with him, plus the Boni-Bus „Verkaufen“
export function rateOf(D, save, id) {
  const C = traderConfig(D, id), T = traderState(D, save, id);
  return clamp(C.rate[0] + Math.floor((T.volume || 0) / C.rateEvery), C.rate[0], C.rate[1]);   // the Boni-Bus „Verkaufen“ counts on top in sellPrice
}
// #183 a stand on the road: fresh goods and till every time it is opened (ctx: { brand, gang, mood, danger, scale, seed })
export function openRoad(D, save, id, ctx = {}) {
  const C = traderConfig(D, `${id}@road`);
  if (!C) return null;
  save.trade ??= {};
  save.trade[C.key] = { day: 'road', cash: C.cash, stock: rollStock(D, C, ctx.seed ?? `${save.day}:${save.hour}`, ctx), sold: {}, volume: 0, ctx: { gang: ctx.gang || null, mood: ctx.mood ?? 100, danger: ctx.danger || 1, scale: ctx.scale ?? 0.25, brand: ctx.brand || null } };
  return C.key;
}
// #183 the traders at a place of the travel map (default: where the rig stands) → [{ key, name, open, reason }]
export function placeTraders(D, save, nodeId = save.location) {
  const node = save.map?.nodes?.find(n => n.id === nodeId);
  if (!node) return [];
  const out = [];
  for (const id of Object.keys(D.traders || {})) {
    const C = traderConfig(D, id);
    if (C.kind !== 'place') continue;
    if (C.at.pois.length && !C.at.pois.includes(node.poi)) continue;
    if (C.at.regions.length && !C.at.regions.includes(node.region)) continue;
    if (rng(hash(`${id}@${nodeId}:${save.cycle ?? 0}`))() * 100 >= C.at.chance) continue;
    const t = C.at.time, open = t === 'any' || (t === 'night') === isNight(save);
    out.push({ key: `${id}@${nodeId}`, id, name: C.name, open, reason: open ? null : t === 'night' ? 'erst nachts (ab 20 Uhr)' : 'nur tagsüber' });
  }
  return out;
}
const satiety = (C, T, item, extra = 0) => clamp(1 - (C.step / 100) * ((T.sold[item] || 0) + extra), C.floor / 100, 1);
export const buys = (D, id, item) => { const C = traderConfig(D, id), cat = D.items?.[item]?.category; return !!C && !!D.items?.[item] && (D.items[item].value || 0) > 0 && !D.items[item].noSell && !(D.items[item].tags || []).includes('quest') && (!C.buys || C.buys.includes(cat)); };

// Δ for one piece sold now (the k-th of a batch: satiety drops with every piece)
export function sellPrice(D, save, id, item, k = 0) {
  const C = traderConfig(D, id), T = traderState(D, save, id), base = valueOf(D, D.items?.[item]);
  if (!C || !base || !buys(D, id, item)) return 0;
  const bonus = 1 + (mod(D, save, 'sell') || 0) / 100, raw = base * rateOf(D, save, id) / 100 * satiety(C, T, item, k) * bonus;
  return Math.max(1, T.ctx ? earn(D, save, raw, T.ctx) : Math.round(raw));   // #183 on the road and at places: Ruf, mood, danger
}
export function buyPrice(D, save, id, item) {
  const C = traderConfig(D, id), T = C && traderState(D, save, id), base = valueOf(D, D.items?.[item]);
  if (!C || !base) return 0;
  const raw = base * C.markup / 100;
  return Math.max(1, T?.ctx ? pay(D, save, raw, { ...T.ctx, brand: D.items[item].brand || null }) : Math.round(raw));   // #069 one price function (Influencer too)
}

// the window's two lists
export function offers(D, save, id) {
  const T = traderState(D, save, id);
  if (!T) return { sell: [], buy: [] };
  const st = campStock(D, save);
  const sell = Object.entries(st).filter(([item, n]) => n > 0 && buys(D, id, item)).map(([item, n]) => ({ item, n, price: sellPrice(D, save, id, item), full: Math.round(valueOf(D, D.items[item])), sat: Math.round(satiety(traderConfig(D, id), T, item) * 100) }))
    .sort((a, b) => b.price - a.price || a.item.localeCompare(b.item));
  const buy = T.stock.filter(s => s.n > 0 && D.items?.[s.id]).map(s => ({ item: s.id, n: s.n, price: buyPrice(D, save, id, s.id) }));
  return { sell, buy, cash: T.cash, rate: rateOf(D, save, id), deltas: save.deltas || 0 };
}

// sells up to n pieces; stops when his till is empty → { ok, n, got, reason }
export function sell(D, save, id, item, n = 1) {
  const C = traderConfig(D, id), T = traderState(D, save, id);
  if (!C) return { ok: false, n: 0, got: 0, reason: 'Kein Händler' };
  if (!buys(D, id, item)) return { ok: false, n: 0, got: 0, reason: `${C.name} kauft das nicht` };
  const have = campStock(D, save)[item] || 0;
  let done = 0, got = 0, reason = null;
  for (; done < Math.min(n, have); done++) {
    const p = sellPrice(D, save, id, item);
    if (p > T.cash) { reason = `${C.name} hat nur noch ${T.cash} Δ in der Kasse`; break; }
    if (take(D, save, item, 1) < 1) break;
    T.cash -= p; got += p; T.sold[item] = (T.sold[item] || 0) + 1;
  }
  if (done) {
    save.deltas = (save.deltas || 0) + got; T.volume = (T.volume || 0) + got;
    const s = T.stock.find(x => x.id === item); if (s) s.n += done; else T.stock.push({ id: item, n: done });   // he sells it on (dearer)
  }
  return { ok: done > 0, n: done, got, reason: done ? reason : reason || (have ? 'Geht nicht' : 'Nichts davon da') };
}

// buys up to n pieces into the camp inventories → { ok, n, paid, reason }
export function buy(D, save, id, item, n = 1) {
  const C = traderConfig(D, id), T = traderState(D, save, id);
  const s = T?.stock.find(x => x.id === item && x.n > 0);
  if (!C || !s) return { ok: false, n: 0, paid: 0, reason: 'Nicht mehr da' };
  const p = buyPrice(D, save, id, item);
  let done = 0, reason = null;
  for (; done < Math.min(n, s.n); done++) {
    if ((save.deltas || 0) < p) { reason = 'Zu wenig Δ'; break; }
    if (give(D, save, item, 1) > 0) { reason = 'Kein Platz im Lager'; break; }
    save.deltas -= p; T.cash += p;
  }
  s.n -= done; T.stock = T.stock.filter(x => x.n > 0);
  T.volume = (T.volume || 0) + done * p;
  return { ok: done > 0, n: done, paid: done * p, reason };
}

// ---------- Vorschuss ----------
export function advanceConfig(D) {
  const A = D.economy?.advance || {};
  const tiers = (A.tiers?.length ? A.tiers : [{ amount: 100, after: 0 }, { amount: 250, after: 1 }, { amount: 500, after: 2 }]).filter(t => t?.amount > 0);
  return { on: A.enabled !== false, lender: A.lender || 'onkel_sung', share: clamp(A.share ?? 50, 1, 100), tiers };
}
export const debtOf = save => save.debt && save.debt.amount > 0 ? save.debt : null;
// the amounts on offer: [{ amount, ok, reason }]
export function advanceTiers(D, save) {
  const A = advanceConfig(D), paidBack = save.debtsPaid || 0, open = debtOf(save);
  return A.tiers.map(t => ({ amount: t.amount, ok: !open && paidBack >= (t.after || 0), reason: open ? `Erst den alten Vorschuss abzahlen (noch ${open.amount} Δ)` : paidBack < (t.after || 0) ? `Nach ${t.after} abbezahlten Vorschüssen` : null }));
}
export function takeAdvance(D, save, amount) {
  const t = advanceTiers(D, save).find(x => x.amount === amount);
  if (!t) return { ok: false, reason: 'Diesen Betrag gibt es nicht' };
  if (!t.ok) return { ok: false, reason: t.reason };
  save.debt = { lender: advanceConfig(D).lender, amount, taken: amount, day: save.day ?? 1 };
  save.deltas = (save.deltas || 0) + amount;
  return { ok: true, amount };
}
// a run's payout: the share goes to the lender → { cut, left, done } (cut = Δ that went to him)
export function repayFromRun(D, save, paid) {
  const d = debtOf(save);
  if (!d || paid <= 0) return { cut: 0, left: d?.amount || 0, done: false };
  const cut = Math.min(d.amount, Math.ceil(paid * advanceConfig(D).share / 100));
  d.amount -= cut;
  const done = d.amount <= 0;
  if (done) { save.debt = null; save.debtsPaid = (save.debtsPaid || 0) + 1; }
  return { cut, left: done ? 0 : d.amount, done };
}
// paying back by hand (from the Δ she has)
export function repay(D, save, amount) {
  const d = debtOf(save);
  if (!d) return { ok: false, reason: 'Keine Schulden' };
  const n = Math.min(d.amount, Math.max(0, Math.floor(amount)), save.deltas || 0);
  if (n <= 0) return { ok: false, reason: 'Zu wenig Δ' };
  save.deltas -= n; d.amount -= n;
  const done = d.amount <= 0;
  if (done) { save.debt = null; save.debtsPaid = (save.debtsPaid || 0) + 1; }
  return { ok: true, n, done, left: done ? 0 : d.amount };
}
