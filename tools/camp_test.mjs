// Headless check of the camp mode (game.html?camp): van menu, warroom, a run and back, sleeping, the fire,
// companions, day/night, driving, knocked out, savegame. Server must run (npm run serve).
//   node tools/camp_test.mjs [--shots]   pictures to output/camp_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);   // workshops in the rig at the start (tools/test_fixture.mjs)
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = f => page.evaluate(f);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(250); await page.screenshot({ path: `output/camp_${n}.png` }); await ev(() => nomad.thaw()); };
// helpers inside the page
await ev(() => {
  nomad.take(); nomad.step(30);
  window.c = {
    to(name) { nomad.goTo(name); return nomad.state().prompt; },
    use() { nomad.step(1, [], ['grab']); return nomad.menu(); },
    pick(...labels) { for (const l of labels) nomad.choose(l); nomad.step(5); return nomad.state(); },
  };
});

let s = await ev(() => nomad.state());
check('Camp startet', s.mode === 'camp' && s.camp.clock === 'Tag 1 · 18:30' && s.camp.daytime === 'Abend', s.camp);
check('Rig: Van mit Schlafkoje + Warroom, Wohnanhänger mit Kochnische + Werkbank, Holzkiste mit Lagerregal', JSON.stringify(s.camp.van) === '["schlafkoje","warroom"]' && s.camp.rig[0]?.workshops.join() === 'kochnische,werkbank' && s.camp.rig[1]?.id === 'holzkiste' && s.camp.rig[1]?.workshops.join() === 'lagerregal', s.camp);
check('Leyla steht am Van, E-Hinweis', s.prompt === 'Einsteigen · Van', s.prompt);
await shot('start');

let m = await ev(() => { c.use(); return nomad.map(); });
check('Van-Tür öffnet direkt die Karte, der Ort hier ist gewählt, Werkstätten im Van als Knöpfe (#016)', m?.open && m.sel === m.here && m.action === 'Hier plündern' && m.extras.join('|') === 'Schlafen|Planen' && m.ready.some(r => /^Leben/.test(r)), m);
m = await ev(() => { nomad.choose('Planen'); const mp = game.scene.getScene('play').hud.map; mp.select(mp.state().near[0]); return nomad.map(); });
check('Warroom öffnet die Reisekarte: Start, Nachbarorte, Hinfahren (#007)', m?.open && m.here === 'tankstelle_km7' && m.near.length >= 2 && m.near.includes(m.sel) && m.action === 'Hinfahren', m);
{ const t = await ev(() => document.querySelector('.wm-cost')?.textContent || ''); check('Reisekarte: Kosten mit deutschen Zahlen', /\d+ km/.test(t) && /\d,\d+ l|\d+ l/.test(t), t); }
{ const h = await ev(() => { const mp = game.scene.getScene('play').hud.map; mp.select(mp.save.location); return mp.state(); }); check('Reisekarte: hier = Hier plündern', h.action === 'Hier plündern', h); }
await shot('warroom');

