import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
page.on('pageerror', e => console.log('ERR', e.message));
await furnishedStart(page, { work: true });
await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
console.log(await page.evaluate(() => { const s = game.scene.getScene('play'); nomad.take(); nomad.step(5); nomad.step(1, [], ['build']); nomad.step(30);
  const b = s.hud.build; b.jobs.push({ x: 3000, fx: 3000, fy: s.camp.ground - 100, secs: 1 }); const tr = [];
  for (let i = 0; i < 20; i++) { nomad.step(15); tr.push([b.job?.state, Math.round(s.drone.x), Math.round(s.drone.y), b.job && Math.round(b.job.fy - 150), JSON.stringify(s.drone.build)]); }
  return { tr, atFire: b.atFire, l: s.leyla.state, fire: s.camp.geo.fireX, look: s.camp.C.fire?.sit?.look, drone: !!s.drone, build: s.drone?.build, work: b.B.work }; }));
await browser.close();
