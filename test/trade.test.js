// #182 Händler + Vorschuss (game/trade.js) without DOM: rate, Tageskasse, satiety, stock per day, buying, advance tiers, repay from runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { stock } from '../game/crafting.js';
import { traderState, offers, sell, buy, sellPrice, buyPrice, rateOf, advanceTiers, takeAdvance, repayFromRun, repay, debtOf, traderOf, buys } from '../game/trade.js';
import { add } from '../game/inventory.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => { const s = newSave(D); s.inv.grids.backpack.items = []; return s; };

test('Schraube: Kurs 35 %, satt bei Gleichem, Tageskasse, Ware je Tag', () => {
  const s = fresh();
  assert.equal(traderOf(D, 'schraube'), 'schraube');
  assert.equal(rateOf(D, s, 'schraube'), 35);
  add(D, s.inv.grids.backpack, 'items', 'goldzahn', 6);
  const p0 = sellPrice(D, s, 'schraube', 'goldzahn');
  assert.equal(p0, Math.round(35 * 0.35));
  const d0 = s.deltas, r = sell(D, s, 'schraube', 'goldzahn', 3);
  assert.equal(r.n, 3); assert.equal(s.deltas - d0, r.got);
  assert.ok(sellPrice(D, s, 'schraube', 'goldzahn') < p0, 'satt: weniger für das vierte');
  assert.equal(stock(D, s).goldzahn, 3);
  assert.ok(traderState(D, s, 'schraube').stock.some(x => x.id === 'goldzahn'), 'legt es in seine Ware');
  // he does not buy food
  add(D, s.inv.grids.backpack, 'items', 'neon_ramen', 1);
  assert.equal(buys(D, 'schraube', 'neon_ramen'), false);
  assert.ok(!offers(D, s, 'schraube').sell.some(x => x.item === 'neon_ramen'));
  // the till runs dry
  traderState(D, s, 'schraube').cash = 10;
  const big = sell(D, s, 'schraube', 'goldzahn', 3);
  assert.ok(big.n < 3 && /Kasse/.test(big.reason), JSON.stringify(big));
  // next day: full till, new goods, satiety recovered a bit
  const sat = traderState(D, s, 'schraube').sold.goldzahn;
  s.day += 1;
  const T = traderState(D, s, 'schraube');
  assert.equal(T.cash, 300); assert.ok(T.sold.goldzahn < sat);
  assert.ok(T.stock.length >= 6 && T.stock.length <= 10, String(T.stock.length));
});

test('Kaufen: Δ weg, Ding ins Lager, Kurs wächst mit der Kundschaft', () => {
  const s = fresh(); s.deltas = 1000;
  const T = traderState(D, s, 'schraube'), first = T.stock[0], p = buyPrice(D, s, 'schraube', first.id);
  const before = stock(D, s)[first.id] || 0;
  const r = buy(D, s, 'schraube', first.id, 1);
  assert.ok(r.ok, JSON.stringify(r)); assert.equal(s.deltas, 1000 - p); assert.equal(stock(D, s)[first.id], before + 1);
  s.trade.schraube.volume = 1000;
  assert.equal(rateOf(D, s, 'schraube'), 45);
  s.trade.schraube.volume = 99999;
  assert.equal(rateOf(D, s, 'schraube'), 70);
  s.deltas = 0;
  const poor = buy(D, s, 'schraube', T.stock[0].id, 1);
  assert.equal(poor.ok, false); assert.match(poor.reason, /Δ/);
});

test('Vorschuss bei Onkel Sung: Beträge, ein Vorschuss zur Zeit, Anteil je Run, Obergrenze wächst', () => {
  const s = fresh(); s.deltas = 0;
  let T = advanceTiers(D, s);
  assert.deepEqual(T.map(t => [t.amount, t.ok]), [[100, true], [250, false], [500, false]]);
  assert.equal(takeAdvance(D, s, 250).ok, false);
  assert.ok(takeAdvance(D, s, 100).ok); assert.equal(s.deltas, 100); assert.equal(debtOf(s).amount, 100);
  assert.equal(takeAdvance(D, s, 100).ok, false);   // the old one first
  assert.deepEqual(repayFromRun(D, s, 80), { cut: 40, left: 60, done: false });
  assert.deepEqual(repayFromRun(D, s, 0), { cut: 0, left: 60, done: false });
  assert.deepEqual(repayFromRun(D, s, 500), { cut: 60, left: 0, done: true });
  assert.equal(debtOf(s), null); assert.equal(s.debtsPaid, 1);
  T = advanceTiers(D, s);
  assert.deepEqual(T.map(t => t.ok), [true, true, false]);
  assert.ok(takeAdvance(D, s, 250).ok);
  s.deltas = 1000;
  const r = repay(D, s, 9999);
  assert.ok(r.done); assert.equal(s.deltas, 1000 - 250 + 0); assert.equal(s.debtsPaid, 2);
});

