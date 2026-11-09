// Headless check of the workshop pictures in the camp (Daniel, 08.11.2026: "Werkbank-Grafiken einbauen, cosy Beleuchtung und Effekte,
// Funktionen und Micro-Animationen; Vorschau beim Händler; ausgebaute Werkbänke liegen in Kisten"; "das Regal hat mehrere Zustände
// abhängig vom Füllzustand"). Pictures in the trailer, shelf fills up shelf by shelf, effects wake up when used, sparks at the
// workbench behind the craft window, Chill Area (time, heal, buff), Mama-Bot docks at the drone bench, no power = dark,
// packed crates on the scrapyard with the name on the label, thumbnails + big preview in the dealer's catalogue.
//   node tools/bench_test.mjs [--shots]   (server must run: npm run serve), pictures to output/bench_*.png
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
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze?.()); await page.waitForTimeout(300); await page.screenshot({ path: `output/bench_${n}.png` }); await ev(() => nomad.thaw?.()); };
const benches = () => ev(() => nomad.state().camp.benches);
const bench = async id => (await benches()).find(b => b.id === id);
const scene = 'game.scene.getScene("play")';
// a fresh camp at night with the given rig change (the scene reloads at the same place)
const reload = (js = '') => ev(js0 => { const s = game.scene.getScene('play'), sv = nomad.save(); (new Function('sv', js0))(sv); s.goCamp({ keepPlace: true, fade: 0 }); }, js).then(() => page.waitForFunction(() => game.scene.getScene('play')?.camp?.benches?.list?.length, null, { timeout: 15000 })).then(() => ev(() => { nomad.take(); nomad.step(5); }));

await ev(() => { nomad.save().deltas = 20000; nomad.take(); nomad.step(5); });
let b = await benches();
check('Start-Rig: Kochnische und Werkbank im Wohnanhänger, Lagerregal in der Holzkiste, alle als Bilder', ['kochnische', 'werkbank', 'lagerregal'].every(id => b.some(x => x.id === id)) && b.find(x => x.id === 'lagerregal').place === '2:0', b);
const one = await ev(() => game.scene.getScene('play').data_.camp.rig.benchScale), shelfK = await ev(() => (game.scene.getScene('play').data_.workshops.lagerregal.scale ?? 100) / 100);
check(`Ein Maßstab für alle (Camp › Rig-Ansicht, ×${one}; Regal mit Korrektur ${Math.round(shelfK * 100)} %)`, b.find(x => x.id === 'werkbank').scale === one && b.find(x => x.id === 'kochnische').scale === one && Math.abs(b.find(x => x.id === 'lagerregal').scale - one * shelfK) < 0.01, b);
check('Effekte angelegt (Kochnische und Werkbank)', b.find(x => x.id === 'kochnische').fx >= 5 && b.find(x => x.id === 'werkbank').fx >= 4, b);
const shelf0 = b.find(x => x.id === 'lagerregal');
check('Lagerregal zeigt seinen Füllstand (Start-Inventar)', shelf0.fill > 0 && shelf0.shelves >= 1, shelf0);

// the van pulls two trailers now (Daniel, 08.11.2026); the start rig uses that: Wohnanhänger + Holzkiste
check('Van zieht zwei Anhänger: Start-Rig Wohnanhänger + Holzkiste', (await ev(() => nomad.save().rig.units.map(u => u.id).join())) === 'van,wohnanhaenger,holzkiste', await ev(() => nomad.save().rig.units.map(u => u.id)));
// pixel magic: every picture stays inside its place
const inside = await ev(() => game.scene.getScene('play').camp.benches.list.every(b => b.x0 >= b.clip.x0 - 0.5 && b.x1 <= b.clip.x1 + 0.5 && b.top >= b.clip.y0 - 0.5));
check('Pixel-Magie: kein Bild ragt über seinen Platz im Container hinaus', inside, null);
// Leyla stands in front of the pictures and their little lights
const depths = await ev(() => { const s = game.scene.getScene('play'), B = s.camp.benches; return { leyla: s.leyla.sprite.depth, fx: B.add_.depth, flat: B.flat.depth }; });
check('Leyla steht vor den Werkbänken und ihren Effekten', depths.leyla > depths.fx && depths.leyla > depths.flat, depths);
// the van's door: the workshop behind it shows only while the door is open
const door = async () => ev(() => { const c = game.scene.getScene('play').camp; return c.vanDoor && { id: c.vanDoor.bench.id, a: c.vanDoor.view.alpha }; });
await ev(() => { const h = nomad.state().camp.hotspots.find(h => h.name === 'Van'); nomad.walkTo(h.x + 900); nomad.step(60); });
let dr = await door();
check('Van-Tür zu: dahinter nichts zu sehen', dr && dr.a === 0, dr);
await ev(() => { const h = nomad.state().camp.hotspots.find(h => h.name === 'Van'); nomad.walkTo(h.x + 150); nomad.step(60); });
dr = await door();
check('Van-Tür offen: der Warroom zeigt sich durch die Tür', dr?.id === 'warroom' && dr.a === 1, dr);

