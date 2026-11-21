// Markenschild am POI-Eingang (Daniel 21.11.2026: „Die Firmenlogos werden in den POI nicht angezeigt“): the brand of the place stands
// on a pylon sign in the first outdoor room, with logo, name and slogan. Run: node tools/brand_sign_test.mjs   (server on :8766)
import { chromium } from 'playwright';
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [], pageErrors = [];
p.on('pageerror', e => pageErrors.push(e.message));
const check = (name, cond, info) => { (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 400)}`); console.log((cond ? '  ok   ' : '  FEHL ') + name); };
await p.goto(`${base}?poi=tankstelle_km7&seed=3&brand=delta_petrol`);
await p.waitForFunction(() => window.nomad && game.scene.getScene('play')?.level, null, { timeout: 60000 });
let v = await p.evaluate(() => { nomad.take(); const s = game.scene.getScene('play'), g = s.level.sign, R = s.room, T = s.T; if (!g) return null; const tx = Math.floor(g.x / T), ty = Math.round((g.y + 4.6 * T) / T); return { ...g, floor: R.tiles[ty]?.[tx], air: R.tiles[ty - 1]?.[tx] }; });
check('Tankstelle mit Delta Petrol: Schild am Eingang, steht auf festem Boden', v?.brand === 'delta_petrol' && v.floor === '#' && v.air === '.', v);
await p.evaluate(() => nomad.tp(game.scene.getScene('play').level.sign.x - 200, game.scene.getScene('play').level.sign.y + 4.6 * 64));
await p.evaluate(() => { nomad.step(60); nomad.freeze?.(); }); await p.waitForTimeout(600);
await p.screenshot({ path: 'output/brand_sign.png' });
await p.goto(`${base}?poi=tankstelle_km7&seed=3`);
await p.waitForFunction(() => window.nomad && game.scene.getScene('play')?.level, null, { timeout: 60000 });
v = await p.evaluate(() => game.scene.getScene('play').level.sign || null);
check('Ohne Marke: kein Schild', !v, v);
check('Keine Fehler auf der Seite', !pageErrors.length, pageErrors);
await b.close();
console.log(errors.length ? `\nFehler:\n${errors.join('\n')}` : `\nMarkenschild ok: ${ok.length} Prüfungen.`);
process.exit(errors.length ? 1 : 0);