s = await ev(() => c.pick('Plündern'));
check('Run startet im POI-Level mit Van (Tankstelle, tools/poi_test.mjs prüft das Level)', s.mode === 'run' && s.level?.poi === 'tankstelle_km7' && s.prompt === 'Zurück ins Camp · Van' && !s.camp, { mode: s.mode, level: !!s.level, prompt: s.prompt });
await shot('run');
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(3); const m = nomad.menu(); nomad.choose('Hierbleiben'); nomad.step(3); const stay = nomad.state().mode; nomad.step(1, [], ['grab']); nomad.step(3); nomad.choose('Zurückreisen'); nomad.step(40); const H = game.scene.getScene('play').hud, sum = { ...H.sum.state(), title: H.sum.S?.title, poi: H.sum.S?.poi }; return { ...nomad.state(), sum, ask: m?.title, stay }; });
check('Am Van: Rückfrage „Wirklich zurückreisen?“, Hierbleiben bleibt im POI', s.ask === 'Wirklich zurückreisen?' && s.stay === 'run', { ask: s.ask, stay: s.stay });
check('Mit dem Van zurück ins Camp, Ankunft in der Dämmerung, Beute-Bilanz statt Banner (#017)', s.mode === 'camp' && s.camp.clock === 'Tag 2 · 18:30' && s.sum.open && s.sum.title === 'Zurück im Camp' && /Mile 7/.test(s.sum.poi) && !s.sum.grade, { mode: s.mode, sum: s.sum, clock: s.camp?.clock });
check('Dämmerung', s.camp.daytime === 'Abend', s.camp.daytime);
// #041: „Alles einlagern“ on the Beute-Bilanz: dishes and ingredients into a Kühlraum (here in place of the workbench, only for this check), the rest into the Camp-Lager
s = await ev(async () => { const { fitContainers } = await import('/game/save.js'); const sc = game.scene.getScene('play'), H = sc.hud, sv = nomad.save(), w = sv.rig.units[1].workshops.find(w => w.id === 'werkbank'), key = `store:1:${w.at}`;
  w.id = 'kuehlraum'; fitContainers(sc.data_, sv);
  const camp = sv.inv.grids.camp, n = id => camp.items.filter(e => e.id === id).reduce((k, e) => k + e.n, 0), scrap0 = n('schrott'), reis0 = n('reis');
  sv.inv.grids.backpack.items = [{ a: 'items', id: 'bohneneintopf', n: 1, x: 0, y: 0, r: 0 }, { a: 'items', id: 'reis', n: 2, x: 1, y: 0, r: 0 }, { a: 'items', id: 'schrott', n: 3, x: 2, y: 0, r: 0 }]; H.sum.draw();
  const before = H.sum.state().buttons, label = document.querySelector('.sum-stow')?.textContent; document.querySelector('.sum-stow')?.click();
  const after = H.sum.state(), r = { before, label, after: after.buttons, stowed: after.stowed, open: after.open, disabled: !!document.querySelector('.sum-stow')?.disabled, bag: sv.inv.grids.backpack.items.length,
    cool: sv.inv.grids[key]?.items.map(e => `${e.id}×${e.n}`), scrap: n('schrott') - scrap0, reis: n('reis') - reis0 };
  w.id = 'werkbank'; delete sv.inv.grids[key]; H.sum.close(); nomad.step(2); return r; });
check('Beute-Bilanz: „Alles einlagern“ bringt Gerichte + Zutaten in den Kühlraum, den Rest ins Camp-Lager, die Karte bleibt offen', s.before?.[0] === 'stow' && /Alles einlagern/.test(s.label || '') && s.open && s.disabled && s.bag === 0 && s.stowed?.moved === 3
  && s.cool?.includes('bohneneintopf×1') && s.cool?.includes('reis×2') && s.reis === 0 && s.scrap === 3, s);
s = await ev(() => { nomad.save().hour = 23; game.scene.getScene('play').goCamp({}); nomad.step(40); const sc = game.scene.getScene('play'); return { ...nomad.state(), door: sc.camp.doorLights.map(l => l.alpha), lightK: sc.camp.lightK }; });
check('Nachts: Licht quillt aus der offenen Van-Tür', s.camp.daytime === 'Nacht' && s.van.open && s.door[0] > 0.3, { d: s.camp.daytime, van: s.van, door: s.door });
await shot('night');

s = await ev(() => { c.use(); return c.pick('Schlafen', 'Schlafen'); });
check('Schlafen bis 7 Uhr mit Buff', s.camp.clock === 'Tag 3 · 07:00' && s.camp.buffs.includes('ausgeschlafen') && s.camp.daytime === 'Morgen', s.camp);
await shot('morning');

