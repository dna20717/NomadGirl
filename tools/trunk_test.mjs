// The van in a POI (#093, #094, Daniel 19.11.2026: „Van im POI soll nicht aufgehen“, „Van braucht Kofferraum-Segment für Beute aus POI“):
// the door stays shut, E at the rear opens the trunk, its loot survives a knock-out and comes home into the backpack.
// Server must run (npm run serve).   node tools/trunk_test.mjs [--shots]
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
const ev = f => page.evaluate(f);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);

let v = await ev(() => {
  nomad.take(); nomad.step(30); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.choose('Planen'); nomad.choose('Plündern'); nomad.step(60);
  const s = game.scene.getScene('play'); nomad.step(40);
  return { mode: s.mode, van: s.van?.state(), trunk: !!s.box.save.inv.grids.trunk, size: [s.box.save.inv.grids.trunk?.w, s.box.save.inv.grids.trunk?.h] };
});
check('Im POI: Van steht da, Tür bleibt zu, obwohl Leyla daneben startet (#093)', v.mode === 'run' && v.van && v.van.frame === 0 && !v.van.open, v);
check('Kofferraum-Raster da (6 × 4)', v.trunk && v.size.join() === '6,4', v);
v = await ev(() => {
  const s = game.scene.getScene('play'), van = s.van, x = van.toWorld(van.S.trunk.x, 0).x;
  nomad.tp(x, s.leyla.feet); nomad.step(10); const prompt = s.vanPrompt;
  nomad.step(1, [], ['grab']); nomad.step(3);
  const inv = s.hud.inv, open = inv.isOpen && inv.other?.key === 'trunk';
  return { prompt, open, title: inv.other?.title };
});
check('E am Heck: „Kofferraum · Beute sicher verstauen“ öffnet den Kofferraum (#094)', /Kofferraum/.test(v.prompt || '') && v.open && v.title === 'Kofferraum', v);
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: 'output/trunk_open.png' }); }
v = await ev(async () => {
  const s = game.scene.getScene('play'), I = await import('/game/inventory.js'), save = s.box.save;
  I.add(s.data_, save.inv.grids.trunk, 'items', 'discokugel', 1); I.add(s.data_, save.inv.grids.backpack, 'items', 'kupferkabel', 2);
  s.hud.inv.close(); s.endRun(true);
  await new Promise(r => setTimeout(r, 200));
  for (let i = 0; i < 40 && !game.scene.getScene('play')?.camp; i++) { nomad.step(10); await new Promise(r => setTimeout(r, 100)); }
  const sv = game.scene.getScene('play').box.save;
  return { bag: sv.inv.grids.backpack.items.map(e => e.id), trunk: sv.inv.grids.trunk.items.length };
});
check('k.o.: Rucksack-Beute weg, Kofferraum-Beute ist zu Hause im Rucksack', v.bag.includes('discokugel') && !v.bag.includes('kupferkabel') && v.trunk === 0, v);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Van im POI: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
