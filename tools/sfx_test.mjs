// #130 Ton-Ereignisse in the game: every event of the catalog plays (code placeholder) without errors, the moves and fights of a
// short scripted session fire their sounds, M (muted) keeps everything silent. Server must run (npm run serve).
//   node tools/sfx_test.mjs
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=kampfraum';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if ((m.type() === 'error' || (m.type() === 'warning' && /^sfx/.test(m.text()))) && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.leyla, null, { timeout: 30000 });

// every event once, straight through the bank (the context runs thanks to the autoplay flag)
const all = await page.evaluate(async () => {
  const s = game.scene.getScene('play');
  s.muted = false; s.sound.mute = false;
  try { await s.sound.context?.resume?.(); } catch { /* fine */ }
  const ids = Object.keys(s.data_.sounds || {}), bad = [];
  const bank = s.__sfxBank;
  for (const id of ids) { bank.last = {}; bank.recent = []; if (!s.sfx(id, { x: s.leyla.x })) bad.push(id); }
  return { state: s.sound.context?.state, n: ids.length, bad, played: bank.played.length, viaCode: bank.played.every(p => p.via === 'code') };
});
check('Alle Ton-Ereignisse spielen (Platzhalter aus Code)', all.state === 'running' && all.n > 40 && !all.bad.length, all);

// a short session: run, jump, dash, melee into the enemies, take a hit → the hooks fire
const session = await page.evaluate(() => {
  const s = game.scene.getScene('play'), n = nomad, bank = s.__sfxBank;
  bank.calls = {};
  n.step(90, ['right']);
  n.step(18, ['jump'], ['jump']); n.step(70, []);
  n.step(2, [], ['dash']); n.step(40, []);
  const e = s.enemies.find(x => x.alive);
  if (e) { n.tp(e.x - e.facing * 90, e.feet); s.leyla.facing = Math.sign(e.x - s.leyla.x) || 1; }
  for (let i = 0; i < 6; i++) { n.step(2, [], ['melee']); n.step(24, []); }
  const foe = s.enemies.find(x => x.alive); if (foe) { bank.last = {}; foe.hit(s.now, 1, 0, 1, false, { kind: 'melee' }); }
  s.leyla.invulnerableUntil = 0; if (s.leyla.hurt(s.now, 5, s.leyla.x + 50)) s.onLeylaHit(5);
  n.step(10, []);
  return bank.calls;
});
const fired = k => Object.keys(session).some(x => x.startsWith(k));
for (const k of ['step_', 'jump', 'land_', 'dash', 'melee_whoosh', 'leyla_hurt']) check(`Im Spiel ausgelöst: ${k}`, fired(k), session);
check('Treffer am Gegner klingt (Fleisch, Metall oder Block)', fired('hit_'), session);

// muted (M): nothing sounds, nothing throws; switched off in Spiel › Effekte: same
const quiet = await page.evaluate(() => {
  const s = game.scene.getScene('play'); s.__sfxBank.last = {};
  s.muted = true; const a = s.sfx('jump'); s.muted = false;
  s.data_.game.sfx.enabled = false; const b = s.sfx('dash'); s.data_.game.sfx.enabled = true;
  return { a, b };
});
check('Stumm (M) und Effekte aus: still', !quiet.a && !quiet.b, quiet);

// a button in a window: hover and click play the menu sounds
const ui = await page.evaluate(() => {
  const s = game.scene.getScene('play'), bank = s.__sfxBank; bank.calls = {};
  const b = document.createElement('button'); b.textContent = 'Weiter'; document.body.append(b);
  b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); b.click();
  const x = document.createElement('button'); x.title = 'Schließen'; document.body.append(x); x.click();
  b.remove(); x.remove();
  return bank.calls;
});
check('Menü-Töne: Fokus, Bestätigen, Zurück', ui.ui_hover && ui.ui_confirm && ui.ui_back, ui);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Ton-Ereignisse ok: ${ok.length} Prüfungen.`);
