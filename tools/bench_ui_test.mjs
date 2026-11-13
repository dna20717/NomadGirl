// Workshops with their own action (#013, Daniel 13.11.2026: „Kochen funktioniert anders als ein Gewehr zu bauen“): stove with a
// cooking bar and quality, bench with blueprint + weapon parts → weapon copies with their own values, AvA's board, the ripperdoc's
// steady hand, the foodtruck counter, the regulator; quick crafting; keyboard and controller (UI grammar).
// Server must run (npm run serve).   node tools/bench_ui_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const read = f => JSON.parse(fs.readFileSync(new URL(`../projects/nomadgirl/${f}`, import.meta.url), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json|Failed to load resource/.test(m.location()?.url || m.text())) errors.push(m.text()); });
const game = read('data/game.json');
game.start.workshops = ['schlafkoje', 'kochnische', 'werkbank', 'drohnenwerkstatt', 'ripperdoc', 'foodtruck', 'generator'];
await page.addInitScript(g => localStorage.setItem('nomadgirl-drafts:data/game.json', JSON.stringify(g)), game);
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 30000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async name => { if (shots) { await page.waitForTimeout(250); await page.screenshot({ path: `output/bench_ui_${name}.png` }); } };
fs.mkdirSync('output', { recursive: true });

await ev(async () => {
  const { give } = await import('/game/crafting.js');
  nomad.take(); nomad.step(5);
  const S = game.scene.getScene('play'), D = S.data_, save = nomad.save();
  save.inv.grids.backpack.items.length = 0; save.inv.grids.chest && (save.inv.grids.chest.items.length = 0);   // room for what comes out
  for (const [id, n] of [['dosenbohnen', 10], ['gewuerzmischung', 2], ['schrott', 12], ['schrauben', 6], ['schrottplatte', 2], ['langer_lauf', 1], ['kurzer_lauf', 1], ['tape_griff', 2], ['rotpunkt_visier', 1], ['trommelmagazin', 1],
    ['chip', 2], ['led_chip', 2], ['turbo_regler', 1], ['notfall_relais', 1], ['batteriezelle', 4], ['kupferkabel', 4], ['bohneneintopf', 3], ['grillsteak', 2]]) give(D, save, id, n);
  save.deltas = 5000;
  for (const r of Object.keys(D.recipes)) if (!save.recipes.includes(r) && D.recipes[r].station === 'ripperdoc') save.recipes.push(r);
  S.hud.craft.manual = true;   // the panels' time only moves by stepStation
  window.C = () => S.hud.craft; window.S = S; window.D = D;
  window.click = (txt, sel = '.craft-recipe') => { const c = [...document.querySelectorAll(sel)].find(x => x.textContent.includes(txt)); c?.querySelector('.craft-btns .inv-btn')?.click(); return !!c; };
  window.count = (id, a = 'items') => Object.values(save.inv.grids).flatMap(g => g.items).filter(e => e.a === a && e.id === id);
});

