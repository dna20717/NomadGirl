// Werte (#091 → #104, Daniel 19.11.2026: „Das wäre als Abschnitt des Inventars sinnvoller. Bitte sauber dort aufbauen“): U opens the
// inventory on Leyla › Werte, every value as Grundwert + Boni = Ergebnis with its sources, camp and tank below, the pause menu entry,
// U again closes.   node tools/stats_test.mjs [--shots]   (server: npm run serve)
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 700)}`);
const ev = (f, a) => page.evaluate(f, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: `output/stats_${n}.png` }); };

await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && game.scene.getScene('play')?.camp && game.scene.getScene('play').hud.inv, null, { timeout: 60000 });
await ev(() => { nomad.take(); nomad.step(10); window.SC = () => game.scene.getScene('play'); window.INV = () => SC().hud.inv; SC().hud.tutorial?.setSessionOff?.(true);
  const w = nomad.save().inv.wear ??= {}; w.armor = 'plattentraeger'; w.eyes = 'nachtsicht_optik'; nomad.save().buffs = ['satt']; SC().applyGear(); nomad.release(); });
await page.keyboard.press('u'); await page.waitForTimeout(300);
const read = () => ev(() => ({ open: INV().isOpen, view: INV().view, tab: document.querySelector('.inv-tab.on')?.dataset.tab, rows: [...document.querySelectorAll('.inv-val')].map(r => r.textContent), text: document.querySelector('.inv-values')?.textContent || '' }));
let v = await read();
check('U öffnet das Inventar auf Leyla › Werte', v.open && v.view === 'stats' && v.tab === 'stats', v);
const life = v.rows.find(t => t.startsWith('Leben')) || '';
const m = /^Leben100 LP\+(\d+) LP(\d+) LP/.exec(life);
check('Leben: Grundwert 100 LP + Boni = Ergebnis (Plattenträger und Satt)', m && +m[2] === 100 + +m[1] && /Plattenträger/.test(life) && /Satt/.test(life), life);
const def = v.rows.find(t => t.startsWith('Abwehr')) || '';
check('Abwehr mit Quelle Plattenträger: Grund 0 %, Boni, Ergebnis', /^Abwehr0 %\+\d/.test(def) && /Plattenträger/.test(def), def);
check('Nachtsicht-Optik und der Buff fürs nächste Mal stehen als Quellen da', /Nachtsicht/i.test(v.text) && /nächster Run/.test(v.text), v.text.slice(0, 300));
check('Malus steht rot (Tempo)', await ev(() => !!document.querySelector('.inv-val.down')), {});
await shot('values');
await page.keyboard.press('u'); await page.waitForTimeout(200);
check('U nochmal schließt', !(await ev(() => INV().isOpen)));
v = await ev(() => { SC().hud.pauseMenu(); const items = (SC().hud.menuItems || []).map(x => x.label); nomad.choose('Werte'); return items; });
await page.waitForTimeout(250);
check('Pause-Menü › Werte öffnet dieselbe Ansicht', v.includes('Werte') && (await read()).view === 'stats' && await ev(() => INV().isOpen), v);
await ev(() => document.querySelector('.inv-tab[data-tab="gear"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
await page.waitForTimeout(150);
check('Reiter Ausrüstung bringt die Puppe zurück', await ev(() => !!document.querySelector('.inv-doll') && !document.querySelector('.inv-values')));

await browser.close();
console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); process.exit(1); }
console.log(`Werte: ${ok.length} Prüfungen grün`);
