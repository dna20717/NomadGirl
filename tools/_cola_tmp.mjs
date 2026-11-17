import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }), p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8766/game.html?camp&new');
const ready = () => p.waitForFunction(() => window.nomad && game.scene.getScene('play')?.camp && !game.scene.getScene('play').restarting, null, { timeout: 30000 });
await ready();
const r = await p.evaluate(() => { const s = game.scene.getScene('play'), save = s.box.save; save.deltas = 5000; s.openBuild(); const bm = s.hud.build, camp = s.camp;
  const out = []; for (const id of ['cola_automat', 'cola_kuehlbox']) { bm.buyDecor(id); const g = camp.decorSpots(id); bm.placeDecor({ x: g[6 + out.length * 3].x, y: g[6 + out.length * 3].y }); out.push(id); }
  s.closeBuild?.(); bm.close?.(); return save.rig.decor.map(x => x.id); });
await p.waitForTimeout(800); await ready();
const at = await p.evaluate(() => { const s = game.scene.getScene('play'); const im = s.children.list.find(o => o.texture?.key === 'icons_nomadcola'); return im && { x: im.x, y: im.y, n: s.children.list.filter(o => o.texture?.key === 'icons_nomadcola').length }; });
if (at) await p.evaluate(({ x, y }) => { const s = game.scene.getScene('play'); nomad.take(); const c = s.cameras.main; c.stopFollow(); c.centerOn(x, y - 150); nomad.freeze(); }, at);
await p.waitForTimeout(600); await p.screenshot({ path: 'output/cola_camp.png' });
console.log(JSON.stringify(r), JSON.stringify(at), errs); await b.close();
