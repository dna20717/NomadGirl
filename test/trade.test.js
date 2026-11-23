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
