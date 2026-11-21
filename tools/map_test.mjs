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
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(20); window.SC = () => game.scene.getScene('play'); });
const tap = async b => { await ev(x => { setPad([x]); nomad.step(2); setPad(); nomad.step(2); }, b); };

let v = await ev(() => { const m = nomad.save().map; return { n: m?.nodes.length, e: m?.edges.length, here: nomad.save().location, start: m?.start, visited: m?.visited, names: m?.nodes.map(x => x.name) }; });
check('Neues Spiel: Karte im Spielstand, Start = Tankstelle Kilometer 7', v.n >= 12 && v.e >= v.n && v.here === 'tankstelle_km7' && v.start === 'tankstelle_km7' && v.visited.includes('tankstelle_km7'), v);

// the van door: Karte · Reisen
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(5); return { map: nomad.map(), ready: document.querySelectorAll('.wm-ready-row').length }; });
check('Van-Tür öffnet direkt die Reisekarte, hier gewählt, mit „Bereit?“-Check (#016)', v.map?.open && v.map.sel === v.map.here && v.map.action === 'Hier plündern' && v.ready >= 4, v);
// #119 the dust sea: no place inside it, no road across it, the dock on its shore known from the start and closed for small vehicles
v = await ev(async () => { const { mapConfig, inSea } = await import('/game/worldmap.js'); const s = SC(), m = nomad.save().map, C = mapConfig(s.data_), N = id => m.nodes.find(n => n.id === id);
  const across = m.edges.filter(([a, b]) => { const A = N(a), B = N(b); for (let k = 1; k < 16; k++) { const t = k / 16; if (inSea(C, [A.pos[0] + (B.pos[0] - A.pos[0]) * t, A.pos[1] + (B.pos[1] - A.pos[1]) * t], 1)) return true; } return false; }).length;
  const mp = s.hud.map; mp.select('dock'); mp.paint?.();
  return { dock: !!N('dock'), known: m.revealed?.includes('dock'), inside: m.nodes.filter(n => n.id !== 'dock' && inSea(C, n.pos)).length, across, action: mp.action(), text: document.querySelector('.wm-detail')?.textContent || '' }; });
check('Staubozean: kein Ort darin, keine Straße hinüber, Andockpunkt von Anfang an bekannt und für kleine Fahrzeuge gesperrt (#119)', v.dock && v.known && v.inside === 0 && v.across === 0 && v.action?.disabled && /kleinen Fahrzeuge/.test(v.action.disabled), v);
if (shots) { await page.waitForTimeout(600); await page.screenshot({ path: 'output/map_staubozean.png' }); }
await ev(() => SC().hud.map.select(nomad.save().location));
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
// #087 Wettervorhersage: with a warroom the navigator shows the weather of every leg, here the rain of the next days
v = await ev(() => { const mp = SC().hud.map; mp.intelWas = mp.host.intel; mp.host.intel = () => true; mp.detail(); const st = mp.state(), box = document.querySelector('.wm-fc'); return { intel: st.intel, fc: st.forecast, rows: box?.querySelectorAll('.wm-fc-chip').length || 0, text: box?.textContent || '' }; });
check('Navigator: Wetter je Etappe der Route (mit Warroom)', v.intel && Array.isArray(v.fc) && v.fc.length >= 1 && v.rows === v.fc.length && /Navigator/.test(v.text), v);
await shot('forecast');
v = await ev(() => { const mp = SC().hud.map; mp.select(nomad.save().location); const st = mp.state(); const r = { intel: st.intel, fc: st.forecast, text: document.querySelector('.wm-fc')?.textContent || '' }; mp.host.intel = mp.intelWas; return r; });
check('Navigator am eigenen Ort: Regen der nächsten 3 Tage', v.intel && (v.fc?.length === 3 && /Heute/.test(v.text) && /Morgen/.test(v.text)), v);
// #089 Revierkrieg: a road between places of rival gangs is a front on the map, the place panel names who moved in
// the neighbour must have a gang of its own (the map is rolled per new game; a culvert without a gang has no „vorher“)
v = await ev(async () => { const R = await import('/game/reputation.js'), mp = SC().hud.map, here = nomad.save().location, near = nomad.map().near.find(id => R.gangOfPlace(mp.D, nomad.save(), id)); if (!near) return { noGang: nomad.map().near }; nomad.save().turfs = { [here]: 'Sky Wolves', [near]: 'Level Five' }; mp.host.intel = () => true; mp.select(near); mp.detail(); mp.paint();
  const st = mp.state(), text = document.querySelector('.wm-detail')?.textContent || ''; return { fronts: st.fronts, text }; });
check('Revierkrieg: Front auf der Karte, Ort zeigt die neue Gang und die alte', v.fronts >= 1 && /Level Five/.test(v.text) && /vorher/.test(v.text) && /Rivalen: Sky Wolves/.test(v.text), v);
await shot('front');
await ev(() => { delete nomad.save().turfs; const mp = SC().hud.map; mp.host.intel = mp.intelWas; });
await tap(1);
check('B schließt die Karte', !(await ev(() => nomad.map())).open);

