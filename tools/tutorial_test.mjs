#!/usr/bin/env node
// Field guide (#011): a card the first time (time, prompt, window, event triggers), it pauses, keys per device, a clip plays,
// slides turn, Menü › Feldhandbuch with chapters and lessons, seen is remembered, the switch in Menü › Optionen.
//   node tools/tutorial_test.mjs [--shots]   (server: npm run serve; images → output/tutorial_*.png)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => { (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`); if (process.env.V) console.log(cond ? 'ok' : 'FEHLER', name, cond ? '' : JSON.stringify(info).slice(0, 400)); };
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(900); await page.screenshot({ path: `output/tutorial_${n}.png` }); };
await page.addInitScript(() => {
  localStorage.setItem('nomadgirl-tutorial-test', 'true');   // cards also under Playwright
  if (!sessionStorage.getItem('tut-init')) { localStorage.removeItem('nomadgirl-tutorial-seen'); localStorage.removeItem('nomadgirl-tutorial-off'); sessionStorage.setItem('tut-init', '1'); }
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.setPad = (press = []) => pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; });
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); window.SC = () => game.scene.getScene('play'); window.TU = () => SC().hud.tut; });
const tap = async b => ev(x => { setPad([x]); nomad.step(2); setPad(); nomad.step(2); }, b);

// time trigger: the first lesson of the camp after 2 s
let v = await ev(() => { nomad.step(200); return { ...TU().state(), x0: SC().leyla.x }; });
check('Camp: nach 2 s erscheint „Laufen und Gehen“ als Karte', v.open && v.view === 'card' && v.lesson === 'laufen', v);
v = await ev(() => { const x = SC().leyla.x; nomad.step(30, ['right']); const card = document.querySelector('.tut-card'); const vid = card?.querySelector('video');
  return { moved: SC().leyla.x !== x, video: vid?.getAttribute('src') || null, keys: [...card.querySelectorAll('.tut-text kbd')].map(k => k.textContent), title: card.querySelector('h2')?.textContent }; });
check('Karte pausiert das Spiel, zeigt den Clip und die Tasten', !v.moved && /tut_laufen\.webm$/.test(v.video || '') && v.keys.includes('A') && v.keys.includes('D'), v);
v = await ev(() => new Promise(r => { const vid = document.querySelector('.tut-card video'); let n = 0; const t = setInterval(() => { if (vid.readyState >= 2 || ++n > 40) { clearInterval(t); r({ ready: vid.readyState, w: vid.videoWidth, paused: vid.paused }); } }, 100); }));
check('Clip lädt und läuft in der Schleife', v.ready >= 2 && v.w >= 600, v);
await shot('card');
await page.keyboard.press('Escape');
v = await ev(() => { nomad.step(4); return { tut: TU().state(), pause: !!SC().hud.modal }; });
check('Esc schließt die Karte (kein Pause-Menü dahinter), Lektion ist gesehen', !v.tut.open && v.tut.seen.includes('laufen') && !v.pause, v);
v = await ev(() => { nomad.step(300); return TU().state(); });
check('Gleich danach keine zweite Karte (Abstand)', !v.open, v);

// a prompt: near the chest → „Die Kiste“
v = await ev(() => { nomad.goTo('Kiste'); nomad.step(20); const first = TU().state().lesson; if (first === 'feuer') { TU().close(); nomad.step(200); nomad.goTo('Kiste'); nomad.step(20); } return { ...TU().state(), first, slides: document.querySelectorAll('.tut-slide').length }; });   // on the way she passes the fire: its card first
check('Hinweis „Kiste“ sichtbar → Lektion „Die Kiste“ (Slideshow)', v.open && v.lesson === 'kiste' && v.slides === 2, v);
v = await ev(() => { const a = TU().state().slide; TU().act('right'); const b = TU().state().slide; return { a, b, src: document.querySelector('.tut-slide.on img')?.getAttribute('src') }; });
check('Slideshow blättert, Bilder aus dem Spiel', v.a === 0 && v.b === 1 && /tut_kiste_2\.webp$/.test(v.src || ''), v);
await shot('slides');

// the controller: A closes, buttons as pictures
await tap(0);
v = await ev(() => TU().state());
check('A schließt die Karte', !v.open, v);

// a window: the inventory → a lesson over it, one per opening
await tap(5);   // the controller in hand: buttons as pictures
v = await ev(() => { nomad.step(200); nomad.step(1, [], ['inventory']); nomad.step(200); return { tut: TU().state(), inv: SC().hud.inv.isOpen, imgs: document.querySelectorAll('.tut-card .pad-ico').length }; });
check('Inventar auf → Lektion „Formen und Drehen“ darüber, mit Controller-Symbolen', v.inv && v.tut.open && v.tut.lesson === 'raster' && v.imgs > 0, v);
await shot('window');
await tap(1);
v = await ev(() => { nomad.step(60); return { tut: TU().state(), inv: SC().hud.inv.isOpen }; });
check('B schließt nur die Karte, das Inventar bleibt offen, keine zweite Karte in derselben Öffnung', !v.tut.open && v.inv, v);
await ev(() => { SC().hud.inv.close(); nomad.step(10); });

