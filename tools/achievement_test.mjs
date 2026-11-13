#!/usr/bin/env node
// #012 Achievements mit Trophäen-Rezepten + Rezepte automatisch lernen, im echten Spiel (Camp) und in der Werkstatt:
// note picked up → toast, recipe book, backpack empty; „Lernen“ in the inventory; kills count (filter raider) → 🏆 + 📜; craft once;
// trophy on a stand → bonus (crit) + holo sign + tooltip; a second treasury counts; new Durchgang → memory chest; Menü › Achievements.
//   node tools/achievement_test.mjs [--shots]     (needs npm run serve)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 700)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(900); await page.screenshot({ path: `output/achievement_${n}.png` }); await ev(() => nomad.thaw()); };
const ready = () => page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp && !game.scene.getScene('play').leaving, null, { timeout: 40000 });

await page.goto('http://localhost:8766/game.html?camp&new'); await ready();
await ev(() => { nomad.take(); nomad.step(20); window.SC = () => game.scene.getScene('play'); });

// 1. Rezepte automatisch lernen
let v = await ev(async () => {
  const I = await import('/game/inventory.js'), s = SC(), save = nomad.save(), bag = save.inv.grids.backpack, rid = s.data_.items.rezept_ramen.teaches;
  bag.items = []; I.add(s.data_, bag, 'items', 'rezept_ramen', 1); s.invChanged('backpack');
  return { known: save.recipes.includes(rid), bag: bag.items.map(e => e.id), toasts: [...document.querySelectorAll('.hud-toast b')].map(b => b.textContent) };
});
check('Zettel einsammeln: sofort im Rezeptbuch, Rucksack leer, Meldung „Rezept gelernt“', v.known && !v.bag.includes('rezept_ramen') && v.toasts.some(t => /Rezept gelernt: /.test(t)), v);
v = await ev(async () => {
  const I = await import('/game/inventory.js'), s = SC(), save = nomad.save(), chest = save.inv.grids.chest;
  chest.items = []; I.add(s.data_, chest, 'items', 'bauplan_medikit', 1);
  const e = chest.items[0], acts = s.hud.inv.actionsFor('chest', e).map(a => a.label);
  const r = s.learnFrom(chest, e);
  return { acts, learnt: r?.learnt, left: chest.items.map(x => x.id) };
});
check('Schnellaktion „Lernen“ für einen Zettel in der Kiste (alte Spielstände)', v.acts[0] === 'Lernen' && v.learnt && !v.left.length, v);

// 2. Achievement: kills (only raiders count for Plünderer-Plage), then the trophy recipe
v = await ev(() => {
  const s = SC(), fake = (id, family) => ({ id, d: { family, deltas: [0, 0] }, x: s.leyla.x + 300, feet: s.leyla.feet, h: 180, lastHit: { kind: 'melee', crit: false } });
  for (let i = 0; i < 5; i++) s.onKill(fake('kriecher', 'mutant'));
  for (let i = 0; i < 25; i++) s.onKill(fake('schlaeger', 'raider'));
  nomad.step(220);
  const a = nomad.save().achievements;
  return { raider: a.counts['kills:raider'], mutant: a.counts['kills:mutant'], done: Object.keys(a.done), known: nomad.save().recipes.includes('trophaee_raider_maske'), toasts: [...document.querySelectorAll('.hud-toast b')].map(b => b.textContent) };
});
check('25 Plünderer besiegt: „Plünderer-Plage“ erreicht, Mutanten zählen extra', v.raider === 25 && v.mutant === 5 && v.done.includes('plage'), v);
check('Meldung 🏆 und gleich danach „Rezept gelernt: Raider-Maske“', v.known && v.toasts.includes('Plünderer-Plage') && v.toasts.some(t => /Rezept gelernt: Raider-Maske/.test(t)), v.toasts);
await shot('toast');

// 3. craft once
v = await ev(async () => {
  const C = await import('/game/crafting.js'), I = await import('/game/inventory.js'), s = SC(), D = s.data_, save = nomad.save();
  save.inv.grids.chest = I.newGrid(12, 12);
  for (const i of D.recipes.trophaee_raider_maske.ingredients) C.give(D, save, i.item, i.count * 2);
  const a = C.craft(D, save, 'trophaee_raider_maske', 'werkbank'), b = C.craft(D, save, 'trophaee_raider_maske', 'werkbank');
  return { a: a.ok, b: b.reason, have: C.have(D, save, 'raider_maske') };
});
check('Trophäe einmal herstellen, ein zweites Mal geht nicht', v.a && /einmalig/.test(v.b) && v.have === 1, v);

