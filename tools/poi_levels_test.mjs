// The new POI levels in the browser (Ava, 11.11.2026, Daniel AFK: "gestalte die anderen POIs"): Großmarkt, Bunker 13, Ministerium
// load without errors, have chests, secrets and the shortcut, their rooms wear their own tile sets and moods, small life runs.
// Reachability of every chest, switch, goal and shortcut is checked in test/poi.test.js (engine/reach.js).
// Server must run (npm run serve).   node tools/poi_levels_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], ok = [];
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const CASES = [['grossmarkt', 3, 'markt_passage', 'mall', 'markt_neon'], ['bunker_13', 2, 'bunker_gang', 'bunker', 'bunker_rot'], ['ministerium', 2, 'min_flur', 'marble', 'ministerium_kalt']];
for (const [poi, seed, room, kit, mood] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errs.push(m.text()); });
  await page.goto(`${process.env.GAME_URL || 'http://localhost:8766/game.html'}?poi=${poi}&seed=${seed}`);
  await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 120000 });
  const v = await page.evaluate(([room]) => {
    nomad.take(); const s = game.scene.getScene('play'), L = s.levelInfo, r = L.rooms.find(x => x.id === room), T = s.T, st0 = nomad.state();
    const tm = s.terrainMap(), kitAt = tm?.idAt?.(r.x + 3, r.y + r.h - 1);
    nomad.tp((r.x + 4) * T, (r.y + r.h - 1) * T - 2); nomad.step(150);
    const st = nomad.state();
    return { chests: st0.level?.chests?.length ?? st0.level?.chests, secrets: st0.level?.secretsMax, shortcut: !!L.shortcut, rooms: L.rooms.length, kitAt, mood: st.light?.mood, critters: st.light?.critters, lamps: st.light?.lamps?.length };
  }, [room]);
  check(`${poi}: lädt ohne Fehler, ${v.rooms} Räume, Kisten, Geheimnisse, Abkürzung`, !errs.length && v.chests > 0 && v.secrets > 0 && v.shortcut, { ...v, errs });
  check(`${poi}: ${room} trägt Kachel-Set ${kit} und Stimmung ${mood}, Lampen`, v.kitAt === kit && v.mood === mood && v.lamps > 10, v);
  const life = Object.values(v.critters || {}).reduce((n, x) => n + x, 0);
  check(`${poi}: Kleinvieh lebt (${JSON.stringify(v.critters)})`, life > 0, v);
  if (shots) { fs.mkdirSync('output', { recursive: true }); await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(500); await page.screenshot({ path: `output/poi_levels_${poi}.png` }); }
  await page.close();
}
console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