let p = await ev(() => c.to('Lagerfeuer'));
check('Hinweis am Lagerfeuer', p === 'Hinsetzen · Questlog · Lagerfeuer', p);
// Questlog (#016): at the campfire; offers from the companions, take one, follow it, deliver, reward
s = await ev(() => { const m = c.use(); nomad.choose('Questlog'); const sc = game.scene.getScene('play'), Q = sc.hud.quests, first = nomad.quests().tab; Q.open('active'); const a = { ...nomad.quests(), first };
  Q.open('offers'); const offers = nomad.quests().rows; Q.pick = offers.indexOf('offer:kabelsalat'); Q.act('ok'); const taken = nomad.quests();
  const sv = nomad.save(), d0 = sv.deltas; sc.hud.goalAt = 0; nomad.step(3); const goal = document.querySelector('.hud-goal')?.textContent || '';
  const g = sv.inv.grids.camp, cables = () => Object.values(sv.inv.grids).reduce((n, gr) => n + (gr?.items || []).filter(e => e.id === 'kupferkabel').reduce((k, e) => k + e.n, 0), 0); g.items.push({ a: 'items', id: 'kupferkabel', n: 5, x: g.w - 1, y: g.h - 1 }); const c0 = cables(); Q.draw();
  const ready = nomad.quests(); Q.pick = ready.rows.indexOf('side:kabelsalat!'); Q.act('ok');
  const after = { ...nomad.quests(), deltas: sv.deltas - d0, done: !!sv.quests.done.kabelsalat, cable: c0 - cables() };
  sv.deltas = d0; Q.close(); nomad.step(2);   // the later checks count from the start money
  return { menu: m?.items.map(i => i.label), a, offers, taken, goal, ready: ready.rows, after }; });
check('Lagerfeuer: Menü mit Hinsetzen und Questlog; neue Angebote zuerst, Aktiv beginnt mit der Hauptquest', s.menu?.join('|') === 'Hinsetzen|Questlog|Zurück' && s.a.first === 'offers' && s.a.open && s.a.rows[0] === 'main', s);
check('Questlog: Angebot annehmen, wird verfolgt und steht als Zielzeile im Bild', s.offers.includes('offer:kabelsalat') && s.taken.tab === 'active' && s.taken.tracked === 'kabelsalat' && /Kabelsalat/.test(s.goal), s);
check('Questlog: Kupferkabel da → abgeben, Belohnung, Kabel weg, wieder Hauptquest verfolgt', s.ready.includes('side:kabelsalat!') && s.after.done && s.after.deltas === 60 && s.after.cable === 5 && s.after.tracked === 'main', s);
// #017: companions talk jobs: „!“ over Schraube's head, the next job in the conversation (after Kabelsalat: Geier rupfen)
s = await ev(() => { const cp = game.scene.getScene('play').camp, sch = cp.companions.find(x => x.id === 'schraube'); cp.questMarks(); const mark = sch.markKind, hint = sch.spot.hint;
  nomad.goTo('Schraube'); const m = c.use(); nomad.choose('Auftrag: Geier'); const sub = [...document.querySelectorAll('.hud-talk .hud-item small')].map(e => e.textContent).join(' '); nomad.choose('Annehmen'); nomad.step(3);
  return { mark, hint, menu: m?.items.map(i => i.label), sub, active: Object.keys(nomad.save().quests.active), mark2: sch.markKind }; });
check('Companions: „!“ über Schraube, im Gespräch den Folgeauftrag annehmen (#017)', s.mark === 'offer' && s.hint === 'Reden · neuer Auftrag' && s.menu?.[0] === 'Auftrag: Geier rupfen' && /Belohnung/.test(s.sub || '') && s.active.includes('geier_rupfen') && !s.mark2, s);
p = await ev(() => c.to('Lagerfeuer'));
s = await ev(() => { game.scene.getScene('play').leyla.health = 40; c.use(); nomad.choose('Hinsetzen'); nomad.step(240); const st = nomad.state(), sp = game.scene.getScene('play').leyla.sprite; return { st, flip: sp.flipX, frame: sp.frame.name, prompt: st.prompt }; });
check('E am Feuer: Leyla setzt sich und zockt, schaut zum Feuer', s.st.leyla.state === 'sit' && s.prompt === 'Aufstehen · Lagerfeuer' && Number(s.frame) >= 6, s);
await shot('sit');
s = await ev(() => { nomad.step(60, ['right']); nomad.step(10); return nomad.state(); });
check('Aufstehen nach dem Sitzen: 1 h, heilt 25 %, Leyla bleibt dort', s.camp.clock === 'Tag 3 · 08:00' && s.health === 65 && Math.abs(s.leyla.x - s.camp.hotspots.find(h => h.name === 'Lagerfeuer').x) < 200, { clock: s.camp.clock, health: s.health, x: s.leyla.x });

