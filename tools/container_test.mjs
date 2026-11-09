#!/usr/bin/env node
// Closed shipping containers in the camp (Daniel, 09.11.2026): closed from afar, open when Leyla is near, while building
// and with the button „Rig offen“; three lengths (1, 2, 3 places) drawn ×4. Server must run (npm run serve).
//   node tools/container_test.mjs [--shots]   (images → output/container_*.png)
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.addInitScript(() => { try { localStorage.removeItem('nomadgirl-rig-open'); } catch {} });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 30000 });
const ev = (f, a) => page.evaluate(f, a);
let ok = 0, bad = 0;
const check = (name, pass, info) => { if (pass) { ok++; console.log('✔ ' + name); } else { bad++; console.log('✘ ' + name + ': ' + JSON.stringify(info)); } };
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(250); await page.screenshot({ path: `output/container_${n}.png` }); await ev(() => nomad.thaw()); };
const shells = () => ev(() => nomad.state().camp.shells);

// a test rig: van + Wohnanhänger + 20-foot container with two workshops
const sizes = await ev(() => {
  const s = game.scene.getScene('play'), sv = s.box.save, D = s.data_;
  sv.rig.units = sv.rig.units.filter(u => u.kind === 'tractor' || u.id === 'wohnanhaenger');
  sv.rig.units.push({ id: 'container_20', workshops: [{ id: 'chill_area', at: 0 }, { id: 'drohnenwerkstatt', at: 1 }] });
  s.camp.drawRig();
  const A = D.assets;
  return ['container_10', 'container_20', 'container_40'].map(id => { const c = D.containers[id]; return { id, places: c.places, w: A[c.look].frameSize[0], same: A[c.look].frameSize.join() === A[c.lookClosed].frameSize.join(), k: A[c.look].height / A[c.look].frameSize[1] }; });
});
check('Drei Längen: 1, 2, 3 Plätze, offen und zu deckungsgleich, ×4', sizes.map(x => x.places).join() === '1,2,3' && sizes.every(x => x.same && x.k === 4) && sizes[0].w < sizes[1].w && sizes[1].w < sizes[2].w, sizes);
let c = (await shells())[0];
check('Container hat eine geschlossene Hülle', !!c, await shells());

await ev(x => { nomad.walkTo(x); nomad.step(80); }, c.x1 + 340);
c = (await shells())[0];
check('Leyla weit weg: Container ist zu', c.closed === 1, c);
check('Zu: Schilder der Werkstätten sind weg', await ev(() => game.scene.getScene('play').camp.labels.filter(t => t.unit === 2).every(t => t.alpha === 0)), null);
await shot('closed');

await ev(x => { nomad.walkTo(x); nomad.step(60); }, (c.x0 + c.x1) / 2);
c = (await shells())[0];
check('Leyla davor: Container blendet auf', c.closed === 0, c);
check('Offen: Schilder sichtbar', await ev(() => game.scene.getScene('play').camp.labels.filter(t => t.unit === 2).every(t => t.alpha === 1)), null);
await shot('near');

await ev(x => { nomad.walkTo(x); nomad.step(80); }, c.x1 + 340);
check('Leyla geht weg: wieder zu', (await shells())[0].closed === 1, await shells());

await page.click('.hud-openbtn');
await ev(() => nomad.step(40));
check('Knopf „Rig offen“: alle offen, auch aus der Ferne', (await shells())[0].closed === 0 && await ev(() => localStorage.getItem('nomadgirl-rig-open')) === '1' && (await page.textContent('.hud-openbtn')).includes('Rig offen'), await shells());
await shot('toggle');
await page.click('.hud-openbtn');
await ev(() => nomad.step(40));
check('Knopf nochmal: wieder zu', (await shells())[0].closed === 1 && (await page.textContent('.hud-openbtn')).includes('Rig zu'), await shells());

await page.click('.hud-buildbtn');
await ev(() => nomad.step(40));
check('Bau-Modus: Container offen', (await shells())[0].closed === 0, await shells());
await shot('build');
await ev(() => game.scene.getScene('play').hud.build.close());
await ev(() => nomad.step(60));
check('Bau-Modus zu: wieder zu', (await shells())[0].closed === 1, await shells());

// E-Punkt and work mode only on the bench's own level (Daniel, 09.11.2026): on the street below a container on its chassis nothing,
// up on its floor the bench's "E · …" and work mode
const lv = await ev(() => {
  const s = game.scene.getScene('play'), u = s.camp.geo.units.find(u => u.workshops.length && !u.level), w = u.workshops[0], name = s.data_.workshops[w.id]?.name;
  const x = u.in0 + (w.at + 0.5) * u.cell, L = s.leyla;
  nomad.walkTo(x); nomad.step(60);
  const street = { feet: Math.round(L.feet), prompt: s.camp.promptText, work: s.camp.atWorkshop };
  L.body.reset(x, u.floorY - L.size.h / 2); nomad.step(60);
  const inside = { feet: Math.round(L.feet), floor: Math.round(u.floorY), prompt: s.camp.promptText, work: s.camp.atWorkshop };
  nomad.walkTo(x + 2000); nomad.step(30);
  return { name, street, inside };
});
check('Unten auf der Straße: kein „E · Werkstatt“, kein Arbeitsmodus', !(lv.street.prompt || '').includes(lv.name) && !lv.street.work, lv);
check('Oben auf dem Containerboden: „E · Werkstatt“ und Arbeitsmodus', (lv.inside.prompt || '').includes(lv.name) && lv.inside.work, lv);

// modular trailer (Daniel, 09.11.2026): on the ground automatically on a chassis as long as the container, stacked without
const ch = await ev(() => {
  const s = game.scene.getScene('play'), sv = s.box.save;
  sv.rig.units.push({ id: 'container_10', level: 1, workshops: [] });
  s.camp.drawRig();
  return s.camp.geo.units.map(u => ({ id: u.id, level: u.level || 0, chassis: !!u.chassis, segs: u.chassis?.plan.segs.length, axles: u.chassis?.plan.segs.filter(r => r[0] === s.data_.camp.chassis.axle[0]).length, lift: u.chassis?.lift, floor: Math.round(u.floorY), ground: s.camp.ground }));
});
const low = ch.find(u => u.id === 'container_20'), top = ch.find(u => u.id === 'container_10');
check('20-Fuß am Boden steht auf einem Fahrgestell mit 2 Achsen, Boden um die Fahrgestell-Höhe angehoben', low.chassis && low.axles === 2 && low.floor < low.ground - low.lift, ch);
check('Gestapelter 10-Fuß-Container steht ohne Fahrgestell auf dem Dach', top.level === 1 && !top.chassis, ch);
await shot('chassis');

check('keine Fehler in der Konsole', !errors.length, errors);
await browser.close();
console.log(`${ok} ok, ${bad} Fehler`);
process.exit(bad ? 1 : 0);
