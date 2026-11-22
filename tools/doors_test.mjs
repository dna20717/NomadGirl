// Türen (#174) im Browser: Durchgangstüren im Profil und Rückwand-Türen frontal. A shut door blocks Leyla and sight, E opens and shuts
// it, an enemy on the hunt opens it, shots and strikes break a wooden door (splinters, stays open), a bulkhead holds against strikes and
// only a grenade blows it, the broken door stays broken as Leyla's trace (#167) when she comes back, a paired front door leads into its
// side room and back; the cycle graph's locks and the switch doors wear the painted doors; no page errors.
// Server must run (npm run serve, or TEST_PORT / GAME_URL).   node tools/doors_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const base = process.env.GAME_URL || `http://localhost:${process.env.TEST_PORT || 8766}/game.html`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], ok = [];
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const open = async (poi, seed) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errs.push(m.text()); });
  await page.goto(`${base}?poi=${poi}&seed=${seed}`);
  await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 120000 });
  await page.evaluate(() => { nomad.take(); nomad.calm(); });
  return { page, errs };
};
const run = (page, body) => page.evaluate(`(async () => { ${PRE}\n${body} })()`);
// helpers in the page: the door by material, Leyla on the left of it (facing it)
const PRE = `
  const s = game.scene.getScene('play'), W = s.level.doorways, T = s.T;
  const byMat = (m, kind) => W.side.find(d => d.p.material === m && (!kind || d.p.kind === kind)) || W.side.find(d => d.p.material === m);
  const before = (d, k = 1.6) => { nomad.tp(d.cx - T * k, d.feet - 2); nomad.step(4, ['right']); nomad.step(20); };
  const at = d => ({ state: d.state, hp: d.hp, tile: s.room.tiles[d.y0][d.x], solid: s.pointSolid(d.cx, d.top + d.h / 2) });
`;

