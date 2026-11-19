#!/usr/bin/env node
// Revier-Camp (#061): with Ruf from „Geduldet“ the gang of a POI does not attack; seen opening a chest = theft (Ruf −); the vault only
// by breaking the peace; a friend can trade and take a job; any hit breaks the peace and they all fight.   node tools/turf_test.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);

async function run(rep, moved = null) {
  await page.goto('http://localhost:8766/game.html?camp&new');
  await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
  await ev(([rep, moved]) => { nomad.take(); nomad.step(10); window.SC = () => game.scene.getScene('play'); nomad.save().rep = moved ? { [moved]: rep } : { 'Yellow Vultures': rep }; nomad.save().deltas = 2000;
    if (moved) nomad.save().turfs = { [nomad.save().location]: moved };   // #089
    const TU = SC().hud.tutorial; TU?.setSessionOff?.(true);
    nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(4); if (TU?.state?.().open) TU.close(); nomad.choose('Plündern'); nomad.release(); }, [rep, moved]);
  await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.mode === 'run' && s.leyla && s.level; }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  return ev(() => { nomad.take(); nomad.step(120); const s = SC(); return { turf: s.turf?.state(), toast: [...document.querySelectorAll('.hud-toast b, .hud-toast strong, .hud-toasts *')].map(e => e.textContent).join(' | ').slice(0, 400), members: s.enemies.filter(e => s.turf?.member(e)).length }; });
}

// a friend of the Yellow Vultures
let v = await run(75);
check('Freund: Revier-Camp mit Hinweis zu Beginn (Gang, Beziehung)', v.turf?.active && v.turf.friend && /Revier der Yellow Vultures · Freund/.test(v.toast), v);
// their people stand next to her and do nothing
v = await ev(() => { const s = SC(), e = s.enemies.find(x => s.turf.member(x) && x.alive); nomad.tp(e.x - 120, e.body.bottom - 4); const hp = s.leyla.health; nomad.step(240);
  nomad.tp(e.x - 60, e.body.bottom - 4); nomad.step(3); return { hp, after: s.leyla.health, state: e.state, peaceful: e.peaceful, talk: s.level.nearest()?.text || '' }; });
check('Sie greifen nicht an, auch direkt daneben; E: Reden (Handel, Auftrag)', v.after === v.hp && v.state === 'patrol' && v.peaceful && /Reden · Yellow Vultures/.test(v.talk), v);
v = await ev(() => { const s = SC(), e = s.enemies.find(x => s.turf.member(x) && x.alive); nomad.tp(e.x - 60, e.body.bottom - 4); nomad.step(2); s.level.nearest().act(); nomad.step(2); const m = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Handeln'); nomad.step(2); const t = (s.hud.menuItems || []).map(x => x.label + ' ' + (x.sub || ''));
  const d0 = nomad.save().deltas; s.hud.choose(0); nomad.step(2); return { m, t, d0, d1: nomad.save().deltas, stock: s.turf.state().stock }; });
check('Handel: ein paar Dinge aus ihrer Beute zu Freundschaftspreisen', v.m.includes('Handeln') && v.stock?.length >= 1 && v.d1 < v.d0, v);
await ev(() => SC().hud.closeMenu?.());
// theft: a chest under their eyes
v = await ev(() => { const s = SC(), T = s.turf, c = s.level.chests.find(x => !x.open);
  const e = s.enemies.find(x => T.member(x) && x.alive); e.tp ? 0 : 0; nomad.tp(c.x, c.feet - 4); nomad.step(5);
  e.body.reset(c.x + 150, c.feet - e.body.height / 2); nomad.step(10); e.body.reset(c.x + 150, c.feet - e.body.height / 2); e.facing = -1;
  const r0 = T.rep(), seen = T.witnesses().length, dbg = { ex: Math.round(e.x), cx: c.x, lx: Math.round(s.leyla.x), sees: e.sees(s.leyla) }; s.level.openChest(c); nomad.step(3); return { seen, dbg, r0, r1: T.rep(), thefts: T.state().thefts }; });
