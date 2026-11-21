// Info-Center, Bühne (#129): nothing lies on top of something else. A hint waits while a window is open and comes after closing,
// warnings come at once, the Now-Playing tape steps aside while a window or the build mode is open, notes in build mode stay below its bar.
// #154 the stage with zones: nothing overlaps in the concept's four situations (camp start, build mode, inventory, run); images output/stage_*.png
// Run: node tools/stage_test.mjs   (server on :8766, or GAME_URL=http://localhost:8797/game.html)
import { chromium } from 'playwright';

const base = process.env.GAME_URL || 'http://localhost:8766/game.html';
const browser = await chromium.launch();
const [vw, vh] = (process.env.STAGE_VIEW || '1600x900').split('x').map(Number);   // e.g. STAGE_VIEW=1280x720
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const errors = [], ok = [], pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
const check = (name, cond, info) => { (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`); console.log((cond ? '  ok   ' : '  FEHL ') + name); };
const ev = (f, a) => page.evaluate(f, a);
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

// #142 a keepsake for the cockpit: a small note once
v = await ev(() => { const s = SC(); ((s.box.save.achievements ??= {}).counts ??= {}).trips = 3; s.keepsakeNews(); nomad.step(120); const a = [...document.querySelectorAll('.hud-toast.keepsake')].map(x => x._title); s.keepsakeNews(); nomad.step(120); return { a, b: [...document.querySelectorAll('.hud-toast.keepsake')].length, seen: s.box.save.achievements.keepsakes }; });
check('Cockpit-Kram: kleine Meldung einmal (Sonnenbrille nach drei Fahrten)', v.a.includes('Fürs Cockpit: Sonnenbrille') && v.b === 1 && v.seen.includes('ck_sunglasses'), v);

// build mode: notes below the build bar
await ev(() => { SC().box.save.deltas = 500; SC().openBuild(); nomad.step(20); SC().hud.toast('Stage-Bau', 'unter der Leiste', 'warn'); nomad.step(2); });
await page.waitForTimeout(300);
v = await ev(() => { const bar = document.querySelector('.bm-bar')?.getBoundingClientRect(), all = [...document.querySelectorAll('.hud-toast:not(.out)')].map(x => x.getBoundingClientRect()), n = all.length ? { top: Math.min(...all.map(r => r.top)), bottom: Math.max(...all.map(r => r.bottom)) } : null; return { bar: bar && [bar.top, bar.bottom], note: n && [n.top, n.bottom], count: all.length, quiet: document.body.classList.contains('ng-quiet') }; });
check('Bau-Modus: alle Meldungen unter der Bau-Leiste, Kassette weg', v.bar && v.note && v.note[0] >= v.bar[1] - 1 && v.quiet, v);
v = await ev(() => { const h = SC().hud, sv = SC().box.save, n0 = sv.journal.length; h.toast('Stage-Kein-Platz', '', 'warn'); h.toast('Stage-Eingebaut', '', 'good'); window.dispatchEvent(new CustomEvent('ng-journal', { detail: { title: '♪ Baulied', cat: 'radio' } })); return sv.journal.slice(n0).map(e => e.title); });
check('Bau-Modus: nur Erfolge und Radio-Titel ins Logbuch', v.join() === 'Stage-Eingebaut,♪ Baulied', v);

// ---------- #154 Bühne mit Zonen: nothing overlaps anything else in the four situations of the concept (docs/concepts/info_center.md › 10) ----------
// every visible entry of the zones (toasts one by one) as a box, clipped to its zone; obstacles = what else must stay free (build bar, window buttons)
const overlaps = (obstacles = '') => ev(sel => {
  const R = SC().hud.stage.rects(), bad = [], cut = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) if (cut(R[i], R[j])) bad.push([R[i].zone + ':' + R[i].title, R[j].zone + ':' + R[j].title]);
  const O = sel ? [...document.querySelectorAll(sel)].filter(n => n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden').map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, title: n.className.split(' ')[0] + ' ' + n.textContent.trim().slice(0, 20) }; }).filter(r => r.w && r.h) : [];
  for (const r of R) for (const o of O) if (cut(r, o)) bad.push([r.zone + ':' + r.title, 'frei:' + o.title]);
  return { n: R.length, zones: [...new Set(R.map(r => r.zone))].join(''), what: R.map(r => `${r.zone}:${r.what}`), bad };
}, obstacles);
const tape = (title = 'Rust Lullaby') => ev(t => import('./game/now_playing.js').then(m => { const s = SC(); m.nowPlaying({ title: t, artist: 'Saint FM', cassette: s.data_.assets?.ui_cassette, base: s.base || location.href }); }), title);
const dj = () => ev(() => { const c = SC().hud.radio?.el; if (!c) return false; c.hidden = false; c.classList.add('on', 'talk'); c.querySelector('span').textContent = 'Mama Static: Regen zieht über den Großmarkt, und am Highway 9 sammeln sich die Static Saints. Bleibt im Rig, Leute.'; return true; });
const shotAs = async name => { await page.waitForTimeout(700); await page.screenshot({ path: `output/stage_${name}${vw === 1600 ? '' : '_' + vw}.png` }); };

// 1 a fresh camp start: welcome + goal card + tape + E prompt + a hint + the DJ talking
await page.goto(base + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { window.SC = () => game.scene.getScene("play"); nomad.take(); nomad.step(30); const h = SC().hud; h.tut?.close?.(); h.closeMenu?.(); });
await ev(() => { const h = SC().hud; h.banner('Willkommen im Camp', 'E benutzt Dinge · H zeigt die Steuerung'); h.toast('Stage-Hinweis 1', 'erste Meldung', 'good'); h.toast('Stage-Hinweis 2', 'zweite Meldung', 'loot'); h.prompt('Schlafen · Schlafkoje'); nomad.step(4); });
await tape(); await dj();
await page.waitForTimeout(900); await ev(() => nomad.step(2));
v = await overlaps();
let st = await ev(() => ({ goal: !!document.querySelector('#stage .zone-c .hud-goal'), tape: !!document.querySelector('#stage .zone-g .np-card.on'), prompt: !!document.querySelector('#stage .zone-e .hud-prompt:not([hidden])'), banner: /Willkommen/.test(SC().hud.bannerText() || ''), chip: !!document.querySelector('#stage .zone-g .radio-chip:not([hidden])') }));
check('Camp-Start: Willkommen, Ziel-Karte, Kassette, E-Hinweis und DJ stehen in ihren Zonen', st.goal && st.tape && st.prompt && st.banner && st.chip, { st, v });
check('Camp-Start: nichts liegt übereinander', v.n >= 6 && !v.bad.length, v);
await shotAs('camp');

// 2 build mode open with a toast and a change of music: the notes below the bar on the left, no tape, the build note in E
await ev(() => { const s = SC(); s.hud.prompt(null); s.box.save.deltas = 500; s.openBuild(); nomad.step(20); s.hud.build.shopOpen = true; s.hud.build.draw(); s.hud.toast('Stage-Bau', 'unter der Leiste', 'good'); s.hud.toast('Stage-Bau 2', 'Warnung', 'warn'); s.hud.build.say('Lichterkette: an einem Andockpunkt loslassen'); nomad.step(2); });
await tape('Baulied');
await page.waitForTimeout(900); await ev(() => nomad.step(2));
v = await overlaps('.bm-bar, .bm-shop, .bm-hints');
st = await ev(() => { const bar = document.querySelector('.bm-bar').getBoundingClientRect(), T = [...document.querySelectorAll('.hud-toast:not(.out)')].map(t => t.getBoundingClientRect()), np = document.querySelector('.np-card'); return { below: T.length && T.every(r => r.top >= bar.bottom - 1), left: T.every(r => r.left < innerWidth / 2), tape: np ? getComputedStyle(np).opacity : null, msg: document.querySelector('#stage .zone-e .bm-msg')?.textContent || null, ctx: SC().hud.stage.ctx }; });
check('Bau-Modus: Meldungen links unter der Leiste, keine Kassette, Bau-Meldung in Zone E', st.ctx === 'build' && st.below && st.left && (st.tape == null || Number(st.tape) < 0.05) && /Lichterkette/.test(st.msg || ''), st);
check('Bau-Modus: nichts liegt übereinander, Leiste, Händler und Hilfezeile bleiben frei', !v.bad.length && v.n >= 2, v);
await shotAs('build');
v = await ev(() => { SC().hud.build.close(); nomad.step(30); return { msg: !!document.querySelector('#stage .bm-msg'), ctx: SC().hud.stage.ctx }; });
check('Bau-Modus zu: die Bau-Meldung geht mit', !v.msg && v.ctx === 'play', v);

// 3 the inventory open + an achievement: compact at the top centre, never on the window's buttons
await page.waitForTimeout(600);
await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(6); SC().hud.toast('Achievement: Stage-Trophäe', 'Alles an seinem Platz', 'trophy'); nomad.step(2); });
await page.waitForTimeout(500);
v = await overlaps('.inv button, .inv .inv-tab, .inv .ui-x');
st = await ev(() => { const t = [...document.querySelectorAll('.hud-toast.trophy:not(.out)')].map(x => x.getBoundingClientRect()); return { ctx: SC().hud.stage.ctx, zone: document.querySelector('.hud-toasts')?.parentElement?.dataset.zone, n: t.length, centre: t.every(r => Math.abs(r.left + r.width / 2 - innerWidth / 2) < innerWidth * 0.06) }; });
check('Inventar offen: das Achievement kommt kompakt oben in der Mitte (Zone B)', st.ctx === 'window' && st.zone === 'B' && st.n === 1 && st.centre, st);
check('Inventar offen: nichts liegt übereinander, keine Meldung auf einem Knopf', !v.bad.length, v);
await shotAs('inventory');
await ev(() => { SC().hud.inv.close(); nomad.step(4); });

// 4 a run with a tip + the E prompt + the DJ (forced: the radio stays in the rig) + notes + the room title
await ev(() => { const s = SC(); nomad.release?.(); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(4); nomad.choose('Plündern'); nomad.release?.(); });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.mode === 'run' && s.leyla && s.level; }, null, { timeout: 60000 });
await ev(() => { nomad.take(); nomad.step(20); const h = SC().hud; h.tut?.close?.(); h.sum?.close?.(); h.closeMenu?.(); nomad.step(2); });
await ev(() => { localStorage.setItem('nomadgirl-tutorial-test', 'true'); const h = SC().hud, T = h.tut, id = T.lessons.find(l => l.media)?.id || T.lessons[0].id; T.showTip(id, SC().now); h.prompt('Kiste öffnen'); h.roomTitle('Stage-Raum', 6000); h.toast('Stage-Run', 'Secret gefunden', 'secret'); h.toast('Stage-Run 2', 'Beute', 'loot'); h.toast('Stage-Run 3', 'Hinweis', 'info'); nomad.step(4); });
await dj();
await page.waitForTimeout(900); await ev(() => nomad.step(2));
v = await overlaps();
st = await ev(() => ({ tip: !!document.querySelector('#stage .zone-f .tut-tip:not([hidden])'), prompt: !!document.querySelector('#stage .zone-e .hud-prompt:not([hidden])'), status: document.querySelector('.hud-camp')?.parentElement?.dataset.zone, title: !!document.querySelector('#stage .zone-b .room-title') }));
check('Run: Tipp (F), E-Hinweis (E), Raumtitel (B), Status unten rechts (R)', st.tip && st.prompt && st.title && st.status === 'R', st);
check('Run: nichts liegt übereinander', v.n >= 6 && !v.bad.length, v);
await shotAs('run');
await ev(() => localStorage.removeItem('nomadgirl-tutorial-test'));

check('Keine Fehler auf der Seite', !pageErrors.length, pageErrors);
await browser.close();
console.log(errors.length ? `\nFehler:\n${errors.join('\n')}` : `\nBühne ok: ${ok.length} Prüfungen.`);
process.exit(errors.length ? 1 : 0);
