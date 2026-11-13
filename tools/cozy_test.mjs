#!/usr/bin/env node
// Camp-Paket (#008): start rig (van with bunk + kitchenette, the small trailer with the tank), power, the map without a warroom,
// folding stairs, clutter on the closed walls, deco round the fire, companions as sprites, solar on the roof, the cistern,
// string lights pulled with the mouse in build mode (and taken down), a tidy HUD.   node tools/cozy_test.mjs [--shots]
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 700)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(900); await page.screenshot({ path: `output/cozy_${n}.png` }); await ev(() => nomad.thaw()); };
const boot = async url => { await page.goto(url); await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 }); await ev(() => { nomad.take(); nomad.step(20); window.SC = () => game.scene.getScene('play'); }); };

await boot('http://localhost:8766/game.html?camp&new');
let v = await ev(() => { const c = SC().camp; return { rig: nomad.save().rig.units.map(u => `${u.id}[${u.workshops.map(w => w.id)}]`), power: c.budget.power, noPower: c.noPower };});
check('Start-Rig: Van mit Koje + Kochnische, kleiner Anhänger mit Tank, Strom reicht', v.rig.join(' ') === 'van[schlafkoje,kochnische] container_10[cryotank]' && v.power.made === 2 && !v.noPower, v);

v = await ev(() => { const c = SC().camp; return { ladders: SC().ladders.filter(l => l.rig && l.ground).map(l => l.stairs), shells: c.shells.map(x => x.extras.map(e => e.texture.key)), labels: c.labels.map(t => [t.style.fontSize, Math.round(t.alpha * 100)]),
  comps: c.companions.map(x => [x.id, x.sprite.texture.key, !!x.sprite.anims?.isPlaying]), foot: document.querySelector('.hud-foot').textContent, deco: SC().children.list.filter(o => o.texture?.key?.startsWith('camp_')).length }; });
check('Erdgeschoss: Klapptreppe statt Leiter (kletterbar)', v.ladders.length >= 1 && v.ladders.every(Boolean), v.ladders);
check('Außenwand: Kälte-Panel am geschlossenen Tank-Container', v.shells.flat().includes('out_tank'), v.shells);
check('Companions: Schraube und Onkel Sung als PixelLab-Figuren, atmen', v.comps.every(([, k, p]) => k.startsWith('companion_') && p), v.comps);
check('Deko ums Feuer, Beschriftungen dezent', v.deco >= 3 && v.labels.every(([f, a]) => f === '20px' && a <= 80), v);
check('HUD aufgeräumt: unten nur Menü und Version', !/Werkstatt|Start|Neues Spiel/.test(v.foot), v.foot);
await shot('day');

// the map without a warroom: no danger, no loot, a hint
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(5); const m = nomad.map(); return { m, text: document.querySelector('.wm-detail')?.textContent || '' }; });
check('Karte ohne Warroom: Gefahr und Beute unbekannt, Hinweis auf den Warroom', v.m.open && v.m.intel === false && /\? \? \?/.test(v.text) && /Warroom/.test(v.text), v);
await ev(() => { SC().hud.map.close(); nomad.step(5); });

// the cistern: water over time, fill bottles
v = await ev(() => { const s = nomad.save(), c = SC().camp; s.hour = 6; c.use('zisterne', '9:0'); const m1 = nomad.menu(); nomad.choose('Zurück'); s.hour = 18; c.use('zisterne', '9:0'); const m2 = nomad.menu(); nomad.choose('Abfüllen'); nomad.step(3);
  const n = ['backpack', 'chest'].reduce((a, k) => a + JSON.stringify(s[k] || s.inventories?.[k] || '').split('"wasser"').length - 1, 0); return { m1: m1?.items[0]?.label, m2: m2?.items[0]?.label, has: JSON.stringify(s).includes('"wasser"') }; });