// ---------- 1. Bunker 13 seed 2: a steel door (seam), a bulkhead, a pair of front doors ----------
{
  const { page, errs } = await open('bunker_13', 2);
  const v = await run(page, `
    const st0 = nomad.state().level.doorways, d = byMat('steel');
    W.setState(d, 'closed', true);
    before(d);
    const x0 = s.leyla.x; nomad.step(90, ['right']); const blocked = s.leyla.x < d.cx - T * 0.4, a = at(d);
    const sight = s.lineFree(d.cx - T * 2, d.top + T, d.cx + T * 2, d.top + T);
    const near = s.level.nearest(); near?.act?.(); nomad.step(20);
    const b = at(d); nomad.step(120, ['right']); const passed = s.leyla.x > d.cx + T * 0.6;
    // shut it again from the far side, then an enemy on the other side hunts her through it
    nomad.tp(d.cx + T * 1.6, d.feet - 2); nomad.step(4, ['left']); nomad.step(10); const near2 = s.level.nearest(); near2?.act?.(); nomad.step(10); const shutAgain = at(d);
    nomad.tp(d.cx - T * 4, d.feet - 2); nomad.step(10);
    const e = s.addEnemy(Object.keys(s.data_.enemies).find(k => s.data_.enemies[k].behavior !== 'boss' && s.data_.enemies[k].behavior !== 'flyer' && s.data_.enemies[k].behavior !== 'shooter' && s.data_.enemies[k].kit) || 'schlaeger', d.x + 3, d.y1);
    const en = s.enemies.at(-1); en.state = 'engage'; en.lastSeen = s.time.now; en.lastKnown = { x: s.leyla.x, y: s.leyla.feet }; en.seeing = true;
    nomad.until(() => W.byEnemy?.length, 400);
    const byEnemy = [...(W.byEnemy || [])], afterEnemy = at(d);
    return { kinds: st0.side.map(x => x.kind + '/' + x.material), front: st0.front.length, links: st0.front.filter(f => f.link != null).length, blocked, a, sight, near: near?.text, b, passed, near2: near2?.text, shutAgain, byEnemy, afterEnemy, id: d.p.id };
  `);
  check(`Bunker 13: Türen geplant (${v.kinds.join(', ')}), ${v.front} Rückwand-Türen, ${v.links} echte`, v.kinds.length >= 3 && v.front >= 3 && v.links >= 2, v);
  check('Zu: Tür blockiert Leyla, Kachel fest, Sicht weg', v.blocked && v.a.solid && v.a.tile === '/' && !v.sight, v);
  check(`E öffnet („${v.near}“), Leyla läuft durch`, /öffnen/.test(v.near || '') && v.b.state === 'open' && !v.b.solid && v.passed, v);
  check(`E schließt von der anderen Seite („${v.near2}“)`, /schließen/.test(v.near2 || '') && v.shutAgain.state === 'closed', v);
  check('Gegner auf der Jagd öffnet die Tür', v.byEnemy.includes(v.id) && v.afterEnemy.state === 'open', v);
  // a bulkhead: strikes and shots bounce off, a grenade blows it
  const w = await run(page, `
    for (const e of s.enemies) if (e.alive) nomad.calmOne?.(e);
    nomad.calm();
    const d = byMat('bulkhead'); if (!d) return { none: true };
    W.setState(d, 'closed', true); d.hp = d.t.health;
    before(d, 1.2);
    for (let i = 0; i < 6; i++) nomad.step(30, [], ['melee']);
    const afterMelee = at(d);
    (await import('/game/play/throwables.js')).Throwables.of(s).throw({ x: d.cx - T * 0.8, y: d.feet - T, vx: 0, vy: 0, item: 'granate', fuse: 200, radius: 140, damage: 20, friendly: true });
    nomad.tp(d.cx - T * 5, d.feet - 2);
    nomad.step(120);
    return { afterMelee, afterBlast: at(d), hp0: d.t.health };
  `);
  check('Schott hält Hiebe aus, eine Granate sprengt es', !w.none && w.afterMelee.state === 'closed' && w.afterMelee.hp === w.hp0 && w.afterBlast.state === 'broken' && !w.afterBlast.solid, w);
  // front doors: E through a paired one leads into its side room and back
  const f = await run(page, `
    const a = W.front.find(o => o.link != null), b = W.front[a.link];
    nomad.tp(a.x, a.feet - 2); nomad.step(10);
    const near = s.level.nearest(); near?.act?.(); nomad.step(40);
    const there = { x: Math.round(s.leyla.x), feet: Math.round(s.leyla.feet) };
    const near2 = s.level.nearest(); near2?.act?.(); nomad.step(40);
    const back = { x: Math.round(s.leyla.x), feet: Math.round(s.leyla.feet) };
    const L = s.levelInfo, roomOf = (x, f) => L.rooms.find(r => x / T >= r.x && x / T < r.x + r.w && f / T - 1 >= r.y && f / T - 1 < r.y + r.h);
    return { near: near?.text, near2: near2?.text, there, back, a: { x: a.x, feet: a.feet, room: a.p.room }, b: { x: b.x, feet: b.feet, room: b.p.room, band: L.rooms.find(r => r.id === b.p.room)?.band }, thereRoom: roomOf(there.x, there.feet)?.id, went: W.went };
  `);
  check(`Rückwand-Tür führt in den Seitenraum (${f.a.room} → ${f.b.room}) und zurück`, f.near === 'Durch die Tür' && Math.abs(f.there.x - f.b.x) < 40 && Math.abs(f.there.feet - f.b.feet) < 40 && Math.abs(f.back.x - f.a.x) < 40 && f.went === 2
    && f.a.room !== f.b.room, f);
  if (shots) { fs.mkdirSync('output', { recursive: true }); await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(500); await page.screenshot({ path: 'output/doors_test_bunker.png' }); }
  check('Bunker 13: keine Seitenfehler', !errs.length, errs);
  await page.close();
}

