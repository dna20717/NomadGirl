import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const want = process.argv.slice(2);
for (const spec of want) {
  const [poi, seed, ...ids] = spec.split(':');
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:8766/game.html?poi=${poi}&seed=${seed}`);
  await p.waitForFunction(() => window.nomad && game?.scene.getScene('play')?.leyla, null, { timeout: 90000 });
  for (const id of ids) {
    const info = await p.evaluate(id => { nomad.take(); const s = game.scene.getScene('play'), r = s.levelInfo.rooms.find(x => x.id === id); if (!r) return null;
      const T = s.T; nomad.tp((r.x + r.w / 2) * T, (r.y + r.h - 1) * T); nomad.step(90); const st = nomad.state(); return { mood: st.light?.mood, critters: st.light?.critters, room: r }; }, id);
    if (!info) { console.log('no room', id); continue; }
    await p.evaluate(() => nomad.freeze()); await p.waitForTimeout(600);
    await p.screenshot({ path: `output/poi_${id}.png` }); await p.evaluate(() => nomad.thaw());
    console.log(id, JSON.stringify(info.critters), info.mood);
  }
  await p.close();
}
await b.close();
