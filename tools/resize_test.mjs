// #113 Container ziehen in build mode: the grip at the rear end, pulling left = longer, right = shorter; a workshop holds against it
// (no change after half a place) and pops onto the scrapyard after a longer pull; the whole pull is one undo step; the controller
// steps one place per press and needs a second press over a workshop. Server must run (npm run serve).
//   node tools/resize_test.mjs [--shots]   picture output/resize_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = (f, a) => page.evaluate(f, a);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.camp, null, { timeout: 30000 });
// a 2-place container behind the tank trailer, a workbench in its second place
await ev(() => { nomad.release(); const s = game.scene.getScene('play'), save = s.box.save; save.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'werkbank', at: 1 }] }); save.rig.spare.workshops = save.rig.spare.workshops.filter(w => w !== 'werkbank'); s.goCamp({ fade: 0 }); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving && s.camp.geo.units.length >= 2; }, null, { timeout: 60000 });
await ev(() => game.scene.getScene('play').openBuild());
await page.waitForTimeout(1200);

let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, save = s.box.save, ui = save.rig.units.length - 1, out = {};
  const grip = () => bm.resizeGrips().find(g => g.ui === ui), n = () => save.rig.units[ui].places ?? 2;
  out.grips = bm.resizeGrips().length;
  let g = grip(), y = (g.y0 + g.y1) / 2;
  out.hit = bm.pick(g.x, y)?.kind;
  // pull 2.2 places to the left: 4 places
  bm.startResize(bm.pick(g.x, y), { x: g.x, y }); bm.resizeMove({ x: g.x - g.unit.cell * 2.2, y }); bm.endResize();
  out.longer = n();
  out.undo1 = bm.undo.length;
  // shrink back: from 4 to 2 over empty places, then half a place more: the workbench (place 2 of 2) holds
  g = grip(); const cell = g.unit.cell;
  bm.startResize(bm.pick(g.x, y), { x: g.x, y });
  bm.resizeMove({ x: g.x + cell * 2.1, y }); out.empty = n();
  bm.resizeMove({ x: g.x + cell * 2.7, y }); out.holds = n(); out.strain = bm.resizing.strain > 0;
  bm.resizeMove({ x: g.x + cell * 3.25, y }); out.popped = n(); out.spare = [...save.rig.spare.workshops];
  bm.endResize();
  out.undo2 = bm.undo.length;
  bm.undoLast(); out.back = n(); out.bench = save.rig.units[ui].workshops.map(w => `${w.id}@${w.at}`);
  // controller: one press per place, a second press over the workshop
  g = grip(); bm.startResize(bm.pick(g.x, (g.y0 + g.y1) / 2), { x: g.x, y }, true);
  bm.resizeStep(1); out.pad1 = n();                                         // 4 → 5
  bm.resizeStep(-1); bm.resizeStep(-1); bm.resizeStep(-1); out.pad2 = n();   // → 2 (the workbench in place 2)
  bm.resizeStep(-1); out.padHold = [n(), save.rig.units[ui].workshops.length];   // first press: it holds
  bm.resizeStep(-1); out.pad3 = n(); out.padPop = save.rig.units[ui].workshops.length;
  bm.endResize();
  return out;
});
check('Griff am hinteren Ende jedes ziehbaren Containers', r.grips >= 2 && r.hit === 'resize', r);
check('Nach links ziehen: länger (2 → 4 Plätze), ein Schritt auf dem Rückgängig-Stapel', r.longer === 4 && r.undo1 >= 1, r);
check('Zurück über leere Plätze: kürzer', r.empty === 2, r);
check('Über der Werkbank: sie hält dagegen (Zittern)', r.holds === 2 && r.strain, r);
check('Weiter gezogen: die Werkbank ploppt auf den Schrottplatz', r.popped === 1 && r.spare.includes('werkbank'), r);
check('Rückgängig holt Länge (4, wie vor dem Zug) und Werkbank zurück', r.back === 4 && r.bench.includes('werkbank@1'), r);
check('Controller: ein Platz je Druck, über der Werkbank zweimal drücken', r.pad1 === 5 && r.pad2 === 2 && r.padHold[0] === 2 && r.padHold[1] === 1 && r.pad3 === 1 && r.padPop === 0, r);
if (shots) {
  fs.mkdirSync('output', { recursive: true });
  await ev(() => { const s = game.scene.getScene('play'), bm = s.hud.build, ui = s.box.save.rig.units.length - 1; bm.undoLast(); const g = bm.resizeGrips().find(q => q.ui === ui); bm.pointer = { x: g.x, y: (g.y0 + g.y1) / 2, t: 0 }; const A = bm.areas().find(a => a.key === 'rig'); if (A) { bm.areaNow = A; bm.frame(A); } bm.draw(); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'output/resize_griff.png' });
}
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Container ziehen ok: ${ok.length} Prüfungen.`);
