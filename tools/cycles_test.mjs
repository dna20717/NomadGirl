// #168 G2 the cycle graph in the browser: Schlüssel und Schloss in a POI. Mile 7 (side by side): the door into the workshop hall stays
// shut without the key, the toilet key lies in the side room, E picks it up (HUD lists it), the door opens with it and Leyla walks
// through. Pit 6 (deep): the hatch in the joint ladder, key, open, climb down through it. #175: the hatch opens from the ladder below
// (E and a tap ↑, the controller's use), and the ladder of a one-way hole comes down from the landing (way back up to the van).
// Server must run (npm run serve).   node tools/cycles_test.mjs [--shots]   pictures to output/cycles_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], ok = [];
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';

async function open(poi, seed, recipe = 'lockKey') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errs.push(m.text()); });
  // the recipe is pinned to Schlüssel und Schloss (POIs › Struktur › Rezepte), so the check does not hang on one seed's roll
  const pois = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/pois.json', import.meta.url), 'utf8'));
  pois[poi].cycles = { ...pois[poi].cycles, recipes: [{ recipe, weight: 1 }] };
  await page.addInitScript(p => localStorage.setItem('nomadgirl-drafts:data/pois.json', JSON.stringify(p)), pois);
  await page.goto(`${base}?poi=${poi}&seed=${seed}`);
  await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 120000 });
  await page.evaluate(() => { nomad.take(); nomad.calm?.(); window.T = game.scene.getScene('play').T; });
  return { page, errs, ev: (f, a) => page.evaluate(f, a) };
}
const shot = async (page, name) => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.evaluate(() => { const s = game.scene.getScene('play'); s.cam.centerOn(s.leyla.x, s.leyla.feet - 120); nomad.freeze(); }); await page.waitForTimeout(400); await page.screenshot({ path: `output/cycles_${name}.png` }); await page.evaluate(() => nomad.thaw()); };
const keyRow = page => page.evaluate(() => { const r = document.querySelector('.hud-carry'); return r && !r.hidden ? r.textContent : ''; });

// ---------- Mile 7: a door in the seam ----------
{
  const { page, errs, ev } = await open('tankstelle_km7', 1);
  let s = await ev(() => { const st = nomad.state(), L = game.scene.getScene('play').levelInfo; return { lv: st.level, graph: L.graph.circles, cyc: L.cycles }; });
  check('Mile 7: Graph mit Schlüssel und Schloss, ein Schlüssel, ein Schloss', s.graph[0].recipe === 'lockKey' && s.lv.keys.length === 1 && s.lv.locks.length === 1 && !s.lv.locks[0].hatch, s);
  check('Mile 7: Schlüssel aus der Story', /Toilettenschlüssel/.test(s.lv.keys[0].name) && s.lv.locks[0].name === 'Tür zur Werkstatt', s.lv);
  check('HUD: noch kein Schlüssel', !(await keyRow(page)), null);
  // in front of the lock without the key: it says what it needs, and it holds
  s = await ev(() => {
    const o = nomad.state().level.locks[0]; nomad.tp((o.x0 - 1.2) * T, o.y1 * T); nomad.step(6);
    const p = nomad.state().prompt; nomad.step(60, ['right']);
    return { p, x: nomad.state().leyla.x, wall: o.x0 * T };
  });
  check('Schloss: sagt, was fehlt', /verschlossen, braucht: Toilettenschlüssel/.test(s.p || ''), s.p);
  check('Schloss: Leyla kommt nicht durch', s.x < s.wall, s);
  await shot(page, 'lock_shut');
  // the key: E picks it up, the HUD shows it
  s = await ev(() => {
    const k = nomad.state().level.keys[0]; nomad.tp(k.x - 40, k.feet); nomad.step(8);
    const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(30);
    return { p, lv: nomad.state().level };
  });
  check('Schlüssel: E-Hinweis „aufheben“', /aufheben$/.test(s.p || ''), s.p);
  check('Schlüssel: aufgehoben', s.lv.keys[0].taken && s.lv.held.length === 1, s.lv);
  check('HUD: Schlüssel-Zeile nennt ihn', /Toilettenschlüssel/.test(await keyRow(page)), await keyRow(page));
  await shot(page, 'key_taken');
  s = await ev(() => {
    const o = nomad.state().level.locks[0]; nomad.tp((o.x0 - 1.2) * T, o.y1 * T); nomad.step(6);
    const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(40);
    const lv = nomad.state().level; nomad.step(90, ['right']);
    return { p, open: lv.locks[0].open, held: lv.held, x: nomad.state().leyla.x, wall: o.x1 * T, tile: game.scene.getScene('play').room.tiles[o.y1 - 1][o.x0] };
  });
  check('Schloss: E-Hinweis „öffnen“ mit dem Schlüssel', /^Tür zur Werkstatt öffnen/.test(s.p || ''), s.p);
  check('Schloss: offen, der Schlüssel ist verbraucht', s.open && !s.held.length && s.tile === '.', s);
  check('Schloss: Leyla geht hindurch', s.x > s.wall, s);
  await shot(page, 'lock_open');
  check('Mile 7: ohne Fehler', !errs.length, errs);
  await page.close();
}

