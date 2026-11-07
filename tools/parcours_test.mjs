// Plays the parcours in the test room (no enemies) station by station and checks that every obstacle can be done.
// npm run serve &  node tools/parcours_test.mjs [--shots]   (screenshots to output/parcours_*.png)
// Uses the remote control window.nomad (steps without rendering, independent of the frame rate).
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.GAME_URL || 'http://localhost:8766/game.html';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 15000 });

// helpers inside the page: T = tile, F = feet on the floor
await page.evaluate(() => {
  const n = nomad, s = () => game.scene.getScene('play'), T = s().T;
  n.take();
  const L = () => { const l = n.state().leyla; return { st: l.state, x: l.x, feet: l.feet, vy: l.vy, ground: s().leyla.body.blocked.down }; };
  const go = dir => [dir > 0 ? 'right' : 'left'];
  window.P = {
    T, L,
    tp: (col, feetRow) => { n.tp(col * T, feetRow * T); n.step(20); return L(); },
    // run towards x (in tiles), then jump; optional double jump after `dbl` frames and a dash after `dash` frames
    leap(fromCol, toCol, { dbl = 0, dash = 0, max = 240 } = {}) {
      const dir = Math.sign(toCol - fromCol);
      for (let i = 0; i < 200 && (L().x - fromCol * T) * dir < 0; i++) n.step(1, go(dir));
      n.step(1, [...go(dir), 'jump'], ['jump']);
      for (let i = 1; i < max; i++) {
        const tap = i === dbl ? ['jump'] : i === dash ? ['dash'] : [];
        n.step(1, [...go(dir), ...(i < 14 || (dbl && i < dbl + 14) ? ['jump'] : [])], tap);
        const l = L(); if (i > 6 && l.ground && (l.x - toCol * T) * dir >= 0) break;
      }
      n.step(4); return L();
    },
    // jump straight onto a platform above and steer to its middle
    hop(toCol, { dbl = 0 } = {}) {
      n.step(1, ['jump'], ['jump']);
      for (let i = 1; i < 120; i++) {
        const dx = toCol * T - L().x, hold = Math.abs(dx) > 12 ? go(dx) : [];
        n.step(1, [...hold, ...(i < 14 || (dbl && i < dbl + 14) ? ['jump'] : [])], i === dbl ? ['jump'] : []);
        const l = L(); if (i > 8 && l.ground) break;
      }
      n.step(4); return L();
    },
    run(toCol, hold = []) { const dir = Math.sign(toCol * T - L().x); for (let i = 0; i < 400 && (L().x - toCol * T) * dir < 0; i++) n.step(1, [...go(dir), ...hold]); return L(); },
    slide(atCol, toCol) {
      for (let i = 0; i < 200 && L().x < atCol * T; i++) n.step(1, ['right']);
      n.step(1, ['right'], ['down']); const st = L().st;
      for (let i = 0; i < 300 && L().x < toCol * T; i++) n.step(1, ['right']);
      return { ...L(), started: st };
    },
  };
});
const P = (fn, ...a) => page.evaluate(([fn, a]) => new Function('P', 'a', `return (${fn})(P, ...a)`)(window.P, a), [fn.toString(), a]);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async name => { if (shots) { fs.mkdirSync('output', { recursive: true }); await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(400); await page.screenshot({ path: `output/parcours_${name}.png` }); await page.evaluate(() => nomad.thaw()); } };
const room = await page.evaluate(() => { const r = game.scene.getScene('play').data_.rooms.testraum; return { w: r.layout[0].length, h: r.layout.length }; });
const F = room.h - 6, feet = h => (F - h) * 64;   // floor row (as in tools: 6 rows of ground below)

