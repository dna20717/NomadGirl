#!/usr/bin/env node
// The drive in scene (#053, Daniel 18.11.2026: „wie bei Keep Driving“): Hinfahren opens the drive with the camp's rig as a picture, the
// clock and fuel run with the leg, a forced incident comes into view by the road, the rig stops, the incident's window lies over the drive,
// after the choice it drives on, at the end the camp at the new place. Esc skips to the next stop, holding E goes faster, the controller
// does the same; without showDrive (remote control) the drive is skipped as before. The workshop shows a drive preview under Reisen.
//   node tools/drive_test.mjs [--shots]   (server: npm run serve; images → output/drive_*.png)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/drive_${n}.png` }); };
const until = async (fn, a, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, a)) return true; await page.waitForTimeout(150); } return false; };

await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.setPad = (press = []) => pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; });
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(20); window.SC = () => game.scene.getScene('play'); });

// remote control without showDrive: as before, straight there
let v = await ev(() => { const s = SC(), mp = s.hud.map; nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const to = nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.step(40);
  return { to, here: nomad.save().location, drive: s.hud.drive?.isOpen }; });
check('Fernsteuerung ohne showDrive: sofort da, keine Fahrt-Szene', v.here === v.to && !v.drive, v);

// with the scene: a short leg (4 s), a forced Straßensperre, at dusk
const start = await ev(() => { const s = SC(); nomad.release?.(); s.data_.travel.drive.seconds = 4; s.showDrive = true; s.forceEncounter = 'strassensperre'; s.box.save.hour = 18.4; s.box.save.deltas = 500;
  nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, to = nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.release?.();
  return { to, from: nomad.save().location, fuel: nomad.save().fuel }; });
await until(() => SC().hud.drive?.isOpen && SC().hud.drive.state().leg === 0);
v = await ev(() => ({ st: SC().hud.drive.state(), top: document.querySelector('.dv-where')?.textContent || '', stats: document.querySelector('.dv-stats')?.textContent || '', foot: getComputedStyle(document.querySelector('.hud-foot')).visibility, w: SC().hud.drive.rig?.w, wheels: SC().hud.drive.rig?.wheels.length }));
check('Hinfahren öffnet die Fahrt: Rig als Bild (mit Rädern), Kopfzeile von → nach, Uhr und Sprit', v.st.open && v.st.rig && v.w > 200 && v.wheels >= 2 && /→/.test(v.top) && /Tag \d+ · \d\d:\d\d/.test(v.stats) && /l/.test(v.stats), v);
check('Die Spiel-HUD-Leiste ist während der Fahrt verborgen', v.foot === 'hidden', v);
await page.waitForTimeout(900); await shot('road');
// hold E: faster
const t1 = (await ev(() => SC().hud.drive.state())).time;
await page.keyboard.down('e'); await page.waitForTimeout(700); await page.keyboard.up('e');
const t2 = (await ev(() => SC().hud.drive.state())).time;
await page.waitForTimeout(700);
const t3 = (await ev(() => SC().hud.drive.state())).time;
check('E halten spult vor (schneller als ohne)', t2 - t1 > (t3 - t2) * 1.8 || (await ev(() => SC().hud.drive.state())).phase === 'stop', { t1, t2, t3 });
// the incident: comes into view, the rig stops, the window opens over the drive
const stopped = await until(() => SC().hud.modal && SC().hud.drive.state().phase === 'stop', null, 40000);
v = await ev(() => ({ st: SC().hud.drive.state(), title: document.querySelector('.hud-menu h2')?.textContent, say: document.querySelector('.dv-say')?.textContent || '', z: [...document.querySelector('#hud, .hud')?.children || []].indexOf(document.querySelector('.dv')) < [...document.querySelector('#hud, .hud')?.children || []].indexOf(document.querySelector('.hud-menu')) }));
check('Zwischenfall am Straßenrand: Rig hält, Fenster „Straßensperre“ liegt über der Fahrt', stopped && v.st.stop === 'barrier' && v.st.v === 0 && v.title === 'Straßensperre' && v.z, v);
await shot('stop');
v = await ev(() => { SC().hud.choose(0); return { modal: SC().hud.modal, phase: SC().hud.drive.state().phase, deltas: nomad.save().deltas }; });
check('Wegzoll zahlen: Fenster zu, das Rig fährt weiter', !v.modal && v.phase === 'drive' && v.deltas < 500, v);
await until(() => !SC().hud.drive?.isOpen && /Angekommen/.test(nomad.state().banner || ''), null, 40000);
v = await ev(([to]) => ({ here: nomad.save().location, to, open: SC().hud.drive?.isOpen, banner: nomad.state().banner, cam: SC().cameras.main.visible }), [start.to]);
check('Ankunft: Fahrt schließt, Camp am Zielort mit „Angekommen“, Kamera wieder sichtbar', v.here === v.to && !v.open && /Angekommen/.test(v.banner || '') && v.cam, v);

