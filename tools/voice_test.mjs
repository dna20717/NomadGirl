// #112 Gebrabbel in the game: talking to Schraube babbles his line in his voice, Leyla answers with a noise, a speech bubble in
// the camp babbles, raiders shout; every call builds real Web Audio syllables without errors. Server must run (npm run serve).
//   node tools/voice_test.mjs
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.camp?.companions?.length, null, { timeout: 30000 });

const r = await page.evaluate(() => {
  const s = game.scene.getScene('play'), hud = s.hud, v = hud.voice(), calls = [];
  s.sound.mute = false; s.muted = false;
  for (const k of ['line', 'leyla', 'bubble', 'bark']) { const f = v[k].bind(v); v[k] = (...a) => { const h = f(...a); calls.push({ k, who: a[1]?.name || a[1]?.id || a[0]?.d?.name || a[0], n: h?.syllables ?? null }); return h; }; }
  const c = s.camp.companions.find(x => x.id === 'schraube') || s.camp.companions[0];
  s.camp.talk(c);
  const talked = calls.find(x => x.k === 'line');
  const i = hud.menuItems.findIndex(it => /Tschüss/.test(it.label));
  hud.choose(i >= 0 ? i : hud.menuItems.length - 1);
  const leyla = calls.find(x => x.k === 'leyla');
  nomad.tp(c.x, s.camp.ground - 10); s.camp.bark(c, true);
  const bubble = calls.find(x => x.k === 'bubble');
  const bark = v.bark({ d: s.data_.enemies.schlaeger, id: 'schlaeger', x: c.x + 100, y: s.camp.ground }, 'alert');
  const again = v.bark({ d: s.data_.enemies.schlaeger, id: 'schlaeger', x: c.x + 100, y: s.camp.ground }, 'alert');
  return { ctx: s.sound.context?.state, talked, leyla, bubble, bark: bark?.syllables ?? null, calls: calls.length };
});
check('Reden mit einem Companion: seine Zeile wird gebrabbelt', r.talked && r.talked.n > 0, r);
check('Leyla antwortet mit einem Laut', r.leyla && r.leyla.n > 0, r);
check('Sprechblase im Camp brabbelt', r.bubble && r.bubble.n > 0, r);
check('Ein Raider ruft', r.bark > 0, r);
// switched off in Spiel › Stimmen: silence
const off = await page.evaluate(() => { const s = game.scene.getScene('play'); s.data_.game.voice.enabled = false; const h = s.hud.voice().line('Hallo du!', { name: 'X' }); s.data_.game.voice.enabled = true; return h; });
check('Spiel › Stimmen › aus: still', off === null, off);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Stimmen ok: ${ok.length} Prüfungen.`);