// ---------- 🍳 Kochen ----------
let v = await ev(() => {
  C().open('kochnische');
  const book = !!document.querySelector('.craft-book'), quick = [...document.querySelectorAll('.craft-quick')].length;
  click('Bohneneintopf'); const st = C().state();
  return { book, quick, station: st.station, phase: st.phase };
});
check('Kochnische: Rezeptbuch bleibt, jedes Rezept hat „Kochen“ und „Schnell“, Kochen öffnet den Herd', v.book && v.quick > 0 && v.station === 'CookPanel' && v.phase === 'in', v);
v = await ev(() => { C().mainPress(); C().mainPress(); const ph = C().station.phase; if (ph === 'spice') C().mainPress(); C().stepStation(1500); return { ph, cook: C().station?.phase, pos: Math.round(C().station.pos()) }; });
await shot('cook');
check('Zutaten nacheinander in die Pfanne, dann Würzen, dann der Gar-Balken', v.ph === 'spice' && v.cook === 'cook' && v.pos > 30 && v.pos < 45, v);
v = await ev(() => { C().stepStation(1400); C().mainPress(); return { log: C().state().log?.text, q: count('bohneneintopf').map(e => e.q || 0) }; });
check('Im goldenen Bereich rausgenommen: perfekt (Qualität 2)', /perfekt/.test(v.log) && v.q.includes(2), v);
v = await ev(() => { click('Bohneneintopf'); C().mainPress(); C().mainPress(); if (C().station.phase === 'spice') C().mainPress(); C().stepStation(4100); return { log: C().state().log?.text, plain: count('bohneneintopf').filter(e => !e.q).reduce((n, e) => n + e.n, 0) }; });
check('Nichts gedrückt: am Ende normal raus (kein Scheitern)', /Bohneneintopf ist fertig/.test(v.log) && !/gut|perfekt/.test(v.log) && v.plain >= 4, v);
v = await ev(() => { click('Bohneneintopf'); C().mainPress(); C().mainPress(); const sp = [...document.querySelectorAll('.st-btn')].find(b => /Gewürz/.test(b.textContent) && !/Ohne/.test(b.textContent)); sp?.click(); C().stepStation(2000); C().mainPress();
  return { spice: !!sp, log: C().state().log?.text }; });
check('Mit Gewürz eine Stufe besser (gut statt normal)', v.spice && /gut/.test(v.log), v);
v = await ev(() => { const before = nomad.save().buffs.length; const q2 = count('bohneneintopf').find(e => e.q === 2); C().close(); const r = S.useThing('bohneneintopf', 2); return { r, buffQ: nomad.save().buffQ, toast: [...document.querySelectorAll('.hud-toast')].map(t => t.textContent).join('|'), had: !!q2 }; });
check('Perfektes Gericht essen: Buff +50 % (save.buffQ), Toast zeigt den Bonus', v.r.ok && v.r.bonus === 50 && v.buffQ?.satt === 50 && /\+50 %/.test(v.toast), v);
v = await ev(() => { C().open('kochnische'); const n = count('bohneneintopf').reduce((a, e) => a + e.n, 0); const card = [...document.querySelectorAll('.craft-recipe')].find(c => c.textContent.includes('Bohneneintopf')); card.querySelector('.craft-quick').click(); return { before: n, after: count('bohneneintopf').reduce((a, e) => a + e.n, 0), station: C().state().station }; });
check('„Schnell“: ohne Handgriff, sofort normal', v.after === v.before + 1 && !v.station, v);

// keyboard: Leertaste = main button of the action
await ev(() => { click('Bohneneintopf'); });
await page.keyboard.press('Space'); await page.keyboard.press('Space');
v = await ev(() => ({ phase: C().station?.phase, added: C().station?.added }));
check('Tastatur: Leertaste drückt den Hauptknopf (Zutaten rein)', v.added === 2 && (v.phase === 'spice' || v.phase === 'cook'), v);
await page.keyboard.press('Escape');
v = await ev(() => ({ open: C().isOpen, station: C().state().station }));
check('Esc bricht die Handlung ab, das Fenster bleibt offen', v.open && !v.station, v);

