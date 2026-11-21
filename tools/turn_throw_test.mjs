// Headless check of the Wende-Wurf (#164): during the dash the opposite direction + grenade turns Leyla around,
// the grenade flies flat backwards, she skids on the old way looking back, it costs a charge and stamina,
// a short slow motion starts at the release and ends again; without a charge or stamina the dash goes on; a late press right
// after the dash still counts (Leyla › Wende-Wurf › Puffer). Picture: output/turn_throw.png (at the release, in slow motion).
// python3 -m http.server 8766 &  node tools/turn_throw_test.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=gegner_arena';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => !document.querySelector('#load.loading-on'), null, { timeout: 15000 });
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 15000 });
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const ev = (fn, arg) => page.evaluate(fn, arg);

await ev(() => {
  const s = game.scene.getScene('play'), T = s.T, FLOOR = 15 * T;
  nomad.take();
  window.TT = {
    s, T, FLOOR,
    // fresh start: no enemies, full stamina and charges, Leyla at a column facing right
    reset(col = 12) {
      nomad.calm(); s.combat.clear(); s.throwables?.list.splice(0); nomad.step(2);
      const l = s.leyla, G = l.grenade;
      l.invulnerableUntil = 1e12; l.health = l.maxHealth; l.attack = null; l.combo = null; l.state = 'normal'; l.tt = null;
      nomad.tp((col + 0.5) * T, FLOOR); l.facing = 1; nomad.step(30);
      l.stamina = l.maxStamina; G.charges = G.c.charges; G.refillAt = null; G.pose = null;
      return l;
    },
    friendly() { return (s.throwables?.list || []).filter(p => p.friendly); },
  };
});

// ---------- the move: dash right, left + T ----------
const m = await ev(() => {
  const { s } = TT, l = TT.reset(10), G = l.grenade, out = {};
  const st0 = nomad.state();
  out.before = { stamina: st0.turnThrow.stamina, charges: st0.grenade.charges };
  nomad.step(1, ['right'], ['dash']); nomad.step(3, ['right']);
  out.dashState = l.state;
  const x0 = l.x;
  nomad.step(1, ['left'], ['grenade']);
  out.started = { state: l.state, count: nomad.state().turnThrow.count, stamina: Math.round(l.stamina) };
  // until the grenade leaves her hand
  let st = nomad.until(() => TT.friendly().length > 0, 90);
  const p = TT.friendly()[0];
  out.throw = p ? { vx: Math.round(p.vx), vy: Math.round(p.vy), turn: !!p.turn } : null;
  out.atRelease = { facing: l.facing, vx: Math.round(l.body.velocity.x), state: l.state, charges: G.state().charges };
  // slow motion: the next frames run on a slower game clock, then it ends
  const t0 = s.now; nomad.step(1); const slowStep = s.now - t0;
  out.slow = { active: nomad.state().turnThrow.slow.active, step: Math.round(slowStep * 10) / 10 };
  nomad.until(st => !st.turnThrow.slow.active, 60);
  const t1 = s.now; nomad.step(1); out.slowAfter = { active: nomad.state().turnThrow.slow.active, step: Math.round((s.now - t1) * 10) / 10 };
  out.gx = p ? Math.round(p.x) : null;
  nomad.until(() => l.state !== 'turnThrow', 120);
  out.end = { state: l.state, x: Math.round(l.x), dx: Math.round(l.x - x0), facing: l.facing };
  out.grenadeX = TT.friendly()[0] ? Math.round(TT.friendly()[0].x) : null;
  out.charges = G.state().charges; out.stamina = Math.round(l.stamina);
  out.cost = l.TT.stamina; out.legs = nomad.state().leyla.look;
  nomad.until(() => TT.friendly().length === 0, 400);
  return out;
});
check('Wende-Wurf: Dash rechts + links + T startet den Move', m.dashState === 'dash' && m.started.state === 'turnThrow' && m.started.count === 1, m);
check('Wende-Wurf: Granate fliegt flach nach links', m.throw && m.throw.vx < -900 && m.throw.vy > -500 && m.throw.vy < 0 && m.throw.turn && m.grenadeX < m.end.x - 200, m);
check('Wende-Wurf: Leyla rutscht weiter nach rechts, Blick links', m.atRelease.vx > 0 && m.atRelease.facing === -1 && m.end.dx > 60 && m.end.facing === -1, m);
check('Wende-Wurf: eine Ladung weniger, Ausdauer weniger', m.charges === m.before.charges - 1 && m.started.stamina <= m.before.stamina - 25 - m.cost + 1, m);
check('Wende-Wurf: Zeitlupe greift und endet', m.slow.active && m.slow.step < 9 && !m.slowAfter.active && m.slowAfter.step > 15, m);
check('Wende-Wurf: danach wieder normal', m.end.state === 'normal', m);

