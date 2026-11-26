// #190 (persona test #189): many runs in one session, camp ↔ run again and again.
// ① a grenade in the run after a run with a grenade does not crash ('sys'), ② the throw HUD stays one, ③ level textures (fog chunks,
// baked render textures) go with their scene and the raider kit cache keeps its limit.
// Server must run (npm run serve) or use tools/test_all.mjs.   node tools/rerun_test.mjs
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
await page.goto(url);
await page.waitForFunction(() => { try { return window.nomad?.state?.(); } catch { return false; } }, null, { timeout: 60000 });

const r = await page.evaluate(() => {
  const S = () => game.scene.getScene('play'), out = { runs: [], thrown: 0 };
  const level = () => game.textures.getTextureKeys().filter(k => /^fog_/.test(k) || /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(k)).length;
  nomad.take(); nomad.fast(true); nomad.stepQuiet(30);
  for (let i = 0; i < 5; i++) {
    nomad.goTo('Van'); nomad.stepQuiet(1, [], ['grab']); nomad.stepQuiet(10);
    if (S().hud.menuState()) nomad.choose('Planen');
    nomad.choose('Plündern'); nomad.stepQuiet(240);
    nomad.calm();
    for (let k = 0; k < 2; k++) { const before = S().leyla.grenade?.state().thrown || 0; nomad.stepQuiet(1, [], ['grenade']); nomad.stepQuiet(90); out.thrown += (S().leyla.grenade?.state().thrown || 0) - before; }
    out.runs.push({ mode: S().mode, hud: document.querySelectorAll('.hud-throw').length });
    S().endRun(false); nomad.stepQuiet(240); S().hud.sum?.close(); nomad.stepQuiet(30);
    out.runs[i].level = level();
  }
  out.kits = S().kitCache?.size ?? 0; out.keep = S().data_.game?.kitCacheKeep ?? 8;
  return out;
});
check('Fünf Runs mit Granaten, kein Absturz (①)', !errors.length && r.runs.every(x => x.mode === 'run') && r.thrown >= 4, r);
check('Wurf-Anzeige bleibt eine (②)', r.runs.every(x => x.hud === 1), r.runs.map(x => x.hud));
const lv = r.runs.map(x => x.level);
check('Level-Texturen wachsen nicht mit jedem Run (③)', Math.max(...lv) - Math.min(...lv.slice(1)) <= 2, lv);
check('Raider-Cache hält seine Grenze (③)', r.kits <= r.keep, r);

await browser.close();
console.log(ok.map(t => '✓ ' + t).join('\n'));
if (errors.length) { console.log(errors.map(t => '✗ ' + t).join('\n')); process.exit(1); }
console.log(`Neustarts ok: ${ok.length} Prüfungen.`);