// an event: AvA alarmed → „Nahkampf“
v = await ev(() => { nomad.step(200); SC().drone.react('alert'); nomad.step(200); return TU().state(); });
check('Ereignis (AvA alarmiert) → Lektion „Nahkampf“', v.open && v.lesson === 'nahkampf', v);
// „für diese Sitzung nicht mehr“ (Daniel, 14.11.2026): X toggles the checkbox on the card, then no card comes until it is off again
await tap(2);
v = await ev(() => ({ tut: TU().state(), box: !!document.querySelector('.tut-mute input')?.checked, txt: document.querySelector('.tut-mute')?.textContent || '' }));
check('Häkchen „Für diese Sitzung keine Lektionen mehr“ auf der Karte, X setzt es', v.tut.open && v.tut.sessionOff && v.box && /Sitzung/.test(v.txt), v);
await tap(1);
v = await ev(() => { nomad.step(200); SC().drone.react('kill'); nomad.step(200); const r = { ...TU().state(), keep: sessionStorage.getItem('nomadgirl-tutorial-session-off') }; TU().setSessionOff(false); TU().events.clear(); return r; });
check('Mit Häkchen kommt in dieser Sitzung keine Karte mehr (sessionStorage)', !v.open && v.sessionOff && v.keep === '1', v);

// Menü › Feldhandbuch: chapters, lessons, slides
await ev(() => { SC().hud.pauseMenu(); window.__items = SC().hud.menuState().items.map(i => i.label); nomad.choose('Feldhandbuch'); }); await page.waitForTimeout(100);
v = await ev(() => { const items = window.__items; nomad.step(4); return { items, tut: TU().state(), list: document.querySelectorAll('.tut-list li').length, tabs: document.querySelectorAll('.tut-tab').length }; });
check('Pause-Menü › Feldhandbuch: Kapitel als Tabs, Lektionen als Liste', v.items.includes('Feldhandbuch') && v.tut.view === 'guide' && v.tabs >= 8 && v.list >= 5, v);
await shot('guide');
const ch0 = v.tut.chapter;
await tap(5); await tap(13);
v = await ev(() => TU().state());
check('RB: nächstes Kapitel, ↓: nächste Lektion', v.chapter !== ch0 && v.view === 'guide' && !!v.lesson, v);
v = await ev(() => ({ n: TU().lessons.length, all: TU().lessons.every(l => l.media === 'clip' ? !!SC().data_.assets[l.clip]?.file : (l.slides || []).every(x => SC().data_.assets[x.look]?.file)) }));
check('Alle Lektionen haben ihren Clip bzw. ihre Bilder', v.n >= 45 && v.all, v);
await tap(1);
check('B schließt das Feldhandbuch', !(await ev(() => TU().isOpen)));

// Menü › Optionen: off
await ev(() => { SC().hud.pauseMenu(); nomad.choose('Optionen'); }); await page.waitForTimeout(100);
await ev(() => { window.__m = SC().hud.menuState().items.map(i => i.label); nomad.choose('Lektionen beim ersten Mal'); }); await page.waitForTimeout(100);
v = await ev(() => { SC().hud.closeMenu(); nomad.step(200); SC().drone.react('kill'); nomad.step(200); return { m: window.__m, off: TU().state().off, open: TU().isOpen }; });
check('Optionen: Lektionen abschalten, dann kommt keine Karte mehr', v.m.some(x => /Lektionen beim ersten Mal: an/.test(x)) && v.off && !v.open, v);
await ev(() => TU().setOff(false));

// #016: in the run a lesson is a tip in the corner, the game keeps running; „Mehr“ opens the card
await ev(() => { TU().setSessionOff(false); TU().events.clear(); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(4); nomad.choose('Plündern'); nomad.release(); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.mode === 'run' && s.leyla; }, null, { timeout: 40000 });
await page.waitForTimeout(800);
v = await ev(() => { nomad.take(); const r = nomad.until(() => !!TU().state().tip, 4000, []); const st = TU().state(); const x = SC().leyla.x; nomad.step(30, ['right']);
  return { tip: st.tip, open: st.open, moved: SC().leyla.x !== x, shown: !document.querySelector('.tut-tip')?.hidden, text: document.querySelector('.tut-tip b')?.textContent || '' }; });
check('Run: Lektion als Tipp in der Ecke, das Spiel läuft weiter', !!v.tip && !v.open && v.moved && v.shown && !!v.text, v);
v = await ev(() => { document.querySelector('.tut-tip-more')?.click(); nomad.step(2); return TU().state(); });
check('Tipp › „Mehr“ öffnet die volle Karte', v.open && v.view === 'card' && !v.tip, v);
await ev(() => { TU().close(); });

// the workshop shows the lessons and plays a clip
await page.goto('http://localhost:8766/workshop.html');
await page.waitForFunction(() => window.workshop?.p?.data, null, { timeout: 20000 });
v = await ev(async () => { workshop.go({ area: 'assets', choice: 'tut_laufen' }); for (let i = 0; i < 50 && !document.querySelector('.ng-sprite video'); i++) await new Promise(r => setTimeout(r, 100)); return { video: !!document.querySelector('.ng-sprite video') }; });   // #017: up to 5 s (was 0.9 s, flaky)
check('Werkstatt: Clip-Asset spielt in der Vorschau', v.video, v);
v = await ev(async () => { workshop.go({ area: 'tutorial', choice: 'kanten' }); await new Promise(r => setTimeout(r, 500)); return { txt: document.body.textContent.includes('Kanten greifen') }; });
check('Werkstatt: Bereich Lektionen', v.txt, v);

await browser.close();
for (const n of ok) console.log('  ok  ', n);
for (const e of errors) console.log('  FEHLER', e);
console.log(errors.length ? `\n${errors.length} Fehler` : `\nFeldhandbuch: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