// Esc skips to the stop (a breakdown at noon), the controller's B too
await ev(() => { const s = SC(); s.data_.travel.drive.seconds = 30; s.showDrive = true; s.forceEncounter = 'panne'; s.box.save.hour = 12;
  nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, to = nomad.map().near.find(n => n !== nomad.save().location) || nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.release?.(); });
await until(() => SC().hud.drive?.isOpen && SC().hud.drive.state().leg === 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
v = await ev(() => ({ ...SC().hud.drive.state(), paused: SC().hud.paused }));
check('Esc springt zum Halt am Zwischenfall (Rest der Etappe übersprungen)', v.time > 15 && v.stop === 'breakdown' && !v.paused, v);
await until(() => SC().hud.modal, null, 30000);
await shot('breakdown');
await ev(() => SC().hud.closeMenu());   // closing takes the first choice that works (Panne: the spare part may be missing)
await page.waitForTimeout(300);
v = await ev(() => { const h = SC().hud, modal = h.modal; setPad([1]); nomad.step(2); setPad([]); nomad.step(2); return { ...h.drive.state(), modal }; });
check('B am Controller springt ans Ende der Etappe', !v.modal && (!v.open || v.phase === 'out' || v.time >= 29.9 || v.leg === null), v);
await until(() => !SC().hud.drive?.isOpen, null, 30000);

// #054: an incident from the Ereignis-Baukasten (forced: Lagerfeuer at night): the campfire by the road, two people, the window with its options
await ev(() => { const s = SC(); s.data_.travel.drive.seconds = 4; s.showDrive = true; s.forceEncounter = 'gen:lagerfeuer'; s.box.save.hour = 22;
  nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, to = nomad.map().near.find(n => n !== nomad.save().location) || nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.release?.(); });
await until(() => SC().hud.modal && SC().hud.drive?.state().phase === 'stop', null, 40000);
v = await ev(() => ({ st: SC().hud.drive.state(), cast: SC().hud.drive.st.stop?.cast?.length || 0, title: document.querySelector('.hud-menu h2')?.textContent || '', items: [...document.querySelectorAll('.hud-menu .hud-item b')].map(b => b.textContent) }));
check('Gewürfelter Zwischenfall: Lagerfeuer am Rand, zwei Figuren, Titel und Antworten aus dem Baukasten', v.st.stop === 'campfire' && v.cast === 2 && /Lagerfeuer|Nomaden/.test(v.title) && v.items.length >= 2 && v.items.some(t => /Weiter/.test(t)), v);
await shot('campfire');
await ev(() => SC().hud.closeMenu());
await until(() => !SC().hud.drive?.isOpen, null, 30000);

// #055: Ruf. At the gang's place with Ruf „Freund“ the forced zollstation does not happen there … the generator gives „Freie Fahrt“;
// the map shows the gang and the Ruf; giant billboards stand by the road; a story (Fehde) goes on on the next drive
v = await ev(() => { const s = SC(), save = nomad.save(), mp = s.hud.map; nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3);
  const near = nomad.map().near, gangOf = id => { const n = save.map.nodes.find(x => x.id === id); return s.data_.pois?.[n?.poi]?.gang?.name || null; };
  const to = near.find(id => gangOf(id)) || near[0], g = gangOf(to); save.rep = { ...(save.rep || {}), [g]: 90 }; mp.select(to);
  return { to, g, rep: document.querySelector('.wm-rep')?.textContent || '' }; });
check('Reisekarte: Revier der Gang mit Ruf „Freund (+90)“', v.g && v.rep.includes(v.g) && /Freund \(\+90\)/.test(v.rep), v);
const toG = v;
await ev(() => { const s = SC(); s.data_.travel.drive.seconds = 4; s.showDrive = true; s.forceEncounter = 'gen:freie_fahrt'; s.box.save.hour = 21; for (const l of s.data_.travel.landscapes) l.screens = 100;
  document.querySelector('.wm-go').click(); nomad.release?.(); });