// ---------- Pit 6: a hatch in the ladder ----------
{
  const { page, errs, ev } = await open('pit6', 2);
  let s = await ev(() => { const st = nomad.state(); return { lv: st.level }; });
  const lock = s.lv.locks[0];
  check('Pit 6: Luke in der Leiter, Grubenmarke', lock?.hatch && lock.name === 'Förderkorb-Luke' && /Grubenmarke/.test(s.lv.keys[0]?.name || ''), s.lv);
  // stand on the hatch: shut, it carries (4 s, so the Wow camera of the Kristalldom has run)
  s = await ev(() => { const o = nomad.state().level.locks[0]; nomad.tp((o.x0 + 0.5) * T, o.y0 * T); nomad.step(240); const p = nomad.state().prompt; nomad.step(40, ['down']); return { p, feet: nomad.state().leyla.feet, top: o.y0 * T, state: nomad.state().leyla.state }; });
  check('Luke: sagt, was fehlt, und trägt', /verschlossen, braucht: Grubenmarke/.test(s.p || '') && s.feet <= s.top + 4, s);
  await shot(page, 'hatch_shut');
  s = await ev(() => {
    // calm frames first: ↓ held on the hatch would still drop her through a platform under the key
    nomad.step(40); const k = nomad.state().level.keys[0]; nomad.tp(k.x - 40, k.feet); nomad.step(8); nomad.step(1, [], ['grab']); nomad.step(20);
    const o = nomad.state().level.locks[0]; nomad.tp((o.x0 + 0.5) * T, o.y0 * T); nomad.step(20);
    const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(30);
    const open = nomad.state().level.locks[0].open;
    nomad.until(st => st.leyla.state === 'climb', 60, ['down']);
    nomad.until(st => st.leyla.feet > (o.y1 + 3) * T, 600, ['down']);
    return { p, open, feet: nomad.state().leyla.feet, below: (o.y1 + 3) * T, tile: game.scene.getScene('play').room.tiles[o.y0][o.x0] };
  });
  check('Luke: öffnet mit der Grubenmarke und wird zur Leiter', /^Förderkorb-Luke öffnen/.test(s.p || '') && s.open && s.tile === 'H', s);
  check('Luke: Leyla klettert hindurch nach unten', s.feet > s.below, s);
  await shot(page, 'hatch_open');
  check('Pit 6: ohne Fehler', !errs.length, errs);
  await page.close();
}

// ---------- #175 Pit 6: the hatch from the ladder below (Daniel: „Auf Leitern kann man keine Keycard benutzen“) ----------
{
  const { page, errs, ev } = await open('pit6', 2);
  const s = await ev(() => {
    nomad.step(240); const k = nomad.state().level.keys[0]; nomad.tp(k.x - 40, k.feet); nomad.step(8); nomad.step(1, [], ['grab']); nomad.step(20);
    const o = nomad.state().level.locks[0];
    nomad.tp((o.x0 + 0.5) * T, (o.y1 + 4) * T); nomad.step(3);
    nomad.until(st => st.leyla.state === 'climb', 30, ['up']);
    nomad.step(90, ['up']); nomad.step(6);
    const st = nomad.state(), p = st.prompt, state = st.leyla.state;
    nomad.step(1, [], ['up']); nomad.step(20);   // a tap ↑ on the ladder = use (keyboard W / ↑, the controller's stick)
    const lv = nomad.state().level;
    return { p, state, open: lv.locks[0].open, held: lv.held, tile: game.scene.getScene('play').room.tiles[o.y0][o.x0] };
  });
  check('Luke von unten: auf der Leiter steht der Hinweis „öffnen“', s.state === 'climb' && /^Förderkorb-Luke öffnen/.test(s.p || ''), s);
  check('Luke von unten: ↑ auf der Leiter öffnet mit der Grubenmarke', s.open && !s.held.length && s.tile === 'H', s);
  await shot(page, 'hatch_from_ladder');
  check('Luke von der Leiter: ohne Fehler', !errs.length, errs);
  await page.close();
}

// ---------- #175 Pit 6: Einbahn hinunter, the ladder comes down from the landing ----------
{
  const { page, errs, ev } = await open('pit6', 1, 'oneWayDown');
  const s = await ev(() => {
    const sc = game.scene.getScene('play'), f = nomad.state().level.lifts[0];
    if (!f) return { none: true };
    const top = Math.min(...f.tiles.map(t => t[1]));
    nomad.tp(f.x, f.feet); nomad.step(240);
    const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(20);
    const down = nomad.state().level.lifts[0].down, tile = sc.room.tiles[top][f.tiles[0][0]];
    nomad.until(st => st.leyla.state === 'climb', 60, ['up'], ['up']);
    nomad.until(st => st.leyla.feet <= top * T + 2, 900, ['up']); nomad.step(20);
    return { p, down, tile, feet: nomad.state().leyla.feet, top: top * T };
  });
  check('Einbahn: an der Landestelle „Leiter herunterlassen“', /^Leiter herunterlassen/.test(s.p || ''), s);
  check('Einbahn: die Leiter ist unten', s.down && s.tile === 'H', s);
  check('Einbahn: Leyla klettert wieder hinauf', s.feet <= s.top + 4, s);
  await shot(page, 'lift_up');
  check('Einbahn-Leiter: ohne Fehler', !errs.length, errs);
  await page.close();
}

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
