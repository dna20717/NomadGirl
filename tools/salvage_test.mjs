// Salvage in the game (#023): the LKW wreck stands at the end of the camp at its site, E opens the salvage list, building in takes
// the parts from the camp, the test start makes the LKW the tractor; quest log row, map marker. Server must run (npm run serve).
//   node tools/salvage_test.mjs [--shots]   pictures to output/salvage_*.png
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
const camp = () => page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp && !window.game.scene.getScene('play').leaving, null, { timeout: 30000 });
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(300); await page.screenshot({ path: `output/salvage_${n}.png` }); await ev(() => nomad.thaw()); };
await page.goto(url);
await camp();

// the quest log lists the LKW from the start, the map marks the wreck
let r = await ev(async () => {
  const S = await import('/game/salvage.js'), s = game.scene.getScene('play'), save = s.box.save;
  S.ensureSites(s.data_, save);
  s.hud.quests.open('active');
  const st = s.hud.quests.state(); s.hud.quests.close();
  return { rows: st.rows, site: S.siteOf(save, 'lkw'), mark: save.map.wrecks?.[S.siteOf(save, 'lkw')]?.id, wreck: s.camp.geo.wreck };
});
check('Questlog: Bergung LKW ab Spielstart', r.rows.includes('salvage:lkw'), r);
check('Karte: Wrack markiert', r.mark === 'lkw', r);
check('Am Start steht kein Wrack', !r.wreck, r);

// drive there (directly): the camp grows, the wreck stands at its end with an E spot
await ev(async () => { const S = await import('/game/salvage.js'), s = game.scene.getScene('play'); s.box.save.location = S.siteOf(s.box.save, 'lkw'); s.goCamp({ fade: 0 }); });
await page.waitForTimeout(800);
await camp();
r = await ev(() => { const s = game.scene.getScene('play'), g = s.camp.geo, h = s.camp.hotspots.find(h => h === s.camp.wreckSpot); return { wreck: g.wreck, W: g.W, spot: h ? { x: h.x, name: h.name } : null, art: s.camp.wreckArt?.length || 0 }; });
check('Wrack am Ende des Camps mit E-Punkt', r.wreck?.id === 'lkw' && r.spot && r.art > 0 && r.wreck.x0 > 0, r);
await ev(() => { const s = game.scene.getScene('play'); nomad.take(); nomad.tp(s.camp.wreckSpot.x - 300, s.camp.ground); nomad.step(30); });
await page.waitForTimeout(400);
await shot('wrack');

// E: the salvage list; nothing to build without parts
r = await ev(() => { const s = game.scene.getScene('play'); s.camp.wreckSpot.act(); const m = s.hud.menuState?.() || null; const t = document.querySelector('.menu, .hud-menu, [class*=menu]')?.innerText || ''; return { modal: s.hud.modal, text: t.slice(0, 300) }; });
check('E am Wrack öffnet die Bergungsliste', r.modal && /Freilegen/.test(r.text), r);
await shot('liste');
await ev(() => game.scene.getScene('play').hud.closeMenu());

// parts into the chest, build in section by section, then the test start
r = await ev(async () => {
  const S = await import('/game/salvage.js'), C = await import('/game/crafting.js'), s = game.scene.getScene('play'), D = s.data_, save = s.box.save;
  const log = [];
  for (let i = 0; i < 6 && !S.progress(D, save, 'lkw').ready; i++) {
    for (const m of S.missing(D, save, 'lkw')) C.give(D, save, m.item, m.need - m.have);
    s.camp.wreckBuild('lkw');
    log.push(Math.round(S.progress(D, save, 'lkw').share * 100));
  }
  return { log, ready: S.progress(D, save, 'lkw').ready, day: save.day, hour: save.hour };
});
check('Einbauen Abschnitt für Abschnitt bis zum Probestart', r.ready && r.log.length === 4 && r.log[3] === 100, r);
await shot('fertig');
await ev(() => { nomad.take(); game.scene.getScene('play').camp.wreckStart('lkw'); nomad.step(200); });   // timers run on the remote clock headless
await page.waitForFunction(() => { const s = window.game.scene.getScene('play'); return s?.camp && !s.leaving && s.box.save.rig.tractor === 'lkw' && !s.camp.geo.wreck; }, null, { timeout: 30000 }).catch(() => {});
r = await ev(async () => { const S = await import('/game/salvage.js'), s = game.scene.getScene('play'), save = s.box.save; return { tractor: save.rig.tractor, base: save.base, wreck: s.camp.geo.wreck, open: S.active(s.data_, save) }; });
check('Probestart: der LKW zieht das Rig, Van bleibt als Basis, Crawler und Fatbird offen', r.tractor === 'lkw' && r.base?.node && !r.wreck && r.open.includes('crawler'), r);
await shot('lkw');

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Bergung ok: ${ok.length} Prüfungen.`);
