// #117 Bau-Modus neu: touching a container's body marks one cell, its chassis the whole container; the container's menu starts with
// its colours (instead of the brush), the cell's menu brings a workshop from the scrapyard into exactly that place; zoom in three
// steps; B / Esc takes the mark away. Server must run (npm run serve).
//   node tools/select_test.mjs [--shots]   picture output/select_menu.png (Klickpunkte, Daniel 20.11.2026)
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
// a 3-place container behind the tank trailer, the workbench on the scrapyard
await ev(() => { nomad.release(); const s = game.scene.getScene('play'), save = s.box.save; save.rig.units.push({ kind: 'container', id: 'container_20', places: 3, workshops: [] }); if (!save.rig.spare.workshops.includes('werkbank')) save.rig.spare.workshops.push('werkbank'); s.goCamp({ fade: 0 }); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.camp && !s.leaving && s.camp.geo.units.length >= 2; }, null, { timeout: 60000 });
await ev(() => game.scene.getScene('play').openBuild());
await page.waitForTimeout(1200);

let r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, save = s.box.save, ui = save.rig.units.length - 1, u = s.camp.geo.units.find(x => x.ui === ui), out = {};
  const P = bm.selPoints().filter(q => q.ui === ui), pc = P.find(q => q.kind === 'cell' && q.p === 1), pu = P.find(q => q.kind === 'container');
  const body = bm.pick(pc.x, pc.y), chassis = bm.pick(pu.x, pu.y), plain = bm.pick(u.in0 + u.cell * 1.5, u.inTop + 12);
  out.points = P.length; out.body = body && [body.kind, body.p]; out.chassis = chassis && [chassis.kind, !!chassis.point]; out.plain = plain?.kind;
  // the chassis: mark + menu with colours first
  bm.select(chassis, { x: chassis.unit.x0 + 40, y: u.floorY }, { menu: true });
  const box = document.querySelector('.bm-ctx'), sw = [...box.querySelectorAll('.bm-swatch')];
  out.menu = { title: box.querySelector('header b')?.textContent, swatches: sw.length, buttons: [...box.querySelectorAll('.inv-btn:not(.bm-swatch)')].map(b => b.textContent.trim()) };
  const red = sw.find(b => /df3e23/i.test(b.getAttribute('style') || '')) || sw[1];
  red.click();
  out.color = save.rig.units[ui].color; out.menuGone = !document.querySelector('.bm-ctx');
  bm.undoLast(); out.undone = s.box.save.rig.units[ui].color ?? null;
  // a cell: its menu brings the workbench from the scrapyard into exactly this place
  const p3 = bm.selPoints().find(q => q.ui === ui && q.kind === 'cell' && q.p === 2), cell = bm.pick(p3.x, p3.y);
  bm.select(cell, { x: u.in0 + u.cell * 2.5, y: u.inTop }, { menu: true });
  const cb = document.querySelector('.bm-ctx'), wb = [...cb.querySelectorAll('.inv-btn')].find(b => /Werkbank hierhin/.test(b.textContent));
  out.cellMenu = { title: cb.querySelector('header b')?.textContent, has: !!wb };
  wb?.click();
  out.ws = s.box.save.rig.units[ui].workshops.map(w => `${w.id}@${w.at}`);
  // Esc / B: the mark goes
  bm.select(chassis, { x: u.x0, y: u.floorY }); out.marked = bm.sel?.kind; bm.clearSel(); out.cleared = bm.sel === null;
  return out;
});
check('Klickpunkte: einer je Container (Fahrgestell), einer je freier Zelle; daneben markiert nichts', r.points === 4 && r.body?.[0] === 'cell' && r.body[1] === 1 && r.chassis?.[0] === 'container' && r.chassis[1] && r.plain === 'container', r);
check('Menü des Containers: Farben zuerst, dann Umhängen, Länge, Schrottplatz, Verkaufen', r.menu.swatches >= 8 && r.menu.buttons.some(b => /Umhängen/.test(b)) && r.menu.buttons.some(b => /Länger/.test(b)) && r.menu.buttons.some(b => /Verkaufen/.test(b)), r);
check('Farbe im Menü streicht den Container, Rückgängig holt das Original', r.color === '#df3e23' && r.menuGone && r.undone === null, r);
check('Zelle: Werkbank vom Schrottplatz genau in diesen Platz', r.cellMenu.has && /Platz 3/.test(r.cellMenu.title) && r.ws.includes('werkbank@2'), r);
check('Markierung an und wieder weg', r.marked === 'container' && r.cleared, r);
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, cam = s.cam, Z = bm.zoomSteps(), out = { steps: Z.map(z => Math.round(z * 100)) };
  const A = bm.areas()[0]; bm.areaNow = A; bm.frame(A); cam.zoomEffect.reset(); cam.panEffect.reset(); cam.setZoom(Z[0]);
  const zs = []; for (const d of [1, 1, 1, -1, -1, -1]) { bm.zoomStep(d, { x: s.camp.geo.vanLeft, y: s.camp.ground - 100 }); cam.zoomEffect.reset(); cam.setZoom(bm.view.zoom); zs.push(bm.zoomLevel); }
  out.levels = zs;
  return out;
});
check('Zoom in drei Stufen (Übersicht, Rig, Detail), am Ende ist Schluss', r.steps.length === 3 && r.steps[0] < r.steps[1] && r.steps[1] < r.steps[2] && JSON.stringify(r.levels) === '[1,2,2,1,0,0]', r);
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, c = s.camp, ui = s.box.save.rig.units.length - 1, u = c.geo.units.find(x => x.ui === ui);
  bm.clearSel(); bm.showInside = false; s.leyla.x = (u.x0 + u.x1) / 2; nomad.step(90);
  const shut = c.shells.find(x => x.u.ui === ui)?.a;
  bm.toggleOpen(); nomad.step(90); const open = c.shells.find(x => x.u.ui === ui)?.a;
  bm.toggleOpen(); nomad.step(90);
  return { shut, open, back: c.shells.find(x => x.u.ui === ui)?.a };
});
check('Bau-Modus: Rig bleibt zu, auch wenn Leyla davor steht; O / R3 öffnet und schließt', r.shut > 0.95 && r.open < 0.05 && r.back > 0.95, r);
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build, g = s.camp.ground; if (!bm.active) s.openBuild(); nomad.step(5); bm.takeAva();
  bm.aim({ x: -99999, y: g - 300 }); const left = { x: Math.round(bm.ava.x), warn: bm.signalNow.warn, hit: bm.signalNow.hit };
  bm.aim({ x: 99999, y: -99999 }); const far = { x: Math.round(bm.ava.x), y: Math.round(bm.ava.y), hit: bm.signalNow.hit };
  bm.aim({ x: 600, y: g + 3000 }); const down = Math.round(bm.ava.y);
  const L = bm.limits(), Z = bm.zoomSteps(); s.cam.setZoom(Z[0]); s.cam.centerOn(-99999, -99999); const v = s.cam.worldView;
  const view = [Math.round(v.x), Math.round(v.y)], inside = v.x >= L.x0 - 1 && v.y >= L.y0 - 1;
  bm.aim({ x: 600, y: g - 300 });
  return { left, far, down, ground: g, view, inside, L };
});
check('AvA: Empfang reißt links/rechts/oben ab (rotes !, unsichtbare Wand), nicht in den Boden; ganz rausgezoomt kein Camp-Ende', r.left.hit && r.left.warn >= 0.99 && r.left.x > -5000 && r.far.hit && r.far.y > -4000 && r.down < r.ground && r.inside, r);
r = await ev(() => {
  const s = game.scene.getScene('play'), bm = s.hud.build; const was = !!s.hud.rigOpen; bm.toggleOpen(); const synced = s.hud.rigOpen === bm.showInside; bm.toggleOpen(); bm.close(); nomad.step(20);
  const a = !!s.hud.rigOpen; nomad.step(1, [], ['pose']); nomad.step(5); const b = !!s.hud.rigOpen; nomad.step(1, [], ['pose']); nomad.step(5);
  return { was, synced, a, b, c: !!s.hud.rigOpen, state: s.leyla.state };
});
check('Rig offen / zu: ein Schalter für Bau-Modus und Leyla (O / P / rechter Stick), keine Yoga-Pose mehr', r.synced && r.a !== r.b && r.c === r.a && r.state !== 'pose', r);
if (shots) {
  fs.mkdirSync('output', { recursive: true });
  await ev(() => { const s = game.scene.getScene('play'), bm = s.hud.build, ui = s.box.save.rig.units.length - 1, u = s.camp.geo.units.find(x => x.ui === ui); const A = bm.areas().find(a => a.key === 'rig'); bm.areaNow = A; bm.frame(A); const pu = bm.selPoints().find(q => q.ui === ui && q.kind === 'container'); bm.select(bm.pick(pu.x, pu.y), { x: u.x0 + 60, y: u.floorY }, { menu: true }); bm.closeCtx(); bm.pointer = { x: pu.x, y: pu.y, t: 0 }; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'output/select_menu.png' });
}
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Auswahl & Zoom ok: ${ok.length} Prüfungen.`);