await until(() => SC().hud.drive?.isOpen && SC().hud.drive.road?.screens?.length > 0, null, 30000);
await page.waitForTimeout(1200); await shot('billboards');
v = await ev(() => ({ screens: SC().hud.drive.road.screens.length, brand: SC().hud.drive.road.screens[0]?.brand?.name, lines: SC().hud.drive.road.screens[0]?.brand?.lines.length }));
check('Riesen-Billboards mit Werbung der Marken stehen in der Landschaft', v.screens >= 1 && v.brand && v.lines >= 1, v);
await until(() => SC().hud.modal, null, 40000);
v = await ev(() => ({ title: document.querySelector('.hud-menu h2')?.textContent || '', items: [...document.querySelectorAll('.hud-menu .hud-item b')].map(b => b.textContent) }));
check('Freund der Gang: Freie Fahrt statt Wegzoll, keine Kampf-Antworten', /Freie Fahrt|Bekannte Gesichter/.test(v.title) && !v.items.some(t => /Durchbrechen|kämpfen|Gas geben/.test(t)), v);
await ev(() => SC().hud.choose(0));
await until(() => !SC().hud.drive?.isOpen, null, 30000);
// a story: Fehde over two drives
await ev(() => { const s = SC(); s.forceEncounter = 'gen:fehde1'; nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, to = nomad.map().near.find(n => n !== nomad.save().location) || nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.release?.(); });
await until(() => SC().hud.modal, null, 40000);
v = await ev(() => { const items = [...document.querySelectorAll('.hud-menu .hud-item b')].map(b => b.textContent); SC().hud.choose(0); return { items, chain: nomad.save().road?.chain }; });
check('Fehde: Partei ergreifen startet eine Geschichte (nächster Schritt gemerkt)', v.chain?.step === 'fehde2' && v.items.length >= 3, v);
await until(() => !SC().hud.drive?.isOpen, null, 30000);
await ev(() => { const s = SC(); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, to = nomad.map().near.find(n => n !== nomad.save().location) || nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.release?.(); });
await until(() => SC().hud.modal, null, 40000);
v = await ev(() => ({ title: document.querySelector('.hud-menu h2')?.textContent || '', chain: nomad.save().road?.chain }));
check('Nächste Fahrt: die Geschichte geht weiter („Die Rache der …“)', /Rache/.test(v.title), v);
await ev(() => SC().hud.closeMenu());
await until(() => !SC().hud.drive?.isOpen, null, 30000);

// workshop: Reisen › Fahrt-Vorschau
await page.goto('http://localhost:8766/workshop.html');
await page.waitForFunction(() => window.workshop?.p && !document.querySelector('#load.loading-on'), null, { timeout: 30000 });
await ev(() => workshop.go({ area: 'travel' }));
await page.waitForTimeout(1200);
v = await ev(() => { const h = [...document.querySelectorAll('h2, h3, .ed-section-title, summary')].map(x => x.textContent); const c = [...document.querySelectorAll('canvas')].find(x => x.width === 960 && x.height === 540);
  let lit = 0; if (c) { const d = c.getContext('2d').getImageData(0, 0, 960, 540).data; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; }
  return { pre: /Fahrt-Vorschau/.test(document.body.textContent), canvas: !!c, lit, fields: h.some(t => /Landschaften/.test(t)) }; });
check('Werkstatt › Reisen: Fahrt-Vorschau läuft, Abschnitt Landschaften da', v.pre && v.canvas && v.lit > 100 && v.fields, v);
await ev(() => workshop.go({ area: 'roadEvents' }));
await page.waitForTimeout(500);
v = await ev(() => ({ pre: /Gewürfelte Zwischenfälle/.test(document.body.textContent), cards: [...document.querySelectorAll('ul')].filter(u => u.closest('div')?.querySelector('b')).length, sections: ['Lagen', 'Stimmungen', 'Antworten', 'Wörter'].every(t => document.body.textContent.includes(t)) }));
check('Werkstatt › Ereignis-Baukasten: Lagen, Stimmungen, Antworten, Wörter und sechs gewürfelte Zwischenfälle', v.pre && v.cards >= 6 && v.sections, v);
if (shots) await page.screenshot({ path: 'output/drive_workshop.png', fullPage: false });

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Fahrt: ${ok.length} Prüfungen grün`);
await browser.close();