// the shelf: empty → no shelf filled, full → all four
await ev(() => { const g = nomad.save().inv.grids['store:2:0']; g.keep = g.items; g.items = []; nomad.step(30); });
let sh = await bench('lagerregal');
check('Leeres Regal: kein Fach gefüllt', sh.fill === 0 && sh.shelves === 0, sh);
await ev(() => { const g = nomad.save().inv.grids['store:2:0']; g.items = g.keep.slice(0, 2); nomad.step(30); });
sh = await bench('lagerregal');
check('Ein bisschen drin: unterstes Fach', sh.shelves === 1, sh);
await ev(() => { const g = nomad.save().inv.grids['store:2:0']; g.items = []; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.items.push({ a: 'items', id: 'schrott', n: 1, x, y, r: 0 }); nomad.step(30); });
sh = await bench('lagerregal');
check('Randvoll: alle vier Fächer', sh.fill === 100 && sh.shelves === 4, sh);
await ev(() => { const g = nomad.save().inv.grids['store:2:0']; g.items = g.keep; delete g.keep; nomad.step(30); });

// evening; Leyla at the workbench, the craft window open: the bench is "in use", sparks fly behind the window
await reload('sv.hour = 21.5;');
await ev(() => { nomad.walkTo(1700); nomad.step(10); nomad.walkTo(nomad.state().camp.benches.find(b => b.id === 'werkbank').x); nomad.step(20); nomad.step(1, [], ['grab']); nomad.step(3); });
check('E an der Werkbank öffnet Herstellen', await ev(s => eval(s).hud.craft.isOpen, scene), null);
const sparks = await ev(s => { const B = eval(s).camp.benches; let mx = 0; for (let i = 0; i < 900 && mx < 6; i++) { nomad.step(1); mx = Math.max(mx, B.sparks.length); } return mx; }, scene);
check('Werkbank in Benutzung: Funken fliegen hinter dem Fenster', (await bench('werkbank')).use && sparks >= 6, { sparks, b: await bench('werkbank') });
const puffs = await ev(s => { const B = eval(s).camp.benches; nomad.step(120); return B.puffs.length; }, scene);
check('… und Rauch steigt auf', puffs > 0, puffs);
await ev(s => eval(s).hud.craft.close(), scene);
await shot('evening');

// a third trailer with Chill Area and Drohnenwerkstatt (the LKW pulls three), the Generator in the cab for power
await reload(`sv.rig.tractor = 'lkw'; sv.rig.units[0].id = 'lkw'; sv.rig.units[0].workshops[0] = { id: 'generator', at: 0 }; sv.rig.units.push({ kind: 'container', id: 'modulanhaenger', workshops: [{ id: 'chill_area', at: 0 }, { id: 'drohnenwerkstatt', at: 1 }] }); sv.hour = 21.5;`);
b = await benches();
check('Chill Area und Drohnenwerkstatt stehen im Modul-Anhänger', b.some(x => x.id === 'chill_area') && b.some(x => x.id === 'drohnenwerkstatt'), b.map(x => x.id));
const chill = b.find(x => x.id === 'chill_area');
const tv = async () => ev(s => eval(s).camp.benches.list.find(b => b.id === 'chill_area').fx.find(e => e.r.kind === 'screen').s, scene);
const tv0 = await tv();
await ev(x => { nomad.walkTo(x); nomad.step(30); }, chill.x);
const before = await ev(() => nomad.state().camp.hour);
await ev(() => { nomad.step(1, [], ['grab']); nomad.step(3); });
check('E an der Chill Area bietet „Fernsehen und abhängen“', (await ev(() => nomad.menu()))?.items?.[0]?.label === 'Fernsehen und abhängen', await ev(() => nomad.menu()));
await ev(() => { nomad.choose('Fernsehen'); nomad.step(40); });
check('Beim Chillen geht der Fernseher an (Bildschirm heller)', (await tv()) > tv0 + 0.3, { tv0, tv: await tv() });
await ev(() => nomad.step(200));   // the scene clock runs the evening on (Leyla is remote-controlled)
await page.waitForFunction(() => game.scene.getScene('play')?.camp?.benches?.list?.length, null, { timeout: 15000 });
let st = await ev(() => nomad.state().camp);
check('Chillen: 1 h vergeht, Buff Gemütlich', Math.abs(((st.hour - before + 24) % 24) - 1) < 0.01 && st.buffs.includes('gemuetlich'), { before, hour: st.hour, buffs: st.buffs });
await shot('chill');

