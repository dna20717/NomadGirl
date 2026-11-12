// Headless check of building the rig right in the camp (game.html?camp, Rig bauen 2.0) with real mouse drags:
// B zooms out, swapping workshops by dragging one onto the other, Leyla walks over and screws, undo, onto the scrapyard,
// buying (delivered onto the dealer's pad), building it in, a full shelf stays in, its contents move along, the van pulls
// only one trailer, selling at the dealer, a trailer with workshops cannot be unhitched, B closes and the camp keeps it all,
// no power → workshops say so, too heavy → no driving, Warroom › Rig umbauen, a mouseup lost outside the window, Esc.
//   node tools/build_test.mjs [--shots]   (server must run: npm run serve), pictures to output/build_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';
import { classicRig } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '') && !/404/.test(m.text())) errors.push(m.text()); });
await classicRig(page);   // fixed setup: van pulls one trailer, Wohnanhänger with 3 places (test_fixture.mjs)
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(300); await page.screenshot({ path: `output/build_${n}.png` }); await ev(() => nomad.thaw()); };
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

// the test plays with 400 Δ, whatever Wirtschaft › Startgeld says (Daniel tries other values in the workshop)
await ev(() => { nomad.save().deltas = 400; nomad.take(); nomad.step(5); nomad.step(1, [], ['build']); nomad.step(5); });
let b = await build();
check('B zoomt raus in den Bau-Modus', b.open && b.zoom < 1 && b.rig === 'van[schlafkoje@0 warroom@1] wohnanhaenger[kochnische@0 werkbank@1 lagerregal@2]', b);
check('Budgets: 900/1500 kg, Energie ±0, 400 Δ', b.budgets.weight === 900 && b.budgets.pull === 1500 && b.budgets.power.net === 0 && b.deltas === 400, b);
// Daniel, 12.11.2026: building = steering AvA only, Leyla sits at the fire
await page.mouse.move(700, 400); await page.waitForTimeout(30); await page.mouse.move(720, 420); await ev(() => nomad.step(60));
const fire = await ev(() => { const s = game.scene.getScene('play'), d = s.drone, p = s.hud.build.pointer; return { st: s.leyla.state, dx: Math.round(Math.abs(s.leyla.x - s.camp.geo.fireX)), build: !!d.build, near: p ? Math.round(Math.hypot(d.x - d.build.x, d.y - d.build.y)) : null }; });
check('Bau-Modus: Leyla sitzt am Feuer, AvA folgt dem Zeiger', fire.st === 'sit' && fire.dx < 300 && fire.build && fire.near < 30, fire);
const x0 = await ev(() => nomad.state().leyla.x);
await ev(() => nomad.step(20, ['right']));
check('Tasten steuern Leyla beim Bauen nicht', Math.abs((await ev(() => nomad.state().leyla.x)) - x0) < 2);
await shot('open');

// Kochnische onto the Werkbank: they swap, right away (2 × 30 min)
b = await drag(await slot('kochnische'), await slot('werkbank'), { shotName: 'swing' });
check('Kochnische auf die Werkbank gezogen: getauscht, sofort echt', b.rig.includes('kochnische@1') && b.rig.includes('werkbank@0') && b.clock === 'Tag 1 · 19:30' && !b.held, b);
check('… Leyla bekommt den Job, Rückgängig geht', b.jobs === 1 && b.canUndo, b);
await ev(() => nomad.until(() => nomad.build().working, 600));
check('Leyla läuft hin und schraubt', (await build()).working);
await shot('work');
await finishJobs();
b = await build();
check('Fertig geschraubt: kein Rückgängig mehr', !b.canUndo && !b.jobs, b);

// Werkbank onto the scrapyard, then undo before Leyla is done
b = await drag(await slot('werkbank'), (await spots()).yardFree);
check('Werkbank auf den Schrottplatz', b.spare.workshops.includes('werkbank') && b.budgets.power.net === 1 && b.clock === 'Tag 1 · 20:00', b);
check('… liegt dort auf einer Palette', !!(await yardItem('werkbank')));
await page.locator('.bm-undo').click(); await ev(() => nomad.step(2));
b = await build();
check('Rückgängig: Werkbank wieder drin, Uhr zurück', b.rig.includes('werkbank@0') && !b.spare.workshops.length && b.clock === 'Tag 1 · 19:30' && !b.jobs, b);

