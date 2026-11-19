// Driving a mega rig in the game (#029): move aboard the crawler (rig into the loading bay), the camp stands around it, workshops
// work with E on their floor, the bridge opens the map, the build plan puts a container and a workshop on the grid, the camp follows
// on closing; travelling: the crawler is slow, the fatbird fast and straight; back into the old rig. Server must run (npm run serve).
//   node tools/mega_test.mjs [--shots]   pictures to output/mega_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = f => page.evaluate(f);
// the camp is (re)built: wait for a fresh scene; the remote control lets go so fades run
const camp = (mega = true) => page.waitForFunction(m => { const s = window.game?.scene?.getScene?.('play'); return window.nomad && s?.camp && !s.leaving && (!m || s.camp.megaView); }, mega, { timeout: 90000 });
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(300); await page.screenshot({ path: `output/mega_${n}.png` }); await ev(() => nomad.thaw()); };
await page.goto(url);
await camp(false);

// travel cost of the van, for comparison
let r = await ev(async () => {
  const C = await import('/game/play/camp.js'), s = game.scene.getScene('play'), save = s.box.save, to = s.hud.map ? null : null;
  const far = save.map.nodes.find(n => n.id !== save.location && n.id !== save.map.start) || save.map.nodes[1];
  window.__far = far.id;
  return C.travelCost(s.data_, save, far.id);
});
const van = r;

// move aboard (salvaged crawler)
await ev(async () => {
  const s = game.scene.getScene('play'), save = s.box.save;
  save.megarigs = ['crawler', 'fatbird']; save.deltas = 50000;
  s.camp.moveAboard('crawler');
});
await page.waitForTimeout(200);
await ev(() => nomad.choose('An Bord'));
await ev(() => nomad.release());
await camp();
r = await ev(() => { const s = game.scene.getScene('play'); return { tractor: s.box.save.rig.tractor, bay: s.box.save.mega?.bay?.tractor, hot: s.camp.hotspots.map(h => h.name), van: !!s.van, units: s.box.save.rig.units.filter(u => u.pos).length }; });
check('Umzug: Crawler ist die Zugmaschine, Van in der Ladebucht, Container auf dem Raster', r.tractor === 'crawler' && r.bay === 'van' && !r.van && r.units >= 1 && r.hot.includes('Kommandobrücke') && r.hot.some(h => /^Ladebucht/.test(h)), r);
await shot('camp');

// a workshop aboard on its own floor, the bridge opens the map
r = await ev(() => {
  const s = game.scene.getScene('play'), c = s.camp, out = {};
  const ws = c.hotspots.find(h => h.ws && h.floor != null && h.place && !h.place.startsWith('0:'));
  nomad.tp(ws.x, ws.floor); nomad.step(20); out.ws = [ws.name, nomad.state().camp.prompt];
  const br = c.hotspots.find(h => h.name === 'Kommandobrücke');
  nomad.tp(br.x, br.floor); nomad.step(20); out.bridge = nomad.state().camp.prompt;
  nomad.step(1, [], ['grab']); nomad.step(5); out.map = nomad.map()?.open; s.hud.map.close();
  return out;
});
check('An Bord: Werkstatt per E auf ihrem Stockwerk, Kommandobrücke öffnet die Karte', r.ws[1]?.endsWith(r.ws[0]) && /^Karte/.test(r.bridge || '') && r.map, r);

// the build plan: buy a container onto the deck, put a workshop into it, close: the camp shows it
r = await ev(() => {
  const s = game.scene.getScene('play'); nomad.release(); s.openBuild();
  const mb = s.hud.megaBuild, g = mb.save && mb.save.mega && mb;   // open
  mb.cur = { place: 2, story: 2 }; mb.draw();
  const a = mb.choose('Container (2 Plätze) kaufen');
  mb.save.rig.spare.workshops.push('werkbank');
  mb.cur = { place: 2, story: 2 }; mb.draw();
  const b = mb.choose('Werkbank einräumen');
  const st = mb.state();
  mb.close();
  return { a, b, msg: st.msg, open: mb.isOpen };
});
check('Bauplan: Container kaufen und hinstellen, Werkstatt einräumen', r.a && r.b && !r.open, r);
await camp();
r = await ev(() => { const s = game.scene.getScene('play'); return { werkbank: s.camp.hotspots.some(h => h.name === 'Werkbank' && h.floor != null), pieces: s.campGeo.mega.b.pieces.filter(p => p.type === 'container').length }; });
check('Nach dem Bauen: neuer Container im Camp, Werkbank per E erreichbar', r.werkbank && r.pieces >= 1, r);
await shot('built');

// travel: the crawler crawls
r = await ev(async () => { const C = await import('/game/play/camp.js'), s = game.scene.getScene('play'); return C.travelCost(s.data_, s.box.save, window.__far); });
check('Reisen: der Crawler braucht länger und mehr Sprit als der Van', r.hours > van.hours && r.fuel > van.fuel, { van, crawler: r });

// the fatbird flies straight: fewer km than by road, one leg
await ev(() => { const s = game.scene.getScene('play'); s.camp.moveAboard('fatbird'); });
await page.waitForTimeout(200);
await ev(() => nomad.choose('An Bord'));
await ev(() => nomad.release());
await camp();
r = await ev(async () => { const C = await import('/game/play/camp.js'), s = game.scene.getScene('play'); return { t: s.box.save.rig.tractor, cost: C.travelCost(s.data_, s.box.save, window.__far), kind: s.campGeo.mega.b.kind }; });
check('Fatbird: schwebt über dem Camp, fliegt Luftlinie in einer Etappe und schneller', r.t === 'fatbird' && r.kind === 'airship' && r.cost.legs.length === 1 && r.cost.km <= van.km && r.cost.hours < van.hours, { van, fatbird: r });
await shot('fatbird');

// back into the old rig from the loading bay
await ev(() => { const s = game.scene.getScene('play'); s.camp.bayMenu(); });
await ev(() => { nomad.choose('Zurück ins'); nomad.choose('Umziehen'); });
await ev(() => nomad.release());
await camp(false);
await page.waitForFunction(() => !game.scene.getScene('play').campGeo.mega, null, { timeout: 90000 });
r = await ev(() => { const s = game.scene.getScene('play'); return { t: s.box.save.rig.tractor, mega: s.box.save.mega?.active, van: !!s.van }; });
check('Ladebucht: zurück ins alte Rig', r.t === 'van' && !r.mega && r.van, r);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Mega-Rigs fahren ok: ${ok.length} Prüfungen.`);
