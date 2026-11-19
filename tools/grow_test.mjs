// #116 Ziehen zum Wachsen in build mode: gold grips on growing pieces; pulling the lantern post up adds shaft sections (its light
// moves up and reaches further), a crate grows into a stack, a tent gets longer at its right end and a bit higher, the tower gets
// storeys with the pad (Leyla climbs its painted ladder onto the higher deck, the camera zooms out up there), a pole lifts its tent,
// the limits hold and one undo takes a whole pull back. Server must run (npm run serve).
//   node tools/grow_test.mjs [--shots]   pictures output/grow_*.png
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
await ev(() => {
  nomad.release(); const s = game.scene.getScene('play'), save = s.box.save;
  save.rig.decor = [
    { id: 'kit_laterne', at: { x: 2, day: 1 } }, { id: 'kit_kiste', at: { x: 4, day: 1 } }, { id: 'zelt_streifen', at: { x: 8, day: 1 } },
    { id: 'aussichtsturm', at: { x: 19, day: 1 } }, { id: 'zeltstange', at: { x: -3, day: 1 } }, { id: 'zeltstange', at: { x: 0, day: 1 } },
  ];
  save.rig.decor.push({ id: 'zelt', at: { a: 'pole:4', b: 'pole:5', day: 1 } });
  s.goCamp({ fade: 0 });
});
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving; }, null, { timeout: 60000 });
await ev(() => game.scene.getScene('play').openBuild());
await page.waitForTimeout(1200);

let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, out = {};
  let R = s.box.save.rig.decor;
  const grip = (i, side = 'top') => bm.growGrips().find(g => g.i === i && g.side === side);
  const pull = (i, side, steps) => { const g = grip(i, side), hit = bm.pick(g.x, g.y); bm.startGrow(hit, { x: g.x, y: g.y }); bm.growMove(side === 'right' ? { x: g.x + g.step * steps, y: g.y } : { x: g.x, y: g.y - g.step * steps }); bm.endGrow(); return hit?.kind; };
  out.grips = bm.growGrips().map(g => `${R[g.i].id}:${g.side}`);
  // lantern post: two sections up
  const h0 = camp.decorBoxes[0].hook.y, top0 = camp.decorBoxes[0].y0, u0 = bm.undo.length;
  out.hit = pull(0, 'top', 2.2);
  out.lantern = [R[0].at.n, Math.round(h0 - camp.decorBoxes[0].hook.y), Math.round(top0 - camp.decorBoxes[0].y0), bm.undo.length - u0];
  // crates: a stack of three, something can stand on top of it
  const c0 = camp.kitTop(1); pull(1, 'top', 2.1); out.crates = [R[1].at.n, Math.round(c0), Math.round(camp.kitTop(1))];
  // tent: longer to the right, a bit higher
  const w0 = camp.decorBoxes[2].x1 - camp.decorBoxes[2].x0, t0 = camp.decorBoxes[2].y0;
  pull(2, 'right', 3); pull(2, 'top', 2);
  out.tent = [R[2].at.n, R[2].at.m, Math.round(camp.decorBoxes[2].x1 - camp.decorBoxes[2].x0 - w0), Math.round(t0 - camp.decorBoxes[2].y0)];
  // limits: far beyond the top stays at the highest step
  pull(0, 'top', 40); out.max = R[0].at.n;
  // undo takes the last pull back
  bm.undoLast(); R = s.box.save.rig.decor; out.undo = R[0].at.n;
  // the pole lifts the tent's anchor
  const a0 = camp.spanAnchors().find(a => a.id === 'pole:5').y; pull(5, 'top', 3); out.pole = Math.round(a0 - camp.spanAnchors().find(a => a.id === 'pole:5').y);
  // tower with the pad: two storeys
  const d0 = camp.towers[0].y, g = grip(3, 'top');
  bm.startGrow(bm.pick(g.x, g.y), { x: g.x, y: g.y }, true); bm.growStep(1); bm.growStep(1); bm.endGrow();
  out.tower = [R[3].at.n, Math.round(d0 - camp.towers[0].y)];
  bm.close();
  return out;
});
check('Goldene Griffe: Laterne, Kisten, Turm, Stangen oben, Zelt rechts und oben', ['kit_laterne:top', 'kit_kiste:top', 'zelt_streifen:right', 'zelt_streifen:top', 'aussichtsturm:top', 'zeltstange:top'].every(k => r.grips.includes(k)) && r.hit === 'grow', r);
check('Laterne zwei Stufen höher: Licht wandert mit nach oben, ein Schritt auf dem Rückgängig-Stapel', r.lantern[0] === 3 && r.lantern[1] > 60 && r.lantern[2] > 60 && r.lantern[3] === 1, r);
check('Kiste ziehen macht einen Stapel (3), oben kann etwas stehen', r.crates[0] === 3 && r.crates[2] > r.crates[1] * 2.5, r);
check('Zelt: rechts länger (+3 Abschnitte), oben etwas höher', r.tent[0] === 4 && r.tent[1] === 3 && r.tent[2] > 300 && r.tent[3] > 15, r);
check('Grenzen halten, Rückgängig holt den Zug zurück', r.max === 4 && r.undo === 3, r);
check('Höhere Zeltstange hebt den Anker der Plane', r.pole > 100, r);
check('Turm mit dem Controller: zwei Etagen mehr, die Plattform wandert hoch', r.tower[0] === 4 && r.tower[1] > 120, r);
// Leyla climbs the grown tower; up there the camera zooms out
await page.waitForTimeout(800);
r = await ev(() => {
  const s = game.scene.getScene('play'), c = s.camp, T = c.towers[0], L = s.ladders.find(l => l.rig && Math.abs(l.top - T.y) < 2), z0 = s.cam.zoom;
  nomad.step(150); nomad.tp(L.cx, L.bottom - 4); nomad.step(10); nomad.step(3, ['up'], ['up']); nomad.step(600, ['up']); nomad.step(20); nomad.step(5, ['right']); nomad.step(120);
  const st = nomad.state().leyla; nomad.release();
  return { feet: Math.round(st.feet), deck: Math.round(T.y), z0, z1: s.cam.zoom, L: L && [Math.round(L.cx), L.top, L.bottom], lx: Math.round(st.x ?? s.leyla.x), state: st.state, n: c.towers.length };
});
check('Leyla klettert die gemalte Leiter auf die höhere Plattform', Math.abs(r.feet - r.deck) < 8, r);
check('Oben zoomt die Kamera raus (Weitblick)', r.z1 < r.z0 * 0.85, r);
if (shots) {
  fs.mkdirSync('output', { recursive: true });
  await ev(() => { nomad.freeze?.(); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'output/grow_turm.png' });
  await ev(() => { nomad.thaw?.(); const s = game.scene.getScene('play'); s.openBuild(); const bm = s.hud.build, g = bm.growGrips()[0]; bm.pointer = { x: g.x, y: g.y, t: 0 }; const A = bm.areas().find(a => a.key === 'camp'); if (A) { bm.areaNow = A; bm.frame(A); } bm.draw(); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'output/grow_griffe.png' });
  await ev(() => { const s = game.scene.getScene('play'), bm = s.hud.build, c = s.camp; bm.buyDecor('kit_stuhl'); bm.pointer = { x: c.groundX(5.3), y: c.ground - 30, t: 0 }; bm.draw(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'output/grow_raster.png' });
}
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Ziehen zum Wachsen ok: ${ok.length} Prüfungen.`);
