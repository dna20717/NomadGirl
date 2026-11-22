#!/usr/bin/env node
// Pictures of the hulls (#171 G4): per POI the whole level (fog and light map off, so the building reads) and close-ups in game zoom
// (light on): the roof edge of the first building, a facade with windows, the outside (sky, skyline, awning/canopy). With --before the
// same pictures with Spiel › Hülle › Hüllen aus (the data is changed in the browser only), for vorher/nachher.
// With --code (#172) the hull painted from code only (Spiel › Hülle › Gemalte Module aus, the look of #171), for vorher/nachher of the modules.
//   node tools/facade_shots.mjs <tag> [--poi <id>] [--seed 1] [--before | --code] [--no-close] [--sheet output/fassaden_172.jpg]
//   (server must run, GAME_URL) → output/hullen_<poi>_<what>_<tag>.png
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const tag = args.find((a, i) => !a.startsWith('--') && !['--poi', '--seed', '--sheet'].includes(args[i - 1])) || 'now';
const seed = +(opt('--seed') || 1), only = opt('--poi'), before = args.includes('--before'), code = args.includes('--code'), close = !args.includes('--no-close'), sheet = opt('--sheet');
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const D = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/pois.json', import.meta.url)));
fs.mkdirSync('output', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const out = [], whole = [], errors = [];
for (const poi of Object.keys(D).filter(p => !only || p === only)) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(`${poi}: ${e.message}`));
  if (before || code) await p.route(/data\/game\.json/, async r => { const res = await r.fetch(), j = await res.json(); j.hull = { ...(j.hull || {}), ...(before ? { enabled: false } : { modules: false }) }; r.fulfill({ response: res, json: j }); });
  try {
    await p.goto(`${base}?poi=${poi}&seed=${seed}`);
    await p.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 120000 });
    // where to look: the plan of the hull (also when it is switched off, from the engine, so vorher/nachher show the same spots)
    const info = await p.evaluate(async () => {
      nomad.take(); const s = game.scene.getScene('play'); if (s.hud) s.hud.roomTitle = () => {}; for (const e of s.enemies) e.destroy?.(); s.enemies = [];
      const { planHull } = await import('/engine/facade.js'), D0 = s.data_, P = planHull({ ...D0, game: { ...D0.game, hull: { ...(D0.game?.hull || {}), enabled: true } } }, s.levelPoi, s.levelInfo, { decay: D0.pois[s.levelPoi]?.hull?.decay ?? D0.pois[s.levelPoi]?.story?.decay ?? 1 }), L = s.levelInfo;
      const b0 = P.buildings?.[0], wins = (P.windows || []).filter(w => w.where === 'facade'), rw = (P.windows || []).find(w => w.where === 'room');
      const spots = [];
      if (b0) spots.push({ what: 'dach', x: b0.x0 + 2, y: b0.top + 1 });
      if (wins.length) { const w = wins[Math.floor(wins.length / 2)]; spots.push({ what: 'fassade', x: w.x + 1, y: w.y + 1 }); }
      else if (rw) spots.push({ what: 'fenster', x: rw.x + 1, y: rw.y + 1 });
      const st = P.parts?.find(q => ['station', 'awning', 'canopy', 'surface', 'plant', 'lattice', 'portal', 'fire'].includes(q.kind));
      if (st) spots.push({ what: 'aussen', x: st.x + Math.min(st.w, 12) / 2, y: st.y + Math.min(st.h, 6) });
      if (!spots.length) { const r = L.rooms[0]; spots.push({ what: 'eingang', x: r.x + r.w / 2, y: r.y + 2 }); }
      return { above: P.above || 0, spots, state: s.hull?.state?.() || null };
    });
    const shot = async (what, fn, arg) => {
      await p.evaluate(fn, arg); await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(500);
      const file = `output/hullen_${poi}_${what}_${tag}.png`; await p.screenshot({ path: file, timeout: 240000 }); out.push(file); await p.evaluate(() => nomad.thaw()); return file;
    };
    whole.push(await shot('ganz', above => {
      const s = game.scene.getScene('play'), T = s.T, c = s.cam, W = s.room.w * T, H = (s.room.h + above + 2) * T;
      if (s.fog) { s.fog.reveal = () => {}; for (const o of s.children.list) if (o.depth === 15.5) o.setVisible(false); }
      s.atmo?.image?.setVisible(false);
      c.stopFollow(); c.setBounds(-6000, -6000, W + 12000, H + 12000); const z = Math.max(0.1, Math.min(1600 / W, 900 / H) * 0.96); c.setZoom(z); c.centerOn(W / 2, z * H > 900 ? 900 / z / 2 - (above + 2) * T : (s.room.h * T) / 2 - (above + 2) * T / 2);   // too big for one picture (software WebGL): the top part
    }, info.above));
    if (close) for (const sp of info.spots) await shot(`nah_${sp.what}`, sp => {
      const s = game.scene.getScene('play'), T = s.T, c = s.cam, C = s.data_.game?.camera || {};
      if (s.fog) for (const o of s.children.list) if (o.depth === 15.5) o.setVisible(true);
      s.atmo?.image?.setVisible(true);
      c.setBounds(-6000, -6000, s.room.w * T + 12000, s.room.h * T + 12000); c.setZoom((C.zoom || 1) * 0.8); c.centerOn(sp.x * T, sp.y * T);
    }, sp);
    if (info.state) console.log(poi, JSON.stringify(info.state));
  } catch (e) { console.log(`✘ ${poi}: ${e.message}`); errors.push(`${poi}: ${e.message}`); }
  await p.close();
}
await b.close();
console.log(out.join('\n'));
if (sheet && whole.length) {
  execFileSync('montage', [...whole, '-tile', '4x', '-geometry', '800x450+4+4', '-background', '#141013', '-quality', '86', sheet]);
  console.log('Übersicht: ' + sheet);
}
if (errors.length) { console.log('Fehler:\n' + errors.join('\n')); process.exitCode = 1; }
