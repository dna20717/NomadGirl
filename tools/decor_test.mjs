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

// #128 the notice board is a placed piece: there from the start, notes and E on it, moved it still works
{ const b = await ev(() => { const s = game.scene.getScene('play'), c = s.camp, at = () => c.board && { x: Math.round(c.board.x), n: c.board.notes.length, decor: !!c.board.decor, hs: c.hotspots.filter(h => h.name === 'Schwarzes Brett').length };
  const a = at(); s.box.save.rig.decor.find(o => o.id === 'schwarzes_brett').at.x += 3; c.drawRig(); return { a, b: at() }; });
  check('Schwarzes Brett als Deko (#128): steht da, Zettel, E-Punkt; umgesetzt geht es weiter', b.a?.decor && b.a.n > 0 && b.a.hs === 1 && b.b?.decor && b.b.x - b.a.x === 192 && b.b.n === b.a.n && b.b.hs === 1, b); }
await ev(() => { const s = game.scene.getScene('play'); s.box.save.deltas = 5000; s.box.save.rig.decor = []; s.camp.drawRig(); s.openBuild(); });   // without the gifted notice board (#128): the checks count from piece 0
await page.waitForTimeout(1500);
let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, save = s.box.save, out = {};
  bm.shopOpen = true; bm.shopTab = 'decor'; bm.draw();
  out.rows = document.querySelectorAll('.bm-shop .build-row').length;
  bm.buyDecor('kit_laterne'); const g = camp.decorSpots('kit_laterne')[8]; bm.placeDecor({ x: g.x, y: g.y });
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
check('Laterne, Neon, zwei Zeltstangen und ein Zelt dazwischen platziert', ['kit_laterne', 'neon_open', 'zeltstange', 'zeltstange', 'zelt'].every((id, i) => r.placed[i] === id), r);
check('Anklicken nimmt ein Stück auf, Esc legt es ins Lager, Rückgängig holt es zurück', r.hit === 'decor' && r.spare.includes('kit_laterne') && r.undo === 5, r);
// Aufräumen 16.11.2026: undo with a piece in hand would duplicate it; closing build mode puts the piece in hand into the Lager
await ev(() => game.scene.getScene('play').openBuild());
await page.waitForTimeout(1500);
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, save = s.box.save, out = { d0: save.deltas, n0: save.rig.decor.length, sp0: save.rig.spare.decor.length };
  bm.buyDecor('kit_laterne');
  bm.undoLast(); out.blocked = !!bm.decorHold && save.deltas < out.d0;
  bm.dropDecorToSpare(); bm.undoLast();
  out.d1 = save.deltas; out.sp1 = save.rig.spare.decor.length;
  bm.buyDecor('kit_laterne'); const g = camp.decorSpots('kit_laterne')[4]; bm.placeDecor({ x: g.x, y: g.y });
  bm.undoLast(); out.back = bm.decorHold?.id; out.n1 = save.rig.decor.length;
  bm.close(); out.sp2 = save.rig.spare.decor.length; out.d2 = save.deltas;
  return out;
});
check('Rückgängig mit Deko in der Hand gesperrt, nach Esc: Kauf zurück, nichts doppelt', r.blocked && r.d1 === r.d0 && r.sp1 === r.sp0, r);
check('Platzieren rückgängig: zurück in die Hand, Schließen legt es ins Lager', r.back === 'kit_laterne' && r.n1 === r.n0 && r.sp2 === r.sp0 + 1, r);

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
// the hammock between two poles: E under it, an hour passes, a little health
r = await ev(() => {
  const s = game.scene.getScene('play'), save = s.box.save, c = s.camp;
  save.rig.decor = [{ id: 'zeltstange', at: { x: 12 } }, { id: 'zeltstange', at: { x: 15 } }, { id: 'haengematte', at: { a: 'pole:0', b: 'pole:1' } }];
  c.drawRig();
  const h = c.hotspots.find(x => x.name === s.data_.decor.haengematte.name);
  if (!h) return { h: null };
  save.health = 40; s.leyla.health = 40; const t0 = save.day * 24 + save.hour;
  h.act(); const m = nomad.menu(); nomad.choose('Abhängen'); nomad.release();
  return { h: h.hint, m: m?.title, hours: save.day * 24 + save.hour - t0, health: save.health };
});
check('Hängematte: E unter ihr, eine Stunde abhängen heilt', r.h === 'Abhängen' && r.hours === 1 && r.health > 40, r);
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving; }, null, { timeout: 60000 });
// #037 walkable pieces: from the lookout tower over the rope bridge onto the balcony and into the stacked container
r = await ev(() => {
  const s = game.scene.getScene('play'), save = s.box.save, c = s.camp;
  save.rig.tractor = 'lkw'; save.rig.units[0].id = 'lkw';
  save.rig.units = [save.rig.units[0], { kind: 'container', id: 'container_40', workshops: [] }, { kind: 'container', id: 'container_20', level: 1, workshops: [] }];
  save.rig.decor = [{ id: 'balkon_breit', at: { ui: 2, side: 1 } }, { id: 'aussichtsturm', at: { x: 2, n: 3 } }, { id: 'haengebruecke', at: { a: 'balc:0', b: 'tower:1' } }];
  return true;
});
await ev(() => { nomad.release(); game.scene.getScene('play').goCamp({ fade: 0 }); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving && s.camp.spanAnchors().some(a => a.id === 'tower:1'); }, null, { timeout: 60000 });
r = await ev(() => {
  const s = game.scene.getScene('play'), A = s.camp.spanAnchors(), t = A.find(a => a.id === 'tower:1'), b = A.find(a => a.id === 'balc:0');
  nomad.tp(t.x, t.y); nomad.step(20); const top = nomad.state().leyla.feet;
  nomad.step(320, ['left']); const st = nomad.state().leyla;
  const lad = s.ladders.filter(l => l.rig && Math.abs(l.top - t.y) < 4).length;
  nomad.release();
  return { top, ty: t.y, feet: st.feet, by: b.y, x: Math.round(st.x), bx: Math.round(b.x), lad };
});
check('Aussichtsturm mit Leiter, über die Hängebrücke auf den Balkon und in den oberen Container (#037)', Math.abs(r.top - r.ty) < 4 && Math.abs(r.feet - r.by) < 4 && r.x < r.bx && r.lad === 1, r);
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(800); await page.screenshot({ path: 'output/decor_alle.png' }); }

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Deko ok: ${ok.length} Prüfungen.`);