// ---------- 2. Tankstelle seed 4: wooden doors break by shots and strikes, splinters, the trace stays ----------
{
  const { page, errs } = await open('tankstelle_km7', 4);
  const v = await run(page, `
    const woods = W.side.filter(d => d.p.material === 'wood');
    if (woods.length < 1) return { none: W.side.map(d => d.p.material) };
    const d = woods[0];
    // a savegame of its own for the traces (the test mode has none)
    const save = { day: 3, hour: 10, story: {} }, sf = s.storyFx; sf.on = true; sf.save = save; sf.node = 'test_km7';
    W.setState(d, 'closed', true); d.hp = d.t.health;
    before(d, 3);
    s.leyla.armed = 'on';
    let n = 0; while (d.state !== 'broken' && n < 40) { nomad.step(24, [], ['ranged']); n++; }
    const shot = { ...at(d), shots: n, hits: W.hits, splinters: s.children.list.filter(o => o.type === 'Rectangle' && o.depth === 9).length };
    const traces = JSON.parse(JSON.stringify(save.story.traces || {}));
    // a second wooden door (or the same one again) by strikes
    W.setState(d, 'closed', true); d.hp = d.t.health;
    before(d, 1.2);
    let m = 0; while (d.state !== 'broken' && m < 20) { nomad.step(26, [], ['melee']); m++; }
    const melee = { ...at(d), strikes: m };
    // she comes back: a new level object, the trace from the savegame breaks the door again
    W.setState(d, 'closed', true);
    sf.old = null; sf.applyTraces();
    return { shot, traces, melee, back: at(d), trace: d.trace, type: d.p.type };
  `);
  check(`Holztür: Schüsse zerstören sie (${v.shot?.shots} Schuss, Splitter ${v.shot?.splinters})`, v.shot?.state === 'broken' && !v.shot.solid && v.shot.splinters >= 5, v);
  check('Spur im Spielstand (#167): zerstörte Tür', Object.values(v.traces || {}).flat().some(t => t.kind === 'door'), v.traces);
  check(`Holztür: Hiebe zerstören sie (${v.melee?.strikes} Hiebe)`, v.melee?.state === 'broken', v);
  check('Beim nächsten Besuch bleibt sie zerstört (Spur)', v.back?.state === 'broken' && v.trace != null, v);
  // a locked door: E offers the hack (Glitch-Duell), enemies cannot open it
  const lk = await run(page, `
    const d = W.side.find(o => o !== W.side.find(q => q.p.material === 'wood')) || W.side[0];
    W.setState(d, 'locked', true); d.tried = false;
    before(d, 1.4);
    const near = s.level.nearest()?.text;
    const e = { x: d.cx + T * 0.9, feet: d.feet, w: 60, kind: 'raider', state: 'engage' };
    return { near, enemy: W.enemyAt(e, -1), state: d.state };
  `);
  check(`Verschlossen: E bietet Hacken an („${lk.near}“), Gegner kommen nicht durch`, /hacken/.test(lk.near || '') && lk.enemy === 'locked' && lk.state === 'locked', lk);
  if (shots) { await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(500); await page.screenshot({ path: 'output/doors_test_km7.png' }); }
  check('Tankstelle: keine Seitenfehler', !errs.length, errs);
  await page.close();
}

// ---------- 3. Tankstelle seed 1: the cycle graph's lock (key → Werkstatt-Tür) and the switch doors wear painted doors ----------
{
  const { page, errs } = await open('tankstelle_km7', 1);
  const p = await page.evaluate(() => { const s = game.scene.getScene('play'); return { locks: s.level.locks.map(o => ({ img: !!o.img, kind: o.info.kind, hatch: o.hatch })), doors: s.level.doors.map(d => !!d.img) }; });
  check(`Schlösser (#168) und Schalter-Türen tragen gemalte Türen (${p.locks.length} Schlösser, ${p.doors.length} Schalter-Türen)`, p.locks.length + p.doors.length > 0 && p.locks.every(o => o.img || o.hatch || o.kind === 'gate') && p.doors.every(Boolean), p);
  check('Tankstelle Seed 1: keine Seitenfehler', !errs.length, errs);
  await page.close();
}