// drive by clicking the button
v = await ev(() => { const fuel = nomad.save().fuel, day = nomad.save().day; nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(3);
  const mp = SC().hud.map, to = nomad.map().near[0], cost = mp.host.cost(to); mp.select(to); document.querySelector('.wm-go').click(); nomad.step(60);
  return { to, here: nomad.save().location, fuel, after: nomad.save().fuel, cost, visited: nomad.save().map.visited, banner: nomad.state().banner }; });
// #129/#154 the map was still open when the camp came back: the Info-Center holds the arrival banner until the window is gone, then it comes
v.banner = await page.waitForFunction(() => { const b = nomad.state().banner; return /Angekommen/.test(b || '') && b; }, null, { timeout: 5000, polling: 100 }).then(h => h.jsonValue()).catch(() => v.banner);
check('Klick auf „Hinfahren“: Leyla ist am Nachbarort, Sprit weg, als besucht markiert', v.here === v.to && Math.abs(v.fuel - v.cost.fuel - v.after) < 0.11 && v.visited.includes(v.to) && /Angekommen/.test(v.banner || ''), v);
// #014: further away over several legs, an incident on the road (forced: Panne), the choice costs time, then arrival
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(3);
  const mp = SC().hud.map, save = nomad.save(), far = save.map.nodes.map(n => n.id).filter(id => id !== save.location && !nomad.map().near.includes(id)).map(id => ({ id, c: mp.host.cost(id) })).find(x => x.c.legs?.length >= 2 && x.c.fuel < save.fuel);
  if (!far) return { none: true };
  mp.select(far.id); const label = mp.state().action;
  SC().forceEncounter = 'panne'; const h0 = save.day * 24 + save.hour;
  document.querySelector('.wm-go').click(); nomad.step(2);
  const menu = nomad.state().menu;
  nomad.choose('Richtig reparieren'); nomad.step(80);
  const s2 = nomad.save();
  return { to: far.id, legs: far.c.legs.length, label, menu, here: s2.location, hours: s2.day * 24 + s2.hour - h0, cost: far.c.hours, banner: nomad.state().banner, toasts: [...document.querySelectorAll('.hud-toast')].map(t => t.textContent) };
});
check('Weiter weg in Etappen: „Hinfahren · N Etappen“, Panne unterwegs, Reparatur kostet 3 h, dann angekommen', !v.none && /Etappen/.test(v.label) && v.menu?.title === 'Panne' && v.here === v.to && v.hours >= v.cost + 3 - 0.01 && /Etappen/.test(v.banner || ''), v);

// the warroom: same map, with Techtree / Auswerten in its header; plunder here
v = await ev(() => { const W = () => { const u = nomad.save().rig.units[0]; u.workshops = u.workshops.filter(w => w.at !== 1).concat({ id: 'warroom', at: 1 }); game.scene.getScene('play').goCamp({ keepPlace: true, fade: 0 }); nomad.step(30); }; /* #008: no warroom at the start, build one into the van */ W(); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Planen'); nomad.step(3); return nomad.map(); });
check('Warroom: Reisekarte mit Techtree und Auswerten', v.open && v.extras.includes('Techtree') && v.extras.includes('Auswerten'), v);
v = await ev(() => { const ok = nomad.choose('Plündern'); nomad.step(60); return { ok, mode: nomad.state().mode, poi: nomad.save().run?.poi }; });
check('Hier plündern startet den Run am neuen Ort', v.ok && v.mode === 'run' && !!v.poi, v);
// #014: the danger of the place works in the run: more enemies, tougher, more loot
v = await ev(() => { const S = game.scene.getScene('play'), run = nomad.save().run, D = S.data_;
  // tougher = the same kind of enemy has more life (the average over a random mix of kinds wobbled: backlog C19)
  const byKind = () => { const m = {}; for (const e of S.enemies) (m[e.id] ??= []).push(e.hp); return Object.fromEntries(Object.entries(m).map(([k, l]) => [k, l.reduce((a, b) => a + b, 0) / l.length])); };
  run.danger = 1; S.spawnEnemies(); const n1 = S.enemies.length, k1 = byKind();
  run.danger = 4; S.spawnEnemies(); const n4 = S.enemies.length, k4 = byKind();
  const both = Object.keys(k1).filter(k => k4[k]), ratios = both.map(k => +(k4[k] / k1[k]).toFixed(2));
  const T = S.threat(); return { n1, n4, ratios, loot: T.loot, stored: typeof run.danger }; });
check('Gefahr wirkt: Gefahr 4 bringt mehr und zähere Gegner und Extra-Beute', v.n4 > v.n1 && v.ratios.length && v.ratios.every(r => r > 1.15) && v.loot > 0, v);

// a new Durchgang rolls a new map
v = await ev(async () => { const { newCycle } = await import('/game/save.js'); const s = nomad.save(), old = s.map.nodes.map(n => n.name).join(); const n = newCycle(SC().data_, s); return { same: n.map.nodes.map(x => x.name).join() === old, cycle: n.cycle, mapCycle: n.map.cycle, here: n.location }; });
check('Neuer Durchgang: neue Karte, wieder an der Tankstelle', !v.same && v.mapCycle === v.cycle && v.here === 'tankstelle_km7', v);

// the workshop: Reisekarte with a preview and „Neu würfeln“
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html').replace('game.html', 'workshop.html'));
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
