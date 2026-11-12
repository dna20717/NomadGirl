// The cryo tank in the camp (game.html?camp&new): in the rig from the start, its screen and face, phases change the picture,
// maintenance at the tank, the heart in the fogged glass, the hand at the glass, AvA's loving face nearby, fixed in build mode.
// node tools/tank_test.mjs [--shots]   (server must run: npm run serve)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/tank_${n}.png` }); };

await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp?.benches, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(10); window.TK = () => game.scene.getScene('play').camp.benches.list.find(b => b.tank); });

let v = await ev(() => { const s = nomad.save(), b = TK(); return { units: s.rig.units.map(u => u.id), tank: s.tank, hs: nomad.state().camp.hotspots.some(h => h.name === 'Cryo-Tank'), st: b?.tank.state() }; });
check('Neues Spiel: Cryo-Tank im kleinsten Container, voll, mit E-Punkt', v.units.includes('container_10') && v.tank.cond === 100 && v.hs && v.st?.phase === 'Stabil', v);
v = await ev(() => { nomad.goTo('Cryo-Tank'); nomad.step(120); return TK().tank.state(); });
check('Anzeige tippt Text, Gesicht lächelt, wenn Leyla davor steht', v.text.length > 0 && v.face === 2, v);
await shot('stable');

// maintenance at the tank: E opens the window with the tank bar, Notflicken brings condition back
v = await ev(() => { const s = nomad.save(); s.tank.cond = 62; s.tank.at = s.day * 24 + s.hour;
  const g = s.inv.grids.chest; g.items.push({ a: 'items', id: 'panzertape', n: 4, x: 7, y: 4, r: 0 }, { a: 'items', id: 'schrott', n: 2, x: 6, y: 4, r: 0 });
  nomad.step(1, [], ['grab']); nomad.step(3); const open = game.scene.getScene('play').hud.craft.isOpen, bar = document.querySelector('.craft-tank')?.textContent;
  const btn = [...document.querySelectorAll('.craft-recipe')].find(r => r.textContent.includes('Notflicken'))?.querySelector('button'); btn?.click();
  return { open, bar, cond: Math.round(s.tank.cond) }; });
check('E am Tank: Fenster mit Zustand, Notflicken bringt +8 %', v.open && /AvA · 62/.test(v.bar || '') && v.cond === 70, v);
await ev(() => { game.scene.getScene('play').hud.craft.close(); nomad.step(5); });

// phases: the picture changes, a weak tank gets the weak face
v = await ev(() => { const s = nomad.save(), b = TK(); const out = {};
  for (const c of [70, 50, 30, 8]) { s.tank.cond = c; b.tank.refresh(true); nomad.step(3); out[c] = { key: b.picture.texture.key, loop: b.tank.state().loop, face: b.tank.state().face }; }
  return out; });
check('Phasen tauschen Bild und Schleife', v[70].key === 'ws_cryotank_2' && v[50].key === 'ws_cryotank_3' && v[30].loop === 'cryotank_loop_4' && v[8].key === 'ws_cryotank_5', v);
check('Schwacher Tank: Gesicht schwach bzw. k.o.', v[30].face === 15 && v[8].face === 9, v);

// fogged glass: a fingertip draws a heart; the hand print fades in
v = await ev(() => { const s = nomad.save(), b = TK(); s.tank.cond = 70; b.tank.refresh(true); b.tank.nextHeart = 0; b.tank.nextHand = 0; nomad.step(60); const st = b.tank.state(); return st; });
check('Beschlagen: ein Herz wird ins Glas gemalt, ein Handabdruck taucht auf', v.heart && v.hand, v);
await ev(() => nomad.step(40)); await shot('heart');

// AvA near her tank: loving face
v = await ev(() => { const s = game.scene.getScene('play'), d = s.drone, b = TK(); for (let i = 0; i < 90; i++) { d.x = b.cx; d.y = b.floor - 150; nomad.step(1); } return { mood: d.mood, face: d.faceFrame }; });
check('AvA beim Tank: verliebtes Gesicht', v.mood === 'love' && v.face === 14, v);

// dead: dark picture, screen says so
v = await ev(() => { const s = nomad.save(), b = TK(); s.tank.cond = 0; s.tank.dead = true; b.tank.refresh(true); nomad.step(80); return { key: b.picture.texture.key, st: b.tank.state() }; });
check('Tot: Bild dunkel, Anzeige zeigt es', v.key === 'ws_cryotank_dead' && /TOT/.test(v.st.text), v);
await shot('dead');

await browser.close();
console.log(ok.map(n => '✔ ' + n).join('\n'));
if (errors.length) { console.log('✖ ' + errors.join('\n✖ ')); }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
