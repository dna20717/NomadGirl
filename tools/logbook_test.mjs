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
// #129 the Logbuch is the second tab of the Questlog: newest first with the time, categories, search, radio titles
v = await ev(() => { const h = game.scene.getScene('play').hud; window.dispatchEvent(new CustomEvent('ng-journal', { detail: { title: '♪ Testlied', sub: 'Rig-Radio', cat: 'radio' } }));
  h.logbook(); nomad.step(2); const q = h.quests, st = q.state(), first = document.querySelector('.lb-list li:not(.lb-day) b')?.textContent, time = document.querySelector('.lb-list li:not(.lb-day) small')?.textContent;
  return { open: q.isOpen, tab: st.tab, first, time, tabs: [...document.querySelectorAll('.ql .tut-tab')].map(b => b.textContent) }; });
check('Logbuch als zweiter Reiter im Questlog, neueste zuerst, mit Uhrzeit', v.open && v.tab === 'log' && v.tabs[1]?.startsWith('Logbuch') && v.first === '♪ Testlied' && /^\d\d:\d\d · Rig-Radio/.test(v.time || ''), v);
v = await ev(() => { const q = game.scene.getScene('play').hud.quests; q.act('context'); const a = q.state().logCat; while (q.state().logCat !== 'radio') q.act('context'); const rows = q.state().rows; q.logCat = 'all'; q.logQ = 'Warnung'; q.draw(); const found = q.state().rows; return { a, rows, found }; });
check('R schaltet die Kategorie, Radio zeigt nur Titel, Suche findet Untertitel', v.a === 'quest' && v.rows.length >= 1 && v.rows.every(r => r.startsWith('log:radio:')) && v.found.length >= 1 && v.found.every(r => r.includes('Achtung')), v);
await page.screenshot({ path: 'output/logbook.png' });
v = await ev(() => { const h = game.scene.getScene('play').hud; h.quests.logQ = ''; h.quests.logCat = 'all'; h.quests.close(); return true; });
console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Logbuch: ${ok.length} Prüfungen grün`);
await browser.close();
