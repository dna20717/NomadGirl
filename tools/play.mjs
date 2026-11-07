#!/usr/bin/env node
// Play the game from the command line (Ava's controller): opens game.html headless, takes over the input via window.nomad
// and runs commands one after another. Prints the state after every command, screenshots go to output/.
//   npm run serve &   node tools/play.mjs [--room <id>] '<command>' '<command>' …
// Commands:
//   step <frames> [keys]          hold keys for n frames, e.g. "step 30 right+jump"
//   tap <key> [frames] [keys]     press key once, then step (default 10 frames), e.g. "tap melee 24", "tap jump 30 right+jump"
//   until <js> [max] [keys]       step until the condition holds; s = state, e.g. "until s.leyla.x>1300 300 right"
//   tp <col> <row>                Leyla to tile column, feet on top of row (row 15 = floor in the test room)
//   calm | restart | state        enemies off | room fresh | print full state
//   shot <name>                   screenshot of the current frame → output/play_<name>.png
//   eval <js>                     run JS in the page (nomad, game available)
import fs from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
let room = null;
if (args[0] === '--room') { room = args[1]; args.splice(0, 2); }
const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + (room ? `?room=${encodeURIComponent(room)}` : '');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 20000 });
await page.evaluate(() => nomad.take());
fs.mkdirSync('output', { recursive: true });

const keys = k => (k ? k.split('+') : []);
const short = v => `${v.leyla.state} x=${v.leyla.x} feet=${v.leyla.feet} tile=${v.leyla.tile} hp=${v.leyla.health} ammo=${v.leyla.ammo} · kills ${v.kills} · Δ ${v.deltas} · ${v.time}` +
  ' · ' + v.enemies.map(e => `${e.id}:${e.state}:${e.hp}`).join(' ');
for (const cmd of args) {
  const [c, ...a] = cmd.trim().split(/\s+/);
  let v;
  if (c === 'step') v = await page.evaluate(([n, h]) => nomad.step(n, h), [+a[0] || 1, keys(a[1])]);
  else if (c === 'tap') v = await page.evaluate(([k, n, h]) => nomad.step(n, h, [k]), [a[0], +a[1] || 10, keys(a[2])]);
  else if (c === 'until') v = await page.evaluate(([t, n, h]) => nomad.until(t, n, h), [a[0], +a[1] || 600, keys(a[2])]);
  else if (c === 'tp') v = await page.evaluate(([x, y]) => nomad.tpTile(x, y), [+a[0], +a[1]]);
  else if (c === 'calm') v = await page.evaluate(() => nomad.calm());
  else if (c === 'restart') v = await page.evaluate(() => nomad.restart());
  else if (c === 'state') { console.log(JSON.stringify(await page.evaluate(() => nomad.state()), null, 1)); continue; }
  else if (c === 'shot') {
    await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(600);
    await page.screenshot({ path: `output/play_${a[0] || 'shot'}.png` });
    await page.evaluate(() => nomad.thaw());
    console.log(`→ output/play_${a[0] || 'shot'}.png`); continue;
  } else if (c === 'eval') { console.log(await page.evaluate(a.join(' '))); continue; }
  else { console.error(`Unbekannter Befehl: ${c}`); continue; }
  console.log(`${cmd.padEnd(28)} ${short(v)}`);
}
await browser.close();
if (errors.length) { console.error('Fehler im Spiel:\n' + errors.join('\n')); process.exit(1); }
