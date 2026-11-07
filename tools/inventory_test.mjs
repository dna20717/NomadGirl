// Headless check of the inventory with real mouse clicks (game.html?camp): chest, picking up, putting down, turning,
// stacking, double click, equipping, "Alles einlagern", the storage shelf, loot on the ground in a run, knocked out.
//   node tools/inventory_test.mjs [--shots]   (server must run: npm run serve), pictures to output/inv_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.location()?.url?.includes('/api/')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/inv_${n}.png` }); };
const inv = () => ev(() => nomad.inv());
// cell centre of a grid (0 = backpack, 1 = the other panel) in page pixels
const cell = (panel, x, y) => ev(([panel, x, y]) => { const g = document.querySelectorAll('.inv-grid')[panel], r = g.getBoundingClientRect(), c = parseFloat(g.style.getPropertyValue('--c')); return [r.left + (x + 0.5) * c, r.top + (y + 0.5) * c]; }, [panel, x, y]);
const click = async (panel, x, y, opt = {}) => { const [px, py] = await cell(panel, x, y); await page.mouse.click(px, py, opt); await page.waitForTimeout(30); };
const slot = async name => { const b = await page.locator('.inv-slot', { hasText: name }).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(30); };
const has = (g, id) => g.items.some(i => i.startsWith(id + '×'));

await ev(() => { nomad.take(); nomad.step(5); const h = nomad.state().camp.hotspots.find(h => h.name === 'Kiste'); nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(5); });
let s = await inv();
check('E an der Kiste öffnet Rucksack + Kiste', s.open && s.other?.key === 'chest' && has(s.other.grid, 'discokugel') && has(s.backpack, 'verband'), s);
await shot('chest');

// machete (1×3) from the chest into the backpack
await click(1, 2, 0);
s = await inv();
check('Klick nimmt die Machete', s.held === 'machete×1' && !has(s.other.grid, 'machete'), s);
await click(0, 3, 0);
s = await inv();
check('… und legt sie in den Rucksack', !s.held && s.backpack.items.some(i => i === 'machete×1@3,0'), s);
// pick again, turn with a right click, put down lying flat
await click(0, 3, 0); await click(0, 3, 0, { button: 'right' }); await click(0, 0, 2);
s = await inv();
check('Rechtsklick dreht (liegt quer)', s.backpack.items.some(i => i === 'machete×1@0,2 r1'), s);
// equip: machete onto the melee slot, the pipe wrench comes back in hand and goes into the free cell
await click(0, 0, 2); await slot('Nahkampf');
s = await inv();
check('Machete in den Nahkampf-Slot, Rohrzange in der Hand', s.slots.melee === 'machete' && s.held === 'rohrzange×1', s);
await click(1, 2, 0);
s = await inv();
check('Rohrzange in die Kiste', !s.held && has(s.other.grid, 'rohrzange'), s);
check('Kampf nutzt die neue Waffe', await ev(() => game.scene.getScene('play').weapon('melee')?.name === 'Machete'), null);
// wrong slot
await click(1, 0, 0); await slot('Fernkampf');
s = await inv();
check('Discokugel passt nicht in den Fernkampf-Slot', s.held === 'discokugel×1' && s.slots.ranged === 'nagelpistole', s);
await click(1, 0, 0);
// double click: dosenbohnen into the backpack
const [bx, by] = await cell(1, 4, 0); await page.mouse.dblclick(bx, by); await page.waitForTimeout(40);
s = await inv();
check('Doppelklick schickt die Bohnen in den Rucksack', has(s.backpack, 'dosenbohnen') && !has(s.other.grid, 'dosenbohnen') && !s.held, s);
// stacking: kupferkabel ×3 onto … take the cable and drop it on itself elsewhere is trivial; use "Alles einlagern"
await page.getByText('Alles einlagern').click({ timeout: 3000 }); await page.waitForTimeout(40);
s = await inv();
check('Alles einlagern leert den Rucksack in die Kiste', s.backpack.items.length === 0 && has(s.other.grid, 'verband') && has(s.other.grid, 'kupferkabel'), s);
await page.getByText('Alles nehmen').click(); await page.waitForTimeout(40);
s = await inv();
check('Alles nehmen packt ein, was passt', s.backpack.items.length > 0, s);
await shot('moved');

