#!/usr/bin/env node
// Werte-Bildschirm (#091): U opens it in the camp, four tabs (Leyla · Camp · Tank & AvA · Effekte), every value with its sources,
// gear shows up at once, pause menu entry, ←/→ switch tabs, Esc closes.   node tools/stats_test.mjs [--shots]   (server: npm run serve)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: `output/stats_${n}.png` }); };

await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && game.scene.getScene('play')?.camp && game.scene.getScene('play').hud.stats, null, { timeout: 60000 });
await ev(() => { nomad.take(); nomad.step(10); window.SC = () => game.scene.getScene('play'); window.ST = () => SC().hud.stats; SC().hud.tutorial?.setSessionOff?.(true);
  const w = nomad.save().inv.wear ??= {}; w.armor = 'plattentraeger'; w.eyes = 'nachtsicht_optik'; nomad.save().buffs = ['satt']; SC().applyGear(); nomad.release(); });
await page.keyboard.press('u'); await page.waitForTimeout(300);
let v = await ev(() => ({ ...ST().state(), text: document.querySelector('.stats-box')?.textContent || '' }));
check('U öffnet die Werte: Reiter Leyla mit Abwehr, Leben, Fernkampf und ihren Quellen', v.open && v.tab === 'leyla' && v.rows >= 3 && /Abwehr/.test(v.text) && /Plattenträger/.test(v.text) && /Nachtsicht/i.test(v.text) && /nächster Run/.test(v.text), v);
check('Malus steht rot (Tempo −3 %)', await ev(() => !!document.querySelector('.stats-row.bad')), {});
await shot('leyla');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
v = await ev(() => ST().state());
check('→: Reiter Camp', v.tab === 'camp', v);
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
v = await ev(() => ({ ...ST().state(), text: document.querySelector('.stats-box')?.textContent || '' }));
check('Effekte: der Buff „Satt“ wirkt im nächsten Run', v.tab === 'fx' && v.fx.includes('buff:satt') && /Satt/.test(v.text), v);
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
check('Esc schließt', !(await ev(() => ST().isOpen)));
v = await ev(() => { SC().hud.pauseMenu(); const items = (SC().hud.menuItems || []).map(x => x.label); nomad.choose('Werte'); return items; });
await page.waitForTimeout(150);
check('Pause-Menü › Werte öffnet den Bildschirm', v.includes('Werte') && await ev(() => ST().isOpen), v);
await ev(() => ST().close());

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Werte: ${ok.length} Prüfungen grün`);
await browser.close();
