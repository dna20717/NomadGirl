// #182 Händlerfenster + Vorschuss im Camp (game.html?camp): Schraube → Reden → Handeln, verkaufen (E / F), satt, Tab Kaufen, kaufen,
// Esc schließt und das Spiel war pausiert; Onkel Sung → Vorschuss 100 Δ, größere gesperrt, Schulden im HUD, zurückzahlen.
// Server must run (npm run serve) or tools/test_all.mjs.   node tools/trade_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(250); await page.screenshot({ path: `output/trade_${n}.png` }); await ev(() => nomad.thaw()); };
const key = async k => { await page.keyboard.press(k); await ev(() => nomad.step(2)); };

await ev(() => {
  nomad.take(); nomad.step(30);
  const sc = game.scene.getScene('play'), S = sc.box.save;
  S.deltas = 600; S.inv.grids.backpack.items = [];
});
// things to sell: 4 Goldzähne, 2 Kupferkabel into the backpack
await ev(async () => { const { add } = await import('./game/inventory.js'); const sc = game.scene.getScene('play'), D = sc.data_, g = sc.box.save.inv.grids.backpack; add(D, g, 'items', 'goldzahn', 4); add(D, g, 'items', 'kupferkabel', 2); add(D, g, 'items', 'neon_ramen', 1); });

// 1. Schraube: Reden → Handeln
let m = await ev(() => { nomad.goTo('Schraube'); nomad.step(1, [], ['grab']); nomad.step(3); return nomad.menu(); });
check('Schraube bietet „Handeln“ an', m?.items.some(i => i.label === 'Handeln'), m);
await ev(() => { nomad.choose('Handeln'); }); await page.waitForTimeout(150);
let t = await ev(() => { nomad.step(4); return nomad.trade(); });
check('Händlerfenster offen: Verkaufen, Kasse 300, zahlt 35 %', t?.tab === 'sell' && t.cash === 300 && t.rate === 35, t);
check('Nur was er ankauft (keine Ramen)', t?.sell.some(x => x.startsWith('goldzahn×4')) && !t.sell.some(x => x.startsWith('neon_ramen')), t?.sell);
await shot('sell');
const d0 = await ev(() => game.scene.getScene('play').box.save.deltas);
const gold = t.sell.findIndex(x => x.startsWith('goldzahn'));
for (let i = 0; i < gold; i++) await key('ArrowDown');
const p0 = Number(t.sell[gold].split('@')[1]);
await key('e');
t = await ev(() => nomad.trade());
let d1 = await ev(() => game.scene.getScene('play').box.save.deltas);
check('E verkauft ein Stück: +Δ, Kasse sinkt', d1 === d0 + p0 && t.cash === 300 - p0 && /verkauft/.test(t.note || ''), { d0, d1, p0, t });
check('Satt: der nächste Goldzahn bringt weniger', Number(t.sell.find(x => x.startsWith('goldzahn')).split('@')[1]) < p0, t.sell);
await key('f');
t = await ev(() => nomad.trade());
check('F verkauft alle', !t.sell.some(x => x.startsWith('goldzahn')), t.sell);
const tFrozen = await ev(() => { const s = game.scene.getScene('play'); const x = s.leyla.x; nomad.step(30, ['right']); return { moved: s.leyla.x !== x, paused: s.physics.world.isPaused }; });
check('Fenster pausiert das Spiel', !tFrozen.moved && tFrozen.paused, tFrozen);

// 2. Kaufen
await key('q');
t = await ev(() => nomad.trade());
check('Tab Kaufen: Ware des Tages, darunter die verkauften Goldzähne', t?.tab === 'buy' && t.buy.length >= 6 && t.buy.some(x => x.startsWith('goldzahn')), t);
const first = t.buy[0], price = Number(first.split('@')[1]);
const before = await ev(() => game.scene.getScene('play').box.save.deltas);
await key('e');
const after = await ev(() => game.scene.getScene('play').box.save.deltas);
t = await ev(() => nomad.trade());
check('E kauft ein Stück: −Δ, Ding im Lager', after === before - price && /gekauft/.test(t.note || ''), { before, after, price, note: t.note });
await shot('buy');
await key('Escape');
check('Esc schließt', !(await ev(() => nomad.trade())));

