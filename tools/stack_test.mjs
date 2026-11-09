// Headless check of stacking containers (game.html?camp, Daniel 08.11.2026: "leerer Container zum vertikalen Stapeln", Leyla can stand in the upper one)
// with real mouse drags: buy a container, drag it on top of the trailer, a workshop up there, Leyla climbs the ladder and uses it,
// E spots below do not work from above, double jump from the lower trailer up, unhitching only from the top, stacks move as a block,
// the Modul-Anhänger carries too.
//   node tools/stack_test.mjs [--shots]   (server must run: npm run serve), pictures to output/stack_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.location()?.url?.includes('/api/') && !/404/.test(m.text())) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze?.()); await page.waitForTimeout(300); await page.screenshot({ path: `output/stack_${n}.png` }); await ev(() => nomad.thaw?.()); };
const inv = () => ev(() => nomad.inv());
const cell = (panel, x, y) => ev(([panel, x, y]) => { const g = document.querySelectorAll('.inv-grid')[panel], r = g.getBoundingClientRect(), c = parseFloat(g.style.getPropertyValue('--c')); return [r.left + (x + 0.5) * c, r.top + (y + 0.5) * c]; }, [panel, x, y]);
const walkE = name => ev(n => { nomad.take(); nomad.step(5); const h = nomad.state().camp.hotspots.find(h => h.name === n || h.name.startsWith(n)); if (!h) return null; nomad.walkTo(h.x); nomad.step(1, [], ['grab']); nomad.step(5); return h; }, name);
const grid = key => ev(k => { const g = nomad.save().inv.grids[k]; return g && { w: g.w, h: g.h, items: g.items.map(e => `${e.id}×${e.n}@${e.x},${e.y}`) }; }, key);
const minutes = () => ev(() => { const s = nomad.save(); return s.day * 1440 + Math.round(s.hour * 60); });
const build = () => ev(() => nomad.build());
const spots = () => ev(() => nomad.buildSpots());
// drag with the mouse: press, move in steps (the game steps in between, so the part swings), release
const drag = async (a, b, { shotName = null } = {}) => {
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await ev(() => nomad.step(2));
  for (let i = 1; i <= 10; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await ev(() => nomad.step(2)); }
  if (shotName) await shot(shotName);
  await page.mouse.up(); await ev(() => nomad.step(2));
  return build();
};
const slot = async ws => (await spots()).slots.find(s => s.ws === ws);
const freeSlot = async () => (await spots()).slots.find(s => !s.ws);
const yardItem = async id => (await spots()).yard.find(y => y.id === id);
const finishJobs = () => ev(() => nomad.until(() => { const b = nomad.build(); return !b.jobs && !b.working; }, 1500));


await ev(() => { nomad.save().deltas = 20000; nomad.take(); nomad.step(5); nomad.step(1, [], ['build']); nomad.step(40); });
let b = await build(), sp = await spots(), s;
check('Bau-Modus: der Wohnanhänger bietet einen Stapelplatz', sp.stacks.length === 1 && sp.stacks[0].onto === 1, sp.stacks);
await ev(() => game.scene.getScene('play').hud.build.buy('containers', 'container_20'));
await finishJobs();
const yc = async id => (await spots()).yard.find(y => y.kind === 'container' && y.id === id);
// drag the container from the scrapyard so that it hangs over the trailer's roof
const stackAt = async () => { const st = (await spots()).stacks[0]; return { x: st.x, y: st.y - 200 }; };
b = await drag(await yc('container_20'), await stackAt(), { shotName: 'hang' });
check('Container auf den Wohnanhänger gezogen: gestapelt', b.rig.includes('^container_20') && b.spare.containers.length === 0, b);
check('Leiste zeigt die Höhe (2 / 2 hoch)', /2 \/ 2 hoch/.test(await page.locator('.bm-bar').innerText()), await page.locator('.bm-bar').innerText());
check('Kein Stapelplatz mehr frei (Van stapelt 2 hoch)', (await spots()).stacks.length === 0, (await spots()).stacks);
await finishJobs();
// a shelf into the upper container
await ev(() => game.scene.getScene('play').hud.build.buy('workshops', 'lagerregal'));
await finishJobs();
const upSlot = (await spots()).slots.find(x => x.ui === 2 && x.p === 0);
b = await drag((await spots()).yard.find(y => y.kind === 'ws' && y.id === 'lagerregal'), upSlot);
check('Lagerregal in den oberen Container eingebaut', /\^container_20\[lagerregal@0\]/.test(b.rig), b.rig);
await finishJobs();
// unhitching the trailer below: first the container on top
b = await drag((await spots()).units.find(u => u.ui === 1), (await spots()).yardFree);
check('Wohnanhänger mit Container drauf: nicht abhängen', !b.spare.containers.length && /oben abnehmen|Werkstätten/.test(b.msg || ''), b);
await shot('built');
await ev(() => { game.scene.getScene('play').hud.build.close(); nomad.step(60); });