p = await ev(() => c.to('Onkel Sung'));
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(3); const m = nomad.menu(); nomad.choose('Plaudern'); nomad.step(3); return { m: m?.items.map(i => i.label), text: game.scene.getScene('play').camp.companions.find(x => x.id === 'onkel_sung').bubble.text }; });
check('Companion redet per E: mit Auftrag im Angebot erst das Gespräch, „Plaudern“ gibt einen Spruch', p === 'Reden · neuer Auftrag · Onkel Sung' && s.m?.includes('Auftrag: Sungs Suppe') && s.text.length > 5, { p, s });
await shot('talk');

// #025: the notice board at the van: every job of the crew as notes; accept one, hand in a done one, collect the reward
p = await ev(() => c.to('Schwarzes Brett'));
s = await ev(() => {
  const cp = game.scene.getScene('play').camp, sv = nomad.save(), Q = sv.quests;
  nomad.step(1, [], ['grab']); nomad.step(3); const m = nomad.menu(), notes = document.querySelectorAll('.hud-board .hud-note').length;
  nomad.choose('Sungs Suppe'); const talk = !!document.querySelector('.hud-talk'); nomad.choose('Annehmen'); nomad.step(3);
  const after = nomad.menu(), accepted = !!Q.active.sungs_suppe;
  // pretend the soup is cooked: the job is ready, the board offers to hand it in
  Q.active.sungs_suppe.base = -10; cp.jobsChanged(); cp.scene.hud.closeMenu(); cp.boardMenu(); const d0 = sv.deltas;
  nomad.choose('Sungs Suppe'); nomad.choose('Abgeben'); nomad.step(3);
  const kinds = cp.board.notes.map(n => n.texture.key), gain = sv.deltas - d0;
  sv.deltas = d0;   // the k.o. check further down counts on the start money
  cp.scene.hud.closeMenu(); nomad.step(2);
  return { m: m?.title, notes, talk, after: after?.title, accepted, done: !!Q.done.sungs_suppe, gain, kinds, open: !!nomad.menu() };
});
check('Schwarzes Brett: Zettel je Auftrag, annehmen und abgeben, Belohnung kommt an (#025)', /Schwarzes Brett/.test(p) && s.m === 'Schwarzes Brett' && s.notes >= 1 && s.talk && s.after === 'Schwarzes Brett' && s.accepted && s.done && s.gain === 40, { p, s });

