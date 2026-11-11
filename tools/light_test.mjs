// Headless check of light & atmosphere (game/play/atmosphere.js) in the POI level Tankstelle Kilometer 7 (seed 7):
// moods per room (outside bright, shop with neon, store room dark, hall rusty, tunnel blue), lamps at the ceilings and * in the layout,
// glowing clutter, Mama-Bot's searchlight lights the way (only with the part on her), dust and fog, everything off and on, camp without.
// Server must run (npm run serve).   node tools/light_test.mjs [--shots]   pictures to output/light_*.png (on and off)
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
await page.goto(base + '?poi=tankstelle_km7&seed=7');
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 20000 });
await ev(() => { nomad.take(); nomad.calm(); });
// Leyla to a tile, the camera right there (headless steps do not move the camera)
const go = (x, y, face = 1) => ev(([x, y, f]) => {
  nomad.tpTile(x, y); nomad.step(4, [f > 0 ? 'right' : 'left']); nomad.step(40);
  const s = game.scene.getScene('play'); s.cam.stopFollow(); s.cam.centerOn(s.leyla.x, s.leyla.feet - 260); s.cam.startFollow(s.leyla.box, false, 0.12, 0.12);
  nomad.step(1);   // one more frame: the lightmap is drawn for the camera's new place
  return nomad.light();
}, [x, y, face]);
const shot = async n => {
  if (!shots) return;
  fs.mkdirSync('output', { recursive: true });
  for (const on of [true, false]) { await ev(o => { nomad.light(o); nomad.freeze(); }, on); await page.waitForTimeout(500); await page.screenshot({ path: `output/light_${n}_${on ? 'an' : 'aus'}.png` }); await ev(() => nomad.thaw()); }
  await ev(() => nomad.light(true));
};

let s = await ev(() => nomad.light());
check('Licht an im POI-Level', s?.on, s);
check('Lampen hängen an den Decken (Neon, Glühlampe, Notlicht)', s.lamps.length > 10 && ['tube', 'ceiling', 'emergency'].every(k => s.lamps.some(l => l.kind === k)), s.lamps.length);
check('* im Layout: feste Lampe (Geheimfach im Verkaufsraum)', s.lamps.some(l => l.fixed), s.lamps.filter(l => l.fixed));
check('Kaputte und flackernde Lampen', s.lamps.some(l => l.behavior === 'broken') && s.lamps.some(l => l.behavior === 'flicker'), null);
check('Leuchtender Clutter (Automaten, Kühlschrank, Generator)', s.glows.length >= 1, s.glows);

s = await go(20, 33);
check('Vorplatz: Wüste draußen, keine Dunkelheit', s.mood === 'wueste_draussen' && s.atLeyla >= 0.99, s);
check('Vorplatz: Sand treibt im Wind', s.dust > 0, s.dust);
await shot('vorplatz');

s = await go(56, 33);
check('Verkaufsraum: Neon-Stimmung', s.mood === 'beton_neon', s.mood);
check('Verkaufsraum: Staub im Licht', s.dust > 0, s.dust);
await shot('verkaufsraum');

s = await go(47, 16);
check('Lager: duster', s.mood === 'beton_lager' && s.atLeyla < 0.75, s);
// the lightmap around Leyla (store room, she stands in its middle): the darkest spot is really dark, the brightest is a lamp
const pix = await ev(() => { const a = game.scene.getScene('play').atmo, d = a.ctx.getImageData(Math.floor(a.lw * 0.35), Math.floor(a.lh * 0.25), Math.floor(a.lw * 0.3), Math.floor(a.lh * 0.5)).data; let lo = 999, hi = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [Math.round(lo), Math.round(hi)]; });
check('Lichtkarte: im Lager dunkle Ecken und helle Lampen', pix[0] < 110 && pix[1] > 150, pix);
await shot('lager');

// tunnel: Mama-Bot's searchlight makes the way ahead brighter, only while the part sits on her
s = await go(80, 37, 1);
check('Tunnel: blau und dunkel, Nebel am Boden', s.mood === 'tunnel_blau' && s.fog > 0, s);
const spot = await ev(() => {
  const sc = game.scene.getScene('play'), a = sc.atmo, part = sc.drone.partImgs.find(p => p.r.name === 'Suchscheinwerfer');
  nomad.step(30, []);
  const on = nomad.light(), sp = a.lastSpot, x = sp.x + Math.cos(sp.dir) * 320, y = sp.y + Math.sin(sp.dir) * 320, beamOn = a.lightAt(x, y);   // a point in the beam
  part.img.setVisible(false); nomad.step(2);
  const off = nomad.light(), beamOff = a.lightAt(x, y);
  part.img.setVisible(true); nomad.step(2);
  return { on, off, beamOn, beamOff };
});
check('Scheinwerfer: leuchtet in Blickrichtung', !!spot.on.spot && spot.beamOn > spot.beamOff + 0.25, { on: spot.beamOn, off: spot.beamOff });
check('Scheinwerfer: ohne das Teil kein Kegel', spot.off.spot === null, spot.off.spot);
await shot('tunnel');

s = await ev(() => { nomad.light(false); const v = game.scene.getScene('play').atmo.image.visible; nomad.light(true); return { v, after: game.scene.getScene('play').atmo.image.visible }; });
check('Aus und wieder an (Vergleichsbilder)', s.v === false && s.after === true, s);

// the camp keeps its own day and night
await page.goto(base + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
s = await ev(() => { nomad.take(); nomad.step(5); return nomad.state().light; });
check('Camp: ohne Atmosphäre (eigener Tag und Nacht)', !s || s.on === false, s);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`Licht & Atmosphäre: ${ok.length} Prüfungen grün`);
