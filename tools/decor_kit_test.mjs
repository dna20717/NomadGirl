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

// second round: R switches variants, wall pieces in two rows, roof garden, balconies, the cat, the ensemble list in the Deko tab
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, save = s.box.save, out = {};
  s.openBuild();
  bm.buyDecor('kit_tischkram'); const v0 = bm.decorHold.v; bm.cycleDecor(1); out.cycHold = bm.decorHold.v === (v0 + 1) % 16;
  bm.dropDecorToSpare();
  const k = save.rig.decor.findIndex(x => x.id === 'kit_kiste'), b = camp.decorBoxes[k], v1 = save.rig.decor[k].at.v;
  bm.pointer = { x: b.x, y: b.y - 10 }; bm.cycleDecor(1); out.cycPlaced = save.rig.decor[k].at.v === (v1 + 1) % 10;
  const W = camp.decorSpots('kit_wandschmuck'); out.wallRows = new Set(W.map(q => q.at.row)).size; out.wallN = W.length;
  bm.buyDecor('kit_wandschmuck'); bm.placeDecor({ x: W[3].x, y: W[3].y }); out.wall = save.rig.decor.at(-1)?.id;
  const R = camp.decorSpots('kit_pflanzkasten').filter(q => q.at.ui != null); out.roofN = R.length;
  bm.buyDecor('kit_pflanzkasten'); bm.placeDecor({ x: R[2].x, y: R[2].y }); out.roof = save.rig.decor.at(-1)?.at.ui;
  bm.shopOpen = true; bm.shopTab = 'decor'; bm.draw();
  out.ensRows = [...document.querySelectorAll('.bm-shop .build-row b')].map(n => n.textContent).filter(t => /Lagerfeuer-Ecke|Dachterrasse|Feldküche/.test(t)).length;
  bm.close();
  out.cat = !!camp.cat; out.hot = camp.hotspots.some(h => h.hint === 'Streicheln');
  return out;
});
check('R wechselt die Variante (in der Hand und platziert)', r.cycHold && r.cycPlaced, r);
check('Wandschmuck: zwei Höhen, feine Schritte, hängt an der Wand', r.wallRows === 2 && r.wallN >= 16 && r.wall === 'kit_wandschmuck', r);
check('Dach: Ziele in halben Kacheln, Pflanzkasten steht oben', r.roofN >= 8 && r.roof === 1, r);
check('Deko-Tab listet die Ensembles mit dem, was sie brauchen', r.ensRows >= 3, r);
check('Gemütlich genug: die Katze schläft im Camp, E streichelt', r.cat && r.hot, r);
// a balcony is a surface too
r = await ev(() => {
  const s = game.scene.getScene('play'), camp = s.camp, save = s.box.save;
  save.rig.decor.push({ id: 'balkon', at: { ui: 1, side: 1, day: 1 } });
  camp.drawRig();
  const B = camp.decorSpots('kit_pflanze').filter(q => q.balc);
  if (B.length) { save.rig.decor.push({ id: 'kit_pflanze', at: { ...B[0].at, v: 0, day: 1 } }); camp.drawRig(); }
  const i = save.rig.decor.length - 1, b = camp.decorBoxes[i], bal = camp.balconyAt(1, 1, s.data_.decor.balkon);
  return { n: B.length, y: b && Math.round(b.y), by: bal && Math.round(bal.y) };
});
check('Balkon: Stücke lassen sich daraufstellen', r.n > 0 && Math.abs(r.y - r.by) <= 2, r);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Baukasten ok: ${ok.length} Prüfungen.`);