// buy a generator: delivered onto the dealer's pad
await page.locator('.bm-shopbtn').click();
await page.locator('.bm-shop .build-row', { hasText: 'Generator' }).locator('button').click(); await ev(() => nomad.step(40));
b = await build();
check('Generator gekauft: auf den Händler-Platz geliefert, 200 Δ', b.spare.workshops.includes('generator') && b.deltas === 200 && !!(await yardItem('generator')), b);
await shot('delivered');
await page.locator('.bm-shop .craft-x').click();
// werkbank out, generator in
await drag(await slot('werkbank'), (await spots()).yardFree);
b = await drag(await yardItem('generator'), await freeSlot());
check('Generator vom Schrottplatz eingebaut: Energie +4', b.rig.includes('generator@0') && b.budgets.power.net === 4 && b.spare.workshops.join() === 'werkbank', b);

// the full shelf may not go onto the scrapyard; swapping it keeps its contents
const shelf = await ev(() => nomad.save().inv.grids['store:1:2'].items.length);
b = await drag(await slot('lagerregal'), (await spots()).yardFree);
check('Volles Lagerregal bleibt drin', b.rig.includes('lagerregal@2') && /nicht leer/.test(b.msg || ''), b);
await ev(() => nomad.step(30));
b = await drag(await slot('lagerregal'), await slot('kochnische'));
check('Lagerregal und Kochnische getauscht', b.rig.includes('lagerregal@1') && b.rig.includes('kochnische@2'), b);
check('Lagerregal-Inhalt zieht mit', (await ev(() => { const g = nomad.save().inv.grids; return [g['store:1:1']?.items.length, !!g['store:1:2']]; })).join() === `${shelf},false`);

// a crate trailer: the van pulls only one; selling it at the dealer
await page.locator('.bm-shopbtn').click();
await page.locator('.bm-shop .build-row', { hasText: 'Holzkiste' }).locator('button').click(); await ev(() => nomad.step(40));
await page.locator('.bm-shop .craft-x').click();
const gaps = (await spots()).gaps;
b = await drag(await yardItem('holzkiste'), gaps[gaps.length - 1]);
check('Van zieht nur einen Anhänger', /höchstens 1/.test(b.msg || '') && b.spare.containers.includes('holzkiste'), b);
await ev(() => nomad.step(30));
const before = (await build()).deltas;
b = await drag(await yardItem('holzkiste'), (await spots()).dealer, { shotName: 'sell' });
check('Holzkiste beim Händler verkauft (+30 Δ)', !b.spare.containers.length && b.deltas === before + 30, b);
b = await drag(await yardItem('werkbank'), (await spots()).dealer);
check('Werkbank verkauft (+40 Δ)', !b.spare.workshops.length && b.deltas === before + 70, b);
// the trailer with workshops inside stays hitched
const unit = (await spots()).units[0];
b = await drag(unit, (await spots()).yardFree);
check('Anhänger mit Werkstätten lässt sich nicht abhängen', b.rig.startsWith('van') && b.rig.includes('wohnanhaenger') && /Werkstätten ausbauen/.test(b.msg || ''), b);
await finishJobs();
await shot('built');

// B: done, the camp keeps everything
await ev(() => { nomad.step(1, [], ['build']); nomad.step(30); });
b = await build();
const sv = await ev(() => nomad.save()), st = await ev(() => nomad.state());
check('B schließt, Kamera folgt Leyla wieder', !b.open && (await ev(() => !!window.game.scene.getScene('play').cam._follow)), b);
check('Rig gespeichert: Generator, Lagerregal, Kochnische; 210 Δ', sv.rig.units[1].workshops.map(w => `${w.id}@${w.at}`).sort().join() === 'generator@0,kochnische@2,lagerregal@1' && sv.deltas === 210, { rig: sv.rig, d: sv.deltas });
check('Camp: Generator steht im Wohnanhänger', st.camp.hotspots.some(h => h.name === 'Generator') && !st.camp.hotspots.some(h => h.name === 'Werkbank'), st.camp.hotspots);
await shot('camp');