// storage shelf in the trailer: swap the backpack for the hiking backpack
s = await ev(() => { nomad.step(1, [], ['grab']); const h = nomad.state().camp.hotspots.find(h => h.name === 'Lagerregal'); nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(5); return nomad.inv(); });
check('Lagerregal ist ein Inventar', s.open && s.other?.title === 'Lagerregal' && has(s.other.grid, 'wanderrucksack') && has(s.other.grid, 'kronkorken'), s);
const ruck = await ev(() => { const g = nomad.save().inv.grids; const k = Object.keys(g).find(k => k.startsWith('store:')); return g[k].items.find(e => e.id === 'wanderrucksack'); });
await click(1, ruck.x, ruck.y); await slot('Rucksack');
s = await inv();
check('Größerer Rucksack angelegt, Inhalt bleibt', s.slots.backpack === 'wanderrucksack' && s.backpack.w === 6 && s.backpack.h === 4 && s.held === 'schulranzen×1', s);
await click(1, 0, 3);
s = await inv();
check('Schulranzen ins Regal', !s.held && has(s.other.grid, 'schulranzen'), s);
await shot('shelf');
const saved = await ev(() => new Promise(r => setTimeout(() => r(JSON.parse(localStorage.getItem('nomadgirl-save'))), 1500)));
check('Spielstand merkt sich das Inventar', saved.inv.backpack === 'wanderrucksack' && saved.inv.slots.melee === 'machete', saved.inv.slots);

// throw something on the ground in the camp: a new bundle, it stays after reloading
s = await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(1, [], ['inventory']); return nomad.inv(); });
await click(0, 0, 0);
const thrown = (await inv()).held;
await page.mouse.click(30, 780); await page.waitForTimeout(40);
s = await ev(() => ({ inv: nomad.inv(), loot: nomad.loot(), ground: nomad.save().ground }));
check('Daneben klicken wirft es auf den Boden (neues Bündel)', thrown && !s.inv.held && s.loot.length === 1 && Object.values(s.ground)[0].length === 1, { thrown, s });
await ev(() => nomad.step(1, [], ['inventory']));
s = await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(2); return nomad.inv(); });
check('I am Bündel zeigt den Boden im Camp', s.other?.key === 'floor' && s.other.grid.items.length === 1, s);
await ev(() => nomad.step(1, [], ['inventory']));

// a run: enemies drop bundles, the ground inventory, auto-stacking, knocked out
s = await ev(() => {
  nomad.step(1, [], ['inventory']);   // close
  const v = nomad.state().camp.hotspots.find(h => h.name === 'Van'); nomad.walkTo(v.x); nomad.step(1, [], ['grab']); nomad.choose('Planen'); nomad.choose('Plündern'); nomad.step(10);
  const sc = game.scene.getScene('play');
  nomad.calm(); const x = sc.leyla.x + 400;
  sc.loot.drop(x, sc.leyla.feet, [{ a: 'items', id: 'rohrbogen', n: 1 }, { a: 'items', id: 'verband', n: 2 }, { a: 'items', id: 'autobatterie', n: 1 }], 0);
  nomad.step(40); nomad.walkTo(x - 40); nomad.step(20);
  return { st: nomad.state(), loot: nomad.loot(), inv: nomad.inv() };
});
check('Beutebündel am Boden', s.st.mode === 'run' && s.loot.length === 1, s.loot);
check('Hinweis: I öffnet die Beute', /Beute am Boden/.test(s.st.prompt || ''), s.st.prompt);
await ev(() => nomad.step(1, [], ['inventory']));
s = await inv();
check('Boden-Inventar zeigt das Bündel', s.open && s.other?.key === 'floor' && has(s.other.grid, 'rohrbogen'), s);
await shot('floor');
const rb = await ev(() => game.scene.getScene('play').hud.inv.other.grid.items.find(e => e.id === 'rohrbogen'));
await click(1, rb.x, rb.y);
// put the L where it fits in the 6×4 backpack: try cells until it lands
for (const [x, y] of [[4, 1], [3, 1], [4, 0], [2, 1], [5, 0]]) { if (!(await inv()).held) break; await click(0, x, y); }
s = await inv();
check('Rohrbogen vom Boden in den Rucksack', !s.held && has(s.backpack, 'rohrbogen'), s);
s = await ev(() => { const sc = game.scene.getScene('play'); sc.hud.inv.close(); sc.loot.drop(sc.leyla.x + 20, sc.leyla.feet, [{ a: 'items', id: 'kupferkabel', n: 2 }], 0); nomad.step(40); return { loot: nomad.loot(), inv: nomad.inv(), bag: nomad.save().inv.grids.backpack.items.filter(e => e.id === 'kupferkabel').reduce((n, e) => n + e.n, 0) }; });
check('Kupferkabel (schon im Rucksack) wird beim Drüberlaufen eingesammelt', s.bag >= 5 && !s.loot.some(p => p.items.some(i => i.startsWith('kupferkabel'))), s);
s = await ev(() => { const sc = game.scene.getScene('play'); sc.leyla.hurt(sc.time.now, 9999, 0); nomad.step(200); return { mode: nomad.state().mode, bag: nomad.save().inv.grids.backpack.items.length, slots: nomad.save().inv.slots }; });
check('k.o.: Rucksack leer, Waffen bleiben', s.mode === 'camp' && s.bag === 0 && s.slots.melee === 'machete', s);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
