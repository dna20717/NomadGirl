// Decoration in the camp (#036): the dealer's Deko tab, buying, placing on the ground / a wall / between two poles, picking up,
// into the Lager, undo; the camp draws every kind without errors. Server must run (npm run serve).
//   node tools/decor_test.mjs [--shots]   picture to output/decor_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if ((m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) || /^Deko/.test(m.text())) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = f => page.evaluate(f);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.camp, null, { timeout: 30000 });

await ev(() => { const s = game.scene.getScene('play'); s.box.save.deltas = 5000; s.openBuild(); });
await page.waitForTimeout(1500);
let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, save = s.box.save, out = {};
  bm.shopOpen = true; bm.shopTab = 'decor'; bm.draw();
  out.rows = document.querySelectorAll('.bm-shop .build-row').length;
  bm.buyDecor('laterne'); const g = camp.decorSpots('laterne')[8]; bm.placeDecor({ x: g.x, y: g.y });
  bm.buyDecor('neon_open'); const w = camp.decorSpots('neon_open')[0]; bm.placeDecor({ x: w.x, y: w.y });
  bm.buyDecor('zeltstange'); let q = camp.decorSpots('zeltstange')[14]; bm.placeDecor({ x: q.x, y: q.y });
  bm.buyDecor('zeltstange'); q = camp.decorSpots('zeltstange')[24]; bm.placeDecor({ x: q.x, y: q.y });
  bm.buyDecor('zelt'); const A = camp.spanAnchors().filter(a => a.id.startsWith('pole')); bm.placeDecor(A[0]); bm.placeDecor(A[1]);
  out.placed = save.rig.decor.map(x => x.id);
  const hit = bm.pick(camp.groundX(save.rig.decor[0].at.x), camp.ground - 30);
  out.hit = hit?.kind;
  bm.liftDecor(hit.i); bm.dropDecorToSpare();
  out.spare = [...save.rig.spare.decor];
  bm.undoLast();
  out.undo = save.rig.decor.length;
  bm.close();
  return out;
});
check('Händler › Deko: Stücke zum Kaufen', r.rows >= 15, r);
check('Laterne, Neon, zwei Zeltstangen und ein Zelt dazwischen platziert', ['laterne', 'neon_open', 'zeltstange', 'zeltstange', 'zelt'].every((id, i) => r.placed[i] === id), r);
check('Anklicken nimmt ein Stück auf, Esc legt es ins Lager, Rückgängig holt es zurück', r.hit === 'decor' && r.spare.includes('laterne') && r.undo === 5, r);

// every kind of piece draws (wall, roof, ground, spans) without errors, the campsite shows them
r = await ev(() => {
  const s = game.scene.getScene('play'), save = s.box.save;
  save.rig.decor = [];
  for (const [id, x] of Object.entries(s.data_.decor)) {
    const at = x.place === 'ground' ? { x: Math.random() * 18 } : x.place === 'span' ? { a: 'mast:0', b: '1:1' } : { ui: 1, p: 0 };
    save.rig.decor.push({ id, at });
  }
  s.camp.drawRig();
  return { n: save.rig.decor.length, anim: s.camp.decorAnim.length, objs: s.camp.rigObjs.length };
});
check('Alle Deko-Arten zeichnen sich ohne Fehler, bewegte haben eine Animation', r.n >= 15 && r.anim >= 5, r);
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(800); await page.screenshot({ path: 'output/decor_alle.png' }); }

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Deko ok: ${ok.length} Prüfungen.`);
