// Headless check of the rigs' own storages and the rig parts (game.html?camp) with real mouse clicks and drags:
// Kofferraum at the van's rear door, Deichselkasten on the trailer's drawbar, the inventory tab "Van" (only a view),
// rig parts in the build mode (B): bought onto the scrapyard, dragged onto the sockets on the van (wrong socket = flies back),
// swapped, the Dachbox makes the Kofferraum taller and only comes off when nothing falls out, undo, selling at the dealer,
// a part made at the workbench lands on the scrapyard, unhitching only with an empty Deichselkasten.
//   node tools/van_test.mjs [--shots]   (server must run: npm run serve), pictures to output/van_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '') && !/404/.test(m.text())) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze?.()); await page.waitForTimeout(300); await page.screenshot({ path: `output/van_${n}.png` }); await ev(() => nomad.thaw?.()); };
const inv = () => ev(() => nomad.inv());
const cell = (panel, x, y) => ev(([panel, x, y]) => { const g = document.querySelectorAll('.inv-grid')[panel], r = g.getBoundingClientRect(), c = parseFloat(g.style.getPropertyValue('--c')); return [r.left + (x + 0.5) * c, r.top + (y + 0.5) * c]; }, [panel, x, y]);
const walkE = name => ev(n => { nomad.take(); nomad.step(5); const h = nomad.state().camp.hotspots.find(h => h.name === n || h.name.startsWith(n)); if (!h) return null; nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(5); return h; }, name);
const grid = key => ev(k => { const g = nomad.save().inv.grids[k]; return g && { w: g.w, h: g.h, items: g.items.map(e => `${e.id}×${e.n}@${e.x},${e.y}`) }; }, key);
const minutes = () => ev(() => { const s = nomad.save(); return s.day * 1440 + Math.round(s.hour * 60); });
const build = () => ev(() => nomad.build());
const spots = () => ev(() => nomad.buildSpots());
// drag with the mouse: press, move in steps (the game steps in between, so the part swings), release
const drag = async (a, b, { shotName = null } = {}) => {
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await ev(() => nomad.step(2));
  for (let i = 1; i <= 10; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await ev(() => nomad.step(2)); }
  if (shotName) await shot(shotName);
  await page.mouse.up(); await ev(() => nomad.step(2));
  return build();
};
const slot = async ws => (await spots()).slots.find(s => s.ws === ws);
const freeSlot = async () => (await spots()).slots.find(s => !s.ws);
const yardItem = async id => (await spots()).yard.find(y => y.id === id);
const finishJobs = () => ev(() => nomad.until(() => { const b = nomad.build(); return !b.jobs && !b.working; }, 1500));

// the camp has E spots for both storages
const names = await ev(() => nomad.state().camp.hotspots.map(h => h.name));
check('Kofferraum und Deichselkasten haben einen E-Punkt', names.includes('Kofferraum') && names.includes('Deichselkasten'), names);

let h = await walkE('Kofferraum'), s = await inv();
check('E an der Hecktür öffnet den Kofferraum (4 × 3)', s.open && s.other?.key === 'rig:0' && s.other.grid.w === 4 && s.other.grid.h === 3, { h, s });
await shot('trunk');

// the tab "Van" shows the van's slots and the Kofferraum; building in happens in the build mode
await page.locator('.inv-tab', { hasText: 'Van' }).click(); await page.waitForTimeout(40);
s = await inv();
check('Tab „Van“: Slots + Kofferraum links, Rucksack rechts', s.tab === 'van' && s.pair?.[0] === 'rig:0' && s.pair?.[1] === 'backpack' && (await page.locator('.inv-slot.part').count()) === 3, s);
await page.locator('.inv-slot[data-part="roof:0"]').click(); await page.waitForTimeout(30);
s = await inv();
check('Slot anklicken baut nichts aus (nur Ansicht)', !s.held && !s.parts?.roof?.[0], s);
await shot('vantab');
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