// Leyla climbs the ladder and stands upstairs
s = await ev(() => {
  const sc = game.scene.getScene('play'), lad = sc.ladders.find(l => l.rig), up = sc.camp.geo.units.find(u => u.level);
  nomad.take(); nomad.walkTo(lad.cx); nomad.step(10);
  nomad.step(1, ['up'], ['up']); const st = sc.leyla.state;
  nomad.until(() => sc.leyla.state !== 'climb' && sc.leyla.feet < up.floorY + 5, 400, ['up']); nomad.step(60);
  return { st, feet: Math.round(sc.leyla.feet), floor: Math.round(up.floorY), prompt: nomad.state().camp.prompt };
});
check('W an der Leiter: Leyla klettert', s.st === 'climb', s);
check('… und steht oben im Container', Math.abs(s.feet - s.floor) < 4, s);
s = await ev(() => { const sc = game.scene.getScene('play'), up = sc.camp.geo.units.find(u => u.level); nomad.walkTo(up.in0 + up.cell / 2); nomad.step(20); return { prompt: nomad.state().camp.prompt, feet: Math.round(sc.leyla.feet) }; });
check('Oben: E-Punkt des oberen Lagerregals (nicht der Kochnische darunter)', /Lagerregal/.test(s.prompt || '') && !/Kochnische|Werkbank/.test(s.prompt || ''), s);
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(5); return nomad.inv(); });
check('E öffnet das Lager oben', s.open && s.other?.key === 'store:2:0', s);
await shot('upstairs');
await ev(() => game.scene.getScene('play').hud.inv.close());
// down again and a double jump from the lower trailer's floor: since the rig is drawn ×4 the upper floor is out of reach (ladder only)
s = await ev(() => {
  const sc = game.scene.getScene('play'), low = sc.camp.geo.units.find(u => !u.level), up = sc.camp.geo.units.find(u => u.level);
  sc.leyla.box.body.reset(low.in0 + 220, low.floorY - sc.leyla.size.h / 2); nomad.step(30);
  const onLow = Math.round(sc.leyla.feet), dbl = 16;
  nomad.step(1, ['jump'], ['jump']);
  for (let i = 0; i < 70; i++) nomad.step(1, (i < 14 || (i >= dbl && i < dbl + 14)) ? ['jump'] : [], i === dbl ? ['jump'] : []);
  return { onLow, lowFloor: Math.round(low.floorY), feet: Math.round(sc.leyla.feet), upFloor: Math.round(up.floorY) };
});
check('Doppelsprung aus dem unteren Anhänger reicht seit Faktor 4 nicht mehr nach oben (nur Leiter; Daniel, 09.11.2026)', s.onLow === s.lowFloor && s.feet === s.lowFloor, s);

// LKW: two trailers, the stack moves along as a block, the Modul-Anhänger carries too
await ev(() => { const sc = game.scene.getScene('play'), sv = sc.box.save; sv.rig.tractor = sv.rig.units[0].id = 'lkw'; sc.camp.drawRig(); nomad.step(1, [], ['build']); nomad.step(40); });
await ev(() => game.scene.getScene('play').hud.build.buy('containers', 'modulanhaenger'));
await finishJobs();
const gapEnd = async () => { const g = (await spots()).gaps; return g[g.length - 1]; };
b = await drag(await yc('modulanhaenger'), await gapEnd());
check('Modul-Anhänger am Ende angekuppelt', /modulanhaenger\[\]$/.test(b.rig), b.rig);
await finishJobs();
await shot('modul');
const gap1 = async () => (await spots()).gaps.find(g => g.g === 1);
b = await drag((await spots()).units.find(u => u.id === 'modulanhaenger'), await gap1());
check('Modul-Anhänger nach vorne: der Stapel zieht als Block mit', /^lkw\[schlafkoje@0 warroom@1\] modulanhaenger\[\] wohnanhaenger\[/.test(b.rig) && /wohnanhaenger\[[^\]]*\] \^container_20/.test(b.rig), b.rig);
await finishJobs();
check('Modul-Anhänger bietet einen Stapelplatz', (await spots()).stacks.some(st => st.onto === 1), (await spots()).stacks);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
