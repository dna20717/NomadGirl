// #117 Deko hinter dem Rig: build mode offers places behind the last container; a piece there moves along when another container is
// hitched on (the camp is longer by Camp › Deko › Hinter dem Rig). Server must run (npm run serve).
//   node tools/rear_test.mjs
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if ((m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) || /^Deko/.test(m.text())) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = (f, a) => page.evaluate(f, a);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.camp, null, { timeout: 30000 });
await ev(() => { nomad.release(); const s = game.scene.getScene('play'); s.box.save.deltas = 5000; s.box.save.rig.decor = []; s.goCamp({ fade: 0 }); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving; }, null, { timeout: 60000 });
await ev(() => game.scene.getScene('play').openBuild());
await page.waitForTimeout(800);
let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, c = s.camp, save = s.box.save;
  const spots = c.decorSpots('kit_kiste').filter(q => q.at.rear != null), rear0 = c.rigRear();
  bm.buyDecor('kit_kiste'); const q = spots.find(p => p.at.rear === 2); bm.placeDecor({ x: q.x, y: q.y });
  const i = save.rig.decor.length - 1, x0 = c.decorBoxes[i]?.x, yard = c.geo.yard?.x1;
  return { n: spots.length, at: save.rig.decor[i].at, x0, rear0, yard, behind: x0 < rear0 };
});
check('Plätze hinter dem letzten Container, die Kiste steht dort', r.n >= 20 && r.at.rear === 2 && r.behind && r.x0 > r.yard, r);
const r0 = r;
r = await ev(async () => {
  const s = game.scene.getScene('play'), save = s.box.save; s.hud.build.close();
  const u = save.rig.units.find(x => x.kind === 'container'), p0 = u.places ?? 2; u.places = p0 + 2;   // the rig gets longer (as when pulling or hitching)
  s.goCamp({ fade: 0 });
  await new Promise(res => { let n = 0; const t = setInterval(() => { const q = game.scene.getScene('play'); if ((q.camp && !q.leaving && q.camp.rigRear() !== undefined && n > 5) || n > 100) { clearInterval(t); res(); } n++; }, 100); });
  const c = game.scene.getScene('play').camp, i = save.rig.decor.length - 1;
  return { x1: c.decorBoxes[i]?.x, rear1: c.rigRear(), yard: c.geo.yard?.x1, places: u.places };
});
check('Rig länger: die Kiste wandert mit nach hinten und bleibt vor dem Schrottplatz', Math.abs((r.rear1 - r.x1) - 2 * 64) < 2 && r.x1 > r.yard && r.x1 < r0.x0 - 60, { r, x0: r0.x0 });
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Hinter dem Rig ok: ${ok.length} Prüfungen.`);
