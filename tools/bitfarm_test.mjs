#!/usr/bin/env node
// Bit-Farm (#060): Entities live in the Bit-Farm (only Entities), work at a workshop of the rig (talent bonus, Macke), a friendly duel in
// the Chill-Ecke raises the Bindung and catches nothing.   node tools/bitfarm_test.mjs   (server: npm run serve)
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);

await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
await ev(() => { nomad.take(); nomad.step(10); window.SC = () => game.scene.getScene('play');
  const sv = nomad.save(); sv.rig.tractor = 'lkw'; sv.rig.units[0].id = 'lkw'; sv.rig.units[0].workshops = [{ id: 'kochnische', at: 0 }]; sv.rig.units.push({ kind: 'container', id: 'modulanhaenger', workshops: [{ id: 'bitfarm', at: 0 }, { id: 'chill_area', at: 1 }] }); nomad.save().hour = 22; SC().goCamp({ keepPlace: true, fade: 0 }); nomad.step(60); });
await page.waitForFunction(() => game.scene.getScene('play')?.camp?.benches?.list?.some(b => b.id === 'bitfarm'), null, { timeout: 20000 });
let v = await ev(async () => { nomad.take(); nomad.step(5); const s = SC(), D = s.data_, save = nomad.save(), W = await import('/game/workers.js'), I = await import('/game/inventory.js'), G = await import('/game/glitchlings.js');
  (await import('/game/save.js')).fitContainers(D, save);   // as after building (rig.js act)
  const key = W.farmKeys(D, save)[0], grid = save.inv.grids[key];
  const all = G.generate(D, 5, 12), koch = { ...(all.find(g => g.talent === 'Koch') || all[0]), talent: 'Koch', stat: 'perfect', quirkKind: 'odd', quirk: 'kocht alles scharf', bits: 3, id: 'koch_t', name: 'Pepper Hiss' };
  const left = I.add(D, grid, 'items', 'glitchling', 1, { g: koch });
  const junk = I.add(D, grid, 'items', 'kupferkabel', 1);
  s.openContainer(key); nomad.step(2); const allowJunk = s.hud.inv.allows(key, { a: 'items', id: 'kupferkabel', n: 1 }, false); s.hud.inv.close(); nomad.step(2);
  return { key, left, allowJunk, size: [grid.w, grid.h], n: W.farmEntities(D, save).length }; });
check('Bit-Farm im Rig: eigenes Raster, nimmt nur Entities', v.key && v.left === 0 && v.allowJunk === false && v.n === 1, v);
v = await ev(() => { const s = SC(), save = nomad.save(), key = Object.keys(save.inv.grids).find(k => save.inv.grids[k].items?.some(e => e.g)), e = save.inv.grids[key].items.find(x => x.g);
  const acts = s.hud.inv.actionsFor(key, e).map(a => a.label); s.camp.workerMenu(e.g); nomad.step(2); const items = (s.hud.menuItems || []).map(x => x.label + ' | ' + (x.sub || ''));
  nomad.choose('Kochnische'); nomad.step(3); const acts2 = s.hud.inv.actionsFor(key, e).map(a => a.label);
  return { acts, items, acts2, perfect: 0 }; });