// Mama-Bot docks at the drone bench
await ev(() => nomad.take());
const db = await bench('drohnenwerkstatt');
await ev(x => { nomad.walkTo(x); nomad.step(30); nomad.step(1, [], ['grab']); nomad.step(3); nomad.choose('Mama-Bot'); }, db.x);
const dock = await ev(s => { const S = eval(s); for (let i = 0; i < 150; i++) nomad.step(1); return { d: Math.abs(S.drone.x - S.camp.benches.list.find(b => b.id === 'drohnenwerkstatt').cx), docked: !!S.drone.dock }; }, scene);
check('Mama-Bot warten: die Drohne fliegt zur Werkbank und dockt an', dock.docked && dock.d < 40, dock);
await ev(() => nomad.step(200));
await page.waitForFunction(() => game.scene.getScene('play')?.camp?.benches?.list?.length, null, { timeout: 15000 });

// no power: consumers go dark (the generator leaves the cab, the drone bench needs 2 ⚡)
await reload(`sv.rig.units[0].workshops = sv.rig.units[0].workshops.filter(w => w.id !== 'generator');`);
await ev(() => nomad.step(120));
const dark = await ev(s => { const B = eval(s).camp.benches.list.find(b => b.id === 'drohnenwerkstatt'); return { dark: B.dark, max: Math.max(...B.fx.map(e => e.s)) }; }, scene);
check('Kein Strom: die Drohnenwerkstatt bleibt dunkel', dark.dark && dark.max < 0.05, dark);

// packed: a workshop on the scrapyard is a crate with its name on the label
await reload(`sv.rig.spare.workshops = ['chill_area', 'kueche'];`);
st = await ev(() => nomad.state().camp);
const crates = st.yard.filter(y => y.kind === 'ws');
const tex = await ev(() => game.textures.getTextureKeys().filter(k => k.startsWith('ws_crate_')));
check('Ausgebaute Werkstätten liegen als Kisten auf dem Schrottplatz', crates.length === 2 && tex.some(k => k.includes('chill_area')) && tex.some(k => k.includes('kueche')), { crates, tex });

// the dealer's catalogue: thumbnails, hovering shows the big preview (the shelf shows empty → full)
await ev(() => { nomad.step(1, [], ['build']); nomad.step(60); });
await page.locator('.bm-shopbtn').click();
const thumbs = await page.locator('.build-row.has-pic .bm-thumb img').count();
check('Händler: Werkstätten mit Bild haben ein Vorschaubild', thumbs >= 8, thumbs);
await page.locator('.build-row.has-pic', { hasText: 'Lagerregal' }).hover();
await page.waitForTimeout(300);
const peek = await ev(() => { const p = document.querySelector('.bm-peek'); return p && { name: p.querySelector('b')?.textContent, imgs: p.querySelectorAll('img').length, fills: p.querySelector('.bm-peek-stage').classList.contains('fills') }; });
check('Hover zeigt die große Vorschau (Regal leer → voll)', peek?.name === 'Lagerregal' && peek.imgs === 2 && peek.fills, peek);
await shot('shop');
// dragging a crate: the workshop itself hangs from the pointer, the preview goes away
const sp = await ev(() => nomad.buildSpots());
const crate = sp.yard.find(y => y.kind === 'ws' && y.id === 'chill_area');
await page.mouse.move(crate.x, crate.y); await page.mouse.down(); await ev(() => nomad.step(2));
for (let i = 1; i <= 6; i++) { await page.mouse.move(crate.x + i * 30, crate.y - i * 30); await ev(() => nomad.step(2)); }
const hold = await ev(s => { const d = eval(s).hud.build.drag; return d && { kind: d.kind, id: d.id, key: d.holder.list[1]?.texture?.key }; }, scene);
check('Kiste packen: die Chill Area selbst hängt am Zeiger', hold?.id === 'chill_area' && /^ws_pic_chill_area/.test(hold.key || ''), hold);
check('Beim Ziehen verschwindet die Vorschau', !(await page.locator('.bm-peek').count()), null);
await page.mouse.up(); await ev(() => nomad.step(30));

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) console.log(errors.map(x => '✘ ' + x).join('\n'));
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
process.exit(errors.length ? 1 : 0);
