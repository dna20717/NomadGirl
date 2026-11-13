// Hydroponics in the camp (Daniel, 12.11.2026): the bench in the rig, plants in their pots at their stage, they grow in event time,
// E harvests the ripe ones into the camp inventories and plants anew.
// node tools/garden_test.mjs [--shots]   (server must run: npm run serve)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(300); await page.screenshot({ path: `output/garden_${n}.png` }); await ev(() => nomad.thaw()); };
const ready = () => page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp?.benches, null, { timeout: 40000 });

await page.goto('http://localhost:8766/game.html?camp&new');
await ready();
// the bench goes into the empty module trailer of the start rig
await ev(() => { nomad.take(); nomad.step(5); const s = nomad.save(), u = { kind: 'container', id: 'container_20', workshops: [] }; s.rig.units.push(u); u.workshops.push({ id: 'hydrokultur', at: 0 }); /* #008: no more module trailers */ nomad.save(); game.scene.getScene('play').goCamp({ keepPlace: true, fade: 0 }); for (let i = 0; i < 90; i++) nomad.step(1); });
await ready(); await ev(() => { nomad.take(); nomad.step(10); });
const H = () => ev(() => { const b = game.scene.getScene('play').camp.benches.list.find(b => b.id === 'hydrokultur'); return b && { n: b.plants?.length, frames: b.plants?.map(p => Number(p.frame.name)), place: b.place }; });
let v = await H();
check('Hydrokultur im Rig: 15 Töpfe mit Keimlingen', v?.n === 15 && v.frames.every(f => f % 4 === 0), v);
await ev(() => { nomad.goTo('Hydrokultur'); nomad.step(30); });
await shot('sprouts');

// time passes (event time): half way = young/grown, after two days everything is ripe
v = await ev(() => { const s = nomad.save(); s.hour += 14; if (s.hour >= 24) { s.hour -= 24; s.day += 1; } nomad.step(40); const b = game.scene.getScene('play').camp.benches.list.find(b => b.id === 'hydrokultur'); return b.plants.map(p => Number(p.frame.name) % 4); });
check('Nach 14 h: Basilikum (18 h) weit, Tomaten (36 h) noch klein', v[2] >= 2 && v[0] <= 1, v);
v = await ev(() => { const s = nomad.save(); s.day += 2; nomad.step(40); const b = game.scene.getScene('play').camp.benches.list.find(b => b.id === 'hydrokultur'); return b.plants.map(p => Number(p.frame.name) % 4); });
check('Nach zwei Tagen ist alles reif', v.every(x => x === 3), v);
await shot('ripe');

v = await ev(() => { const s = nomad.save(); for (const g of Object.values(s.inv.grids)) g.items = g.items.filter(e => !['chili', 'tomaten', 'mutantengemuese', 'gewuerzmischung'].includes(e.id));
  nomad.step(1, [], ['grab']); nomad.step(2); const m = nomad.menu(); nomad.choose('Ernten'); nomad.step(40);
  const st = {}; for (const g of Object.values(s.inv.grids)) for (const e of g.items) if (['chili', 'tomaten', 'mutantengemuese', 'gewuerzmischung'].includes(e.id)) st[e.id] = (st[e.id] || 0) + e.n;
  const b = game.scene.getScene('play').camp.benches.list.find(b => b.id === 'hydrokultur');
  return { menu: m?.items.map(i => i.label), st, after: b.plants.map(p => Number(p.frame.name) % 4) }; });
check('E: „Ernten (15)“ bringt Chili, Tomaten, Kohl, Basilikum ins Camp und pflanzt neu', v.menu?.[0] === 'Ernten (15)' && v.st.chili === 8 && v.st.tomaten === 8 && v.st.mutantengemuese === 4 && v.st.gewuerzmischung === 3 && v.after.every(x => x === 0), v);

await browser.close();
console.log(ok.map(n => '✔ ' + n).join('\n'));
if (errors.length) console.log('✖ ' + errors.join('\n✖ '));
console.log(`${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