check('Zisterne: erst leer, nach 12 Stunden „Abfüllen (3)“, Frischwasser im Inventar', /zu wenig/.test(v.m1) && v.m2 === 'Abfüllen (3)' && v.has, v);

// solar: a panel on the container roof
v = await ev(() => { const s = nomad.save(); s.rig.parts = { ...(s.rig.parts || {}), solar: ['solarpaneel'] }; s.hour = 12; SC().camp.drawRig(); nomad.step(2); const c = SC().camp; return { made: c.budget.power.made, solar: c.solar, drawn: c.rigObjs.filter(o => o.list?.some?.(x => /solar/.test(x.texture?.key || ''))).length }; });
check('Solarpaneel auf dem Container-Dach: +1 ⚡ am Tag', v.made === 3 && v.solar.live === 1 && v.drawn >= 1, v);

// string lights: drag from corner to corner with the mouse, click the middle to take it down
await ev(() => { nomad.save().deltas = 500; SC().openBuild(); nomad.step(30); });
await page.waitForTimeout(400);
let sp = await ev(() => SC().hud.build.spots());
check('Bau-Modus: Andockpunkte an Van und Container', sp.anchors.length >= 4, sp.anchors);
const [a, b] = [sp.anchors.find(x => x.id === '1:1'), sp.anchors.find(x => x.id === '0:0')];
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, a.y + 40, { steps: 6 }); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await ev(() => nomad.step(4));
v = await ev(() => { const st = SC().hud.build.state(); return { lights: st.lights, deltas: st.deltas, bulbs: SC().camp.bulbs.length }; });
check('Lichterkette ziehen: hängt zwischen Container und Van, kostet 25 Δ, Lampen leuchten', v.lights.join() === '1:1-0:0' && v.deltas === 475 && v.bulbs >= 4, v);
const c0 = sp.anchors.find(x => x.id === '1:0');
await page.mouse.click(c0.x, c0.y); await ev(() => nomad.step(2)); await page.mouse.click(a.x, a.y); await ev(() => nomad.step(2));
v = await ev(() => SC().hud.build.state());
check('Klick, Klick: zweite Kette über die Containerfront', v.lights.length === 2 && v.lights.includes('1:0-1:1'), v.lights);
await shot('build');
sp = await ev(() => SC().hud.build.spots());
await page.mouse.click(sp.wires[0].x, sp.wires[0].y); await ev(() => nomad.step(2));
v = await ev(() => SC().hud.build.state());
check('Klick auf die Mitte: Kette abgenommen, halber Preis zurück', v.lights.length === 1 && v.deltas === 450 + 12, v);
await ev(() => { SC().hud.build.close(); nomad.step(60); nomad.save().hour = 23; SC().goCamp({}); nomad.step(40); });
v = await ev(() => { const c = SC().camp; return { lights: nomad.save().rig.lights, bulbs: c.bulbs.map(b => +b.alpha.toFixed(2)), flies: c.flies.length, lightK: c.lightK }; });
check('Nachts: Lichterkette bleibt im Spielstand und leuchtet, Glühwürmchen ums Feuer', v.lights.length === 1 && v.bulbs.length && v.bulbs.every(x => x > 0.2) && v.flies > 0, v);
await shot('night');

// the Tankstelle: a raider from the kit instead of the code-drawn crawler
v = await ev(() => game.scene.getScene('play').data_.pois.tankstelle_km7.enemies.map(e => [e, game.scene.getScene('play').data_.enemies[e].kit || null]));
check('Tankstelle: Streuner aus dem Plünderer-Bausatz statt Kriecher', v.some(([e, k]) => e === 'streuner' && k === 'raider') && !v.some(([e]) => e === 'kriecher'), v);

await browser.close();
for (const n of ok) console.log('  ok  ', n);
for (const e of errors) console.log('  FEHLER', e);
console.log(errors.length ? `\n${errors.length} Fehler` : `\nCamp-Paket: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