// ---------- 🔧 Werkbank: Bauplan + Teile ----------
v = await ev(() => {
  C().close(); C().open('werkbank'); click('Bauplan Nagelpistole');
  const P = C().station, rows0 = [...document.querySelectorAll('.st-stats tr')].map(r => r.textContent);
  const slot = k => P.slots.findIndex(s => s.slot === k);
  P.cycle(slot('lauf')); P.cycle(slot('visier'));
  const rows1 = [...document.querySelectorAll('.st-stats tr.up, .st-stats tr.down')].map(r => r.textContent);
  return { station: C().state().station, slots: P.slots.map(s => s.slot), parts: P.parts(), rows0: rows0.length, changed: rows1 };
});
await shot('bench');
check('Werkbank: Bauplan mit Plätzen (Lauf, Griff, Magazin, Visier), Teile frei wählen, Werte live', v.station === 'BenchPanel' && v.slots.join() === 'lauf,griff,magazin,visier' && v.parts.length === 2 && v.changed.length >= 2, v);
v = await ev(() => {
  const P = C().station; P.startGrips();
  for (let i = 0; i < 2; i++) { const g = P.grip; g.t = g.mark / 100 * g.seconds * 1000; P.press(); }
  const ws = count('nagelpistole', 'weapons');
  return { log: C().state().log?.text, ws: ws.map(e => e.mods) };
});
check('Zwei Handgriffe im Ziel: perfekt, Nagelpistole mit eigenen Werten (Teile + Bonus)', /perfekt/.test(v.log) && v.ws.length === 1 && v.ws[0].damage > 0 && v.ws[0].range > 0 && v.ws[0].crit > 0, v);
await shot('bench_done');
v = await ev(() => {
  click('Bauplan Nagelpistole'); const P = C().station, slot = k => P.slots.findIndex(s => s.slot === k);
  P.cycle(slot('lauf')); P.cycle(slot('griff')); P.cycle(slot('magazin'));
  P.startGrips(); P.press(); P.press();
  return count('nagelpistole', 'weapons').map(e => e.mods);
});
check('Zweiter Satz Teile: zweites Exemplar mit anderen Werten', v.length === 2 && JSON.stringify(v[0]) !== JSON.stringify(v[1]), v);
v = await ev(() => {
  const inv = nomad.save().inv, all = count('nagelpistole', 'weapons'), base = D.weapons.nagelpistole, out = [];
  for (const e of all) { const g = Object.values(inv.grids).find(g => g.items.includes(e)); g.items.splice(g.items.indexOf(e), 1); S.hud.inv.equip('ranged', e, true); S.hud.inv.held = null; const w = S.weapon('ranged'); out.push({ dmg: w.damage, cd: w.cooldown, range: w.range, mag: w.magazine }); }
  return { base: { dmg: base.damage, cd: base.cooldown, range: base.range, mag: base.magazine }, out, slotMods: inv.slotMods?.ranged };
});
check('Im Kampf: die ausgerüstete Waffe nutzt die Werte ihres Exemplars (scene.weapon)', JSON.stringify(v.out[0]) !== JSON.stringify(v.out[1]) && (v.out[0].range !== v.base.range || v.out[0].dmg !== v.base.dmg) && !!v.slotMods, v);
v = await ev(() => { S.hud.inv.open?.(); const inv = nomad.save().inv; S.hud.inv.slotClick('ranged'); const h = S.hud.inv.held; S.hud.inv.held = null; S.hud.inv.close?.(); return { held: h?.e?.mods || null, slot: inv.slots.ranged }; });
check('Ablegen: das Exemplar behält seine Werte in der Hand', !!v.held && !v.slot, v);

// ---------- 💉 Ripperdoc ----------
v = await ev(() => {
  C().close(); C().open('ripperdoc'); const has = click('Billig-Kameraauge');
  const st = C().state().station, g = C().station.grip; g.t = (g.mark + 3) / 100 * g.seconds * 1000; C().mainPress();
  return { has, st, log: C().state().log?.text, q: nomad.save().implantQ };
});
check('Ripperdoc: OP mit ruhiger Hand, guter Schnitt verstärkt das Implantat', v.has && v.st === 'SurgeryPanel' && /Implantat wirkt \+/.test(v.log) && v.q?.billig_kameraauge >= 1, v);