// no power: kochnische needs more than there is
await ev(() => { const s = window.game.scene.getScene('play'); s.data_.workshops.kochnische.power = -9; s.goCamp({ fade: 1 }); });
await ev(() => nomad.step(20));
let h = await ev(() => nomad.state().camp.hotspots.find(h => h.name === 'Kochnische'));
check('Zu wenig Energie: Kochnische hat keinen Strom', h?.hint === 'Kein Strom', h);
await ev(() => { nomad.goTo('Kochnische'); nomad.step(1, [], ['grab']); nomad.step(2); });
const m = await ev(() => nomad.menu());
check('… und sagt, was zu tun ist', /Kein Strom/.test(m?.title + JSON.stringify(m?.items) + m?.sub + '') || m?.items?.some(i => i.label === 'Rig umbauen'), m);
await ev(() => nomad.choose('Zurück'));

// too heavy: no driving
await ev(() => { const s = window.game.scene.getScene('play'); s.data_.workshops.kochnische.power = -1; s.data_.tractors.van.pull = 500; s.goCamp({ fade: 1 }); });
await ev(() => nomad.step(20));
await ev(() => { const h = nomad.state().camp.hotspots.find(h => h.name === 'Van'); nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Planen'); });
const w = await ev(() => nomad.menu());
check('Rig zu schwer: Hinfahren gesperrt', w?.items.filter(i => i.label.startsWith('Hinfahren')).every(i => /zu schwer/.test(i.disabled || '')), w);
check('Warroom ohne Umweg: kein „Rig umbauen“ mehr im Menü', !w.items.some(i => i.label === 'Rig umbauen'), w);
await ev(() => nomad.choose('Zurück'));
check('Knopf „Rig bauen“ ist im Camp immer da', await page.locator('.hud-buildbtn').isVisible());
await page.locator('.hud-buildbtn').click(); await ev(() => nomad.step(5));
check('Knopf „Rig bauen“ öffnet den Bau-Modus', (await build()).open);
check('… und versteckt sich beim Bauen', !(await page.locator('.hud-buildbtn').isVisible()));
// the button comes up outside the window (no mouseup reaches the game): the part must not stay stuck to the pointer
{
  const cdp = await page.context().newCDPSession(page), m = (type, x, y, buttons, button = 'none') => cdp.send('Input.dispatchMouseEvent', { type, x, y, buttons, button, clickCount: 1 });
  const sp = await spots(), a = sp.slots.find(s => s.ws), dl = sp.dealer, rig0 = (await build()).rig;
  await m('mouseMoved', a.x, a.y, 0); await m('mousePressed', a.x, a.y, 1, 'left'); await ev(() => nomad.step(2));
  for (let k = 1; k <= 8; k++) { await m('mouseMoved', a.x + (dl.x - a.x) * k / 8, a.y + (dl.y - a.y) * k / 8, 1); await ev(() => nomad.step(1)); }
  await m('mouseMoved', dl.x + 200, dl.y - 40, 0); await ev(() => nomad.step(20));
  const bb = await build();
  check('Losgelassen außerhalb des Fensters: nichts hängt am Zeiger, nichts verkauft', !bb.held && bb.rig === rig0, bb);
  await m('mouseReleased', dl.x + 200, dl.y - 40, 0, 'left');
  const free = (await spots()).slots.find(s => s.ws);
  const r2 = await drag(free, (await spots()).yardFree);
  check('… danach lässt sich wieder normal ziehen', !r2.held && r2.spare.workshops.length >= 1, r2);
}
await page.keyboard.press('Escape'); await ev(() => nomad.step(5));
check('Esc beendet ihn', !(await build()).open);

await browser.close();
console.log(ok.map(t => '✓ ' + t).join('\n'));
if (errors.length) { console.log(errors.map(t => '✗ ' + t).join('\n')); process.exit(1); }
console.log(`\n${ok.length} Prüfungen bestanden.`);
