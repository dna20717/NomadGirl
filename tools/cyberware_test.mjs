#!/usr/bin/env node
// Cyberware (#006): 30 implants with symbols, double jump and air dash only with implants (savegame), perk + flaw in the values and
// in the tooltip, Ripperdoc-Liege makes cyberware (and the workbench does not), regen flaw never kills, the test room keeps everything.
//   node tools/cyberware_test.mjs [--shots]   (server must run: npm run serve; images → output/cyberware_*.png)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/cyberware_${n}.png` }); };

await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
await ev(() => { nomad.take(); nomad.step(10); window.SC = () => game.scene.getScene('play'); });

// the data: 30 implants, each with a symbol cell that exists, six places, three tiers, every strong one has a flaw
let v = await ev(async () => {
  const { statParts } = await import('/game/inventory.js');
  const D = SC().data_, list = Object.entries(D.items).filter(([, t]) => t.category === 'implant');
  const bad = list.filter(([, t]) => { const a = D.assets[t.look]; return !a || a.kind !== 'icons' || t.icon >= a.grid[0] * a.grid[1]; }).map(([k]) => k);
  const places = new Set(list.map(([, t]) => t.wear)), flawless = list.filter(([, t]) => t.tier === 3 && !statParts(t.stats).some(x => !x.good)).map(([k]) => k);
  return { n: list.length, bad, places: places.size, tiers: [1, 2, 3].map(k => list.filter(([, t]) => t.tier === k).length), flawless };
});
check('30 Implantate mit Symbol, 6 Plätze, 3 Stufen, jedes Perk-Teil hat einen Nachteil', v.n === 30 && !v.bad.length && v.places === 6 && v.tiers.every(n => n >= 6) && !v.flawless.length, v);

// new game: no double jump, no air dash (Leyla › Fähigkeiten › nur mit Implantat)
const jumpTwice = () => ev(() => {
  const l = SC().leyla; nomad.step(30);
  nomad.step(1, [], ['jump']); nomad.step(8, ['jump']);
  const before = l.body.velocity.y, left = l.airJumps;
  nomad.step(1, [], ['jump']); nomad.step(1);
  const after = l.body.velocity.y; nomad.step(90);
  return { before: Math.round(before), after: Math.round(after), left, max: l.maxAirJumps, air: l.canAirDash };
});
v = await jumpTwice();
check('Neues Spiel: kein Doppelsprung, kein Luft-Dash', v.max === 0 && !v.air && v.left === 0 && v.after > v.before, v);

// legs and nerves: Sprungfedern give the double jump, Dash-Synapse the air dash
v = await ev(() => { const s = nomad.save(); s.inv.wear.legs = 'sprungfedern'; s.inv.wear.nerves = 'dash_synapse'; SC().applyGear(); return SC().ability; });
check('Sprungfedern + Dash-Synapse schalten frei', v?.airJumps === 1 && v.airDash === true, v);
v = await jumpTwice();
check('mit Sprungfedern springt Leyla in der Luft ein zweites Mal', v.max === 1 && v.air && v.left === 1 && v.after < v.before - 200, v);

// perk + flaw: Tunnelblick-Optik = much more ranged damage and crits, less defense; the tooltip shows both colours
v = await ev(() => { const s = nomad.save(); s.inv.wear.eyes = 'tunnelblick_optik'; SC().applyGear(); const m = SC().mods, c = SC().combat;
  return { ranged: m.ranged, crit: m.crit, defense: m.defense, boost: c?.boost('ranged'), expect: 1 + ((m.damage || 0) + 35) / 100 }; });
check('Tunnelblick-Optik: +35 % Fernkampf, +15 % Krit, −15 % Abwehr', v.ranged === 35 && v.crit === 15 && v.defense === -15 && Math.abs(v.boost - v.expect) < 0.001, v);
v = await ev(() => { const inv = SC().hud.inv; inv.open?.(); inv.showTip({ a: 'items', id: 'kaenguru_beine', n: 1 }); const t = inv.tip;
  return { text: t.textContent, perks: [...t.querySelectorAll('.inv-perks .perk')].map(x => x.textContent), flaws: [...t.querySelectorAll('.inv-perks .flaw')].map(x => x.textContent) }; });
check('Tooltip: Vorteile grün, Nachteile rot', v.perks.length >= 3 && v.flaws.some(x => /Leben/.test(x)) && !v.text.includes('null'), v);
await shot('tooltip');
await ev(() => { SC().hud.inv.close?.(); SC().hud.inv.tip.hidden = true; nomad.step(3); });

// strain: two black-market parts fit (4 + 5), the rest of the body has to stay simple
v = await ev(async () => { const { gearStats } = await import('/game/inventory.js'); const D = SC().data_;
  return { two: gearStats(D, { eyes: 'tunnelblick_optik', heart: 'reaktor_herz' }).strain, three: gearStats(D, { eyes: 'tunnelblick_optik', heart: 'reaktor_herz', skin: 'panzerhaut_titan' }).strain, max: D.leyla.inventory.strainMax }; });
check('Belastung: zwei starke Teile passen, drei nicht', v.two <= v.max && v.three > v.max, v);

