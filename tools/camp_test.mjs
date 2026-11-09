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
    to(name) { const h = nomad.state().camp.hotspots.find(h => h.name === name); nomad.walkTo(h.x); return nomad.state().prompt; },
    use() { nomad.step(1, [], ['grab']); return nomad.menu(); },
    pick(...labels) { for (const l of labels) nomad.choose(l); nomad.step(5); return nomad.state(); },
  };
});

let s = await ev(() => nomad.state());
check('Camp startet', s.mode === 'camp' && s.camp.clock === 'Tag 1 · 18:30' && s.camp.daytime === 'Abend', s.camp);
check('Rig: Van mit Schlafkoje + Warroom, Wohnanhänger mit Kochnische + Werkbank, Holzkiste mit Lagerregal', JSON.stringify(s.camp.van) === '["schlafkoje","warroom"]' && s.camp.rig[0]?.workshops.join() === 'kochnische,werkbank' && s.camp.rig[1]?.id === 'holzkiste' && s.camp.rig[1]?.workshops.join() === 'lagerregal', s.camp);
check('Leyla steht am Van, E-Hinweis', s.prompt === 'Einsteigen · Van', s.prompt);
await shot('start');

let m = await ev(() => c.use());
check('Van-Menü', m?.items.map(i => i.label).join('|') === 'Schlafen · Schlafkoje|Planen · Warroom|Zurück', m);
m = await ev(() => { nomad.choose('Planen'); return nomad.menu(); });
check('Warroom: Plündern + 3 Ziele', m?.title === 'Warroom' && m.items[0].label.startsWith('Plündern') && m.items.filter(i => i.label.startsWith('Hinfahren')).length === 3, m);
check('Warroom: deutsche Zahlen', /2,5 l Sprit/.test(m?.items[1]?.sub), m?.items[1]);
await shot('warroom');

s = await ev(() => c.pick('Plündern'));
check('Run startet im Ersatzraum mit Van', s.mode === 'run' && s.room === 'kampfraum' && s.prompt === 'Zurück ins Camp · Van' && !s.camp, { mode: s.mode, room: s.room, prompt: s.prompt });
await shot('run');
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(5); return nomad.state(); });
check('Mit dem Van zurück ins Camp, Ankunft in der Dämmerung', s.mode === 'camp' && s.camp.clock === 'Tag 2 · 18:30' && /Zurück im Camp/.test(s.banner) && /Tag 2 · 18:30/.test(s.banner), { mode: s.mode, banner: s.banner, clock: s.camp?.clock });
check('Dämmerung', s.camp.daytime === 'Abend', s.camp.daytime);
s = await ev(() => { nomad.save().hour = 23; game.scene.getScene('play').goCamp({}); nomad.step(40); const sc = game.scene.getScene('play'); return { ...nomad.state(), door: sc.camp.doorLights.map(l => l.alpha), lightK: sc.camp.lightK }; });
check('Nachts: Licht quillt aus der offenen Van-Tür', s.camp.daytime === 'Nacht' && s.van.open && s.door[0] > 0.3, { d: s.camp.daytime, van: s.van, door: s.door });
await shot('night');

s = await ev(() => { c.use(); return c.pick('Schlafen', 'Schlafen'); });
check('Schlafen bis 7 Uhr mit Buff', s.camp.clock === 'Tag 3 · 07:00' && s.camp.buffs.includes('ausgeschlafen') && s.camp.daytime === 'Morgen', s.camp);
await shot('morning');

let p = await ev(() => c.to('Lagerfeuer'));
check('Hinweis am Lagerfeuer', p === 'Hinsetzen · Lagerfeuer', p);
s = await ev(() => { game.scene.getScene('play').leyla.health = 40; nomad.step(1, [], ['grab']); nomad.step(240); const st = nomad.state(), sp = game.scene.getScene('play').leyla.sprite; return { st, flip: sp.flipX, frame: sp.frame.name, prompt: st.prompt }; });
check('E am Feuer: Leyla setzt sich und zockt, schaut zum Feuer', s.st.leyla.state === 'sit' && s.prompt === 'Aufstehen · Lagerfeuer' && Number(s.frame) >= 6, s);
await shot('sit');
s = await ev(() => { nomad.step(60, ['right']); nomad.step(10); return nomad.state(); });
check('Aufstehen nach dem Sitzen: 1 h, heilt 25 %, Leyla bleibt dort', s.camp.clock === 'Tag 3 · 08:00' && s.health === 65 && Math.abs(s.leyla.x - s.camp.hotspots.find(h => h.name === 'Lagerfeuer').x) < 200, { clock: s.camp.clock, health: s.health, x: s.leyla.x });