// ---------- without a charge / without stamina: the dash goes on ----------
const no = await ev(() => {
  const { s } = TT, out = {};
  let l = TT.reset(10), G = l.grenade;
  G.charges = 0;
  const n0 = l.turnThrows || 0;
  nomad.step(1, ['right'], ['dash']); nomad.step(3, ['right']);
  nomad.step(1, ['left'], ['grenade']);
  out.charge = { state: l.state, count: (l.turnThrows || 0) - n0, flying: TT.friendly().length, denied: l.turnDenied };
  nomad.step(30);
  l = TT.reset(10); G = l.grenade;
  l.stamina = 30;   // enough for the dash (25), not for the move after it
  nomad.step(1, ['right'], ['dash']); nomad.step(3, ['right']);
  const ch = G.state().charges;
  nomad.step(1, ['left'], ['grenade']);
  out.stamina = { state: l.state, count: (l.turnThrows || 0) - n0, charges: G.state().charges - ch, flying: TT.friendly().length, denied: l.turnDenied };
  nomad.step(30);
  return out;
});
check('Wende-Wurf: ohne Ladung kein Move, der Dash läuft weiter', no.charge.state === 'dash' && no.charge.count === 0 && no.charge.flying === 0 && no.charge.denied === 'charges', no);
check('Wende-Wurf: ohne Ausdauer kein Move, keine Ladung weg', no.stamina.state === 'dash' && no.stamina.count === 0 && no.stamina.charges === 0 && no.stamina.flying === 0 && no.stamina.denied === 'stamina', no);

// ---------- late press right after the dash (Puffer) ----------
const late = await ev(() => {
  const l = TT.reset(10), n0 = l.turnThrows || 0;
  nomad.step(1, ['right'], ['dash']);
  nomad.until(() => l.state !== 'dash', 30, ['right']);
  nomad.step(2, ['right']);
  nomad.step(1, ['left'], ['grenade']);
  const out = { state: l.state, count: (l.turnThrows || 0) - n0 };
  nomad.until(() => l.state !== 'turnThrow', 120);
  nomad.until(() => TT.friendly().length === 0, 400);
  // too late: a normal throw, no move
  TT.reset(10);
  nomad.step(1, ['right'], ['dash']);
  nomad.until(() => l.state !== 'dash', 30, ['right']);
  nomad.step(20, ['right']);
  nomad.step(1, ['left'], ['grenade']);
  out.tooLate = { state: l.state, count: (l.turnThrows || 0) - n0, throwing: l.grenade.state().throwing };
  nomad.step(60);
  return out;
});
check('Wende-Wurf: kurz nach dem Dash zählt der Druck noch (Puffer)', late.state === 'turnThrow' && late.count === 1, late);
check('Wende-Wurf: später = normaler Wurf', late.tooLate.state !== 'turnThrow' && late.tooLate.count === 1 && late.tooLate.throwing, late);

// ---------- picture: at the release, in slow motion, a pursuer behind her ----------
fs.mkdirSync('output', { recursive: true });
await ev(() => {
  const { s } = TT, l = TT.reset(22);
  nomad.spawn('kriecher', 14, 14); const e = s.enemies.at(-1); e.S.sight = 0; e.readyAt = 1e12;
  nomad.step(1, ['right'], ['dash']); nomad.step(3, ['right']);
  nomad.step(1, ['left'], ['grenade']);
  nomad.until(() => TT.friendly().length > 0, 90);
  nomad.step(5);
  nomad.freeze();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'output/turn_throw.png' });
await ev(() => nomad.thaw());

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
console.log('Bild: output/turn_throw.png');
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Wende-Wurf ok: ${ok.length} Prüfungen.`);
