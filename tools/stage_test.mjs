// Info-Center, Bühne (#129): nothing lies on top of something else. A hint waits while a window is open and comes after closing,
// warnings come at once, the Now-Playing tape steps aside while a window or the build mode is open, notes in build mode stay below its bar.
// Run: node tools/stage_test.mjs   (server on :8766)
import { chromium } from 'playwright';

const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [], pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
const check = (name, cond, info) => { (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`); console.log((cond ? '  ok   ' : '  FEHL ') + name); };
const ev = f => page.evaluate(f);
await page.goto(base + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(30); window.SC = () => game.scene.getScene('play'); });
const toasts = () => ev(() => [...document.querySelectorAll('.hud-toast:not(.out)')].map(t => t._title));

// a window open: a hint waits, a warning comes at once
await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(6); });
let v = await ev(() => { const h = SC().hud; h.toast('Stage-Hinweis', 'wartet', 'info'); h.toast('Stage-Warnung', 'sofort', 'warn'); nomad.step(2); return { quiet: document.body.classList.contains('ng-quiet'), inv: !!h.inv?.isOpen }; });
let t = await toasts();
check('Fenster offen: Hinweis wartet, Warnung kommt sofort, Kassette tritt zur Seite', v.inv && v.quiet && t.includes('Stage-Warnung') && !t.includes('Stage-Hinweis'), { v, t });
await ev(() => { SC().hud.inv.close(); nomad.step(4); });
await page.waitForTimeout(1600);
await ev(() => nomad.step(2));
t = await toasts();
v = await ev(() => document.body.classList.contains('ng-quiet'));
check('Fenster zu: der wartende Hinweis kommt, Kassette darf wieder', t.includes('Stage-Hinweis') && !v, { t, quiet: v });

// #129 the announcement (banner) waits too while a window is open: the welcome never lies over the map
await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(6); SC().hud.banner('Stage-Ansage', 'groß oben rechts'); nomad.step(2); });
t = await toasts();
v = await ev(() => !!SC().hud.inv?.isOpen);
check('Fenster offen: die große Ansage wartet', v && !t.includes('Stage-Ansage'), { v, t });
await ev(() => { SC().hud.inv.close(); nomad.step(4); });
await page.waitForTimeout(1600);
await ev(() => nomad.step(2));
v = await ev(() => ({ t: [...document.querySelectorAll('.hud-toast.banner:not(.out)')].map(x => x._title), text: SC().hud.bannerText() }));
check('Fenster zu: die Ansage kommt als großer Toast', v.t.includes('Stage-Ansage') && /Stage-Ansage/.test(v.text || ''), v);

// build mode: notes below the build bar
await ev(() => { SC().box.save.deltas = 500; SC().openBuild(); nomad.step(20); SC().hud.toast('Stage-Bau', 'unter der Leiste', 'warn'); nomad.step(2); });
await page.waitForTimeout(300);
v = await ev(() => { const bar = document.querySelector('.bm-bar')?.getBoundingClientRect(), all = [...document.querySelectorAll('.hud-toast:not(.out)')].map(x => x.getBoundingClientRect()), n = all.length ? { top: Math.min(...all.map(r => r.top)), bottom: Math.max(...all.map(r => r.bottom)) } : null; return { bar: bar && [bar.top, bar.bottom], note: n && [n.top, n.bottom], count: all.length, quiet: document.body.classList.contains('ng-quiet') }; });
check('Bau-Modus: alle Meldungen unter der Bau-Leiste, Kassette weg', v.bar && v.note && v.note[0] >= v.bar[1] - 1 && v.quiet, v);
v = await ev(() => { const h = SC().hud, sv = SC().box.save, n0 = sv.journal.length; h.toast('Stage-Kein-Platz', '', 'warn'); h.toast('Stage-Eingebaut', '', 'good'); window.dispatchEvent(new CustomEvent('ng-journal', { detail: { title: '♪ Baulied', cat: 'radio' } })); return sv.journal.slice(n0).map(e => e.title); });
check('Bau-Modus: nur Erfolge und Radio-Titel ins Logbuch', v.join() === 'Stage-Eingebaut,♪ Baulied', v);
await page.screenshot({ path: 'output/stage_build.png' });

check('Keine Fehler auf der Seite', !pageErrors.length, pageErrors);
await browser.close();
console.log(errors.length ? `\nFehler:\n${errors.join('\n')}` : `\nBühne ok: ${ok.length} Prüfungen.`);
process.exit(errors.length ? 1 : 0);
