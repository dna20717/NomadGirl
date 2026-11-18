#!/usr/bin/env node
// Meldungs-Kanal und Logbuch (#070): hints wait in line while three notes are up, warnings never wait, everything is in the Logbuch.
//   node tools/logbook_test.mjs   (server: npm run serve)
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);

await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
let v = await ev(() => { nomad.take(); nomad.step(10); const h = game.scene.getScene('play').hud; [...h.toastsEl.children].forEach(t => h.dismiss(t)); return true; });
await page.waitForTimeout(600);
v = await ev(() => { const h = game.scene.getScene('play').hud, j0 = (nomad.save().journal || []).length;
  for (let i = 1; i <= 5; i++) h.toast(`Hinweis ${i}`, 'Test', 'info', 900);
  h.toast('Achtung', 'eine Warnung wartet nie', 'warn', 900);
  const live = [...h.toastsEl.children].filter(x => !x.classList.contains('out')).map(x => x._title);
  return { live, queue: (h.toastQueue || []).map(q => q[0]), journal: (nomad.save().journal || []).length - j0 }; });
check('Drei Hinweise stehen, zwei warten, die Warnung kommt sofort; alle sechs im Logbuch', v.live.length === 4 && v.live.includes('Achtung') && v.queue.join() === 'Hinweis 4,Hinweis 5' && v.journal === 6, v);
await page.waitForTimeout(3500);
v = await ev(() => { const h = game.scene.getScene('play').hud; return { queue: (h.toastQueue || []).length, seen: (h.toastLog || []).map(t => t.title).filter(t => /Hinweis [45]/.test(t)) }; });
check('Die wartenden kommen danach der Reihe nach', v.queue === 0 && v.seen.length >= 2, v);
v = await ev(() => { const h = game.scene.getScene('play').hud; h.logbook(); nomad.step(2); const items = (h.menuItems || []).map(x => x.label + ' | ' + (x.sub || '')); h.closeMenu?.(); return { items }; });
check('Menü › Logbuch: neueste zuerst, mit Uhrzeit', /^Achtung \| Tag \d+ · \d\d:\d\d · eine Warnung/.test(v.items[0] || '') && v.items.some(x => x.startsWith('Hinweis 1')), v);

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Logbuch: ${ok.length} Prüfungen grün`);
await browser.close();