check('Kiste unter Zeugen geöffnet: Diebstahl kostet Ruf', v.seen >= 1 && v.r1 < v.r0 && v.thefts === 1, v);
// the vault: only by breaking the peace
v = await ev(() => { const s = SC(), z = s.level.goals[0]; nomad.tp(z.x, z.feet - 4); nomad.step(5); const p = s.level.nearest(); p.act(); nomad.step(2);
  const items = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Lassen'); nomad.step(2); return { text: p.text, items, active: s.turf.active }; });
check('Tresor der Gang: nur mit Gewalt, „Lassen“ lässt den Frieden', /Tresor der Yellow Vultures · nur mit Gewalt/.test(v.text) && v.items.includes('Aufbrechen') && v.active, v);
// a hit breaks the peace
v = await ev(() => { const s = SC(), T = s.turf, e = s.enemies.find(x => T.member(x) && x.alive), r0 = T.rep(); nomad.tp(e.x - 90, e.body.bottom - 4); nomad.step(5);
  e.hit(s.time.now, 5, 1, 0); nomad.step(60); return { r0, r1: T.rep(), broken: T.state().broken, peaceful: e.peaceful, state: e.state }; });
check('Ein Schlag bricht den Frieden: Ruf sinkt, sie greifen an', v.broken && !v.peaceful && v.r1 <= v.r0 - 15 && v.state !== 'patrol', v);

// #088 Gangs als Auftraggeber: geduldet, kein Handel, aber ihr Auftrag; annehmen, erledigen, im Revier abgeben → Δ und Ruf
v = await run(30);
v = await ev(() => { const s = SC(), e = s.enemies.find(x => s.turf.member(x) && x.alive); nomad.tp(e.x - 60, e.body.bottom - 4); nomad.step(2); const talk = s.level.nearest()?.text || ''; s.level.nearest().act(); nomad.step(2);
  const m = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Auftrag: Ratten im Markt'); nomad.step(2); return { talk, m, active: Object.keys(nomad.save().quests?.active || {}) }; });
check('Geduldet: Reden zeigt den Gang-Auftrag (kein Handel), Annehmen landet im Questlog', /Reden · Yellow Vultures \(Auftrag\) !/.test(v.talk) && !v.m.includes('Handeln') && v.m.includes('Auftrag: Ratten im Markt') && v.active.includes('vultures_ratten'), v);
v = await ev(() => { const s = SC(), C = (nomad.save().achievements ??= {}).counts ??= {}; C['pois:grossmarkt'] = (C['pois:grossmarkt'] || 0) + 1; const d0 = nomad.save().deltas, r0 = s.turf.rep();
  const e = s.enemies.find(x => s.turf.member(x) && x.alive); nomad.tp(e.x - 60, e.body.bottom - 4); nomad.step(2); s.level.nearest().act(); nomad.step(2);
  const m = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Abgeben: Ratten im Markt'); nomad.step(2); return { m, d: nomad.save().deltas - d0, r: s.turf.rep() - r0, done: !!nomad.save().quests.done.vultures_ratten }; });
check('Abgeben im Revier: +80 Δ, Ruf +15, erledigt', v.m.includes('Abgeben: Ratten im Markt') && v.d === 80 && v.r === 15 && v.done, v);
await ev(() => SC().hud.closeMenu?.());

// #089 Revierkrieg: the Neon Rats took the station over: their name, their colours, their peace
v = await run(75, 'Neon Rats');
v = { ...v, g: await ev(() => SC().gang()?.name), color: await ev(() => SC().gang()?.color) };
check('Übernommener Ort: Revier der Neon Rats (Hinweis, Frieden, Farbe)', v.turf?.gang === 'Neon Rats' && v.turf.active && /Revier der Neon Rats/.test(v.toast) && v.g === 'Neon Rats', v);

// neutral: no peace, the old POI
v = await run(0);
check('Neutral: kein Frieden, Hinweis „Sie kennen dich nicht“', v.turf && !v.turf.active && /Neutral/.test(v.toast), v);

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Revier: ${ok.length} Prüfungen grün`);
await browser.close();
