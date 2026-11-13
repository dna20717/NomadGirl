#!/usr/bin/env node
// Building the rig with the controller (#010): AvA is the pointer. d-pad hops between targets (holding: only where it fits),
// RB/LB areas with the camera, A packs / puts down, preview at the target (green / red with a reason), Y = scrapyard, Y held = sell,
// X = context menu, X held = undo, the dealer with tabs, string lights with A A, the tooltip card, the hint line per situation.
//   node tools/build_pad_test.mjs [--shots]   (server: npm run serve; images → output/buildpad_*.png)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => { (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 700)}`); if (process.env.V) console.log(cond ? 'ok' : 'FEHLER', name, cond ? '' : JSON.stringify(info).slice(0, 500)); };
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(800); await page.screenshot({ path: `output/buildpad_${n}.png` }); await ev(() => nomad.thaw()); };
await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], vibrationActuator: { effects: [], playEffect(t, o) { window.__rumble = (window.__rumble || 0) + 1; return Promise.resolve('complete'); } } };
  window.setPad = (press = [], axes = [0, 0, 0, 0]) => { pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; }); pad.axes = axes; };
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(20); window.SC = () => game.scene.getScene('play'); window.BM = () => SC().hud.build; nomad.save().deltas = 5000; });
const tap = async (b, frames = 2) => ev(([x, f]) => { setPad([x]); nomad.step(f); setPad(); nomad.step(3); }, [b, frames]);
const hold = (b, ms) => tap(b, Math.ceil(ms / 16.7) + 4);
const st = () => ev(() => ({ ...BM().cursorState(), b: BM().state(), hint: document.querySelector('.bm-hints')?.textContent || '', tip: document.querySelector('.bm-tip:not([hidden])')?.textContent || '', zoom: +SC().cam.zoom.toFixed(3) }));

// open with Select held, the first touch brings AvA over
await ev(() => { setPad([8]); nomad.step(45); setPad(); nomad.step(60); });
await tap(15);
let s = await st();
check('Bau-Modus mit Controller: AvA ist der Zeiger (kein freier Mauszeiger), Tooltip am Ziel', s.on && s.b.open && /packen|Kette|Katalog/.test(s.tip), s);
const z0 = s.zoom;

// areas
await tap(5); s = await st();
const a1 = s.area;
check('RB: nächster Bereich, die Kamera rahmt ihn', a1 !== 'all' && s.zoom !== z0, s);
let n = 0; while ((await st()).area !== 'yard' && n++ < 6) await tap(5);
s = await st();
check('RB weiter bis zum Schrottplatz', s.area === 'yard' && /Schrottplatz/.test(await ev(() => document.querySelector('.bm-area.on')?.textContent)), s);

// hop between targets with the d-pad, the hops make a little rumble
const r0 = await ev(() => window.__rumble || 0);
const p0 = await st(); await tap(15); let p1 = await st(); if (p1.x === p0.x && p1.y === p0.y) { await tap(14); p1 = await st(); }
check('Steuerkreuz: AvA hüpft zum nächsten Ziel (mit Vibration)', (p0.x !== p1.x || p0.y !== p1.y) && (await ev(() => window.__rumble || 0)) > r0, { p0, p1 });

// pack a spare workshop on the scrapyard
s = await ev(() => { const it = SC().camp.yardItems.find(x => x.kind === 'ws' && x.id === 'werkbank'); BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); return it.id; });
await tap(0); s = await st();
check('A packt die Werkbank, Hilfezeile wechselt auf „ablegen“', s.drag === 'ws' && /ablegen/.test(s.hint) && /Werkbank/.test(s.tip), s);

// LB back to everything, then hop only to places where it fits; preview at the target
await ev(() => { BM().areaNow = null; BM().frame(BM().areas()[0]); nomad.step(40); });
s = await ev(() => { const T = BM().navTargets(); return { n: T.length, labels: [...new Set(T.map(t => t.label))] }; });
check('Mit Werkbank in der Hand: Ziele nur Plätze, Schrottplatz entfällt (liegt dort), Händler', s.n >= 2 && s.labels.some(l => /Tauschen|Einbauen/.test(l)) && s.labels.some(l => /Verkaufen/.test(l)) && !s.labels.some(l => /Schrottplatz/.test(l)), s);
s = await ev(() => { const T = BM().navTargets().filter(t => /Tauschen|Einbauen/.test(t.label)); const out = []; for (const t of T) { BM().aim(t); nomad.step(2); out.push({ label: t.label, ok: BM().check?.ok !== false, reason: BM().check?.reason || null }); } return out; });
check('Vorschau am Ziel: grün wo es geht, rot mit Grund wo nicht (Cryo-Tank ist fest)', s.some(x => x.ok) && s.some(x => !x.ok && x.reason), s);
await ev(() => { const t = BM().navTargets().find(t => /Tauschen.*Kochnische/.test(t.label)) || BM().navTargets().find(t => /Tauschen|Einbauen/.test(t.label)); BM().aim(t); nomad.step(2); });
await shot('preview');
await tap(0); await ev(() => nomad.step(30));
s = await st();
check('A legt ab: Werkbank im Van, Kochnische auf dem Schrottplatz (getauscht)', !s.drag && /werkbank/.test(s.b.rig) && s.b.spare.workshops.includes('kochnische'), s.b);