check('Inventar: „Als Worker einsetzen“, Auswahl der Werkstätten (eigene zuerst, mit Effekt)', v.acts.includes('Als Worker einsetzen') && /Kochnische · eigene Werkbank \| Gerichte gelingen/.test(v.items[0] || '') && v.acts2.some(a => /Worker: Kochnische/.test(a)), v);
v = await ev(async () => { const W = await import('/game/workers.js'), s = SC(); return { bonus: W.workerBonus(s.data_, nomad.save(), 'perfect'), list: W.workers(s.data_, nomad.save()).map(k => [k.g.name, k.def.name, k.value, k.flaw.why]) }; });
check('Worker wirkt: Koch-Bonus mit Macke (−15 %, lenkt sich ab)', v.bonus > 0 && v.list[0]?.[3] === 'lenkt sich ab', v);
// #076 Worker right at the bench: a button in the Kochnische's window, an entry in the Chill-Ecke's menu
v = await ev(() => { const s = SC(); s.camp.use('kochnische', '0:0'); nomad.step(2); const btn = document.querySelector('.craft-worker')?.textContent || ''; document.querySelector('.craft-worker')?.click(); nomad.step(2);
  const items = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Zurück'); nomad.step(2); const back = !s.hud.craft.el.hidden; s.hud.craft.close(); nomad.step(2);
  const b = s.camp.benches.list.find(x => x.id === 'chill_area'); s.camp.use('chill_area', b.place); nomad.step(2); const rest = (s.hud.menuItems || []).map(x => x.label);
  nomad.choose('Worker einteilen'); nomad.step(2); const pick = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Pepper Hiss'); nomad.step(2);
  const W = s.camp.box.save.rig.units.flatMap(u => u.workshops || []).find(w => w.id === 'chill_area'); return { btn, items, back, rest, pick, worker: W?.worker || null, koch: s.camp.box.save.rig.units[0].workshops[0].worker || null }; });
check('Worker an der Werkbank (#076): Knopf im Kochfenster, Eintrag in der Chill-Ecke, Tausch zieht sie von der Kochnische ab', /Worker: Pepper Hiss/.test(v.btn) && v.items.includes('Pepper Hiss abziehen') && v.back && v.rest.includes('Worker einteilen') && v.pick.some(x => /Pepper Hiss/.test(x)) && v.worker === 'koch_t' && !v.koch, v);
v = await ev(() => { const s = SC(); const k = s.camp.box.save.rig.units[0].workshops[0]; k.worker = 'koch_t'; delete s.camp.box.save.rig.units.flatMap(u => u.workshops || []).find(w => w.id === 'chill_area').worker; return true; });
// the Chill-Ecke: a friendly duel
v = await ev(() => { const s = SC(), b = s.camp.benches.list.find(x => x.id === 'chill_area'); nomad.save().inv.wear.nerves = 'overclock_chip'; s.camp.use('chill_area', b.place); nomad.step(2); const items = (s.hud.menuItems || []).map(x => x.label);
  nomad.choose('Freundliches Duell'); nomad.step(3); const d = s.hud.duel; return { items, open: d?.isOpen, friendly: !!d?.foe?.friendly, foe: d?.foe?.name, hp: d?.state?.()?.hp, hack: document.querySelector('.gd-hack')?.textContent || '' }; });
check('Chill-Ecke: „Freundliches Duell“ gegen die eigene Entity', v.items.includes('Freundliches Duell') && v.open && v.friendly && v.foe === 'Pepper Hiss', v);
check('Cyberware im Duell (#065): Overclock-Chip (Ghostwire, Qualität +5 %) gibt +16 Integrität nur für Leyla (Grundwert 35, #076), der Kopf sagt es', v.hp?.[0] === 51 && v.hp?.[1] === 35 && /Implantate: \+16 Integrität/.test(v.hack), v);
v = await ev(async () => { const s = SC(), d = s.hud.duel, caught0 = (nomad.save().glitch?.caught || []).length; d.ended({ winner: 'player' }); nomad.step(2); const txt = d.endExtra()[0]?.textContent || ''; d.close(); nomad.step(3);
  const W = await import('/game/workers.js'), g = W.farmEntities(s.data_, nomad.save())[0].g; return { txt, bond: W.bondOf(g), n: W.farmEntities(s.data_, nomad.save()).length, caught: (nomad.save().glitch?.caught || []).length - caught0, backpack: nomad.save().inv.grids.backpack.items.filter(e => e.g).length }; });
check('Sieg im freundlichen Duell: Bindung ♥, nichts gefangen, keine Kopie', v.bond === 1 && v.n === 1 && v.caught === 0 && v.backpack === 0 && /grinst/.test(v.txt), v);

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Bit-Farm: ${ok.length} Prüfungen grün`);
await browser.close();
