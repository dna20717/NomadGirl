// Headless check of the controller support (game/play/pad.js) with a fake gamepad (navigator.getGamepads):
// help shows the buttons, A closes it, stick runs, half tilt walks, A jumps, Y = E with its label in the prompt,
// menus with d-pad, A and B, PlayStation symbols. nomad.step drives the frames, the fake controller adds to it like a real one.
// Server must run (npm run serve).   node tools/pad_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.__pad = pad;
  window.setPad = ({ press = [], axes = [0, 0], id } = {}) => {
    pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; });
    pad.axes = [...axes, 0, 0];
    if (id) pad.id = id;
  };
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const step = n => ev(k => nomad.step(k), n);
// Benutzen (Daniel, 12.11.2026, 3a): left stick flicked up, counts while an E prompt is on screen
const flick = async () => { await ev(() => { setPad({ axes: [0, -1] }); nomad.step(2); setPad(); nomad.step(2); }); };
const tap = async button => { await ev(b => { setPad({ press: [b] }); nomad.step(2); setPad(); nomad.step(2); }, button); };
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/pad_${n}.png` }); };
const sc = () => ev(() => { const s = game.scene.getScene('play'); return { paused: s.hud.paused, x: s.leyla.x, vx: s.leyla.body.velocity.x, vy: s.leyla.body.velocity.y, feet: s.leyla.feet, prompt: s.hud.promptText, key: document.querySelector('.hud-prompt kbd')?.textContent, icon: document.querySelector('.hud-prompt .pad-ico')?.dataset.icon || null, menuIcons: [...document.querySelectorAll('.hud-menu .ui-hints .pad-ico')].map(e => e.dataset.icon), helpIcons: [...document.querySelectorAll('.hud-padhelp .pad-ico')].map(e => e.dataset.icon), keysHidden: getComputedStyle(document.querySelector('.hud-keyhelp')).display === 'none', menu: s.hud.menuState(), focus: s.hud.menuIndex, help: document.querySelector('.hud-padhelp')?.textContent || '', helpHidden: document.querySelector('.hud-padhelp')?.hidden, panel: !document.querySelector('.hud-help').hidden }; });

await page.waitForTimeout(800);
let s = await sc();
check('Steuerung beim Start versteckt (Daniel: nur im Menü)', !s.paused && !s.panel && !s.menu, s);
await ev(() => nomad.take());
// Start opens the pause menu, d-pad down + A opens the controls
await tap(9);
s = await sc();
check('Start öffnet das Menü mit „Steuerung“', s.menu?.title === 'Pause' && s.menu.items.some(i => i.label === 'Steuerung'), s.menu);
await tap(13); await tap(0);
s = await sc();
check('Hilfe zeigt die Controller-Belegung mit Xbox-Symbolen', s.paused && !s.helpHidden && /Controller · Xbox/.test(s.help) && s.helpIcons.includes('xbox_0') && s.helpIcons.includes('xbox_7') && s.helpIcons.includes('xbox_stick'), s);
await shot('help_xbox');
await tap(0);
s = await sc();
check('A schließt die Hilfe', !s.paused, s);

// stick: full tilt runs, half tilt walks
const x0 = (await sc()).x;
await ev(() => setPad({ axes: [1, 0] })); await step(50);
s = await sc(); const run = Math.abs(s.vx);
await ev(() => setPad()); await step(60);
check('Stick nach rechts: Leyla rennt', s.x > x0 + 100 && run > 400, { x0, x: s.x, run });
await ev(() => setPad({ axes: [-0.5, 0] })); await step(50);
s = await sc(); const walk = Math.abs(s.vx);
await ev(() => setPad()); await step(60);
check('Stick halb geneigt: Leyla geht', walk > 50 && walk < run * 0.7, { walk, run });

// A jumps
const f0 = (await sc()).feet;
await ev(() => setPad({ press: [0] })); await step(8);
s = await sc();
await ev(() => setPad()); await step(80);
check('A springt', s.feet < f0 - 20 || s.vy < -200, { f0, feet: s.feet, vy: s.vy });

// stick up = E at the van, with the controller's symbol; menus with d-pad, A and B (one grammar for all windows)
await ev(() => nomad.goTo('Van'));
await tap(5);   // controller in use again (RB = reload, does nothing in the camp)
s = await sc();
check('Hinweis zeigt das Symbol der Controller-Taste (Stick statt E)', s.prompt === 'Einsteigen · Van' && s.icon === 'xbox_stick', s);
await shot('prompt_xbox');
await flick();
s = await sc();
check('Stick hoch öffnet das Van-Menü', s.menu?.items.some(i => i.label.startsWith('Planen')), s.menu);
check('Menü-Fußzeile mit Symbolen: Steuerkreuz, A, B', s.menuIcons.join() === 'xbox_dpad,xbox_0,xbox_1', s.menuIcons);
await shot('menu');
await tap(13);
s = await sc();
check('Steuerkreuz runter wählt den nächsten Eintrag', s.focus === 1, s.focus);
await tap(1);
s = await sc();
check('B schließt das Menü', !s.menu, s.menu);
await flick(); await tap(13); await tap(0);
s = await sc();
check('A nimmt den Eintrag (Warroom)', s.menu?.title === 'Warroom', s.menu);
await tap(1);

// PlayStation symbols
await ev(() => setPad({ id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)' }));
await tap(5);
s = await sc();
check('PlayStation: Hinweis zeigt den Stick', s.icon === 'ps_stick', s.icon);
await ev(() => { nomad.step(1, [], ['controls']); nomad.step(2); });
s = await sc();
check('PlayStation: Hilfe mit ✕ ○ □ △, L2/R2, Tastenliste ausgeblendet', /Controller · PlayStation/.test(s.help) && ['ps_0', 'ps_7'].every(i => s.helpIcons.includes(i)) && s.keysHidden === true, s);
await shot('help_ps');
await ev(() => { nomad.step(1, [], ['controls']); nomad.step(2); });
await ev(() => setPad({ id: 'Google LLC Stadia Controller rev. A (STANDARD GAMEPAD Vendor: 18d1 Product: 9400)' }));
await tap(5);
s = await sc();
check('Stadia: Hinweis und Hilfe mit Stadia-Symbolen', s.icon === 'stadia_stick' && /Controller · Stadia/.test(s.help), { icon: s.icon, help: s.help.slice(0, 40) });
await shot('prompt_stadia');
await ev(() => setPad({ id: 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)' }));
await tap(5);
s = await sc();
check('Switch: Benutzen = Stick hoch', s.icon === 'switch_stick', s.icon);

// inventory with the controller, no pointer (Daniel, 11.11.2026): a cursor on cells, slots and tabs
await ev(() => setPad({ id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)' }));
await ev(() => { const s = game.scene.getScene('play'), inv = s.box.save.inv, g = inv.grids.backpack; g.items = g.items.filter(e => !(e.x < 3 && e.y < 2)); g.items.push({ a: 'items', id: 'schrottplatte', n: 1, x: 0, y: 0, r: 0 }); });
await tap(8);
const iv = () => ev(() => { const u = game.scene.getScene('play').hud.inv, c = document.querySelector('.inv-cursor'), g = game.scene.getScene('play').box.save.inv.grids.backpack;
  const e = g.items.find(x => x.id === 'schrottplatte'); return { open: u.isOpen, cursor: !c.hidden, focus: u.focusId, held: u.held?.e.id || null, at: e ? [e.x, e.y] : null, x: game.scene.getScene('play').leyla.x }; });
s = await iv();
check('Inventar: Select öffnet, Cursor auf dem Rucksack', s.open && s.cursor && /^cell:backpack:0:0$/.test(s.focus), s);
const lx = s.x;
await tap(0); s = await iv();
check('Inventar: A nimmt die Sache am Cursor', s.held === 'schrottplatte', s);
await tap(15); await tap(13); s = await iv();
check('Inventar: Steuerkreuz bewegt den Cursor, Leyla bleibt stehen', s.focus === 'cell:backpack:1:1' && Math.abs(s.x - lx) < 2, s);
await tap(0); s = await iv();
check('Inventar: A legt am Cursor ab', !s.held && s.at?.[0] === 1 && s.at?.[1] === 1, s);
for (let i = 0; i < 12; i++) await tap(15);
s = await iv();
check('Inventar: nach rechts geht es aus dem Raster zu Slots und Mama-Bot', /^el:/.test(s.focus) || !/backpack/.test(s.focus), s);
await shot('inventory');
await tap(1); s = await iv();
check('Inventar: B schließt', !s.open && !s.cursor, s);

// Daniel, 12.11.2026: no dead ends for the controller
// inventory: Y held = throw the thing at the cursor on the ground
await tap(8);
s = await ev(() => { const sc = game.scene.getScene('play'), cnt = () => sc.loot.piles.reduce((a, q) => a + q.grid.items.reduce((b, e) => b + e.n, 0), 0), n0 = cnt(), g = sc.box.save.inv.grids.backpack; g.items = g.items.filter(e => !(e.x < 2 && e.y < 2)); g.items.push({ a: 'items', id: 'schrottplatte', n: 1, x: 0, y: 0, r: 0 }); const b0 = g.items.length; sc.hud.inv.draw(); sc.hud.inv.focusId = 'cell:backpack:0:0'; setPad({ press: [3] }); nomad.step(40); setPad(); nomad.step(4); return { open: sc.hud.inv.isOpen, piles: cnt() - n0, bag: b0 - sc.box.save.inv.grids.backpack.items.length }; });
check('Inventar: Y halten wirft die Sache auf den Boden', s.open && s.piles === 1 && s.bag === 1, s);
// Daniel, 12.11.2026: the cursor frame takes the whole thing in its shape
s = await ev(() => { const sc = game.scene.getScene('play'), inv = sc.hud.inv, g = sc.box.save.inv.grids.backpack;
  const keep = g.items; g.items = [{ a: 'items', id: 'rohrbogen', n: 1, x: 0, y: 0, r: 0 }]; inv.draw();
  inv.focusId = 'cell:backpack:0:0'; inv.padShow(); const c = inv.cursor, d = c.querySelector('path')?.getAttribute('d') || '';
  const on = { shaped: c.classList.contains('shaped'), edges: (d.match(/M/g) || []).length };
  inv.focusId = 'cell:backpack:3:1'; inv.padShow(); const empty = !c.classList.contains('shaped'); window.__keep = keep; return { on, empty }; });
check('Inventar: Rahmen umfasst die ganze Form (Rohrbogen)', s.on.shaped && s.on.edges === 10 && s.empty, s);
await ev(() => { const sc = game.scene.getScene('play'), inv = sc.hud.inv; inv.focusId = 'cell:backpack:0:1'; inv.padShow(); });
if (shots) await page.waitForTimeout(400);
await shot('inv_shape');
await ev(() => { const sc = game.scene.getScene('play'); sc.box.save.inv.grids.backpack.items = window.__keep; sc.hud.inv.draw(); });
await tap(1);
// Select held in the camp = build the rig; cursor with stick/d-pad, RB jumps to the next part, A packs, B puts back, B finishes; Select = Rig offen/zu
s = await ev(() => { setPad({ press: [8] }); nomad.step(45); setPad(); nomad.step(40); return { build: !!game.scene.getScene('play').hud.build.active, inv: game.scene.getScene('play').hud.inv.isOpen }; });
check('Select halten im Camp öffnet Rig bauen (kein Inventar)', s.build && !s.inv, s);
const bc = () => ev(() => game.scene.getScene('play').hud.build.cursorState());
await tap(15); await tap(5);
s = await bc();
check('Bau-Modus: Cursor erscheint, RB springt zum nächsten Teil', s?.on && s.x > 0, s);
await tap(0); s = await bc();
check('Bau-Modus: A packt das Teil unter dem Cursor', !!s?.drag, s);
await tap(1); await ev(() => nomad.step(20)); s = await bc();
check('Bau-Modus: B legt es zurück', s && !s.drag, s);
s = await ev(() => { const h = game.scene.getScene('play').hud, a = h.rigOpen; setPad({ press: [8] }); nomad.step(2); setPad(); nomad.step(2); const b = h.rigOpen; setPad({ press: [8] }); nomad.step(2); setPad(); nomad.step(2); return { a, b, c: h.rigOpen, label: document.querySelector('.bm-openbtn')?.textContent }; });
check('Bau-Modus: Select schaltet Rig offen/zu', s.a !== s.b && s.c === s.a && /Rig (offen|zu)/.test(s.label), s);
await tap(3); s = await bc();
check('Bau-Modus: Y öffnet den Händler', s?.shop, s);
await tap(1); s = await bc();
check('Bau-Modus: B schließt den Händler', s && !s.shop, s);
await tap(1); await ev(() => nomad.step(60));
s = await ev(() => !!game.scene.getScene('play').hud.build.active);
check('Bau-Modus: B ist fertig', !s, s);
// a new game asks in the game's own menu
s = await ev(() => { const h = game.scene.getScene('play').hud; h.confirmNew(); return h.menuState(); });
check('Neues Spiel fragt im Spiel-Menü (kein Browser-Fenster)', s?.title === 'Neues Spiel?' && s.items.length === 2, s);
await tap(1);
s = await ev(() => game.scene.getScene('play').hud.menuState());
check('Neues Spiel: B bricht ab', !s, s);

// the keyboard still works
// right stick pulls Mama-Bot like on a rubber band (Daniel, 12.11.2026): full stick goes far, half stick more than half as far (it gets heavier outside), release = back
s = await ev(() => { const sc = game.scene.getScene('play'), d = sc.drone, l = sc.leyla, off = () => Math.round(d.x - l.x);
  setPad({ axes: [0, 0, 1, 0] }); nomad.step(150); const full = off(), aim = d.aim;
  setPad({ axes: [0, 0, 0.5, 0] }); nomad.step(150); const half = off();
  setPad(); nomad.step(60); const leashed = d.leashed; nomad.step(60); return { full, half, aim, leashed, aimAfter: d.aim, reach: d.d.leash?.reach }; });
check('Rechter Stick zieht Mama-Bot am Gummiband, Licht folgt, Loslassen = zurück', s.full > s.reach * 0.7 && s.half > s.full * 0.55 && s.half < s.full && Math.abs(s.aim) < 0.05 && !s.leashed && s.aimAfter == null, s);
await ev(() => nomad.release());
await page.keyboard.down('d'); await page.waitForTimeout(1500); s = await sc(); await page.keyboard.up('d');
check('Tastatur geht weiter, Hinweis zeigt wieder E', Math.abs(s.vx) > 50 && !s.menu && s.key === 'E' && !s.icon, s);

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
