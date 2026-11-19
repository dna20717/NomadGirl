// #111 Camp-Baukasten in the game: buying and placing free pieces in build mode, stacking on top of each other, the ghost preview,
// chairs turning to the fire, string lights between lantern posts, an ensemble sparkling, picking up the middle of a stack.
// Server must run (npm run serve).   node tools/decor_kit_test.mjs [--shots]   pictures to output/kit_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if ((m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) || /^Deko/.test(m.text())) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = (f, a) => page.evaluate(f, a);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.camp, null, { timeout: 30000 });

await ev(() => { const s = game.scene.getScene('play'); s.box.save.deltas = 5000; s.box.save.rig.decor = []; s.openBuild(); });
await page.waitForTimeout(1500);
let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, save = s.box.save, out = { says: [] };
  const say0 = bm.say.bind(bm); bm.say = (t, k) => { out.says.push(t); return say0(t, k); };
  const ground = (id, x) => { bm.buyDecor(id); const q = camp.decorSpots(id).find(p => p.at.x === x); bm.placeDecor({ x: q.x, y: q.y }); };
  ground('kit_stuhl', 5); ground('kit_feuerstelle', 6.5); ground('kit_stuhl', 8); ground('kit_laterne', 3.5);
  ground('kit_laterne', 10); ground('kit_tisch', 11.5);
  out.ensemble = out.says.filter(t => /✨/.test(t));
  // stacking: crates on crates, a plant on top, one plant on the table
  ground('kit_kiste', 14); ground('kit_kiste', 14.75);
  bm.buyDecor('kit_kiste');
  let q = camp.decorSpots('kit_kiste').find(p => p.at.on === 'deco:6'); bm.pointer = { x: q.x, y: q.y }; bm.drawDecorHold(s.add.graphics(), () => {}, 1, 1); out.ghost0 = !!bm.decorGhost?.visible; bm.placeDecor({ x: q.x, y: q.y });
  bm.buyDecor('kit_pflanze'); q = camp.decorSpots('kit_pflanze').find(p => p.at.on === 'deco:8'); bm.placeDecor({ x: q.x, y: q.y });
  bm.buyDecor('kit_pflanze'); q = camp.decorSpots('kit_pflanze').find(p => p.at.on === 'deco:5' && p.at.dx < 0); bm.placeDecor({ x: q.x, y: q.y });
  bm.buyDecor('kit_pflanze'); q = camp.decorSpots('kit_pflanze').find(p => p.at.on === 'deco:7'); bm.placeDecor({ x: q.x, y: q.y });
  out.placed = save.rig.decor.map(x => `${x.id}${x.at.on ? '@' + x.at.on : ''}`);
  const B = camp.decorBoxes;
  out.stackY = [6, 8, 9].map(i => Math.round(B[i].y));
  out.chairs = [0, 2].map(i => s.children.list.find(o => o.texture?.key === 'kit_chair' && Math.abs(o.x - B[i].x) < 2)?.flipX);
  out.lights = camp.lights.length;
  out.ens = out.says.filter(t => /✨/.test(t));
  bm.close();
  return out;
});
check('Lagerfeuer-Ecke: Feuer, zwei Stühle, Laterne → Ensemble funkelt', r.ensemble.some(t => /Lagerfeuer-Ecke/.test(t)), r);
check('Stapeln: Kiste auf Kiste, Pflanze obendrauf, Pflanze auf Tisch und Kiste', r.placed.length === 12 && r.placed[8] === 'kit_kiste@deco:6' && r.placed[9] === 'kit_pflanze@deco:8', r);
check('Gestapelte stehen höher', r.stackY[0] > r.stackY[1] && r.stackY[1] > r.stackY[2], r);
check('Stühle drehen sich zum Feuer (links schaut rechts, rechts schaut links)', r.chairs[0] === false && r.chairs[1] === true, r);
check('Geister-Vorschau beim Platzieren', r.ghost0, r);
check('Kleiner Garten entsteht (Pflanzen auf Tisch und Kisten)', ['Kleiner Garten'].every(n => r.ens.some(t => t.includes(n))), r.ens);

if (shots) {
  fs.mkdirSync('output', { recursive: true });
  for (const [tag, hour] of [['tag', 14], ['nacht', 22]]) {
    await ev(h => { nomad.release(); const s = game.scene.getScene('play'); s.box.save.hour = h; s.goCamp({ fade: 0 }); }, hour);
    await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving; }, null, { timeout: 60000 });
    await ev(() => { const s = game.scene.getScene('play'), c = s.camp; nomad.tp(c.groundX(9), c.ground - 10); nomad.step(30); s.cam.setZoom(1.15); s.cam.centerOn(c.groundX(9.5), c.ground - 150); });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `output/kit_${tag}.png` });
  }
}
// picking up the middle crate: what stood on it comes down, nothing is lost
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, save = s.box.save;
  s.openBuild();
  const n0 = save.rig.decor.length, i = save.rig.decor.findIndex(x => x.at.on === 'deco:6');
  bm.liftDecor(i); bm.dropDecorToSpare();
  const plant = save.rig.decor.find(x => x.id === 'kit_pflanze' && x.at.on === 'deco:6');
  bm.close();
  return { n0, n1: save.rig.decor.length, spare: [...save.rig.spare.decor], plant: !!plant };
});
check('Mittlere Kiste aufnehmen: die Pflanze rutscht nach unten', r.n1 === r.n0 - 1 && r.plant && r.spare.includes('kit_kiste'), r);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Baukasten ok: ${ok.length} Prüfungen.`);