// a flaw that drains life (Overclock-Chip, −2 LP / 10 s) never goes below 1
v = await ev(() => { const s = nomad.save(); s.inv.wear.eyes = null; s.inv.wear.nerves = 'overclock_chip'; SC().applyGear(); const l = SC().leyla; l.health = 3; nomad.step(60 * 25); return { h: l.health, regen: SC().mods.regen, alive: l.alive }; });
check('Leben sickert, aber nie unter 1 LP', v.regen === -2 && v.h >= 1 && v.h < 3 && v.alive, v);
v = await ev(() => { const s = nomad.save(); s.inv.wear.nerves = 'dash_synapse'; s.inv.wear.heart = 'reaktor_herz'; SC().applyGear(); return SC().mods.tankDecay; });
check('Reaktor-Herz zieht am Tank (Tank-Verfall +30 %)', v === undefined || v === 30, v);
v = await ev(async () => { const { tankMods } = await import('/game/techtree.js'); return tankMods(SC().data_, nomad.save()).decay; });
check('… und der Tank verfällt schneller', v > 1.25, v);

// Ripperdoc-Liege: buyable, makes cyberware; the workbench cannot
v = await ev(async () => { const { shop } = await import('/game/rig.js'); const { recipesFor } = await import('/game/crafting.js'); const D = SC().data_;
  return { shop: shop(D).workshops.includes('ripperdoc'), rd: recipesFor(D, 'ripperdoc').filter(r => D.items[r.result]?.category === 'implant').length, wb: recipesFor(D, 'werkbank').filter(r => D.items[r.result]?.category === 'implant').length,
    start: (nomad.save().recipes || []).filter(id => D.recipes[id]?.station === 'ripperdoc').length, look: D.workshops.ripperdoc.look }; });
check('Ripperdoc-Liege kaufbar, 30 Rezepte, die Werkbank kann keine Cyberware', v.shop && v.rd === 30 && v.wb === 0 && v.start >= 3 && v.look === 'ws_ripperdoc', v);
v = await ev(async () => { const { craft } = await import('/game/crafting.js'); const D = SC().data_, s = nomad.save();
  s.inv.grids.chest.items.push({ a: 'items', id: 'zahnraeder', n: 2, x: 9, y: 0, r: 0 }, { a: 'items', id: 'schrott', n: 5, x: 9, y: 1, r: 0 }, { a: 'items', id: 'panzertape', n: 2, x: 9, y: 2, r: 0 });
  const r = craft(D, s, 'sprungfedern', 'ripperdoc'), at = craft(D, s, 'sprungfedern', 'werkbank');
  const found = Object.values(s.inv.grids).some(g => (g.items || []).some(e => e.id === 'sprungfedern'));
  return { ok: r.ok, reason: r.reason, wb: at.ok, found }; });
check('Sprungfedern an der Liege hergestellt, an der Werkbank nicht', v.ok && v.found && !v.wb, v);

// blueprints for the strong ones lie in vaults and with bosses
v = await ev(() => { const D = SC().data_, L = D.lootTables, t3 = Object.entries(D.items).filter(([, t]) => t.tier === 3).map(([k]) => k);
  return t3.filter(k => !(L.tresor.entries || []).some(e => e.item === `bauplan_${k}`)); });
check('Baupläne aller Perk-Teile liegen im Tresor', !v.length, v);

// the inventory in the camp: implants tab with the black-market parts
await ev(() => { const s = nomad.save(); s.inv.wear.eyes = 'tunnelblick_optik'; s.inv.wear.arm = 'presslufthammer_arm'; s.inv.wear.legs = 'kaenguru_beine';
  s.inv.grids.backpack.items = [{ a: 'items', id: 'klingenarm', n: 1, x: 0, y: 0, r: 0 }, { a: 'items', id: 'kristallauge', n: 1, x: 1, y: 0, r: 0 }, { a: 'items', id: 'heilgel_haut', n: 1, x: 2, y: 0, r: 0 }, { a: 'items', id: 'reaktor_herz', n: 1, x: 4, y: 0, r: 0 }, { a: 'items', id: 'berserker_chip', n: 1, x: 1, y: 1, r: 0 }];
  SC().applyGear(); const inv = SC().hud.inv; inv.view = 'implants'; inv.open?.(); inv.draw?.(); });
if (shots) { await ev(() => nomad.freeze?.()); await page.waitForTimeout(600); await shot('inventory'); }
v = await ev(() => document.querySelectorAll('.inv-item.tier-3').length);
check('Perk-Teile im Rucksack haben den goldenen Rahmen', v >= 2, v);

// the test room keeps double jump and air dash without implants
await page.goto('http://localhost:8766/game.html');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 40000 });
v = await ev(() => { nomad.take(); nomad.step(5); const s = game.scene.getScene('play'); return { ab: s.ability, max: s.leyla.maxAirJumps, air: s.leyla.canAirDash }; });
check('Testraum: Doppelsprung und Luft-Dash wie immer', v.ab === null && v.max === 1 && v.air, v);

await browser.close();
for (const n of ok) console.log('  ok  ', n);
for (const e of errors) console.log('  FEHLER', e);
console.log(errors.length ? `\n${errors.length} Fehler` : `\nCyberware: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
