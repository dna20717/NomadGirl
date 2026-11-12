// Before/after pictures of the tile sets (Daniel, 12.11.2026: „die Kachel-Sets wirken flach, wie an die Wand geklebt“):
// a few spots in the POI levels, written to output/depth_<name>_<tag>.png.   node tools/depth_shots.mjs <tag>   (server must run)
import { chromium } from 'playwright';
const tag = process.argv[2] || 'now';
// [name, poi, seed, k]: k = frames walking right from the start, or 'room:<id>' = jump into that room of the level (its floor, middle)
const spots = [['km7', 'tankstelle_km7', 7, 40], ['bunker', 'bunker_13', 3, 220], ['markt', 'grossmarkt', 4, 200], ['min', 'ministerium', 5, 240],
  ['verkauf', 'tankstelle_km7', 7, 'room:verkaufsraum'], ['halle', 'tankstelle_km7', 7, 'room:werkstatthalle'], ['quartiere', 'bunker_13', 3, 'room:bunker_quartiere'],
  ['reaktor', 'bunker_13', 3, 'room:bunker_reaktor'], ['foodcourt', 'grossmarkt', 4, 'room:markt_foodcourt'], ['kino', 'grossmarkt', 4, 'room:markt_kino'], ['saal', 'ministerium', 5, 'room:min_saal']];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
for (const [name, poi, seed, at] of spots) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:8766/game.html?poi=${poi}&seed=${seed}`);
  await p.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 60000 });
  await p.evaluate(k => { nomad.take(); const s = game.scene.getScene('play'); for (const e of s.enemies) e.destroy?.(); s.enemies = []; nomad.light(false);
    if (typeof k === 'string') {   // into a room of the level: middle column, its lowest floor
      const r = s.levelInfo.rooms.find(r => r.id === k.slice(5)), T = s.T, R = s.room, x = Math.floor(r.x + r.w / 2);
      let y = r.y + r.h - 2; while (y > r.y && !(R.tiles[y][x] !== '#' && R.tiles[y + 1]?.[x] === '#')) y--;
      nomad.tp((x + 0.5) * T, (y + 1) * T); k = 0;
    }
    for (let i = 0; i < k; i += 10) { nomad.step(10, ['right']); if (s.leyla.body.blocked.right) nomad.step(12, ['right', 'jump']); } nomad.step(40); s.fog?.sprite?.setVisible(false); }, at);
  await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(500);
  await p.screenshot({ path: `output/depth_${name}_${tag}.png` });
  await p.close();
}
await b.close();
