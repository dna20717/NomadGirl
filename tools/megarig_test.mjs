// Mega rigs (#022): the prototype page megarig.html loads every vehicle in every stage without errors, Leyla climbs every ladder
// to its top, containers open when she is near, the overview button zooms out. Pictures with --shots to output/megarig_*.png.
// npm run serve &  node tools/megarig_test.mjs [--shots]
import { chromium } from 'playwright';

const base = (process.env.GAME_URL || 'http://localhost:8766/game.html').replace(/game\.html.*$/, '');
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const open = async (id, stage) => {
  await page.goto(`${base}megarig.html?id=${id}${stage !== undefined ? '&stage=' + stage : ''}`);
  await page.waitForFunction(() => window.game?.scene?.getScene('play')?.megaView && window.nomad, null, { timeout: 60000 });
};

for (const id of ['lkw', 'crawler', 'fatbird']) {
  for (const stage of [0, 1, 2]) {
    await open(id, stage);
    const r = await page.evaluate(() => { const s = game.scene.getScene('play'); return { stage: s.megarig.stage, n: s.megarig.pieces.length, problems: s.megarig.problems }; });
    check(`${id} Stufe ${stage} lädt`, r.stage === stage && r.problems.length === 0, r);
  }
  // highest stage: every ladder from its foot to the top
  const r = await page.evaluate(() => {
    const n = nomad, s = game.scene.getScene('play'), L = s.leyla;
    n.take();
    const failed = [];
    for (const l of s.ladders) {
      n.tp(l.cx, l.bottom); n.step(40);
      n.until(() => L.body.bottom <= l.top + 8 && L.state !== 'climb', 900, ['up'], ['up']);
      n.step(40);
      if (L.body.bottom > l.top + 8) failed.push({ x: l.tx, top: l.top / s.T, bottom: l.bottom / s.T, feet: L.body.bottom / s.T });
    }
    return { ladders: s.ladders.length, failed };
  });
  check(`${id}: alle ${r.ladders} Leitern bis oben kletterbar`, r.ladders > 2 && !r.failed.length, r);
  if (shots) {
    await page.evaluate(() => nomad.release());
    await page.click('[data-zoom]'); await page.waitForTimeout(1200);
    await page.screenshot({ path: `output/megarig_${id}.png` });
  }
}

// containers open near Leyla, closed far away
await open('crawler');
const c = await page.evaluate(() => {
  const n = nomad, s = game.scene.getScene('play'), T = s.T, v = s.megaView;
  n.take();
  const box = v.containers.find(c => c.closed);
  n.tp((box.x0 + box.x1) / 2, box.y1 - T); n.step(60);   // feet on the top of the floor row
  const near = box.closed.alpha;
  n.tp(3 * T, s.megarig.G * T); n.step(80);
  return { near, far: box.closed.alpha };
});
check('Container öffnet sich in der Nähe, schließt sich weit weg', c.near < 0.1 && c.far > 0.9, c);

// overview button
const z = await page.evaluate(() => { nomad.release(); document.querySelector('[data-zoom]').click(); const s = game.scene.getScene('play'); return s.cam.zoom; });
check('Übersicht zoomt raus', z < 0.6, z);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Mega-Rigs ok: ${ok.length} Prüfungen.`);