let v;
// Leyla's van: door open at the start, closes when she walks away, ladder up, roof walkable with the rail in front
v = await page.evaluate(() => nomad.state().van); check('Van: Tür offen am Start', v?.open && v.frame === 4, v);
v = await page.evaluate(() => { nomad.step(90, ['right']); return nomad.state().van; }); check('Van: Tür geht zu', v && !v.open && v.frame === 0, v);
v = await page.evaluate(() => { nomad.step(90, ['left']); return nomad.state().van; }); check('Van: Tür geht wieder auf', v?.open && v.frame === 4, v);
v = await page.evaluate(() => {
  const n = nomad, s = n.state().van, T = 64; P.tp(5.2, 18); n.step(10);
  n.step(1, ['up'], ['up']); n.until(x => x.leyla.state !== 'climb', 200, ['up']); n.step(25, ['right']);
  return { ...P.L(), roof: s.roof.y, front: n.state().van.front };
});
check('Van: Leiter hoch, Dach begehbar', Math.abs(v.feet - v.roof) < 3 && v.front, v);
await shot('van');
v = await P(P => P.tp(13, 18));
v = await P(P => P.leap(14.6, 17.5)); check('Hürde 1', v.x > 17 * 64 && v.feet === feet(0), v);
v = await P(P => P.leap(18.5, 22.5)); check('Hürde 2 (breit)', v.x > 22 * 64 && v.feet === feet(0), v);
v = await P(P => P.leap(22.8, 27)); check('Mauer (2 hoch)', v.x > 26 * 64 && v.feet === feet(0), v);
await shot('huerden');
v = await P(P => P.tp(27.5, 18)); v = await P(P => P.leap(29.3, 34)); check('Grube', v.x > 33.5 * 64 && v.feet === feet(0), v);
v = await P(P => P.tp(34.5, 18)); v = await P(P => P.slide(36, 48.5)); check('Slide durch den langen Tunnel', v.started === 'slide' && v.x >= 48.5 * 64 && v.st === 'normal', v);
await shot('tunnel');
v = await P(P => P.tp(48.5, 18)); v = await P(P => P.leap(50.2, 52)); check('Treppe 1', v.feet === feet(2), v);
v = await P(P => P.leap(53.2, 55)); check('Treppe 2', v.feet === feet(4), v);
v = await P(P => P.leap(56.2, 58.5)); check('Treppe 3', v.feet === feet(6), v);
v = await P(P => P.tp(64, 12)); v = await P(P => P.leap(66.4, 73, { dbl: 16 })); check('Doppelsprung-Lücke', v.x > 72 * 64 && v.feet === feet(6), v);
await shot('doppelsprung');
// rope: like the fight room, jump off the edge, grab, swing, let go
v = await page.evaluate(() => {
  const n = nomad, T = P.T; P.tp(79.2, 12); n.step(14, ['right', 'jump'], ['jump']);
  for (let i = 0; i < 30 && n.state().leyla.state !== 'swing'; i++) n.step(1, ['right'], i % 2 ? [] : ['grab']);   // press E until in reach
  const grabbed = n.state().leyla.state;
  n.until(v => v.leyla.x > 87.6 * T, 60, ['right']); n.step(2, [], ['jump']); n.step(60);   // let go and drift onto the plateau
  return { ...P.L(), grabbed };
});
check('Seil über die Lücke', v.grabbed === 'swing' && v.x > 90 * 64 && v.feet === feet(6), v);
await shot('seil');
v = await P(P => P.tp(101.5, 18));
for (const [col, h] of [[104, 2], [107, 4], [104, 6], [107, 8], [104, 10], [107, 12]]) { v = await P((P, c) => P.hop(c), col); check(`Zickzack auf ${h}`, v.feet === feet(h), v); }
v = await P(P => P.run(115)); check('Hochplateau', v.feet === feet(12), v);
await shot('zickzack');
v = await P(P => P.tp(121, 18));
v = await P(P => P.leap(123.4, 132.5, { dbl: 16, dash: 22 })); check('Breite Grube (Doppelsprung + Dash)', v.x > 131.5 * 64 && v.feet === feet(0), v);
v = await P(P => P.tp(136, 18)); v = await P(P => P.leap(138.6, 141.5)); check('Hürde unter der Decke', v.x > 141 * 64 && v.feet === feet(0), v);
v = await P(P => P.leap(143.6, 148)); check('Doppelhürde unter der Decke', v.x > 147 * 64 && v.feet === feet(0), v);
v = await P(P => P.tp(151, 18)); v = await P(P => P.run(152.5));
for (const [col, h] of [[154, 2], [157, 4], [160, 6], [163.5, 8]]) { v = await P((P, c) => P.hop(c), col); check(`Aufstieg auf ${h}`, v.feet === feet(h), v); }
await shot('ziel');

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Parkour ok: ${ok.length} Prüfungen.`);