// 4. two treasuries in the rig, the trophy on a stand → bonus, holo sign, tooltip
await ev(() => { const save = nomad.save(); save.deltas = 5000; save.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'schatzkammer', at: 0 }] }, { kind: 'container', id: 'container_20', workshops: [{ id: 'schatzkammer', at: 0 }] }); SC().goCamp({ fade: 1, keepPlace: true }); nomad.step(60); });
await ready(); await ev(() => { nomad.step(30); });
v = await ev(async () => {
  const S = await import('/game/save.js'), C = await import('/game/crafting.js'), I = await import('/game/inventory.js'), s = SC(), D = s.data_, save = nomad.save();
  for (const c of S.containers(D, save)) S.ensureGrid(D, save.inv, c.key, c.size);   // as building would (applyDraft)
  const stands = S.containers(D, save).filter(c => c.stand != null), crit0 = s.mods.crit || 0;
  C.take(D, save, 'raider_maske', 1);
  const second = stands.filter(c => c.parent !== stands[0].parent);
  I.add(D, save.inv.grids[second[1].key], 'items', 'raider_maske', 1);
  I.add(D, save.inv.grids[stands[1].key], 'items', 'messing_patrone', 1);
  s.applyGear(); s.camp.drawRig(); nomad.step(40);
  const holos = s.camp.benches.list.flatMap(b => (b.trophies || []).filter(o => o.holo).map(o => [o.holo, o.text]));
  const e = save.inv.grids[stands[1].key].items[0];
  s.hud.inv.showTip(e); const tip = s.hud.inv.tip.textContent; s.hud.inv.tip.hidden = true;
  return { stands: stands.length, crit0, crit: s.mods.crit || 0, damage: s.mods.damage || 0, holos, tip };
});
check('Zwei Schatzkammern: 8 Ständer im Rig', v.stands === 8, v.stands);
check('Ausgestellt in irgendeiner Schatzkammer: Bonus wirkt (+5 % Krit, +5 % Schaden)', v.crit === v.crit0 + 5 && v.damage >= 5, v);
check('Holo-Schild am Ständer zeigt den Bonus', v.holos.length === 2 && v.holos.some(([, t]) => /Krit/.test(t)), v.holos);
check('Tooltip: Achievement, Bonus, „Bonus aktiv“', /Achievement: Revolverheldin/.test(v.tip) && /Krit/.test(v.tip) && /Bonus aktiv/.test(v.tip), v.tip);
await ev(() => { const s = SC(), u = s.camp.geo.units[s.camp.geo.units.length - 1]; nomad.tp((u.x0 + u.x1) / 2, s.leyla.feet); nomad.step(60); });
await shot('stand');

// 5. Menü › Achievements: reached, open, hidden as ???
v = await ev(() => {
  const h = SC().hud; h.pauseMenu(); const items = h.menuItems.map(i => i.label); const i = items.indexOf('Achievements'); h.choose(i);
  return { items, i };
});
await page.waitForTimeout(50);
v = { ...v, ...(await ev(() => { const st = SC().hud.ach.state(); return { open: st.open, rows: st.rows, text: document.querySelector('.ach-box')?.textContent || '' }; })) };
check('Pause-Menü › Achievements: offen, erreicht, versteckt als ???', v.i > 0 && v.open && v.rows.some(r => r.done) && v.rows.some(r => r.hidden) && /\?\?\?/.test(v.text) && /1 von|2 von|3 von/.test(v.text), v);
await shot('menu');
await page.keyboard.press('ArrowRight');
v = await ev(() => SC().hud.ach.state());
check('Pfeil rechts: nächste Art (Kampf)', v.tab === 'combat' && v.rows.every(r => r.id), v.tab);
await page.keyboard.press('Escape');
v = await ev(() => SC().hud.ach.isOpen);
check('Esc schließt die Übersicht', !v, v);

// 6. a new Durchgang: everything stays, trophies wait in the memory chest by the fire
await ev(async () => { const S = await import('/game/save.js'), s = SC(); s.box.save = S.newCycle(s.data_, s.box.save); s.goCamp({ fade: 1 }); nomad.step(60); });
await ready(); await ev(() => { nomad.step(220); });
v = await ev(() => {
  const s = SC(), save = nomad.save(), pile = s.loot.piles.find(p => p.memory);
  return { done: Object.keys(save.achievements.done), recipe: save.recipes.includes('trophaee_raider_maske'), pile: pile && pile.grid.items.map(e => e.id), tag: pile?.tag?.text, nearFire: pile && Math.abs(pile.x - s.camp.geo.fireX) < 400,
    toasts: [...document.querySelectorAll('.hud-toast b')].map(b => b.textContent) };
});
check('Neuer Durchgang: Achievements und Trophäen-Rezepte bleiben', v.done.includes('plage') && v.done.includes('neuer_anfang') && v.recipe, v);
check('Erinnerungskiste am Feuer mit den Trophäen', v.pile?.includes('raider_maske') && v.pile?.includes('messing_patrone') && v.tag === 'Erinnerungskiste' && v.nearFire, v);
check('Meldung „Neuer Anfang“ im neuen Camp', v.toasts.includes('Neuer Anfang'), v.toasts);
await shot('memory');

// 7. the workshop has the area
const w = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
w.on('pageerror', e => errors.push('Werkstatt: ' + e.message));
await w.goto('http://localhost:8766/workshop.html'); await w.waitForFunction(() => window.workshop?.p && !document.querySelector('#load.loading-on'), null, { timeout: 30000 });
v = await w.evaluate(async () => { await workshop.go({ area: 'achievements', choice: 'revolverheldin' }); await new Promise(r => setTimeout(r, 300)); return document.body.textContent; });
check('Werkstatt: Bereich Achievements mit Bedingung, Rezept und Bonus', /Revolverheldin/.test(v) && /Zähler/.test(v) && /Rezept der Trophäe/.test(v) && /Bonus/.test(v), v.slice(0, 200));

await browser.close();
for (const o of ok) console.log('  ok  ', o);
for (const e of errors) console.log('  FEHLER', e);
console.log(errors.length ? `\nAchievements: ${errors.length} Fehler` : `\nAchievements: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
