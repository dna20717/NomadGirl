#!/usr/bin/env node
// Silo Zero (#057): the hidden XXL deep POI. In the camp it is not on the map; a forced story (Kalte Frequenz → Konvoi → Silo Zero)
// gives Kartenstück 4, Onkel Sung's quest „Now I am become Death“ puts five pieces together and reveals the place; in the POI: at least 20 rooms, the gang Zero Hour, the KI-Terminal at the bottom opens a very hard
// Glitch-Duell against Titan Lullaby (120 Integrität).   node tools/silo_test.mjs   (server: npm run serve)
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 500)}`);
const ev = (fn, a) => page.evaluate(fn, a);

await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
let v = await ev(() => { nomad.take(); nomad.step(10); return { here: nomad.save().map.nodes.some(n => n.id === 'silo_zero') }; });
check('Neues Spiel: Silo Zero steht nicht auf der Karte', !v.here, v);
// the story, three legs (forced one after another)
for (const [i, step] of [['silo_frequenz', 'silo_peilen'], ['', 'silo_folgen'], ['', 'silo_markieren']].entries()) {
  v = await ev(([first, answer]) => { const s = game.scene.getScene('play'); if (first) s.forceEncounter = 'gen:' + first;
    nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, to = nomad.map().near.find(n => n !== nomad.save().location) || nomad.map().near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.step(5);
    const title = document.querySelector('.hud-menu h2')?.textContent || '', items = (s.hud.menuItems || []).map(x => x.label);
    s.hud.choose(Math.max(0, items.findIndex(l => /peilt|Abstand|markieren/i.test(l)))); nomad.step(80);
    const inv = Object.values(nomad.save().inv.grids).flatMap(g => g?.items || []); return { title, items, chain: nomad.save().road?.chain?.step || null, revealed: nomad.save().map.revealed || [], k4: inv.filter(e => e.id === 'silo_karte_4').length }; }, step);
  if (i === 0) check('Kalte Frequenz: die Geschichte beginnt nachts mit einem Countdown im Radio', /Stimme|Frequenz/.test(v.title) && v.chain === 'silo_konvoi', v);
  if (i === 1) check('Konvoi der Zero Hour, dann geht es in die Berge', /Zero Hour|Raketen/.test(v.title) && v.chain === 'silo_entdeckt', v);
  if (i === 2) check('Silo Zero gesehen, aber nur Kartenstück 4 (Funkkoordinaten) bleibt: der Ort ist noch nicht auf der Karte', /Silo Zero|Karte/.test(v.title) && !v.revealed.includes('silo_zero') && v.k4 === 1, v);
}
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
await ev(() => { nomad.take(); nomad.step(10); });
// the treasure hunt (a fresh camp: Onkel Sung rides as a guest and stays behind without a Gästekoje) „Now I am become Death“: with a piece, Onkel Sung offers it; all five pieces put together reveal the place
v = await ev(async () => { const s = game.scene.getScene('play'), D = s.data_, onk0 = () => s.camp.companions.find(x => x.id === 'onkel_sung'), { have, give } = await import('/game/crafting.js');
  const k4 = have(D, nomad.save(), 'silo_karte_4'); give(D, nomad.save(), 'silo_karte_1', 1); s.camp.questMarks(); const mark = onk0().markKind, onk = s.camp.companions.find(x => x.id === 'onkel_sung');
  onk.spot.act(); nomad.step(2); const m = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Auftrag: Now I am become'); nomad.step(2); const title = document.querySelector('.hud-menu h2')?.textContent || '';
  nomad.choose('Annehmen'); nomad.step(3);
  for (const id of ['silo_karte_2', 'silo_karte_3', 'silo_karte_4', 'silo_karte_5']) give(D, nomad.save(), id, 1);
  onk.spot.act(); nomad.step(2); const m2 = (s.hud.menuItems || []).map(x => x.label); nomad.choose('Abgeben: Now I am become'); nomad.step(5);
  return { k4, mark, m, title, m2, flags: nomad.save().road.flags, done: Object.keys(nomad.save().quests.done), revealed: nomad.save().map.revealed || [], left: have(D, nomad.save(), 'silo_karte_1') }; });
check('Schatzsuche: Onkel bietet „Now I am become Death“ an, sobald ein Kartenstück da ist', v.k4 === 0 && v.mark === 'offer' && v.m.some(l => /Now I am become Death/.test(l)) && v.flags.includes('silo_jagd'), v);
check('Fünf Stücke bei Onkel abgegeben: Silo Zero steht auf der Reisekarte', v.m2.some(l => /Abgeben: Now I am become/.test(l)) && v.done.includes('silo_schatz') && v.revealed.includes('silo_zero') && v.left === 0, v);
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = game.scene.getScene('play').hud.map; mp.select('silo_zero'); return { ...mp.state(), node: nomad.save().map.nodes.some(n => n.id === 'silo_zero') }; });
check('Reisekarte: Silo Zero hat seinen Namen und lässt sich anfahren', v.node && v.sel === 'silo_zero' && /Hinfahren/.test(v.action || '') , v);
await ev(() => game.scene.getScene('play').hud.map.close());

// the POI itself
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?poi=raketensilo&seed=5');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.level, null, { timeout: 120000 });
v = await ev(() => { nomad.take(); nomad.calm(); nomad.step(10); const s = game.scene.getScene('play'); return { rooms: s.levelInfo?.rooms?.length, gang: s.gang()?.name, banner: nomad.state().banner || '', t: s.level.state().terminals }; });
check('Silo Zero: mindestens 20 Räume, Revier der Zero Hour, ein KI-Terminal', v.rooms >= 20 && v.gang === 'Zero Hour' && v.t.length === 1 && v.t[0].ai === 'Titan Lullaby', v);
v = await ev(() => { const s = game.scene.getScene('play'), t = s.level.terminals[0]; nomad.tp(t.x - 60, t.feet); nomad.step(20); const p = s.level.nearest(); p?.act?.(); nomad.step(3); return { prompt: p?.text, duel: s.hud.duel?.state() }; });
check('KI-Terminal: Glitch-Duell gegen Titan Lullaby, sehr schwer (85 Integrität, #076)', /Titan Lullaby/.test(v.prompt || '') && v.duel?.open && v.duel.foe === 'Titan Lullaby' && v.duel.hp?.[1] === 85, v);
v = await ev(() => { const s = game.scene.getScene('play'); s.hud.duel.act('back'); nomad.step(5); return { prompt: s.level.nearest()?.text, open: s.hud.duel.isOpen }; });
check('Aufgegeben: nur ein Versuch je Run', !v.open && /schweigt/.test(v.prompt || ''), v);

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Silo: ${ok.length} Prüfungen grün`);
await browser.close();
