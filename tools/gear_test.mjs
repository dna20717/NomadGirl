// Headless check of the Diablo inventory (Daniel, 10.11.2026) with real mouse clicks (game.html?camp):
// backpack | Leyla from the front | Mama-Bot, head + armor with stats, implants (tab, camp only, strain), Mama-Bot's parts,
// the rescue pocket surviving a knock-out, Mama-Bot's face reacting.
//   node tools/gear_test.mjs [--shots]   (server must run: npm run serve), pictures to output/gear_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(250); await page.screenshot({ path: `output/gear_${n}.png` }); };
const inv = () => ev(() => nomad.inv());
const center = async sel => { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const clickAt = async ([x, y], opt) => { await page.mouse.click(x, y, opt); await page.waitForTimeout(40); };
const slot = s => center(`.inv-slot[data-slot="${s}"]`);
// a thing in a grid (by key order on screen: backpack 0, other 1, rescue pocket last) → page position of its first cell
const thingAt = (key, id) => ev(([key, id]) => { const ui = game.scene.getScene('play').hud.inv, g = ui.grid(key), e = g.items.find(x => x.id === id); if (!e) return null;
  const grids = [...document.querySelectorAll('.inv-grid')], box = grids[ui.pair.indexOf(key) >= 0 ? ui.pair.indexOf(key) : grids.length - 1], r = box.getBoundingClientRect(), c = ui.cell * (ui.zoom || 1);
  return [r.left + (e.x + 0.5) * c, r.top + (e.y + 0.5) * c]; }, [key, id]);
const freeCell = key => ev(key => { const ui = game.scene.getScene('play').hud.inv, g = ui.grid(key), taken = new Set(); for (const e of g.items) taken.add(`${e.x},${e.y}`);
  const grids = [...document.querySelectorAll('.inv-grid')], box = key === 'drone' ? grids[grids.length - 1] : grids[ui.pair.indexOf(key)], r = box.getBoundingClientRect(), c = ui.cell * (ui.zoom || 1);
  return [r.left + 0.5 * c, r.top + 0.5 * c]; }, key);
const mods = () => ev(() => ({ ...game.scene.getScene('play').mods }));

await ev(() => { nomad.take(); nomad.step(5); const h = nomad.state().camp.hotspots.find(h => h.name === 'Kiste'); nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(5); });
let s = await inv();
check('Kiste offen, Gasmaske + Plattenträger liegen drin', s.open && s.other?.key === 'chest' && s.other.grid.items.some(i => i.startsWith('gasmaske')) && s.other.grid.items.some(i => i.startsWith('plattentraeger')), s);
const order = await ev(() => ['.inv-panel.bag', '.inv-panel.leyla', '.inv-panel.drone'].map(q => document.querySelector(q)?.getBoundingClientRect().left ?? -1));
check('Rucksack links, Leyla in der Mitte, Mama-Bot rechts', order[0] >= 0 && order[0] < order[1] && order[1] < order[2], order);
const pics = await ev(() => ({ leyla: document.querySelector('.inv-figure img')?.complete && document.querySelector('.inv-figure img').naturalWidth, hull: [...document.querySelectorAll('.inv-dronefig img')].length, face: !!document.querySelector('.inv-face') }));
check('Leyla von vorn und Mama-Bot mit Gesicht und Teilen', pics.leyla > 0 && pics.hull >= 3 && pics.face, pics);
check('Start: Cyberarm eingebaut, Scheinwerfer + Greifarm an Mama-Bot, Rettungsfach 3 × 2', s.wear.arm === 'cyberarm_mk1' && s.wear.bow === 'suchscheinwerfer' && s.wear.tail === 'greifarm' && s.drone?.w === 3 && s.drone?.h === 2, s);
await shot('open');

// head: the gas mask from the chest
const m0 = await mods();
await clickAt(await thingAt('chest', 'gasmaske'));
await clickAt(await slot('wear:head'));
s = await inv();
let m = await mods();
check('Gasmaske auf den Kopf: +4 Abwehr', s.wear.head === 'gasmaske' && !s.held && (m.defense || 0) === (m0.defense || 0) + 4, { s, m });
check('Mama-Bot freut sich über bessere Ausrüstung', s.face === 'gearBetter' && await ev(() => !document.querySelector('.inv-bubble').hidden), s.face);
// armor
await clickAt(await thingAt('chest', 'plattentraeger'));
await clickAt(await slot('wear:armor'));
s = await inv(); m = await mods();
check('Plattenträger: Abwehr, Leben, etwas langsamer', s.wear.armor === 'plattentraeger' && m.defense === (m0.defense || 0) + 16 && m.health === (m0.health || 0) + 10 && m.speed === (m0.speed || 0) - 3, m);
const stats = await ev(() => document.querySelector('.inv-stats').textContent);
check('Werte unter Leyla: Abwehr 16 %, Tempo 97 %', /16 %/.test(stats) && /97 %/.test(stats), stats);
// wrong place
await clickAt(await thingAt('chest', 'discokugel'));
await clickAt(await slot('wear:head'));
s = await inv();
check('Discokugel passt nicht auf den Kopf', s.wear.head === 'gasmaske' && s.held === 'discokugel×1', s);
await ev(() => { const ui = game.scene.getScene('play').hud.inv; if (ui.held) ui.putBack(); });

// implants: tab, scan, camp only
await clickAt(await center('.inv-tab[data-tab="implants"]'));
s = await inv();
const scan = await ev(() => ({ fig: !!document.querySelector('.inv-figure.scan'), slots: document.querySelectorAll('.inv-scan .inv-slot').length, wires: document.querySelectorAll('.inv-wire.on').length }));
check('Tab Implantate: Leyla als Scan, 6 Plätze, Linie zum Cyberarm', s.view === 'implants' && scan.fig && scan.slots === 6 && scan.wires >= 2, scan);
await clickAt(await thingAt('chest', 'nachtsicht_optik'));
await clickAt(await slot('wear:eyes'));
s = await inv(); m = await mods();
check('Nachtsicht-Optik in die Augen (im Camp): +5 % Schaden, Belastung 3', s.wear.eyes === 'nachtsicht_optik' && m.damage === (m0.damage || 0) + 5 && /3 \/ 10/.test(await ev(() => document.querySelector('.inv-stats').textContent)), m);
await shot('implants');
// strain limit
const refused = await ev(() => { const sc = game.scene.getScene('play'), ui = sc.hud.inv; ui.held = { e: { a: 'items', id: 'herzpumpe', n: 1, r: 0 }, from: 'chest' };
  const lim = sc.data_.leyla.inventory.strainMax; sc.data_.leyla.inventory.strainMax = 5; ui.slotClick('wear:heart'); const r = { heart: ui.inv.wear.heart, held: !!ui.held }; sc.data_.leyla.inventory.strainMax = lim; ui.held = null; return r; });
check('Zu viel Belastung: Herzpumpe passt nicht mehr', !refused.heart && refused.held, refused);

// Mama-Bot's parts: take the claw off, it disappears in the world; back on, she shows off
await clickAt(await center('.inv-tab[data-tab="gear"]'));
await clickAt(await slot('wear:tail'));
s = await inv();
let vis = await ev(() => game.scene.getScene('play').drone.partImgs.map(p => `${p.r.item}:${p.img.visible}`));
check('Greifarm ab: Mama-Bot ohne Greifarm (auch draußen), guckt traurig', s.held === 'greifarm×1' && s.wear.tail === null && vis.includes('greifarm:false') && s.face === 'gearOff', { s, vis });
await clickAt(await slot('wear:tail'));
s = await inv(); vis = await ev(() => game.scene.getScene('play').drone.partImgs.map(p => `${p.r.item}:${p.img.visible}`));
check('Greifarm wieder dran: Mama-Bot dreht sich stolz', s.wear.tail === 'greifarm' && vis.includes('greifarm:true') && s.face === 'dronePart', { s, vis });
await shot('drone');

// rescue pocket: a valuable goes in, food makes her angry
await clickAt(await thingAt('chest', 'discokugel'));
await clickAt(await freeCell('drone'));
s = await inv();
check('Discokugel ins Rettungsfach, Mama-Bot: „hab ich!“', s.drone.items.some(i => i.startsWith('discokugel')) && s.face === 'rescue', s);
await ev(() => { const ui = game.scene.getScene('play').hud.inv; ui.held = { e: { a: 'items', id: 'dosenbohnen', n: 1, r: 0 }, from: 'chest' }; });
await clickAt(await ev(() => { const box = [...document.querySelectorAll('.inv-grid')].pop(), r = box.getBoundingClientRect(), c = 44; return [r.left + 2.5 * c, r.top + 0.5 * c]; }));
s = await inv();
check('Bohnen ins Rettungsfach: Mama-Bot ist sauer', s.face === 'rescueFood', s.face);

// a run: implants stay put, the pocket survives a knock-out
await ev(() => { const sc = game.scene.getScene('play'); sc.hud.inv.close(); nomad.save().inv.grids.backpack.items = [{ a: 'items', id: 'verband', n: 2, x: 0, y: 0, r: 0 }];
  const v = nomad.state().camp.hotspots.find(h => h.name === 'Van'); nomad.walkTo(v.x); nomad.step(1, [], ['grab']); nomad.choose('Planen'); nomad.choose('Plündern'); nomad.step(10); nomad.calm(); });
const runMode = await ev(() => nomad.state().mode);
if (runMode === 'run') {
  const tryOut = await ev(() => { const ui = game.scene.getScene('play').hud.inv; ui.open(); ui.slotClick('wear:eyes'); const r = { eyes: ui.inv.wear.eyes, held: !!ui.held }; ui.close(); return r; });
  check('Im Run lassen sich Implantate nicht ausbauen', tryOut.eyes === 'nachtsicht_optik' && !tryOut.held, tryOut);
  m = await mods();
  check('Ausrüstung zählt auch im Run', m.defense >= 16, m);
  s = await ev(() => { const sc = game.scene.getScene('play'); sc.leyla.hurt(sc.time.now, 9999, 0); nomad.step(200); const i = nomad.save().inv; return { mode: nomad.state().mode, bag: i.grids.backpack.items.length, pocket: i.grids.drone.items.map(e => e.id), wear: i.wear }; });
  check('k.o.: Rucksack weg, Rettungsfach und Ausrüstung bleiben', s.mode === 'camp' && s.bag === 0 && s.pocket.includes('discokugel') && s.wear.head === 'gasmaske', s);
} else errors.push(`Run nicht gestartet (Modus ${runMode})`);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