// 3. Onkel Sung: Vorschuss
m = await ev(() => { nomad.goTo('Onkel Sung'); nomad.step(1, [], ['grab']); nomad.step(3); return nomad.menu(); });
check('Onkel Sung bietet „Vorschuss“ an', m?.items.some(i => i.label === 'Vorschuss'), m?.items.map(i => i.label));
await ev(() => { nomad.choose('Vorschuss'); }); await page.waitForTimeout(150);
m = await ev(() => { nomad.step(4); return nomad.menu(); });
check('Beträge: 100 frei, 250 und 500 gesperrt', m?.title === 'Vorschuss' && !m.items.find(i => i.label === '100 Δ leihen')?.disabled && m.items.find(i => i.label === '250 Δ leihen')?.disabled && m.items.find(i => i.label === '500 Δ leihen')?.disabled, m);
const dl = await ev(() => game.scene.getScene('play').box.save.deltas);
const s = await ev(() => { nomad.choose('100 Δ leihen'); nomad.step(4); const S = game.scene.getScene('play').box.save; return { deltas: S.deltas, debt: S.debt, hud: document.querySelector('.hud-debt')?.textContent || null }; });
check('100 Δ geliehen, Schulden im HUD', s.deltas === dl + 100 && s.debt?.amount === 100 && s.hud === '100 Δ', s);
await shot('debt');
m = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(3); return nomad.menu(); });
check('Im Gespräch steht der offene Vorschuss', m?.items.some(i => i.label === 'Vorschuss: noch 100 Δ offen'), m?.items.map(i => i.label));
await ev(() => { nomad.choose('Vorschuss: noch'); }); await page.waitForTimeout(150);
const r = await ev(() => { nomad.step(4); const mm = nomad.menu(); nomad.choose('Jetzt zurückzahlen'); nomad.step(4); const S = game.scene.getScene('play').box.save; return { items: mm?.items.map(i => i.label), debt: S.debt, paid: S.debtsPaid, hud: document.querySelector('.hud-debt')?.textContent || null }; });
check('Zurückzahlen: Schulden weg, nächster Betrag frei', r.debt === null && r.paid === 1 && !r.hud, r);

// 4. a run's payout: half goes to Onkel Sung (scene_runs.js endRun)
await ev(() => { nomad.goTo('Onkel Sung'); nomad.step(1, [], ['grab']); nomad.step(3); nomad.choose('Vorschuss'); }); await page.waitForTimeout(150);
await ev(() => { nomad.step(3); nomad.choose('100 Δ leihen'); nomad.step(3); });
const run = await ev(() => { const sc = game.scene.getScene('play'), S = sc.box.save, d0 = S.deltas; sc.deltas = 120; S.run = { poi: null, before: {} }; sc.endRun(false); return { got: S.deltas - d0, debt: S.debt }; });
await page.waitForTimeout(500); run.sum = await ev(() => { nomad.step(120); return game.scene.getScene('play').hud.sum?.state?.()?.debt || null; });
check('Run-Auszahlung: 50 % an Onkel Sung, Bilanz zeigt es', run.got === 60 && run.debt?.amount === 40 && run.sum?.cut === 60 && run.sum?.left === 40, run);
await browser.close();
for (const o of ok) console.log('  ✓ ' + o);
for (const e of errors) console.log('  ✗ ' + e);
console.log(errors.length ? `${errors.length} Fehler` : `trade_test: alle ${ok.length} Prüfungen grün`);
process.exit(errors.length ? 1 : 0);