// ---------- 🤖 Drohnenwerkstatt ----------
v = await ev(() => {
  C().close(); C().open('drohnenwerkstatt');
  const P = C().station; P.add('chip'); P.add('led_chip'); P.add('turbo_regler'); P.add('notfall_relais');
  const used = P.chips.length, power = C().state().log?.text || '';
  return { st: C().state().station, used, power };
});
await shot('drone');
check('Drohnenwerkstatt: AvAs Platine, Chips stecken, Energie-Budget hält zu viel ab', v.st === 'DronePanel' && v.used === 3 && /Energie/.test(v.power), v);
v = await ev(async () => {
  const P = C().station; P.wire();
  for (let i = 0; i < 3; i++) { const g = P.grip; g.t = g.mark / 100 * g.seconds * 1000; P.press(); }
  const { droneBonuses } = await import('/game/stations.js'), { bonuses } = await import('/game/techtree.js');
  return { board: nomad.save().droneBoard, bonus: droneBonuses(D, nomad.save()), battery: bonuses(D, nomad.save()).droneBattery, log: C().state().log?.text };
});
check('Verkabelt: Platine im Spielstand, AvA bekommt Akku, Scheinwerfer, Tempo (perfekte Lötstellen +30 %)', v.board?.chips?.length === 3 && v.bonus.battery === 26 && v.bonus.spot > 25 && v.bonus.speed > 0 && v.battery >= 26, v);

// ---------- 🚚 Foodtruck ----------
v = await ev(() => {
  C().close(); C().open('foodtruck'); const st = C().state().station, P = C().station, d0 = nomad.save().deltas, n = P.queue.length;
  P.serveFirst(); P.since = 1e6; P.serveFirst();
  return { st, n, served: P.served, tips: P.tips, got: nomad.save().deltas - d0 };
});
await shot('truck');
check('Foodtruck: Kunden an der Theke, schnell serviert gibt Trinkgeld', v.st === 'TruckPanel' && v.n >= 2 && v.served === 2 && v.tips > 0 && v.got > v.tips, v);
v = await ev(() => { const P = C().station; P.sellAll(); return { log: C().state().log?.text, book: !!document.querySelector('.craft-book') }; });
check('„Ohne Eile alle bedienen“ verkauft den Rest zum normalen Preis, das Rezeptbuch bleibt daneben', /verkauft/.test(v.log) && v.book, v);

// ---------- ⚡ Generator ----------
v = await ev(() => {
  C().close(); C().open('generator'); const P = C().station, st = C().state().station;
  P.C.drift = 0; P.turn(0); P.load = 55;
  for (let i = 0; i < 70; i++) C().stepStation(100);
  return { st, log: C().state().log?.text, boost: nomad.save().powerBoost };
});
await shot('power');
check('Generator: Regler im grünen Bereich gibt eine Weile Extra-Strom', v.st === 'PowerPanel' && /\+1 ⚡/.test(v.log) && v.boost?.extra === 1, v);
v = await ev(() => { C().close(); S.camp.drawRig?.(); S.goCamp({ fade: 0, keepPlace: true }); return true; });
await page.waitForFunction(() => window.game.scene.getScene('play').camp?.budget, null, { timeout: 20000 });
v = await ev(async () => { const { budgets } = await import('/game/rig.js'); const c = game.scene.getScene('play').camp; return { made: c.budget.power.made, raw: budgets(c.D, nomad.save().rig).power.made }; });
check('Das Rig rechnet den Extra-Strom mit', v.made >= v.raw + 1 - (v.raw - v.made > 0 ? v.raw - v.made : 0), v);

// ---------- 🎮 Controller ----------
v = await ev(() => {
  const s = game.scene.getScene('play'), C2 = s.hud.craft; C2.open('kochnische');
  const card = [...document.querySelectorAll('.craft-recipe')].find(c => c.textContent.includes('Bohneneintopf')); card.querySelector('.craft-btns .inv-btn').click();
  const ui = { now: new Set(['ok']), down: () => false, pressed: k => k === 'ok' };
  C2.nav(ui); C2.nav(ui); C2.nav(ui);
  return { added: C2.station?.added, phase: C2.station?.phase, cursor: C2.cursor.current()?.textContent };
});
check('Controller: A drückt den Knopf unter dem Cursor, der Cursor startet auf dem Hauptknopf', v.added >= 1, v);
await ev(() => game.scene.getScene('play').hud.craft.close());

check('keine Fehler in der Konsole', !errors.filter(e => !/^.+: \{/.test(e)).length, errors);
await browser.close();
for (const o of ok) console.log('✔ ' + o);
for (const e of errors) console.log('✘ ' + e);
console.log(`${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
