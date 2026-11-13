#!/usr/bin/env node
// Travel map (#007): the Durchgang's map in the savegame, the window at the warroom and the van door, places drawn on the paper,
// controller moves between places, LB/RB cycle the reachable ones, drive by click, plunder here, a new Durchgang rolls a new map,
// the workshop shows a preview with „Neu würfeln“.   node tools/map_test.mjs [--shots]   (server: npm run serve; images → output/map_*.png)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(700); await page.screenshot({ path: `output/map_${n}.png` }); };

await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.setPad = (press = []) => pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; });
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(20); window.SC = () => game.scene.getScene('play'); });
const tap = async b => { await ev(x => { setPad([x]); nomad.step(2); setPad(); nomad.step(2); }, b); };

let v = await ev(() => { const m = nomad.save().map; return { n: m?.nodes.length, e: m?.edges.length, here: nomad.save().location, start: m?.start, visited: m?.visited, names: m?.nodes.map(x => x.name) }; });
check('Neues Spiel: Karte im Spielstand, Start = Tankstelle Kilometer 7', v.n >= 12 && v.e >= v.n && v.here === 'tankstelle_km7' && v.start === 'tankstelle_km7' && v.visited.includes('tankstelle_km7'), v);

// the van door: Karte · Reisen
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); const m = nomad.menu(); nomad.choose('Karte'); nomad.step(5); return { first: m?.items[0]?.label, map: nomad.map() }; });
check('Van-Tür: „Karte · Reisen“ öffnet die Reisekarte', v.first === 'Karte · Reisen' && v.map?.open, v);
await page.waitForTimeout(800);
v = await ev(() => { const mp = SC().hud.map; return { places: Object.keys(mp.places).length, known: Object.values(mp.places).filter(p => p.known).length, near: Object.values(mp.places).filter(p => p.near).length, canvas: mp.canvas.width, paper: !!mp.image(mp.D.worldmap.paper), logos: !!mp.image(mp.D.worldmap.logos) }; });
check('Karte gezeichnet: alle Orte, Nachbarn im Rotstift, Papier und Logos geladen', v.places >= 12 && v.near >= 2 && v.known > v.near && v.known < v.places && v.canvas > 400 && v.paper && v.logos, v);
await shot('open');

// controller: arrows walk between places, LB/RB cycle the reachable ones, B closes
v = await ev(() => nomad.map());
const sel0 = v.sel;
await tap(5); const sel1 = (await ev(() => nomad.map())).sel;
await tap(4); const sel2 = (await ev(() => nomad.map())).sel;
check('RB / LB: nächstes erreichbares Ziel und zurück', sel1 !== sel0 && sel2 === sel0 && [v.here, ...v.near].includes(sel1), { sel0, sel1, sel2, near: v.near });
const before = (await ev(() => nomad.map())).sel;
for (const b of [15, 13, 14, 12]) await tap(b);
const moved = await ev(() => nomad.map());
check('Steuerkreuz wandert zu Orten in der Richtung', moved.sel && moved.sel !== undefined, { before, after: moved.sel });
v = await ev(() => { const mp = SC().hud.map; const near = nomad.map().near[0]; mp.select(near); return { st: mp.state(), cost: mp.host.cost(near), text: document.querySelector('.wm-detail')?.textContent || '' }; });
check('Detail: Hinfahren mit Strecke, Fahrt, Sprit, Gefahr, Beute', v.st.action === 'Hinfahren' && !v.st.disabled && /km/.test(v.text) && /Sprit/.test(v.text) && /Gefahr/.test(v.text) && /Beute/.test(v.text) && v.cost.km > 0, v);
await shot('detail');
await tap(1);
check('B schließt die Karte', !(await ev(() => nomad.map())).open);

// drive by clicking the button
v = await ev(() => { const fuel = nomad.save().fuel, day = nomad.save().day; nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(3);
  const mp = SC().hud.map, to = nomad.map().near[0], cost = mp.host.cost(to); mp.select(to); document.querySelector('.wm-go').click(); nomad.step(60);
  return { to, here: nomad.save().location, fuel, after: nomad.save().fuel, cost, visited: nomad.save().map.visited, banner: nomad.state().banner }; });
check('Klick auf „Hinfahren“: Leyla ist am Nachbarort, Sprit weg, als besucht markiert', v.here === v.to && Math.abs(v.fuel - v.cost.fuel - v.after) < 0.11 && v.visited.includes(v.to) && /Angekommen/.test(v.banner || ''), v);

// the warroom: same map, with Techtree / Auswerten in its header; plunder here
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Planen'); nomad.step(3); return nomad.map(); });
check('Warroom: Reisekarte mit Techtree und Auswerten', v.open && v.extras.includes('Techtree') && v.extras.includes('Auswerten'), v);
v = await ev(() => { const ok = nomad.choose('Plündern'); nomad.step(60); return { ok, mode: nomad.state().mode, poi: nomad.save().run?.poi }; });
check('Hier plündern startet den Run am neuen Ort', v.ok && v.mode === 'run' && !!v.poi, v);

// a new Durchgang rolls a new map
v = await ev(async () => { const { newCycle } = await import('/game/save.js'); const s = nomad.save(), old = s.map.nodes.map(n => n.name).join(); const n = newCycle(SC().data_, s); return { same: n.map.nodes.map(x => x.name).join() === old, cycle: n.cycle, mapCycle: n.map.cycle, here: n.location }; });
check('Neuer Durchgang: neue Karte, wieder an der Tankstelle', !v.same && v.mapCycle === v.cycle && v.here === 'tankstelle_km7', v);

// the workshop: Reisekarte with a preview and „Neu würfeln“
await page.goto('http://localhost:8766/workshop.html');
await page.waitForFunction(() => window.workshop?.p?.data, null, { timeout: 20000 });
await ev(() => workshop.go({ area: 'worldmap' }));
await page.waitForTimeout(1200);
v = await ev(() => { const c = document.querySelector('.ng-worldmap'), t = document.querySelector('.ng-worldmap')?.nextElementSibling?.textContent || ''; const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'Neu würfeln'); b?.click(); return { canvas: !!c, t, after: document.querySelector('.ng-worldmap')?.nextElementSibling?.textContent || '' }; });
check('Werkstatt › Reisekarte: Vorschau, Neu würfeln', v.canvas && /Orte/.test(v.t) && v.t !== v.after, v);
await shot('workshop');

await browser.close();
for (const n of ok) console.log('  ok  ', n);
for (const e of errors) console.log('  FEHLER', e);
console.log(errors.length ? `\n${errors.length} Fehler` : `\nReisekarte: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