p = await ev(() => c.to('Onkel Sung'));
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(3); return game.scene.getScene('play').camp.companions.find(x => x.id === 'onkel_sung').bubble.text; });
check('Companion redet per E', p === 'Reden · Onkel Sung' && s.length > 5, { p, s });
await shot('talk');

s = await ev(() => { nomad.step(900, ['left']); nomad.step(60); return nomad.state(); });   // the rig is longer since ×4 (09.11.2026)
check('Schacht links: Leyla bleibt am Rand stehen', s.leyla.feet === 768 && s.leyla.x > 4 * 64 && s.leyla.x < 5 * 64 + 10, s.leyla);
p = await ev(() => c.to('Kiste'));
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(60); return nomad.state(); });
check('Kiste geht mit E auf', p === 'Öffnen · Kiste' && s.camp.chest.open && s.camp.chest.frame === 4 && s.prompt === 'Schließen · Kiste', { p, chest: s.camp.chest, prompt: s.prompt });
await shot('chest');
s = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(60); return nomad.state(); });
check('… und wieder zu', !s.camp.chest.open && s.camp.chest.frame === 0, s.camp.chest);
s = await ev(() => { const near = (c.to('Lagerfeuer'), nomad.state().camp.sound.fire); c.to('Kochnische'); return { near, far: nomad.state().camp.sound.fire, wind: nomad.state().camp.sound.wind }; });
check('Feuer lauter, je näher Leyla ist; Wind läuft', s.near >= 80 && s.far < 15 && s.wind, s);

p = await ev(() => c.to('Kochnische'));
m = await ev(() => { c.use(); return nomad.craft(); });
check('Kochnische: E öffnet Kochen (Rezeptbuch + Experimentieren)', p === 'Kochen · Kochnische' && m?.open && m.workshop === 'kochnische', { p, m });
await page.keyboard.press('Escape');

s = await ev(() => { c.to('Van'); c.use(); nomad.choose('Planen'); return c.pick('Bunker'); });
check('Fahren: Ort, Sprit, Ankunft in der Dämmerung', s.camp.location === 'bunker_13' && s.camp.clock === 'Tag 3 · 18:30' && s.camp.fuel === 34.5, s.camp);
await shot('day');

s = await ev(() => { c.to('Van'); c.use(); nomad.choose('Planen'); c.pick('Plündern'); const sc = game.scene.getScene('play'); const hp = sc.leyla.maxHealth; sc.deltas = 50; sc.leyla.hurt(sc.time.now, 9999, 0); nomad.step(200); return { ...nomad.state(), hp }; });
check('Abwehr-Buff lässt das Leben gleich', s.hp === 100, s.hp);
check('k.o.: Mama-Bot bringt sie ins Camp, Beute weg (Δ bleiben beim Startgeld), 30 % Leben, Buffs verbraucht', s.mode === 'camp' && s.health === 30 && s.camp.deltas === (await ev(() => game.scene.getScene('play').data_.economy?.startDeltas ?? 0)) && !s.camp.buffs.length && /Mama-Bot/.test(s.banner), { mode: s.mode, health: s.health, camp: s.camp });

const saved = await ev(() => JSON.parse(localStorage.getItem('nomadgirl-save')));
check('Spielstand gespeichert (dieser Browser)', saved?.location === 'bunker_13' && saved.health === 30 && saved.run === null, saved);
// reload: the savegame comes back
await page.goto(url.replace('&new', ''));
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
s = await ev(() => { nomad.take(); nomad.step(5); return nomad.state(); });
check('Neu laden: Spielstand ist wieder da', s.camp.location === 'bunker_13' && s.camp.clock === 'Tag 4 · 18:30' && s.health === 30, s.camp);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(`\n${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);

