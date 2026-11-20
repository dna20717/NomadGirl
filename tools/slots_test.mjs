// Headless check of the three savegames (#126, docs/concepts/save_slots.md): the old savegame moves to slot 1, slots stay apart,
// a slot keeps its Datenset, the preview picture, the cockpit menu (levels, Esc / B back, delete with a dialog, the Vor-Lösch-Zustand,
// rename, copy), achievements over all slots, the pause menu „Spielstand laden“.
// Server must run (npm run serve).   node tools/slots_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.GAME_URL ? new URL('./', process.env.GAME_URL).href : 'http://localhost:8766/';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const ev = (f, a) => page.evaluate(f, a);
const shot = async n => { if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/slots_${n}.png` }); } };
const game = async q => { await page.goto(BASE + 'game.html' + q); await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 30000 }); };
const cockpit = async () => { await page.goto(BASE); await page.waitForFunction(() => window.cockpitMenu, null, { timeout: 30000 }); };
const items = () => ev(() => cockpitMenu.items());
const key = async k => { await page.keyboard.press(k); await page.waitForTimeout(250); };
const pick = async label => { const i = (await items()).findIndex(t => t.startsWith(label)); if (i < 0) throw new Error(`kein Eintrag „${label}“ in ${JSON.stringify(await items())}`); while ((await ev(() => cockpitMenu.selected())) !== i) await key('ArrowDown'); await key('Enter'); };

// 1. an old single savegame (like every browser has it before #126) moves to slot 1
await game('?camp&new');
await ev(() => {
  const s = nomad.save(), id = Object.keys(game.scene.getScene('play').data_.achievements)[0];
  s.deltas = 1234; s.achievements = { counts: { kills: 9 }, done: { [id]: { day: 1 } }, made: [] };
  for (const k of Object.keys(localStorage)) if (/^nomadgirl-(save|saves|shot|achievements|trash|slot)/.test(k)) localStorage.removeItem(k);
  localStorage.setItem('nomadgirl-save', JSON.stringify({ ...s, savedAt: 1 }));
});
await game('?camp');
let r = await ev(() => ({ d: nomad.save().deltas, old: localStorage.getItem('nomadgirl-save'), s1: !!localStorage.getItem('nomadgirl-save:1'), slot: __nomadData.slot, ach: JSON.parse(localStorage.getItem('nomadgirl-achievements') || 'null') }));
check('Alter Spielstand zieht nach Slot 1 (alter Schlüssel weg, nichts verloren)', r.d === 1234 && r.old === null && r.s1 && r.slot === 1, r);
check('Achievements des alten Stands werden global', r.ach?.counts?.kills === 9, r.ach);

// 2. a new game in slot 2 with another Datenset; slot 1 stays as it was
const sets = await ev(() => fetch('projects/nomadgirl/sets/index.json').then(x => x.ok ? x.json() : []).catch(() => []));
const setId = sets[0]?.id || '';
await ev(id => { if (id) localStorage.setItem('nomadgirl-set', id); }, setId);
await game('?camp&slot=2&new');
r = await ev(() => ({ slot: __nomadData.slot, set: __nomadData.set?.id || '', d: nomad.save().deltas, kills: nomad.save().achievements?.counts?.kills, active: localStorage.getItem('nomadgirl-slot') }));
check('Slot 2 neu: eigener Stand, Gerät merkt sich Slot 2, Achievements kommen mit', r.slot === 2 && r.d !== 1234 && r.active === '2' && r.kills === 9, r);
check('Slot 2 beginnt mit dem Datenset des Geräts', r.set === setId, { r, setId });
await ev(() => localStorage.removeItem('nomadgirl-set'));   // the device goes back to Standard …
await game('?camp&slot=2');
r = await ev(() => ({ set: __nomadData.set?.id || '' }));
check('… Slot 2 bleibt bei seinem Datenset', r.set === setId, { r, setId });
await page.waitForTimeout(5000);
await ev(() => { const sc = game.scene.getScene('play'); sc.box.save.achievements.counts.kills = 15; return sc.box.persist(true); });
await page.waitForTimeout(2500);
r = await ev(() => ({ shot: (localStorage.getItem('nomadgirl-shot:2') || '').slice(0, 15), meta: JSON.parse(localStorage.getItem('nomadgirl-saves'))[2] }));
check('Speichern im Camp: Vorschaubild und Kurzinfo für die Liste', r.shot.startsWith('data:image/') && r.meta?.day >= 1 && r.meta.name === 'Leyla 2', r);
await game('?camp&slot=1');
r = await ev(() => ({ d: nomad.save().deltas, kills: nomad.save().achievements.counts.kills }));
check('Slot 1 unberührt, Achievements aus Slot 2 gelten auch hier', r.d === 1234 && r.kills === 15, r);

// 3. the pause menu: Spielstand laden lists the slots
await ev(() => game.scene.getScene('play').hud.pauseMenu());
await page.waitForTimeout(200);
r = await ev(() => [...document.querySelectorAll('.hud-menu button, .hud-menu .hud-menu-item, .ui-menu button')].map(b => b.textContent));
check('Pause-Menü hat „Spielstand laden“', r.some(t => t.includes('Spielstand laden')), r);
await ev(() => game.scene.getScene('play').hud.loadMenu());
await page.waitForTimeout(400);
r = await ev(() => [...document.querySelectorAll('.hud-menu button, .hud-menu .hud-menu-item, .ui-menu button')].map(b => b.textContent));
check('Spielstand laden: drei Slots, der aktuelle markiert, Slot 3 leer', r.some(t => t.includes('1 · Leyla 1') && t.includes('gerade')) && r.some(t => t.includes('2 · Leyla 2')) && r.some(t => t.includes('3 · Leer')), r);
await shot('pause');

// 4. the cockpit: levels, delete with a dialog, the Vor-Lösch-Zustand, rename, copy
await cockpit();
await key('Enter');
r = await items();
check('Cockpit: „Spiel“ öffnet die Slots', (await ev(() => cockpitMenu.level())) === 2 && r[0].startsWith('1 · Leyla 1') && r[1].startsWith('2 · Leyla 2') && r[2].startsWith('3 · Leer'), r);
await page.waitForTimeout(600);
r = await ev(() => ({ hidden: document.getElementById('slotshot').hidden, name: document.querySelector('#slotshot b').textContent }));
check('Vorschau-Karte über dem Radio zeigt den gewählten Slot', !r.hidden && /Leyla/.test(r.name), r);
await shot('cockpit');
await key('Escape');
check('Esc geht eine Ebene zurück', (await ev(() => cockpitMenu.level())) === 1);
await key('Enter');
await pick('2 · Leyla 2');
r = await items();
check('Slot-Aktionen: Weiter, Umbenennen, Kopieren, Neues Spiel, Löschen', ['Weiter', 'Umbenennen', 'Kopieren', 'Neues Spiel hier', 'Löschen'].every(x => r.some(t => t.startsWith(x))), r);
await pick('Löschen');
r = await items();
check('Löschen fragt erst (Dialog, „Nein“ vorgewählt)', r[0].includes('löschen?') && r[1].startsWith('Ja, löschen') && (await ev(() => cockpitMenu.selected())) === 2, r);
await pick('Ja, löschen');
await page.waitForTimeout(400);
r = await items();
check('Gelöscht: Slot 2 leer, Eintrag zum Zurückholen', r[1].startsWith('2 · Leer') && r.some(t => t.startsWith('↺ Leyla 2') && t.includes('gelöscht')), r);
await pick('↺ Leyla 2');
await pick('Nach Slot 3');
await page.waitForTimeout(400);
r = await items();
check('Zurückgeholt nach Slot 3', r[2].startsWith('3 · Leyla 2'), r);
await pick('3 · Leyla 2'); await pick('Umbenennen');
await ev(() => { const i = document.querySelector('#lcd input.name'); i.value = 'Wüstenfuchs'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
await page.waitForTimeout(500);
r = await items();
check('Umbenennen per Tastatur', r[2].startsWith('3 · Wüstenfuchs'), r);
await pick('1 · Leyla 1'); await pick('Kopieren'); await pick('Slot 3');
r = await items();
check('Kopieren auf einen belegten Slot fragt erst', r[0].includes('überschreiben?'), r);
await pick('Ja, überschreiben');
await page.waitForTimeout(400);
r = await items();
check('Kopie in Slot 3, der überschriebene liegt im Vor-Lösch-Zustand', r[2].startsWith('3 · Leyla 1 (Kopie)') && r.some(t => t.startsWith('↺ Wüstenfuchs') && t.includes('überschrieben')), r);

// 5. stickers come from the global achievements
r = await ev(() => cockpitMenu.stickers());
check('Cockpit-Sticker aus den globalen Achievements', r >= 1, r);

// 6. with a controller: A opens the slots, B goes back
await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.press = i => { pad.buttons.forEach((b, k) => { b.pressed = k === i; b.value = k === i ? 1 : 0; }); };
  navigator.getGamepads = () => [pad, null, null, null];
});
await cockpit();
const tap = async i => { await ev(i => press(i), i); await page.waitForTimeout(250); await ev(() => press(-1)); await page.waitForTimeout(250); };
await ev(() => press(-1)); await page.waitForTimeout(300);
await tap(0);
const lvA = await ev(() => cockpitMenu.level());
await tap(1);
check('Controller: A öffnet die Slots, B geht zurück', lvA === 2 && (await ev(() => cockpitMenu.level())) === 1, { lvA });

console.log(ok.map(x => '✓ ' + x).join('\n'));
if (errors.length) console.log(errors.map(x => '✘ ' + x).join('\n'));
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
process.exit(errors.length ? 1 : 0);
