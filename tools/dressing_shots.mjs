#!/usr/bin/env node
// Before/after pictures of the set dressing (#158, Daniel 21.11.2026: „Clutter wird manchmal zu gehäuft eingesetzt, manchmal falsch“):
// every POI, three rooms (entrance, the biggest room of the main path, the exit), the whole room in the picture, light, fog and
// enemies off.   node tools/dressing_shots.mjs <tag> [--poi <id>] [--seed 3] [--places]   (server must run, GAME_URL)
// → output/dressing_<poi>_<n>_<tag>.png   --places lays the place types over it (nomad.places(true))
// --decay 0|3 (#159): every POI and room with this Verfall (a local draft of pois.json / rooms.json, only in the test browser)
import fs from 'node:fs';
import { chromium } from 'playwright';
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const tag = args.find((a, i) => !a.startsWith('--') && !['--poi', '--seed', '--decay'].includes(args[i - 1])) || 'now';
const seed = +(opt('--seed') || 3), only = opt('--poi'), places = args.includes('--places'), decay = opt('--decay');
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const D = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/pois.json', import.meta.url)));
fs.mkdirSync('output', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const out = [];
for (const poi of Object.keys(D).filter(p => !only || p === only)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  if (decay != null) {
    const P = Object.fromEntries(Object.entries(D).map(([k, v]) => [k, { ...v, story: { ...v.story, decay: +decay } }]));
    const R = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/rooms.json', import.meta.url)));
    for (const r of Object.values(R)) if (r.story) delete r.story.decay;
    await p.addInitScript(([P, R]) => { localStorage.setItem('nomadgirl-drafts:data/pois.json', JSON.stringify(P)); localStorage.setItem('nomadgirl-drafts:data/rooms.json', JSON.stringify(R)); }, [P, R]);
  }
  try {
    await p.goto(`${base}?poi=${poi}&seed=${seed}`);
    await p.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 120000 });
    const rooms = await p.evaluate(() => {
      nomad.take(); const s = game.scene.getScene('play'); if (s.hud) s.hud.roomTitle = () => {}; for (const e of s.enemies) e.destroy?.(); s.enemies = []; nomad.light(false);
      const main = s.levelInfo.rooms.filter(r => r.band !== 'branch' && r.band !== 'side'), all = s.levelInfo.rooms;
      const big = [...main.slice(1, -1)].sort((a, c) => c.w * c.h - a.w * a.h)[0] || all[1] || all[0];
      return [main[0] || all[0], big, main.at(-1) || all.at(-1)].map(r => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h }));
    });
    for (const [i, r] of rooms.entries()) {
      await p.evaluate(([r, places]) => {
        const s = game.scene.getScene('play'), T = s.T, cam = s.cam || s.cameras.main;
        if (s.fog) { s.fog.reveal = () => {}; if (s.fog.seen) s.fog.seen.fill?.(1); if (s.fog.vis) s.fog.vis.fill?.(1); s.fog.sprite?.setVisible(false); s.fog.rt?.setVisible?.(false); }
        nomad.tp((r.x + 2.5) * T, (r.y + r.h - 1) * T - 2); nomad.step(4);
        cam.stopFollow(); cam.setZoom(Math.max(0.35, Math.min(1, 1920 / (r.w * T), 1080 / (r.h * T)) * 0.98)); cam.centerOn((r.x + r.w / 2) * T, (r.y + r.h / 2) * T);
        if (places) nomad.places?.(true);
      }, [r, places]);
      await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(400);
      const file = `output/dressing_${poi}_${i + 1}_${tag}.png`;
      await p.screenshot({ path: file }); out.push(file);
      await p.evaluate(() => nomad.thaw());
    }
  } catch (e) { console.log(`✘ ${poi}: ${e.message}`); }
  await p.close();
}
await b.close();
console.log(out.join('\n'));
