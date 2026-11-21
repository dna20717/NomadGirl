#!/usr/bin/env node
// Pictures of the Wow rooms (#165): per POI the whole Wow room (enemies off, fog off) and a close-up in game zoom with Leyla in front of
// the motif; with --sheet an overview of all of them (ImageMagick montage, 4 columns).
//   node tools/wow_shots.mjs <tag> [--poi <id>] [--seed 3] [--sheet output/wow_raeume_165.jpg]   (server must run, GAME_URL)
//   → output/wow_<poi>_{room,close}_<tag>.png
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const tag = args.find((a, i) => !a.startsWith('--') && !['--poi', '--seed', '--sheet'].includes(args[i - 1])) || 'now';
const seed = +(opt('--seed') || 3), only = opt('--poi'), sheet = opt('--sheet');
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const D = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/pois.json', import.meta.url)));
fs.mkdirSync('output', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const out = [], errors = [], rooms = [];
for (const poi of Object.keys(D).filter(p => D[p].wow && (!only || p === only))) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`${poi}: ${e.message}`));
  try {
    await p.goto(`${base}?poi=${poi}&seed=${seed}`);
    await p.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 120000 });
    const info = await p.evaluate(() => {
      nomad.take(); const s = game.scene.getScene('play'); if (s.hud) s.hud.roomTitle = () => {}; for (const e of s.enemies) e.destroy?.(); s.enemies = [];
      if (s.fog) { s.fog.reveal = () => {}; s.fog.seen?.fill?.(1); s.fog.vis?.fill?.(1); s.fog.sprite?.setVisible(false); s.fog.rt?.setVisible?.(false); }
      const r = s.levelInfo.rooms.find(r => r.wow), B = s.levelFx?.wowBox;
      return r && { x: r.x, y: r.y, w: r.w, h: r.h, bx: B?.bx, by: B?.by, top: B?.top, pic: !!s.levelFx?.wowPic };
    });
    if (!info) { console.log(`– ${poi}: kein Wow-Raum`); await p.close(); continue; }
    const shot = async (what, fn, arg) => {
      await p.evaluate(fn, arg);
      await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(400);
      const file = `output/wow_${poi}_${what}_${tag}.png`; await p.screenshot({ path: file }); out.push(file);
      await p.evaluate(() => nomad.thaw());
      return file;
    };
    // the whole room
    rooms.push(await shot('room', r => {
      const s = game.scene.getScene('play'), T = s.T, c = s.cam;
      nomad.tp((r.x + 2.5) * T, (r.y + r.h - 1) * T - 2); nomad.step(4);
      c.stopFollow(); c.setZoom(Math.max(0.3, Math.min(1, 1280 / (r.w * T), 720 / (r.h * T)) * 0.98)); c.centerOn((r.x + r.w / 2) * T, (r.y + r.h / 2) * T);
    }, info));
    // close-up in game zoom: Leyla a little left of the motif, the camera on the motif
    await shot('close', r => {
      const s = game.scene.getScene('play'), T = s.T, c = s.cam, C = s.data_.game?.camera || {};
      nomad.tp(r.bx - 3 * T, r.by - 2); nomad.step(20);
      c.stopFollow(); c.setZoom(C.zoom || 1); c.centerOn(r.bx, Math.max(r.top + 4 * T, r.by - 5 * T));
    }, info);
  } catch (e) { console.log(`✘ ${poi}: ${e.message}`); }
  await p.close();
}
await b.close();
console.log(out.join('\n'));
if (sheet && rooms.length) {
  execFileSync('montage', [...rooms, '-tile', '4x', '-geometry', '640x360+4+4', '-background', '#141013', '-quality', '88', sheet]);
  console.log('Übersicht: ' + sheet);
}
if (errors.length) { console.log('Fehler:\n' + errors.join('\n')); process.exitCode = 1; }