// ---------- #183 weitere Händler ----------
import { openRoad, placeTraders, traderConfig } from '../game/trade.js';
import { generateEncounter } from '../game/road_events.js';
import { campArrival } from '../game/crew.js';
import { ensureMap } from '../game/worldmap.js';

test('#183 Sungs Küche: kauft Zutaten und Gerichte, nichts aus Schraubes Ecke; Quest-Dinge nie', () => {
  assert.equal(traderOf(D, 'onkel_sung'), 'onkel_sung');
  assert.ok(buys(D, 'onkel_sung', 'neon_ramen') && buys(D, 'onkel_sung', 'reis'));
  assert.ok(!buys(D, 'onkel_sung', 'goldzahn'));
  assert.ok(!buys(D, 'lucky_ferro', 'silo_karte_1'));   // quest
  assert.equal(rateOf(D, fresh(), 'lucky_ferro'), 45);
});

test('#183 Karawane: Zwischenfall bietet „Den Laden ansehen“ mit Marke, frische Ware mit Markenware, Preise nach Gefahr', () => {
  const s = fresh();
  let E = null;
  for (let i = 0; i < 20 && !E?.options.some(o => o.trade); i++) E = generateEncounter(D, () => (i * 0.137 + 0.3) % 1, { situation: 'karawane', danger: 3, save: s });
  const o = E.options.find(o => o.trade);
  assert.ok(o, JSON.stringify(E.options.map(x => x.label)));
  assert.equal(o.trade.trader, 'karawane'); assert.ok(o.trade.brand, 'mit Marke');
  assert.ok(E.description.includes(D.brands[o.trade.brand].short || D.brands[o.trade.brand].name) || !/\{brand\}/.test(E.description));
  const key = openRoad(D, s, 'karawane', o.trade);
  assert.equal(key, 'karawane@road');
  const T = traderState(D, s, key);
  assert.ok(T.stock.filter(x => D.items[x.id].brand === o.trade.brand).length >= 1, 'Markenware');
  const id = T.stock.find(x => !D.items[x.id].brand).id, plain = Math.round(D.items[id].value * 1.2);
  assert.ok(buyPrice(D, s, key, id) > plain, `Gefahr 3 macht teurer: ${buyPrice(D, s, key, id)} > ${plain}`);
  s.day += 1;
  assert.deepEqual(traderState(D, s, key).stock, T.stock, 'Straße: kein Tageswechsel');
  const again = openRoad(D, s, 'karawane', { ...o.trade, seed: 99 });
  assert.equal(again, key); assert.equal(traderState(D, s, key).cash, traderConfig(D, 'karawane').cash);
});

test('#183 Händler an Orten: je Ort und Durchgang fest, Schwarzmarkt nur nachts, eigene Kasse je Ort', () => {
  const s = fresh(); ensureMap(D, s);
  const all = s.map.nodes.flatMap(n => placeTraders(D, s, n.id).map(t => ({ ...t, node: n.id })));
  assert.ok(all.some(t => t.id === 'schwarzmarkt') && all.some(t => t.id === 'papierhaendler'), all.map(t => t.key).join(' '));
  assert.deepEqual(placeTraders(D, s, s.map.nodes[3].id), placeTraders(D, s, s.map.nodes[3].id));
  const sm = all.find(t => t.id === 'schwarzmarkt');
  s.hour = 12; assert.equal(placeTraders(D, s, sm.node).find(t => t.id === 'schwarzmarkt').open, false);
  s.hour = 23; assert.equal(placeTraders(D, s, sm.node).find(t => t.id === 'schwarzmarkt').open, true);
  assert.ok(all.every(t => t.id !== 'ghostwire' || ['Delta Ring', 'The Outskirts'].includes(s.map.nodes.find(n => n.id === t.node).region)));
  const two = all.filter(t => t.id === 'papierhaendler').slice(0, 2);
  if (two.length === 2) { traderState(D, s, two[0].key).cash = 1; assert.equal(traderState(D, s, two[1].key).cash, 250); }
});

test('#183 Lucky Ferro taucht ab Tag 3 am Feuer auf, einmal je Durchgang', () => {
  const s = fresh(); s.day = 2;
  assert.equal(campArrival(D, s, () => 0.99).joined.length, 0);
  s.day = 3;
  const r = campArrival(D, s, () => 0.99);
  assert.deepEqual(r.joined.map(x => x.id), ['lucky_ferro']); assert.ok(s.companions.includes('lucky_ferro'));
  s.companions = s.companions.filter(c => c !== 'lucky_ferro');
  assert.equal(campArrival(D, s, () => 0.99).joined.length, 0, 'wer gegangen ist, kommt nicht wieder');
});