s = await ev(() => { nomad.step(900, ['left']); nomad.step(60); return nomad.state(); });   // the rig is longer since ×4 (09.11.2026)
check('Schacht links: Leyla bleibt am Rand stehen', s.leyla.feet === 768 && s.leyla.x > 4 * 64 && s.leyla.x < 5 * 64 + 10, s.leyla);
// #041: the chest is gone; E at the van's rear door (Kofferraum) opens the Camp-Lager
p = await ev(() => c.to('Kofferraum'));
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(60); return { st: nomad.state(), inv: nomad.inv() }; });
check('Keine Kiste mehr im Camp, E an der Hecktür öffnet das Camp-Lager', p === 'Öffnen · Kofferraum' && !s.st.camp.hotspots.some(h => h.name === 'Kiste') && !('chest' in s.st.camp) && s.inv?.open && s.inv.other?.key === 'camp' && s.inv.other.title === 'Camp-Lager', { p, inv: s.inv?.other && { key: s.inv.other.key, title: s.inv.other.title }, prompt: s.st.prompt });
await shot('camp_store');
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(60); return nomad.inv(); });
check('… und E schließt es wieder', !s?.open, s?.open);
// Daniel, 12.11.2026: W / ↑ (controller: stick up) counts as E while an E prompt shows; an open window pauses the game
s = await ev(() => { nomad.step(1, [], ['up']); nomad.step(20); const x0 = nomad.state().leyla.x, open = !!nomad.inv()?.open; nomad.step(40, ['dash'], ['dash']);   // a dash would move her (arrows would move the window's cursor)
  const x1 = nomad.state().leyla.x; nomad.step(1, [], ['grab']); nomad.step(60); return { open, moved: Math.abs(x1 - x0), closed: !nomad.inv()?.open }; });
check('W mit E-Hinweis öffnet das Camp-Lager, offenes Fenster pausiert (Leyla läuft nicht), E schließt', s.open && s.moved < 1 && s.closed, s);
s = await ev(() => { const near = (c.to('Lagerfeuer'), nomad.state().camp.sound.fire); c.to('Kochnische'); return { near, far: nomad.state().camp.sound.fire, wind: nomad.state().camp.sound.wind }; });
check('Feuer lauter, je näher Leyla ist; Wind läuft', s.near >= 80 && s.far < 15 && s.wind, s);

p = await ev(() => c.to('Kochnische'));
m = await ev(() => { c.use(); return nomad.craft(); });
check('Kochnische: E öffnet Kochen (Rezeptbuch + Experimentieren)', p === 'Kochen · Kochnische' && m?.open && m.workshop === 'kochnische', { p, m });
await page.keyboard.press('Escape');

s = await ev(() => { c.to('Van'); c.use(); nomad.choose('Planen'); const m = nomad.map(), to = m.near[0], fuel0 = nomad.save().fuel, cost = game.scene.getScene('play').hud.map.host.cost(to); const st = c.pick(to); return { ...st, to, want: Math.round((fuel0 - cost.fuel) * 10) / 10, visited: nomad.save().map.visited.includes(to) }; });
const drove = s.to;
check('Fahren: Nachbarort auf der Karte, Sprit, Ankunft in der Dämmerung, als besucht markiert', s.camp.location === s.to && /18:30$/.test(s.camp.clock) && s.camp.fuel === s.want && s.visited, { camp: s.camp, to: s.to, want: s.want });
await shot('day');

s = await ev(() => { c.to('Van'); c.use(); nomad.choose('Planen'); c.pick('Plündern'); const sc = game.scene.getScene('play'); const hp = sc.leyla.maxHealth; sc.deltas = 50; sc.leyla.hurt(sc.time.now, 9999, 0); nomad.step(200); return { ...nomad.state(), hp }; });
check('Abwehr-Buff lässt das Leben gleich', s.hp === 100, s.hp);
check('k.o.: AvA bringt sie ins Camp, Beute weg (Δ bleiben beim Startgeld), 30 % Leben, Buffs verbraucht', s.mode === 'camp' && s.health === 30 && s.camp.deltas === (await ev(() => game.scene.getScene('play').data_.economy?.startDeltas ?? 0)) && !s.camp.buffs.length && /AvA/.test(s.banner), { mode: s.mode, health: s.health, camp: s.camp });

const saved = await ev(() => JSON.parse(localStorage.getItem('nomadgirl-save')));
check('Spielstand gespeichert (dieser Browser)', saved?.location === drove && saved.health === 30 && saved.run === null, saved);
// reload: the savegame comes back
await page.goto(url.replace('&new', ''));
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
s = await ev(() => { nomad.take(); nomad.step(5); return nomad.state(); });
check('Neu laden: Spielstand ist wieder da', s.camp.location === drove && /18:30$/.test(s.camp.clock) && s.health === 30, s.camp);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);

