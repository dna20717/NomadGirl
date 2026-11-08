// Headless check of the build view of the rig (game.html?camp) with real mouse clicks: B opens it, budgets, swapping workshops,
// buying a generator, a workshop into the store and back, the van pulls only one container, "Fertig bauen" (Δ, time, camp rebuilt,
// shelf contents move along), no power → workshops say so, too heavy → no driving.
//   node tools/build_test.mjs [--shots]   (server must run: npm run serve), pictures to output/build_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.location()?.url?.includes('/api/')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/build_${n}.png` }); };
const build = () => ev(() => nomad.build());
const ws = async name => { await page.locator('.build-ws', { hasText: name }).first().click(); await page.waitForTimeout(30); };
const row = async (panel, name, btn) => { await page.locator(`${panel} .build-row`, { hasText: name }).first().locator('button', { hasText: btn }).click(); await page.waitForTimeout(30); };

await ev(() => { nomad.take(); nomad.step(5); nomad.step(1, [], ['build']); nomad.step(2); });
let b = await build();
check('B öffnet die Bau-Ansicht', b.open && b.rig === 'van[schlafkoje@0 warroom@1] wohnanhaenger[kochnische@0 werkbank@1 lagerregal@2]', b);
check('Budgets: 900/1500 kg, Energie ±0, 400 Δ', b.budgets.weight === 900 && b.budgets.pull === 1500 && b.budgets.power.net === 0 && b.deltas === 400, b);
const x0 = await ev(() => nomad.state().leyla.x);
await ev(() => nomad.step(20, ['right']));
check('Das Spiel wartet', (await ev(() => nomad.state().leyla.x)) === x0);
await shot('open');

// swap Kochnische and Werkbank
await ws('Kochnische');
check('Klick nimmt die Kochnische in die Hand', (await build()).held === 'kochnische');
await ws('Werkbank');
b = await build();
check('Klick auf die Werkbank tauscht', b.held === 'werkbank' && b.rig.includes('kochnische@1'), b);
await page.locator('.build-free', { hasText: 'Hierhin' }).first().click();
b = await build();
check('… und legt die Werkbank auf den freien Platz', !b.held && b.rig.includes('werkbank@0') && b.minutes === 60, b);

// buy a generator (200 Δ), it waits in the store; no free place → werkbank into the store, generator in
await row('.build-shop', 'Generator', 'Δ');
b = await build();
check('Generator gekauft: im Lager, 200 Δ übrig', b.spare.workshops.includes('generator') && b.deltas === 200, b);
await ws('Werkbank');
await page.locator('.build-spare').click({ position: { x: 30, y: 60 } });
b = await build();
check('Werkbank ins Lager', !b.held && b.spare.workshops.includes('werkbank') && b.budgets.power.net === 1, b);
await row('.build-spare', 'Generator', 'Einbauen');
await page.locator('.build-free', { hasText: 'Hierhin' }).first().click();
b = await build();
check('Generator eingebaut: Energie +4', b.rig.includes('generator@0') && b.budgets.power.net === 4, b);

// shelf with things moves to place 1, kochnische to 2
await ws('Lagerregal'); await ws('Kochnische');
await page.locator('.build-free', { hasText: 'Hierhin' }).first().click();
b = await build();
check('Lagerregal und Kochnische getauscht', b.rig.includes('lagerregal@1') && b.rig.includes('kochnische@2'), b);

// a crate: buy, the van pulls only one container
await row('.build-shop', 'Holzkiste', 'Δ');
await row('.build-spare', 'Holzkiste', 'Anhängen');
b = await build();
check('Van zieht nur einen Container', /höchstens 1/.test(b.msg || '') && b.spare.containers.includes('holzkiste'), b);
await row('.build-spare', 'Holzkiste', '+');
await shot('draft');

const shelf = await ev(() => nomad.save().inv.grids['store:1:2'].items.length);
await page.locator('.build-go').click();
await ev(() => nomad.step(10));
const sv = await ev(() => nomad.save());
check('Fertig bauen: Rig gespeichert, Δ, Zeit', sv.rig.units[1].workshops.map(w => `${w.id}@${w.at}`).join() === 'generator@0,lagerregal@1,kochnische@2' && sv.deltas === 170 && sv.hour > 18.5 && sv.rig.spare.workshops.join() === 'werkbank', { rig: sv.rig, d: sv.deltas, h: sv.hour });
check('Lagerregal-Inhalt zieht mit', sv.inv.grids['store:1:1']?.items.length === shelf && !sv.inv.grids['store:1:2'], Object.keys(sv.inv.grids));
const st = await ev(() => nomad.state());
check('Camp neu aufgebaut: Generator steht im Wohnanhänger', !(await build()).open && st.camp.hotspots.some(h => h.name === 'Generator') && !st.camp.hotspots.some(h => h.name === 'Werkbank'), st.camp.hotspots);
await shot('camp');

// no power: kochnische needs more than there is
await ev(() => { const s = window.game.scene.getScene('play'); s.data_.workshops.kochnische.power = -9; s.goCamp({ fade: 1 }); });
await ev(() => nomad.step(20));
let h = await ev(() => nomad.state().camp.hotspots.find(h => h.name === 'Kochnische'));
check('Zu wenig Energie: Kochnische hat keinen Strom', h?.hint === 'Kein Strom', h);
await ev(x => { nomad.walkTo(x); nomad.step(1, [], ['grab']); nomad.step(2); }, h.x);
const m = await ev(() => nomad.menu());
check('… und sagt, was zu tun ist', /Kein Strom/.test(m?.title + JSON.stringify(m?.items) + '') || m?.items?.some(i => i.label === 'Rig umbauen'), m);
await ev(() => nomad.choose('Zurück'));

// too heavy: no driving
await ev(() => { const s = window.game.scene.getScene('play'); s.data_.workshops.kochnische.power = -1; s.data_.tractors.van.pull = 500; s.goCamp({ fade: 1 }); });
await ev(() => nomad.step(20));
await ev(() => { const h = nomad.state().camp.hotspots.find(h => h.name === 'Van'); nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Planen'); });
const w = await ev(() => nomad.menu());
check('Rig zu schwer: Hinfahren gesperrt, Umbauen im Warroom', w?.items.filter(i => i.label.startsWith('Hinfahren')).every(i => /zu schwer/.test(i.disabled || '')) && w.items.some(i => i.label === 'Rig umbauen'), w);
await ev(() => nomad.choose('Rig umbauen'));
check('Warroom › Rig umbauen öffnet die Bau-Ansicht', (await build()).open);
await page.keyboard.press('Escape');
check('Esc bricht ab', !(await build()).open);

await browser.close();
console.log(ok.map(t => '✓ ' + t).join('\n'));
if (errors.length) { console.log(errors.map(t => '✗ ' + t).join('\n')); process.exit(1); }
console.log(`\n${ok.length} Prüfungen bestanden.`);
