// #169 G3 Leben im Browser: Lager mit Gegnern (Feuerstelle, Leute am Lager), eine Runde läuft durch die Nachbarräume und kehrt zurück,
// Fraktionen kämpfen (ein Spähtrupp der Rivalen gegen die Gang des Orts), die Regie wechselt Aufbau → Spitze → Ruhe, die Sirene bringt in
// der Ruhe keine Verstärkung, die Atempause zwingt Ruhe, die Musik-Schicht folgt, nach 10 Tagen sieht der Ort anders aus.
// Server must run (npm run serve) or use tools/test_all.mjs.   node tools/life_test.mjs [--shots]   pictures to output/life_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], ok = [];
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)?.slice(0, 900)}`);
const base = process.env.GAME_URL || 'http://localhost:8766/game.html';

async function open(poi, seed, days = 0) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errs.push(m.text()); });
  await page.goto(`${base}?poi=${poi}&seed=${seed}${days ? `&days=${days}` : ''}`);
  await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 120000 });
  await page.evaluate(() => { nomad.take(); window.S = () => game.scene.getScene('play'); window.T = S().T; window.safe = () => { const l = S().leyla; l.health = l.maxHealth; }; });
  return { page, errs, ev: (f, a) => page.evaluate(f, a) };
}
// a picture: Leyla stands a little left of (x, feet), so the darkness opens there (she does nothing; the step is short)
const shot = async (page, name, x, feet) => {
  if (!shots) return;
  fs.mkdirSync('output', { recursive: true });
  await page.evaluate(([x, feet]) => { const s = S(); const keep = s.leyla.x, kf = s.leyla.feet; window.back = [keep, kf]; nomad.tp(x - 260, feet); for (let i = 0; i < 4; i++) { nomad.step(6); safe(); } s.cam.centerOn(x, feet - 200); nomad.freeze(); }, [x, feet]);
  await page.waitForTimeout(600); await page.screenshot({ path: `output/life_${name}.png` });
  await page.evaluate(() => { nomad.thaw(); nomad.tp(...window.back); });
};

// ---------- Bunker 13: camps, a round, a feud, the director ----------
{
  const { page, errs, ev } = await open('bunker_13', 3);
  let s = await ev(() => { nomad.step(20); return nomad.state(); });
  const L = s.life, D = s.director;
  check('Leben an, Lager im Level', L?.on && L.camps.length >= 1, L);
  check('Lager haben Leute (aus der Lagergröße)', L.camps.every(c => c.members.length >= 1 && c.members.every(m => m.alive)), L.camps);
  check('Leute stehen am Lager', L.camps.every(c => c.members.every(m => m.x >= (c.x0 - 1) * 64 && m.x <= (c.x1 + 2) * 64)), L.camps);
  check('Lager: gemalte Requisiten (Feuerstelle, Vorräte)', L.props.includes('life_campfire'), L.props);
  check('Gegner gehören zu Lagern statt zu Spawn-Punkten', L.removed > 0, { removed: L.removed, sentries: L.sentries });
  check('Regie an, Aufbau', D?.on && D.phase === 'build', D);
  const camp = L.camps[0];
  // a round: Leyla stays at the entrance, the round walker leaves the fire and comes back
  s = await ev(() => { for (let i = 0; i < 60; i++) { nomad.step(30); safe(); } return nomad.state().life; });
  const walker = s.camps.flatMap(c => c.members).find(m => m.role === 'round');
  check('Runde: einer geht seine Runde (und kehrt um)', walker && walker.rounds >= 1, s.camps);
  check('Entspannt: am Lager wird nicht gekämpft, solange keine Gefahr', s.camps.every(c => c.members.every(m => ['patrol', 'feud', 'alert', 'search'].includes(m.state))), s.camps);
  await shot(page, 'camp', (camp.cx + 0.5) * 64, (camp.y + 1) * 64);
  // a rival patrol next to the camp: Salt Dogs against Rust Guard
  s = await ev(c => {
    const sc = S(), [a] = c.route, col = Math.max(a - 1, c.x0 - 5);
    const out = [];
    for (let k = 0; k < 2; k++) { const e = sc.addEnemy('schlaeger', col - k, c.y, 'Salt Dogs'); e.life = { faction: 'rival', gang: 'Salt Dogs' }; e.facing = 1; out.push(e.id); }
    const hp0 = sc.enemies.filter(e => e.life?.camp === c.id).reduce((n, e) => n + e.hp, 0);
    for (let i = 0; i < 70; i++) { nomad.step(10); safe(); }
    const hp1 = sc.enemies.filter(e => e.life?.camp === c.id).reduce((n, e) => n + Math.max(0, e.hp), 0);
    return { life: nomad.state().life, hp0, hp1 };
  }, camp);
  check('Fraktionen: Rivalen und Gang reagieren aufeinander', s.life.feuds >= 2 && s.life.feudLog.some(f => f.how === 'fight'), s.life);
  check('Fraktionen: sie verletzen sich gegenseitig (moderat)', s.hp1 < s.hp0, s);
  await shot(page, 'feud', (camp.cx - 2) * 64, (camp.y + 1) * 64);
  s = await ev(() => { for (let i = 0; i < 300; i++) { nomad.step(10); safe(); } return nomad.state(); });
  check('Fraktionen: einer fällt durch die anderen, Leylas Kills bleiben 0', s.life.feudKills >= 1 && s.kills === 0, { fk: s.life.feudKills, kills: s.kills });
  // the director: tension to the peak (music: combat), then calm (no help from a siren), back to the build-up
  s = await ev(() => {
    const d = S().director, seen = new Set();
    d.st.tension = 95; nomad.step(5); const peak = { phase: d.st.phase, layer: d.layer };
    for (const e of S().enemies) nomad.calmOne(e);
    for (let i = 0; i < 400 && d.st.phase !== 'relax'; i++) { nomad.step(5); seen.add(d.st.phase); }
    const relax = { phase: d.st.phase, layer: d.layer, help: d.allowHelp() };
    for (let i = 0; i < 400 && d.st.phase !== 'build'; i++) nomad.step(10);
    return { peak, relax, back: d.st.phase, changes: d.changes, log: d.st.log };
  });
  check('Regie: Spitze → Musik-Schicht Kampf', s.peak.phase === 'peak' && s.peak.layer === 'combat', s);
  check('Regie: Ruhe → Musik-Schicht Ruhe, keine Verstärkung', s.relax.phase === 'relax' && s.relax.layer === 'calm' && s.relax.help === false, s);
  check('Regie: danach wieder Aufbau, die Schicht hat gewechselt', s.back === 'build' && s.changes >= 3, s);
  check('Bunker 13: ohne Fehler', !errs.length, errs);
  await page.close();
}

// ---------- the siren in the calm, the Atempause, Wow start ----------
{
  const { page, errs, ev } = await open('ministerium', 2);
  let s = await ev(() => {
    const sc = S(), d = sc.director, LI = sc.levelInfo, rest = LI.rooms.find(r => r.rest), wow = LI.rooms.find(r => r.wow), out = {};
    if (rest) { nomad.tp((rest.x + 3) * T, (rest.y + rest.h - 1) * T); nomad.step(8); out.rest = { phase: d.st.phase, help: d.allowHelp(), ctx: d.ctx(sc.now) }; }
    if (wow) { nomad.tp((wow.x + 3) * T, (wow.y + wow.h - 1) * T); nomad.step(8); d.st.phase = 'build'; out.wow = { help: d.allowHelp(), ctx: d.ctx(sc.now) }; }
    return out;
  });
  check('Atempause: Regie in Ruhe, keine Verstärkung', s.rest?.phase === 'relax' && s.rest.help === false, s);
  check('Wow-Raum: in den ersten Sekunden keine Verstärkung', s.wow?.help === false && s.wow.ctx.wow, s);
  // a siren while the director is calm: it howls, the help stays out
  s = await ev(() => {
    const sc = S(), d = sc.director, m = sc.levelInfo.rooms.filter(r => r.band === 'main')[1];
    d.st.phase = 'relax'; d.st.since = d.st.t; d.room = null;
    nomad.tp((m.x + 4) * T, (m.y + m.h - 1) * T); nomad.step(4);
    const e = sc.addEnemy('sirene', m.x + 8, m.y + m.h - 2); e.facing = -1;
    const n0 = sc.enemies.length;
    for (let i = 0; i < 260 && !sc.lastSiren; i++) { nomad.step(2); safe(); }
    return { siren: sc.lastSiren, added: sc.enemies.length - n0 };
  });
  check('Sirene in der Ruhe: heult, aber keine Verstärkung', s.siren && s.siren.held && !s.siren.adds.length, s);
  check('Ministerium: ohne Fehler', !errs.length, errs);
  await page.close();
}

// ---------- the place 10 days later ----------
{
  const a = await open('storm_drain9', 4), b = await open('storm_drain9', 4, 10);
  const sa = await a.ev(() => { nomad.step(10); return nomad.state().life; }), sb = await b.ev(() => { nomad.step(10); return nomad.state().life; });
  check('Nach 10 Tagen: anderer Tag, anderer Zustand', sb.day === sa.day + 10 && JSON.stringify(sb.state) !== JSON.stringify(sa.state), { a: sa.state, b: sb.state, log: sb.log });
  check('Nach 10 Tagen: die Simulation hat erzählt (Log)', sb.log.length > 0 && sb.news.length > 0, sb);
  await shot(b.page, 'nest', (sb.camps[0].cx + 0.5) * 64, (sb.camps[0].y + 1) * 64);
  check('Storm Drain: ohne Fehler', !a.errs.length && !b.errs.length, [...a.errs, ...b.errs]);
  await a.page.close(); await b.page.close();
}

// ---------- the workshop: Leben and the Ökosystem view of a POI ----------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errs.push(m.text()); });
  await page.goto(base.replace('game.html', 'workshop.html'));
  await page.waitForFunction(() => window.workshop?.p && !document.querySelector('#load.loading-on'), null, { timeout: 30000 });
  await page.evaluate(() => window.workshop.go({ area: 'life' }));
  const life = await page.evaluate(() => document.body.innerText);
  check('Werkstatt › Leben: Beziehungen, Lager-Typen, Simulation, Regie', ['Beziehungen', 'Lager-Typen', 'Simulation', 'Regie'].every(t => life.includes(t)), life.slice(0, 300));
  await page.evaluate(() => window.workshop.go({ area: 'pois', choice: 'bunker_13' }));
  const eco = async () => page.evaluate(() => { const h = [...document.querySelectorAll('h4')].find(x => x.textContent === 'Ökosystem'); const box = h?.nextElementSibling; return { has: !!h, text: box?.innerText || '', canvas: !!box?.querySelector('canvas') }; });
  let e = await eco();
  check('Werkstatt › POI: Ökosystem mit Diagramm', e.has && e.canvas && /nach 10 Tagen/.test(e.text), e);
  await page.evaluate(() => { const h = [...document.querySelectorAll('h4')].find(x => x.textContent === 'Ökosystem'); [...h.nextElementSibling.querySelectorAll('button')].find(b => b.textContent === '30 Tage').click(); });
  const e30 = await eco();
  check('Werkstatt › Ökosystem: 30 Tage simulieren ändert den Zustand', /nach 30 Tagen/.test(e30.text) && e30.text !== e.text, e30.text.slice(0, 200));
  if (shots) { fs.mkdirSync('output', { recursive: true }); await page.evaluate(() => [...document.querySelectorAll('h4')].find(x => x.textContent === 'Ökosystem').scrollIntoView()); await page.waitForTimeout(300); await page.screenshot({ path: 'output/life_workshop.png' }); }
  check('Werkstatt: ohne Fehler', !errs.length, errs);
  await page.close();
}

await browser.close();
console.log(`life_test: ${ok.length} ok, ${errors.length} Fehler`);
for (const e of errors) console.log('  ✗ ' + e);
process.exitCode = errors.length ? 1 : 0;
