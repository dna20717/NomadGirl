// #114 Farbe, Innenräume, Wand-Module, Treppen & Wege in build mode: the brush paints a container (its look changes, undo brings
// the original back) and a tent; windows and a door go onto the container wall (painted like it), things inside onto its back wall
// and ceiling (behind the workshops), a ladder leans against it and Leyla climbs onto the roof. Server must run (npm run serve).
//   node tools/paint_test.mjs [--shots]
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
await ev(() => { nomad.release(); const s = game.scene.getScene('play'), save = s.box.save; save.deltas = 5000; save.rig.decor = []; save.rig.units.push({ kind: 'container', id: 'container_20', places: 3, workshops: [{ id: 'werkbank', at: 0 }] }); save.rig.spare.workshops = save.rig.spare.workshops.filter(w => w !== 'werkbank'); s.goCamp({ fade: 0 }); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving && s.camp.geo.units.length >= 2; }, null, { timeout: 60000 });
await ev(() => game.scene.getScene('play').openBuild());
await page.waitForTimeout(1200);

let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, camp = s.camp, save = s.box.save, ui = save.rig.units.length - 1, out = {};
  const unit = () => camp.geo.units.find(u => u.ui === ui);
  bm.togglePaint(true); out.strip = !!document.querySelector('.bm-paint .bm-swatch');
  bm.painting = '#df3e23'; let u = unit(); bm.paintAt({ x: u.in0 + u.cell * 1.5, y: (u.inTop + u.floorY) / 2 });
  out.color = save.rig.units[ui].color; out.look = unit().def.look; out.tex = s.textures.exists(unit().def.look);
  bm.undoLast(); out.undone = save.rig.units[ui].color ?? null;
  bm.paintAt({ x: u.in0 + u.cell * 1.5, y: (u.inTop + u.floorY) / 2 });
  bm.togglePaint(false);
  // a window and a door on the wall, painted like the container
  const place = (id, f) => { bm.buyDecor(id); const q = camp.decorSpots(id).filter(f)[0]; if (q) bm.placeDecor({ x: q.x, y: q.y }); return save.rig.decor.at(-1); };
  place('fenster', q => q.at.ui === ui); place('tuer', q => q.at.ui === ui && q.at.p > 1);
  out.wall = save.rig.decor.map(x => x.id);
  out.painted = s.children.list.some(o => /__p/.test(o.texture?.key || ''));
  // inside: ceiling and back wall, behind the workshops (in the unit's view)
  place('innenkram', q => q.at.ui === ui && q.at.row === 'top'); place('innenkram', q => q.at.ui === ui && q.at.row === 0.2);
  u = unit(); out.inside = u.view.list.filter(o => o.texture?.key === 'kit_inside_items').length;
  // a ladder against the wall: onto the roof
  place('leiter', q => q.at.ui === ui && q.at.p > 1.5);
  const L = s.ladders.filter(l => l.rig && Math.abs(l.top - unit().deckY) < 4);
  out.ladder = L.length;
  // the brush on a tent's cloth
  bm.close();
  return out;
});
check('Pinsel: Farbleiste, Container gestrichen (eigenes Bild), Rückgängig holt das Original', r.strip && r.color === '#df3e23' && /_df3e23$/.test(r.look) && r.tex && r.undone === null, r);
check('Fenster und Tür an der Wand, in der Farbe des Containers', r.wall.includes('fenster') && r.wall.includes('tuer') && r.painted, r);
check('Innenkram an Decke und Rückwand, hinter den Werkstätten', r.inside === 2, r);
check('Leiter an der Wand bis aufs Dach', r.ladder === 1, r);
r = await ev(() => {
  const s = game.scene.getScene('play'), save = s.box.save, ui = save.rig.units.length - 1, u = s.camp.geo.units.find(x => x.ui === ui);
  const L = s.ladders.find(l => l.rig && Math.abs(l.top - u.deckY) < 4);
  nomad.step(120); nomad.tp(L.cx, L.bottom - 4); nomad.step(10); nomad.step(3, ['up'], ['up']); const mid = nomad.state().leyla.state; nomad.step(500, ['up']); nomad.step(20);
  const st = nomad.state().leyla; nomad.release();
  return { feet: Math.round(st.feet), roof: Math.round(u.deckY), mid, st: st.state };
});
check('Leyla klettert die Leiter hoch aufs Dach', Math.abs(r.feet - r.roof) < 12, r);
r = await ev(() => {
  const s = game.scene.getScene('play'), save = s.box.save;
  save.rig.decor.push({ id: 'zeltstange', at: { x: 10, day: 1 } }, { id: 'zeltstange', at: { x: 14, day: 1 } });
  const n = save.rig.decor.length; save.rig.decor.push({ id: 'zelt', at: { a: `pole:${n - 2}`, b: `pole:${n - 1}`, day: 1 } });
  s.openBuild(); const bm = s.hud.build; bm.togglePaint(true); bm.painting = '#249fde';
  const a = s.camp.spanPoint(`pole:${n - 2}`), b = s.camp.spanPoint(`pole:${n - 1}`);
  bm.paintAt({ x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 30 });
  const paint = save.rig.decor[n].at.paint; bm.close();
  return { paint };
});
check('Pinsel auf dem Zelt: der Stoff nimmt die Farbe an', r.paint === '#249fde', r);
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(1500); await page.screenshot({ path: 'output/paint_test.png' }); }
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Farbe & Ausbau ok: ${ok.length} Prüfungen.`);
