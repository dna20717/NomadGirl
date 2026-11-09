// Headless check of cooking and crafting in the camp (game.html?camp) with real mouse clicks:
// E at the Kochnische opens the panel, the game waits, cooking a known recipe, experimenting (hit → recipe book, miss → junk),
// near miss, reading a note, companion tips and lines, the Werkbank, eating from the inventory ("Benutzen"), the clock.
//   node tools/craft_test.mjs [--shots]   (server must run: npm run serve), pictures to output/craft_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);   // workshops in the rig at the start (tools/test_fixture.mjs)
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/craft_${n}.png` }); };
const craft = () => ev(() => nomad.craft());
const clickText = async (sel, text, opt = {}) => { await page.locator(sel, { hasText: text }).first().click(opt); await page.waitForTimeout(30); };
const supply = (name, opt) => clickText('.craft-supply', name, opt);
const go = async ws => ev(ws => {
  nomad.take(); nomad.step(5);
  const s = window.game.scene.getScene('play'), h = s.camp.hotspots.find(h => h.ws === ws);
  nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(3);
}, ws);

await go('kochnische');
let c = await craft();
check('E an der Kochnische öffnet Kochen', c.open && c.workshop === 'kochnische', c);
check('Rezeptbuch: Bohneneintopf bekannt und kochbar', c.book.some(r => r.id === 'bohneneintopf' && r.ready), c.book);
check('Onkel Sung gibt Tipps für unbekannte Rezepte', c.tips.includes('mutanten_curry') && await page.locator('.craft-tip', { hasText: 'Onkel Sung' }).count() > 0, c.tips);
const t0 = await ev(() => nomad.state().camp.clock);
const x0 = await ev(() => nomad.state().leyla.x);
await ev(() => nomad.step(30, ['right']));
check('Das Spiel wartet, solange Kochen offen ist', (await ev(() => nomad.state().leyla.x)) === x0);
await shot('book');

// cook a known recipe
await clickText('.craft-recipe', 'Bohneneintopf');
await page.locator('.craft-recipe', { hasText: 'Bohneneintopf' }).locator('button').click();
c = await craft();
check('Kochen: Bohneneintopf im Rucksack, Dosen weniger', c.log?.kind === 'hit' && c.stock.bohneneintopf === 1 && c.stock.dosenbohnen === 2, c);
check('Kochen kostet Minuten', (await ev(() => nomad.state().camp.clock)) !== t0 && /15 min/.test(await page.locator('.craft-log').textContent()), [t0, await ev(() => nomad.state().camp.clock)]);
check('Onkel Sung kommentiert', !!c.log?.who && c.log.who === 'Onkel Sung', c.log);

// experiment: a near miss (meat + rice, the spice is missing) → junk
await supply('Mutantenfleisch'); await supply('Reis');
c = await craft();
check('Vorräte anklicken legt sie in den Topf', c.pot.mutantenfleisch === 1 && c.pot.reis === 1, c.pot);
await supply('Reis', { button: 'right' });
check('Rechtsklick nimmt wieder raus', !(await craft()).pot.reis);
await supply('Reis');
await clickText('button', 'Ausprobieren');
c = await craft();
check('Fehlschlag: kurioser Müll, knapp daneben erkannt', c.log?.kind === 'near' && (c.stock.verkohlter_klumpen || c.stock.graue_pampe) && !c.stock.mutantenfleisch && Object.keys(c.pot).length === 0, c);
await shot('miss');

// experiment hit: curry (meat comes from a run normally; here into the chest)
await ev(() => { const s = window.game.scene.getScene('play'); s.box.save.inv.grids.chest.items.push({ a: 'items', id: 'mutantenfleisch', n: 1, x: 5, y: 3, r: 0 }); s.hud.craft.draw(); });
await supply('Mutantenfleisch'); await supply('Reis'); await supply('Gewürzmischung');
await clickText('button', 'Ausprobieren');
c = await craft();
check('Treffer: Mutanten-Curry gelernt und gekocht', c.log?.kind === 'learnt' && c.book.some(r => r.id === 'mutanten_curry') && c.stock.mutanten_curry === 2 && !c.tips.includes('mutanten_curry'), c);
check('Treffer verbraucht nur, was das Rezept braucht', c.stock.reis === 1, c.stock);
await shot('learnt');

// a note in the chest teaches a recipe
await ev(() => { const s = window.game.scene.getScene('play'); s.box.save.recipes = s.box.save.recipes.filter(r => r !== 'mutanten_curry'); s.box.save.inv.grids.chest.items.push({ a: 'items', id: 'zettel_curry', n: 1, x: 5, y: 2, r: 0 }); s.hud.craft.draw(); });
check('Zettel erscheint im Rezeptbuch', (await craft()).notes.includes('zettel_curry'));
await page.locator('.craft-note', { hasText: 'Notizzettel' }).locator('button').click();
c = await craft();
check('Lesen lernt das Rezept, Zettel ist weg', c.log?.kind === 'read' && c.book.some(r => r.id === 'mutanten_curry') && !c.stock.zettel_curry, c);

// close with Esc, the game goes on, Werkbank
await page.keyboard.press('Escape');
check('Esc schließt', !(await craft()).open);
await go('werkbank');
c = await craft();
check('Werkbank: Verband + Schrottplatte im Buch, Schraube kennt Kabelbaum', c.open && c.book.some(r => r.id === 'verband') && c.tips.includes('kabelbaum'), c);
await page.locator('.craft-recipe', { hasText: 'Verband' }).locator('button').click();
c = await craft();
check('Herstellen: Verband', c.log?.kind === 'hit' && c.stock.verband === 3, c.stock);
await supply('Schrott'); await supply('Kronkorken');
await clickText('button', 'Ausprobieren');
c = await craft();
check('Werkbank-Fehlschlag ergibt Werkbank-Müll', c.log?.kind === 'miss' && (c.stock.kabelsalat || c.stock.schrottskulptur), c);
await shot('werkbank');
await page.keyboard.press('Escape');

// eat the stew from the inventory: drop it on "Benutzen" → buff for the next run
await ev(() => nomad.step(5));
await page.keyboard.press('i'); await ev(() => nomad.step(3));
if (!(await ev(() => nomad.inv()?.open))) await ev(() => { window.game.scene.getScene('play').hud.inv.open(); });
const stew = await ev(() => { const g = document.querySelectorAll('.inv-grid')[0], c = parseFloat(g.style.getPropertyValue('--c')), r = g.getBoundingClientRect(), e = nomad.save().inv.grids.backpack.items.find(e => e.id === 'bohneneintopf'); return [r.left + (e.x + 0.5) * c, r.top + (e.y + 0.5) * c]; });
await page.mouse.click(...stew); await page.waitForTimeout(30);
await clickText('.inv-slot.use', 'Essen');
const sv = await ev(() => nomad.save());
check('Essen gibt den Buff für den nächsten Run', sv.buffs.includes('satt') && !sv.inv.grids.backpack.items.some(e => e.id === 'bohneneintopf') && !(await ev(() => nomad.inv().held)), sv.buffs);
await shot('eat');

await browser.close();
console.log(ok.map(t => '✓ ' + t).join('\n'));
if (errors.length) { console.log(errors.map(t => '✗ ' + t).join('\n')); process.exit(1); }
console.log(`\n${ok.length} Prüfungen bestanden.`);
