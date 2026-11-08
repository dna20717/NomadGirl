// Headless check of the tractor tab and the rigs' own storages with real mouse clicks (game.html?camp):
// Kofferraum at the van's rear door, Deichselkasten on the trailer's drawbar, the "Van" tab in the inventory (rig part slots),
// building in the Dachbox (Kofferraum grows), taking it out (only when nothing falls out), buying a V8 at the dealer, unhitching only empty.
//   node tools/van_test.mjs [--shots]   (server must run: npm run serve), pictures to output/van_*.png
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
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/van_${n}.png` }); };
const inv = () => ev(() => nomad.inv());
const cell = (panel, x, y) => ev(([panel, x, y]) => { const g = document.querySelectorAll('.inv-grid')[panel], r = g.getBoundingClientRect(), c = parseFloat(g.style.getPropertyValue('--c')); return [r.left + (x + 0.5) * c, r.top + (y + 0.5) * c]; }, [panel, x, y]);
const click = async (panel, x, y, opt = {}) => { const [px, py] = await cell(panel, x, y); await page.mouse.click(px, py, opt); await page.waitForTimeout(30); };
const at = async sel => { const b = await page.locator(sel).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(30); };
const walkE = name => ev(n => { nomad.take(); nomad.step(5); const h = nomad.state().camp.hotspots.find(h => h.name === n || h.name.startsWith(n)); if (!h) return null; nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(5); return h; }, name);
const grid = key => ev(k => { const g = nomad.save().inv.grids[k]; return g && { w: g.w, h: g.h, items: g.items.map(e => `${e.id}×${e.n}@${e.x},${e.y}`) }; }, key);
const minutes = () => ev(() => { const s = nomad.save(); return s.day * 1440 + Math.round(s.hour * 60); });

// the camp has E spots for both storages
const spots = await ev(() => nomad.state().camp.hotspots.map(h => h.name));
check('Kofferraum und Deichselkasten haben einen E-Punkt', spots.includes('Kofferraum') && spots.includes('Deichselkasten'), spots);

let h = await walkE('Kofferraum'), s = await inv();
check('E an der Hecktür öffnet den Kofferraum (4 × 3)', s.open && s.other?.key === 'rig:0' && s.other.grid.w === 4 && s.other.grid.h === 3, { h, s });
await shot('trunk');

// a Dachbox lies in the Kofferraum (as if bought); switch to the tab "Van"
await ev(() => { const sc = game.scene.getScene('play'); sc.box.save.inv.grids['rig:0'].items.push({ a: 'rigParts', id: 'dachbox', n: 1, x: 0, y: 0, r: 0 }); sc.hud.inv.draw(); });
await page.locator('.inv-tab', { hasText: 'Van' }).click(); await page.waitForTimeout(40);
s = await inv();
check('Tab „Van“: Slots + Kofferraum links, Rucksack rechts', s.tab === 'van' && s.pair?.[0] === 'rig:0' && s.pair?.[1] === 'backpack' && (await page.locator('.inv-slot.part').count()) === 3, s);
await shot('vantab');

const t0 = await minutes();
await click(0, 0, 0);
s = await inv();
check('Klick nimmt die Dachbox', s.held === 'dachbox×1', s);
await at('.inv-slot[data-part="engine:0"]');
s = await inv();
check('Dachbox passt nicht in den Motor-Slot', s.held === 'dachbox×1' && !s.parts?.engine?.[0], s);
await at('.inv-slot[data-part="roof:0"]');
s = await inv();
let g = await grid('rig:0');
check('Dachbox aufs Dach: eingebaut, Kofferraum 4 × 5', !s.held && s.parts?.roof?.[0] === 'dachbox' && g.w === 4 && g.h === 5, { s, g });
check('Einbauen kostet Zeit (Rig-Bau › Rig-Teil ein-/ausbauen)', (await minutes()) - t0 === 30, (await minutes()) - t0);

// two V8 fill the bigger Kofferraum: without the Dachbox one would fall out, so it stays on
await ev(() => { const sc = game.scene.getScene('play'), g = sc.box.save.inv.grids['rig:0']; g.items.push({ a: 'rigParts', id: 'v8', n: 1, x: 0, y: 0, r: 0 }, { a: 'rigParts', id: 'v8', n: 1, x: 0, y: 2, r: 0 }); sc.hud.inv.draw(); });
await at('.inv-slot[data-part="roof:0"]');
s = await inv();
check('Volle Dachbox lässt sich nicht abnehmen', !s.held && s.parts?.roof?.[0] === 'dachbox', s);
await ev(() => { const sc = game.scene.getScene('play'), g = sc.box.save.inv.grids['rig:0']; g.items = g.items.filter(e => e.id !== 'v8'); g.items.push({ a: 'items', id: 'discokugel', n: 1, x: 0, y: 4, r: 0 }); sc.hud.inv.draw(); });
// double click: discokugel from the Kofferraum into the backpack
const [dx, dy] = await cell(0, 0, 4); await page.mouse.dblclick(dx, dy); await page.waitForTimeout(40);
g = await grid('rig:0'); s = await inv();
check('Doppelklick schickt sie in den Rucksack', !g.items.some(i => i.startsWith('discokugel')) && s.backpack.items.some(i => i.startsWith('discokugel')), { g, s });
await at('.inv-slot[data-part="roof:0"]');
s = await inv(); g = await grid('rig:0');
check('Leere Dachbox abnehmen: in der Hand, Kofferraum wieder 4 × 3', s.held === 'dachbox×1' && !s.parts?.roof?.[0] && g.h === 3, { s, g });
await click(0, 1, 0);
g = await grid('rig:0');
check('… und zurück in den Kofferraum', g.items.some(i => i.startsWith('dachbox×1@1,0')), g);

// Leyla tab again: backpack + Kofferraum side by side
await page.locator('.inv-tab', { hasText: 'Leyla' }).click(); await page.waitForTimeout(40);
s = await inv();
check('Tab „Leyla“ zeigt wieder Rucksack + Kofferraum', s.tab === 'leyla' && s.other?.key === 'rig:0', s);
await ev(() => game.scene.getScene('play').hud.inv.close());

// Deichselkasten of the trailer
h = await walkE('Deichselkasten'); s = await inv();
check('E an der Deichsel öffnet den Deichselkasten (3 × 2)', s.open && s.other?.key === 'rig:1' && s.other.grid.w === 3 && s.other.grid.h === 2, { h, s });
await shot('drawbar');
await ev(() => { const sc = game.scene.getScene('play'); sc.hud.inv.close(); });

// the dealer sells rig parts: a V8 lands in the Kofferraum, undo takes it back
const before = await ev(() => (nomad.save().deltas = 2000));
await ev(() => { const sc = game.scene.getScene('play'); sc.hud.build.open(); nomad.step(60); sc.hud.build.buy('rigParts', 'v8'); });
g = await grid('rig:0');
const after = await ev(() => nomad.save().deltas);
check('V8 beim Händler gekauft: liegt im Kofferraum, Δ weg', g.items.some(i => i.startsWith('v8×1')) && before - after === 900, { g, before, after });
await ev(() => { const sc = game.scene.getScene('play'); sc.hud.build.undoLast(); });
g = await grid('rig:0');
check('Rückgängig nimmt den Kauf zurück', !g.items.some(i => i.startsWith('v8')) && (await ev(() => nomad.save().deltas)) === before, g);
// a Bleche fits the budget: buy it and build it in, the van gets armour
await ev(() => { const sc = game.scene.getScene('play'); sc.hud.build.buy('rigParts', 'bleche'); sc.hud.build.close(); nomad.step(60); });
g = await grid('rig:0');
check('Bleche gekauft → Kofferraum', g.items.some(i => i.startsWith('bleche×1')), g);

// unhitching: not while the Deichselkasten holds something
s = await ev(() => {
  const sc = game.scene.getScene('play'), save = sc.box.save;
  save.inv.grids['rig:1'].items.push({ a: 'items', id: 'discokugel', n: 1, x: 0, y: 0, r: 0 });
  return import('./game/rig.js').then(R => R.act(sc.data_, save, d => { for (const w of d.rig.units[1].workshops.splice(0)) R.toSpare(d, w); return R.detach(sc.data_, d, 1); }));
});
check('Abhängen geht nur mit leerem Deichselkasten', s.ok === false && /Deichselkasten/.test(s.reason), s);

// in a run the tab is gone
s = await ev(() => { const sc = game.scene.getScene('play'); return { camp: sc.hud.inv.host.inCamp() }; });
check('Van-Tab nur im Camp (Host meldet Camp)', s.camp === true, s);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