// ---------- 4. #177 light: a shut door stops lamp light like a wall, open and broken ones let it through, the change shows at once ----------
{
  const { page, errs } = await open('bunker_13', 2);
  const v = await run(page, `
    const A = s.atmo; if (!A?.on) return { off: true };
    const d = byMat('steel') || W.side[0];
    nomad.tp(d.cx - T * 6, d.feet - 2); nomad.step(4);
    const lamp = { kind: 'bulb', x: d.cx - T * 2, y: d.top + T * 0.8, c: [255, 240, 220], radius: 520, strength: 1.4, behavior: 'steady', seed: 0.3, clip: null, halo: { setAlpha() {} }, haloA: 0, f: 1 };
    A.lights.push(lamp);
    // the lightmap pixel at a world point (rendered right now with only the test lamp on; headless steps do not move the camera, so point it at the door)
    const px = (wx, wy) => {   // what the test lamp adds to the lightmap there (with and without it, the other lamps off)
      s.cam.centerOn(d.cx, d.top); s.cam.preRender();
      const keep = A.lights.map(l => l.strength), read = () => { A.render(); const vw = s.cam.worldView, m = A.margin, k = A.k, q = A.ctx.getImageData(Math.floor((wx - (vw.x - m)) / k), Math.floor((wy - (vw.y - m)) / k), 1, 1).data; return q[0] + q[1] + q[2]; };
      A.lights.forEach(l => { l.strength = 0; }); const base = read(); lamp.strength = 1.4; const lit = read();
      A.lights.forEach((l, i) => { l.strength = keep[i]; });
      return lit - base;
    };
    const here = st => {
      W.setState(d, st, true); nomad.step(1);
      const fx = d.cx + T * 1.5, fy = d.top + T, nx = d.cx - T * 1.2;
      return { st, near: +A.lightAt(nx, fy).toFixed(3), far: +A.lightAt(fx, fy).toFixed(3), blockers: A.blocked.length, pxNear: px(nx, fy), pxFar: px(fx, fy) };
    };
    const rows = ['closed', 'locked', 'open', 'broken', 'closed'].map(here);
    A.lights.pop(); W.setState(d, 'closed', true);
    // switch doors and locks count as blockers while shut
    const L = s.level, shutSwitch = (L.doors || []).filter(g => !g.open).length + (L.locks || []).filter(g => !g.open).length;
    return { rows, shutSwitch, side: W.side.filter(x => W.shut(x)).length };
  `);
  const [c, lk, op, br, again] = v.rows || [];
  check(`Licht: zu hält Lampenlicht an (hinter der Tür ${c?.far} statt ${op?.far}, Lichtkarte ${c?.pxFar} statt ${op?.pxFar})`, !v.off && c.far < op.far - 0.15 && c.pxFar < op.pxFar * 0.3 && op.pxFar > 60, v);
  check('Licht: verschlossen ebenso, die Seite der Lampe bleibt hell', lk.far < op.far - 0.15 && Math.abs(lk.near - op.near) < 0.02 && c.pxNear > c.pxFar, v);
  check('Licht: offen und zerstört lassen es durch', Math.abs(br.far - op.far) < 0.02 && op.far > c.far, v);
  check('Licht: wieder zu, sofort wieder dunkel (Zustandswechsel)', Math.abs(again.far - c.far) < 0.02 && again.blockers === c.blockers && c.blockers === op.blockers + 1, v);
  check(`Licht: Schalter-Türen und Schlösser zählen mit (${v.shutSwitch} zu, ${v.side} Türen zu)`, c.blockers === v.side + v.shutSwitch, v);
  if (shots) {
    // a picture: the door shut with a lamp before it, then open (fog off, so only the light makes the difference)
    await page.evaluate(() => { const f = game.scene.getScene('play').fog; if (f?.F) Object.assign(f.F, { density: 0, remembered: 0, secretDensity: 0, walls: 0, fade: 1 }); });
    for (const st of ['closed', 'open']) {
      await page.evaluate(st => { const s = game.scene.getScene('play'), W = s.level.doorways, T = s.T, d = W.side.find(x => x.p.material === 'steel') || W.side[0];
        W.setState(d, st, true); nomad.tp(d.cx - T * 3, d.feet - 2); nomad.step(4);
        s.atmo.lights = s.atmo.lights.filter(l => !l.test); s.atmo.lights.push({ test: true, kind: 'bulb', x: d.cx - T * 1.5, y: d.top + T * 0.6, c: [255, 220, 170], radius: 560, strength: 1.6, behavior: 'steady', seed: 0.3, clip: null, halo: { setAlpha() {} }, haloA: 0, f: 1 }); nomad.step(2); }, st);
      await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(600);
      await page.screenshot({ path: `output/doors_test_light_${st}.png` });
      await page.evaluate(() => nomad.thaw());
    }
  }
  check('Bunker 13 Licht: keine Seitenfehler', !errs.length, errs);
  await page.close();
}

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
