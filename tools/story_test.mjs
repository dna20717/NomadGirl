// Erzählschicht im POI (#167 G1): a note lies in the level, E reads it, it lands in the Logbuch (category Story) and AvA comments it;
// the Splitter of the place gives the first link of the Faden; Tropes stand in the rooms; an opened chest stays open on the next visit,
// fades over the days and is cleared by new residents (a cleanup time layer, AvA says so).
// node tools/story_test.mjs [--shots]   (server on :8766 or GAME_URL; tools/test_all.mjs story brings its own)   pictures to output/story_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = true;   // the pictures are part of the check (Daniel looks at them)
const read = f => JSON.parse(fs.readFileSync(new URL(`../projects/nomadgirl/data/${f}`, import.meta.url), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
// a fixed level (same seed every visit), the calendar note sure to lie there, two tropes for sure
const pois = read('pois.json'); pois.tankstelle_km7.seed = 7;
const st = read('storylets.json'); st.zettel_kalender.weight = 5000;
const tr = read('tropes.json'); for (const k of ['letzte_stellung', 'werbung_gegen_wirklichkeit', 'letztes_logbuch']) { tr[k].chance = 100; tr[k].weight = 1000; tr[k].roles = []; tr[k].events = []; }
const hi = read('history.json'); hi.notes.perVisit = [2, 2]; hi.notes.announce = 100;
await page.addInitScript(d => { for (const [f, x] of Object.entries(d)) localStorage.setItem('nomadgirl-drafts:data/' + f, JSON.stringify(x)); }, { 'pois.json': pois, 'storylets.json': st, 'tropes.json': tr, 'history.json': hi });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 30000 }).catch(e => { console.log('✖ Start: ' + errors.join(' | ')); throw e; });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)?.slice(0, 600)}`);
fs.mkdirSync('output', { recursive: true });
const shot = async (n, at = null) => { if (!shots) return; await ev(at => { const c = SC.cam, f = SC.fog; if (f) { f.reveal = () => {}; f.seen?.fill?.(1); f.vis?.fill?.(1); f.sprite?.setVisible(false); f.rt?.setVisible?.(false); } c.stopFollow(); if (at) nomad.light(false); if (at) { c.setZoom(0.9); c.centerOn(at.x, at.feet - 150); } else c.centerOn(SC.leyla.x, SC.leyla.feet - 160); nomad.step(3); nomad.freeze(); game.loop.wake(); }, at); await page.waitForTimeout(1500); await page.screenshot({ path: `output/story_${n}.png` }); await ev(() => { nomad.light(true); nomad.thaw(); SC.cam.setZoom(SC.data_.game?.camera?.zoom || 1); SC.cam.startFollow(SC.leyla.box, false, 0.12, 0.12); }); };
// into the POI (from the camp), wait for the level
const run = async () => {
  await ev(() => { nomad.take(); const sc = game.scene.getScene('play'); sc.hud.closeMenu?.(); sc.hud.sum?.close?.(); sc.startRun('tankstelle_km7'); nomad.step(90); });
  await page.waitForFunction(() => game.scene.getScene('play')?.mode === 'run' && game.scene.getScene('play').storyFx, null, { timeout: 20000 }).catch(e => { console.log('✖ Run: ' + errors.join(' | ')); throw e; });
  return ev(() => { nomad.take(); nomad.step(20); nomad.calm(); const sc = game.scene.getScene('play'); window.SC = sc; return sc.storyFx.state(); });
};
const home = async () => { await ev(() => { SC.endRun(false); nomad.step(90); }); await page.waitForFunction(() => game.scene.getScene('play')?.mode === 'camp' && game.scene.getScene('play').camp, null, { timeout: 20000 }); await ev(() => { nomad.take(); nomad.step(10); }); };

let s = await run();
check('Zettel liegen im Level', s.notes.length >= 2, s.notes);
check('Kalender-Zettel liegt da', s.notes.some(n => n.id === 'zettel_kalender'), s.notes.map(n => n.id));
check('Tropes stehen im Level (gemalt und aus Code)', s.tropes.length >= 2 && s.tropes.some(t => t.image), s.tropes);
check('Zeitschichten: 1–3 Zwischenbesitzer, heute die Yellow Vultures', s.layers.length >= 2 && s.layers.length <= 4 && /Yellow Vultures/.test(s.layers.at(-1)), s.layers);
check('Splitter liegt da', !!s.splinter && !s.splinter.taken, s.splinter);
// a trope close up
const t0 = s.tropes.find(t => t.id === 'letzte_stellung') || s.tropes.find(t => t.image) || s.tropes[0];
console.log('Trope fürs Bild: ' + JSON.stringify(t0));
await ev(t => { nomad.tp(t.x - 150, t.feet); nomad.step(90); nomad.calm(); }, t0);
console.log('Kamera: ' + JSON.stringify(await ev(() => ({ sx: SC.cam.scrollX, sy: SC.cam.scrollY, lx: SC.leyla.x, lf: SC.leyla.feet, vis: SC.leyla.sprite?.visible, loop: game.loop.running, sleep: game.loop.sleeping }))));
await shot('trope', t0);
for (const [i, t] of s.tropes.filter(t => t !== t0).entries()) { await ev(t => { nomad.tp(t.x - 150, t.feet); nomad.step(20); nomad.calm(); }, t); await shot(`trope_${i + 2}`, t); }
console.log('Kamera danach: ' + JSON.stringify(await ev(() => ({ sx: SC.cam.scrollX, sy: SC.cam.scrollY }))));

// read the calendar note: E, toast, Logbuch, AvA a moment later
const n = s.notes.find(n => n.id === 'zettel_kalender');
s = await ev(n => { nomad.tp(n.x - 40, n.feet); nomad.step(8); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(4); const log1 = SC.box.save.journal.slice(-3); nomad.step(140); return { p, log1, log: SC.box.save.journal.slice(-4), seen: SC.box.save.story.seen, toasts: SC.hud.toastLog.slice(-4), fx: SC.storyFx.state() }; }, n);
check('E-Hinweis „Zettel lesen“', s.p === 'Zettel lesen', s.p);
check('Zettel im Logbuch (Story)', s.log1.some(e => e.cat === 'story' && e.title === 'Kalenderblatt' && /Mama Geburtstag/.test(e.sub)), s.log1);
check('Storylet gemerkt', s.seen.zettel_kalender != null, s.seen);
check('AvA kommentiert den Fund', s.log.some(e => e.title === 'AvA' && e.cat === 'story' && /Tage danach/.test(e.sub)) && s.toasts.some(t => t.kind === 'ava'), s.log);
check('Zettel gelesen', s.fx.notes.find(x => x.id === 'zettel_kalender')?.read, s.fx.notes);
await ev(() => { nomad.step(10); SC.hud.logbook(); nomad.step(5); });
await shot('logbook');
await ev(() => { SC.hud.quests?.close?.(); nomad.step(5); });

// the Splitter: the first link of the Faden, AvA's memory
const sp = (await ev(() => SC.storyFx.state())).splinter;
s = await ev(sp => { nomad.tp(sp.x - 40, sp.feet); nomad.step(8); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(200); return { p, chain: SC.box.save.story.chain, shards: SC.box.save.story.shards, log: SC.box.save.journal.slice(-5).map(e => e.title) }; }, sp);
check('Splitter: E aufheben', s.p === 'Splitter aufheben', s.p);
check('Faden: Erinnerung 1 gefunden, Splitter des Ortes gemerkt', s.chain[0] === 'faden_01' && Object.keys(s.shards).length === 1, s);
check('Logbuch: Splitter, Erinnerung und AvA', s.log.includes('Ein Splitter') && s.log.includes('Erinnerung 1') && s.log.includes('AvA'), s.log);

// a chest: open it → Leyla's trace
s = await ev(() => { const c = nomad.state().level.chests.find(c => !c.open); nomad.tp(c.x - 60, c.feet); nomad.step(5); nomad.step(1, [], ['grab']); nomad.step(20); return { c, traces: SC.box.save.story.traces }; });
const node = Object.keys(s.traces)[0], chestX = s.c.x;
check('Spur: geöffnete Kiste gemerkt (Raum, Platz, Tag)', node && s.traces[node].some(t => t.kind === 'chest' && t.room && t.rx != null), s.traces);
await home();

// the next visit, same day: the chest still stands open, AvA says so
s = await run();
let lv = await ev(() => nomad.state().level.chests);
check('Nächster Besuch: die Kiste steht noch offen', lv.some(c => Math.abs(c.x - chestX) < 4 && c.open), { lv, chestX });
check('Spur frisch (ein Tag: Deckkraft über 0,75)', s.old.some(t => t.kind === 'chest' && t.fade > 0.75 && t.fade < 1), s.old);
check('Splitter dieses Ortes kommt nicht wieder', !s.splinter, s.splinter);
await ev(() => nomad.step(200));
check('AvA: die Kisten von neulich', (await ev(() => SC.storyFx.state().said)).some(t => /Kisten von neulich/.test(t)), await ev(() => SC.storyFx.state().said));
await home();

// a day later again (each return to the camp waits for the next dusk, about a day): fading
await ev(() => { SC.box.save.day += 1; });
s = await run();
const f2 = s.old.find(t => t.kind === 'chest')?.fade;
check('Später: verblasst (zwischen Verblasst-bis und 1)', f2 > 0.35 && f2 < 1, s.old);
await home();

// past Aufräumen nach: the new residents cleared it, a cleanup layer, AvA notices
await ev(() => { SC.box.save.day += 3; });
s = await run();
lv = await ev(() => nomad.state().level.chests);
check('Nach dem Aufräumen: Spur weg, Kiste wieder zu', !s.old.length && lv.some(c => Math.abs(c.x - chestX) < 4 && !c.open), { old: s.old, lv });
check('Neue Zeitschicht: aufgeräumt', s.layers.some(t => /aufgeräumt|umgebaut/.test(t)), s.layers);
await ev(() => nomad.step(200));
check('AvA: jemand hat aufgeräumt', (await ev(() => SC.storyFx.state().said)).some(t => /aufgeräumt/.test(t)), await ev(() => SC.storyFx.state().said));
check('Logbuch-Reiter kennt Story', await ev(() => { SC.hud.logbook(); nomad.step(3); const t = document.querySelector('.lb-cats')?.textContent || ''; SC.hud.quests?.close?.(); return /Story/.test(t); }), null);

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) console.log(errors.map(x => '✖ ' + x).join('\n'));
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
process.exit(errors.length ? 1 : 0);
