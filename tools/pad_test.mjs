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
const tap = async button => { await ev(b => { setPad({ press: [b] }); nomad.step(2); setPad(); nomad.step(2); }, button); };
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/pad_${n}.png` }); };
const sc = () => ev(() => { const s = game.scene.getScene('play'); return { paused: s.hud.paused, x: s.leyla.x, vx: s.leyla.body.velocity.x, vy: s.leyla.body.velocity.y, feet: s.leyla.feet, prompt: s.hud.promptText, key: document.querySelector('.hud-prompt kbd')?.textContent, menu: s.hud.menuState(), focus: s.hud.menuIndex, help: document.querySelector('.hud-padhelp')?.textContent || '', helpHidden: document.querySelector('.hud-padhelp')?.hidden }; });

await page.waitForTimeout(800);   // the help is open at the start; real frames until nomad.take (which closes the help itself)
let s = await sc();
check('Hilfe zeigt die Controller-Belegung (Xbox-Symbole)', s.paused && !s.helpHidden && /Controller/.test(s.help) && s.help.includes('ASpringen') && s.help.includes('RTSchießen'), s.help);
await shot('help');
await ev(() => setPad({ press: [0] })); await page.waitForTimeout(700); await ev(() => setPad()); await page.waitForTimeout(400);
s = await sc();
check('A schließt die Hilfe', !s.paused, s);
await ev(() => nomad.take());

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

// Y = E at the van, with the controller's label; menus with d-pad, A and B
await ev(() => nomad.goTo('Van'));
await tap(5);   // controller in use again (RB = reload, does nothing in the camp)
s = await sc();
check('Hinweis zeigt die Controller-Taste (Y statt E)', s.prompt === 'Einsteigen · Van' && s.key === 'Y', s);
await tap(3);
s = await sc();
check('Y öffnet das Van-Menü', s.menu?.items.some(i => i.label.startsWith('Planen')), s.menu);
await shot('menu');
await tap(13);
s = await sc();
check('Steuerkreuz runter wählt den nächsten Eintrag', s.focus === 1, s.focus);
await tap(1);
s = await sc();
check('B schließt das Menü', !s.menu, s.menu);
await tap(3); await tap(13); await tap(0);
s = await sc();
check('A nimmt den Eintrag (Warroom)', s.menu?.title === 'Warroom', s.menu);
await tap(1);

// PlayStation symbols
await ev(() => setPad({ id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)' }));
await tap(5);
s = await sc();
check('PlayStation: Hinweis zeigt △', s.key === '△', s.key);

// the keyboard still works
await ev(() => nomad.release());
await page.keyboard.down('d'); await page.waitForTimeout(1500); s = await sc(); await page.keyboard.up('d');
check('Tastatur geht weiter', Math.abs(s.vx) > 50 && !s.menu, s);

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