// build mode: rig parts are bought onto the scrapyard and dragged onto the sockets on the van
await ev(() => { nomad.save().deltas = 3000; nomad.take(); nomad.step(5); nomad.step(1, [], ['build']); nomad.step(40); });
let b = await build(), sp = await spots();
check('Bau-Modus zeigt drei Sockel am Van (Motor, Panzerung, Dach)', sp.sockets.map(x => x.slot).join() === 'engine,armor,roof' && sp.sockets.every(x => !x.id), sp.sockets);
await ev(() => { const bm = game.scene.getScene('play').hud.build; bm.buy('rigParts', 'dachbox'); bm.buy('rigParts', 'v8'); });
await finishJobs();
b = await build(); sp = await spots();
check('Gekauft: Dachbox + V8 liegen auf dem Schrottplatz, Δ weg', b.spare.parts.join() === 'dachbox,v8' && b.deltas === 3000 - 250 - 900 && sp.yard.some(y => y.kind === 'part' && y.id === 'v8'), { b, yard: sp.yard });
await shot('yard');
const part = async id => (await spots()).yard.find(y => y.kind === 'part' && y.id === id);
const sock = async slot => (await spots()).sockets.find(x => x.slot === slot);
b = await drag(await part('v8'), await sock('roof'));
check('V8 aufs Dach: passt nicht, fliegt zurück', !b.parts.roof?.[0] && b.spare.parts.includes('v8'), b);
const t0 = await minutes();
b = await drag(await part('v8'), await sock('engine'), { shotName: 'swing' });
check('V8 an den Motor-Sockel: angeschraubt, +1.500 kg Zugkraft', b.parts.engine?.[0] === 'v8' && b.budgets.pull === 3000 && !b.spare.parts.includes('v8'), b);
check('Anschrauben kostet 30 min', (await minutes()) - t0 === 30, (await minutes()) - t0);
await finishJobs();
b = await drag(await part('dachbox'), await sock('roof'));
await finishJobs();
let g = await grid('rig:0');
check('Dachbox aufs Dach: Kofferraum 4 × 5', b.parts.roof?.[0] === 'dachbox' && g.h === 5, { b, g });
// Kofferraum full: the Dachbox stays on
await ev(() => { const g = nomad.save().inv.grids['rig:0']; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.items.push({ a: 'items', id: 'zettel_curry', n: 1, x, y, r: 0 }); });
b = await drag(await sock('roof'), sp.yardFree);
check('Volle Dachbox lässt sich nicht abschrauben', b.parts.roof?.[0] === 'dachbox' && /Kofferraum/.test(b.msg || ''), b);
await ev(() => { nomad.save().inv.grids['rig:0'].items = []; });
b = await drag(await sock('roof'), (await spots()).yardFree);
g = await grid('rig:0');
check('Leere Dachbox abschrauben: zurück auf den Schrottplatz, Kofferraum 4 × 3', !b.parts.roof?.[0] && b.spare.parts.includes('dachbox') && g.h === 3, { b, g });
await ev(() => game.scene.getScene('play').hud.build.undoLast());
b = await build();
check('Rückgängig schraubt sie wieder an', b.parts.roof?.[0] === 'dachbox', b);
await finishJobs();
// sell the V8 straight from the engine socket
const d0 = b.deltas;
b = await drag(await sock('engine'), (await spots()).dealer);
check('V8 vom Sockel zum Händler: verkauft', !b.parts.engine?.[0] && !b.spare.parts.includes('v8') && b.deltas === d0 + 450, b);
await shot('sockets');
await finishJobs();
await ev(() => { game.scene.getScene('play').hud.build.close(); nomad.step(60); });
check('Außerhalb des Bau-Modus: Dachbox sichtbar auf dem Van', await ev(() => game.scene.getScene('play').camp.rigObjs.some(o => o.h && o.list?.[0]?.texture?.key === 'part_dachbox')), null);

// made at the workbench: onto the scrapyard
s = await ev(() => import('./game/crafting.js').then(C => { const sv = nomad.save(); sv.inv.grids.backpack.items.push({ a: 'items', id: 'schrottplatte', n: 3, x: 0, y: 2, r: 0 }); for (const k of Object.keys(sv.inv.grids)) if (k !== 'backpack') sv.inv.grids[k].items = sv.inv.grids[k].items.filter(e => e.id !== 'schrottplatte'); return { r: C.craft(game.scene.getScene('play').data_, sv, 'bleche_schweissen', 'werkbank'), parts: sv.rig.spare.parts }; }));
check('Bleche an der Werkbank geschweißt: liegen auf dem Schrottplatz', s.r.ok && s.r.made.part && s.parts.includes('bleche'), s);

// unhitching: not while the Deichselkasten holds something
s = await ev(() => {
  const sc = game.scene.getScene('play'), save = sc.box.save;
  save.inv.grids['rig:1'].items.push({ a: 'items', id: 'discokugel', n: 1, x: 0, y: 0, r: 0 });
  return import('./game/rig.js').then(R => R.act(sc.data_, save, d => { for (const w of d.rig.units[1].workshops.splice(0)) R.toSpare(d, w); return R.detach(sc.data_, d, 1); }));
});
check('Abhängen geht nur mit leerem Deichselkasten', s.ok === false && /Deichselkasten/.test(s.reason), s);


await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
