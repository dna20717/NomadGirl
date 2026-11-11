// Animation audit: plays Leyla through many situations and logs every frame (animation, frame, paused),
// then reports flicker (A→B→A within a few frames), restarts (a looping animation jumping back to frame 1 early)
// and stalls (a running animation that does not advance). node tools/anim_audit.mjs [room]
import { chromium } from 'playwright';
const room = process.argv[2] || 'kampfraum';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://localhost:8766/game.html?room=' + room);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 20000 });
const report = await page.evaluate(() => {
  const s = game.scene.getScene('play'), l = s.leyla, log = [];
  const rec = tag => { const a = l.sprite.anims; log.push({ tag, k: a.currentAnim?.key || l.sprite.texture.key, f: a.currentFrame?.index ?? Number(l.sprite.frame.name) + 1, p: a.isPaused, ts: +a.timeScale.toFixed(2), st: l.state, arm: l.armed, vx: Math.round(l.body.velocity.x) }); };
  const go = (tag, n, hold = [], tap = []) => { for (let i = 0; i < n; i++) { nomad.step(1, hold, i === 0 ? tap : []); rec(tag); } };
  nomad.take(); nomad.calm();
  const T = s.T, floor = s.room?.h ? null : null;
  const start = () => { nomad.tp(l.start[0], l.start[1]); nomad.step(30); };
  start(); go('idle', 200);
  go('walk', 90, ['right', 'walk']); go('stop-walk', 40);
  start(); go('run', 90, ['right']); go('brake', 50);
  start(); go('run-left', 60, ['left']); go('turn', 40, ['right']); go('stop', 40);
  start(); go('accel', 30, ['right']); go('walk-run', 40, ['right', 'walk']); go('walk-run2', 40, ['right']);
  start(); go('jump', 70, [], ['jump']); go('jump-run', 70, ['right', 'jump'], ['jump']);
  start(); go('dbl', 15, ['jump'], ['jump']); go('dbl2', 60, ['jump'], ['jump']);
  start(); go('run-dash', 20, ['right']); go('dash', 40, ['right'], ['dash']);
  start(); go('slide', 20, ['right']); go('slide2', 50, ['right', 'down'], ['down']); go('slide3', 30);
  start(); go('crouch', 40, ['down']); go('crouch-up', 40);
  start(); go('melee', 40, [], ['melee']); go('melee-walk', 40, ['right', 'walk'], ['melee']);
  start(); go('draw', 5, [], ['holster']); go('drawn', 60); go('shoot', 30, [], ['ranged']); go('walk-gun', 60, ['right', 'walk']); go('run-gun', 60, ['right']); go('run-shoot', 30, ['right'], ['ranged']); go('reload', 100, ['right'], ['reload']); go('stop-gun', 60); go('holster', 40, [], ['holster']);
  start(); go('yoga', 120, [], ['pose']); go('yoga-out', 60, [], ['pose']);
  // sweep: run right through the room, jumping when blocked, double jump and dash now and then (ledges, ladders, landings)
  start(); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1500; i++) {
    const blocked = l.body.blocked.right, tap = [];
    if (blocked || rnd() < 0.02) tap.push('jump'); if (rnd() < 0.01) tap.push('dash'); if (rnd() < 0.01) tap.push('down');
    nomad.step(1, ['right', ...(rnd() < 0.5 ? ['jump'] : []), ...(l.state === 'hang' ? ['up'] : [])], tap); rec('sweep' + Math.floor(i / 100));
  }
  // analysis
  const out = { frames: log.length, flicker: [], restart: [], stall: [] };
  const fps = k => s.data_.assets?.[k]?.fps || 10;
  for (let i = 2; i < log.length; i++) {
    const a = log[i - 2], b = log[i - 1], c = log[i];
    if (a.k === c.k && b.k !== a.k && a.tag === c.tag) out.flicker.push(`${c.tag}: ${a.k}→${b.k}→${c.k} (${b.st}/${b.arm} vx ${b.vx})`);
  }
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i], n = s.data_.assets?.[b.k]?.frames || 1;
    if (a.k === b.k && !a.p && !b.p && b.f < a.f && !(a.f >= n - 1 && b.f <= 2) && a.tag === b.tag) out.restart.push(`${b.tag}: ${b.k} ${a.f}→${b.f} (${b.st}/${b.arm})`);
  }
  // a standing frame between two movements (Daniel, 11.11.2026: no idle flash between two animations that are not idle)
  out.idleFlash = [];
  const idle = k => /idle/.test(k);
  for (let i = 1; i < log.length; i++) {
    if (!idle(log[i].k) || idle(log[i - 1].k) || log[i].tag !== log[i - 1].tag) continue;
    let j = i; while (j < log.length && idle(log[j].k) && log[j].tag === log[i].tag) j++;
    if (j < log.length && j - i <= 4 && log[j].tag === log[i].tag && !idle(log[j].k)) out.idleFlash.push(`${log[i].tag}: ${log[i - 1].k} → ${j - i}× Stehen → ${log[j].k} (${log[i].st}, vx ${log[i].vx})`);
  }
  let run = 1;
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i];
    if (a.k === b.k && a.f === b.f && !b.p && b.ts > 0.2) { run++; const lim = 60 / fps(b.k) / b.ts * 2.2; const n = s.data_.assets?.[b.k]?.frames || 1; const loop = s.data_.assets?.[b.k]?.loop !== false; if (run > lim && (loop || b.f < n) && run === Math.ceil(lim) + 1) out.stall.push(`${b.tag}: ${b.k} Frame ${b.f} steht ${run} Schritte (ts ${b.ts}, ${b.st}/${b.arm})`); }
    else run = 1;
  }
  out.seq = {};
  for (const r of log) { (out.seq[r.tag] ??= []); const q = out.seq[r.tag]; const last = q[q.length - 1]; const key = r.k.replace('leyla_', '') + (r.p ? '⏸' : ''); if (!last || last[0] !== key) q.push([key, r.f, 1]); else last[2]++; }
  return out;
});
const uniq = a => [...new Set(a)];
console.log('Frames:', report.frames);
console.log('\nFlackern:', uniq(report.flicker).slice(0, 40).join('\n  ') || '–');
console.log('\nNeustart mitten drin:', uniq(report.restart).slice(0, 40).join('\n  ') || '–');
console.log('\nHängt:', uniq(report.stall).slice(0, 40).join('\n  ') || '–');
console.log('\nStehen blitzt auf:', uniq(report.idleFlash).slice(0, 40).join('\n  ') || '–');
if (process.argv.includes('--seq')) for (const [t, q] of Object.entries(report.seq)) console.log(t.padEnd(10), q.map(([k, f, n]) => `${k}@${f}×${n}`).join(' '));
await browser.close();