// X held = undo
await hold(2, 520); await ev(() => nomad.step(10));
s = await st();
check('X halten: rückgängig', /^van\[schlafkoje@0 kochnische@1\]/.test(s.b.rig) && s.b.spare.workshops.includes('werkbank'), s.b);

// Y: with something in the claw → scrapyard; held → sell
s = await ev(() => { const sl = BM().slots().find(q => q.ui === 0 && q.p === 1); BM().aim({ x: (sl.x0 + sl.x1) / 2, y: (sl.y0 + sl.y1) / 2 }); return null; });
await tap(0); await tap(3); await ev(() => nomad.step(20));
s = await st();
check('Y antippen: das gepackte Teil auf den Schrottplatz', !s.drag && s.b.spare.workshops.includes('kochnische'), s.b);
const d0 = (await st()).b.deltas;
s = await ev(() => { const it = SC().camp.yardItems.find(x => x.kind === 'ws' && x.id === 'kochnische'); BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); });
await tap(0); await hold(3, 520); await ev(() => nomad.step(30));
s = await st();
check('Y halten: verkaufen (Ring, Δ dazu)', !s.drag && !s.b.spare.workshops.includes('kochnische') && s.b.deltas > d0, { d0, b: s.b });

// X tapped = context menu at the target
await ev(() => { const it = SC().camp.yardItems.find(x => x.kind === 'ws'); BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); });
await tap(2); s = await ev(() => ({ c: BM().cursorState().ctx, items: [...document.querySelectorAll('.bm-ctx .inv-btn')].map(b => b.textContent.trim()) }));
check('X: Kontextmenü am Ziel (Packen, Verkaufen, Händler, Rig offen, Fertig)', s.c && s.items.some(x => /Packen/.test(x)) && s.items.some(x => /Verkaufen/.test(x)) && s.items.some(x => /Fertig/.test(x)), s);
await shot('context');
await tap(1); s = await st();
check('B schließt das Kontextmenü', !s.ctx && s.b.open, s);

// the dealer: Y without anything in hand, tabs with RB, A buys onto the pad
await tap(3); s = await st();
check('Y ohne Teil: Händler', s.shop && /kaufen/.test(s.hint), s);
const tab0 = await ev(() => document.querySelector('.bm-tab.on')?.textContent);
await tap(5); const tab1 = await ev(() => document.querySelector('.bm-tab.on')?.textContent);
check('Händler: RB wechselt den Tab (Werkstätten → Anhänger)', tab0 !== tab1 && !!tab1, { tab0, tab1 });
while ((await ev(() => document.querySelector('.bm-tab.on')?.textContent)) !== 'Rig-Teile') await tap(5);
const parts0 = (await st()).b.spare.parts.length;
await tap(0); await ev(() => nomad.step(40));
s = await st();
check('Händler: A kauft, geliefert aufs Pad', s.b.spare.parts.length === parts0 + 1, s.b.spare);
await shot('shop');
await tap(1);

// string lights with A, hop, A
s = await ev(() => { const a = SC().camp.anchors()[0]; BM().aim(a); return a.id; });
await tap(0); s = await st();
check('A am Andockpunkt: Lichterkette hängt an AvA', !!s.wire && /einhängen/.test(s.hint), s);
s = await ev(() => BM().navTargets().map(t => t.label));
check('Steuerkreuz springt nur zu anderen Andockpunkten', s.length >= 1 && s.every(l => l === 'Hier einhängen'), s);
await tap(14); await tap(15); await tap(0); await ev(() => nomad.step(5));
s = await st();
check('A hängt die Kette ein', s.b.lights.length === 1 && !s.wire, s.b);

// B finishes
await tap(1); await ev(() => nomad.step(60));
check('B: fertig', !(await ev(() => BM().active)));

await browser.close();
for (const x of ok) console.log('  ok  ', x);
for (const e of errors) console.log('  FEHLER', e);
console.log(errors.length ? `\n${errors.length} Fehler` : `\nBau-Modus mit Controller: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
