#!/usr/bin/env node
// Pictures of the level design (#163): per POI the Wow room (whole room, light on, enemies off), a room that shows the landmark (sky or
// window) and one with its guide line and light at the way on, plus the Wow camera move as three frames.
//   node tools/level_shots.mjs <tag> [--poi <id>] [--seed 3] [--no-cam]   (server must run, GAME_URL) → output/level_<poi>_<what>_<tag>.png
import fs from 'node:fs';
import { chromium } from 'playwright';
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const tag = args.find((a, i) => !a.startsWith('--') && !['--poi', '--seed'].includes(args[i - 1])) || 'now';
const seed = +(opt('--seed') || 3), only = opt('--poi'), cam = !args.includes('--no-cam');
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const D = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/pois.json', import.meta.url)));
fs.mkdirSync('output', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const out = [], errors = [];
for (const poi of Object.keys(D).filter(p => !only || p === only)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`${poi}: ${e.message}`));
  try {
    await p.goto(`${base}?poi=${poi}&seed=${seed}`);
    await p.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 120000 });
    const info = await p.evaluate(() => {
      nomad.take(); const s = game.scene.getScene('play'); if (s.hud) s.hud.roomTitle = () => {}; for (const e of s.enemies) e.destroy?.(); s.enemies = [];
      if (s.fog) { s.fog.reveal = () => {}; s.fog.seen?.fill?.(1); s.fog.vis?.fill?.(1); s.fog.sprite?.setVisible(false); s.fog.rt?.setVisible?.(false); }
      const L = s.levelInfo, fx = s.levelFx, main = L.rooms.filter(r => r.band === 'main');
      const wow = L.rooms.find(r => r.wow), view = fx?.views?.find(v => v.how === 'window') || fx?.views?.find(v => v.how === 'sky');
      const pick = r => r && { id: r.id, x: r.x, y: r.y, w: r.w, h: r.h };
      return { wow: pick(wow), land: pick(view ? L.rooms[view.room] : null), how: view?.how, mid: pick(main[Math.floor(main.length / 2)] !== wow ? main[Math.floor(main.length / 2)] : main[1]) };
    });
    const shot = async (r, what) => {
      if (!r) return;
      await p.evaluate(r => {
        const s = game.scene.getScene('play'), T = s.T, c = s.cam;
        nomad.tp((r.x + 2.5) * T, (r.y + r.h - 1) * T - 2); nomad.step(4);
        c.stopFollow(); c.setZoom(Math.max(0.3, Math.min(1, 1280 / (r.w * T), 720 / (r.h * T)) * 0.98)); c.centerOn((r.x + r.w / 2) * T, (r.y + r.h / 2) * T);
      }, r);
      await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(400);
      const file = `output/level_${poi}_${what}_${tag}.png`; await p.screenshot({ path: file }); out.push(file);
      await p.evaluate(() => nomad.thaw());
    };
    await shot(info.wow, 'wow'); await shot(info.land, `landmark_${info.how}`); await shot(info.mid, 'guide');
    if (cam && info.wow) {   // the camera move: walk in from outside, three frames
      await p.evaluate(w => { const s = game.scene.getScene('play'), T = s.T; s.levelFx.wowDone = false; s.levelFx.inWow = false; s.roomName = null; const C = s.data_.game?.camera || {}; s.cam.setZoom(C.zoom || 1); s.cam.startFollow(s.leyla.box, false, 1, 1);
        const L = s.levelInfo; nomad.tp((w.x + 3) * T, (w.y + w.h - 2) * T - 2); nomad.step(2); }, info.wow);
      for (const [i, ms] of [[1, 300], [2, 1100], [3, 900]].map(([i, ms]) => [i, ms])) {
        await p.evaluate(ms => nomad.step(Math.round(ms / 16.7)), ms);
        await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(300);
        const file = `output/level_${poi}_cam${i}_${tag}.png`; await p.screenshot({ path: file }); out.push(file);
        await p.evaluate(() => nomad.thaw());
      }
    }
  } catch (e) { console.log(`✘ ${poi}: ${e.message}`); }
  await p.close();
}
await b.close();
console.log(out.join('\n'));
if (errors.length) { console.log('Fehler:\n' + errors.join('\n')); process.exitCode = 1; }
