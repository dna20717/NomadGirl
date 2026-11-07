// Remote control of the game for Ava (and tests): window.nomad.
// Takes over the input, steps the game frame by frame without rendering (independent of the real frame rate)
// and reports the state. The keyboard works again after nomad.release().
//
//   nomad.take()                      control on: game loop stops, input comes from here
//   nomad.step(frames, hold?, tap?)   hold = ['right', 'jump'] for all frames, tap = ['melee'] pressed in the first frame → state
//   nomad.until(test, max, hold?, tap?)  steps until test(state) is true (test as function or JS text)
//   nomad.tp(x, feet) / nomad.tpTile(col, row)   put Leyla somewhere (feet on top of tile row)
//   nomad.state()                     Leyla, enemies, kills, Δ, time
//   nomad.calm() / nomad.restart()    enemies off / room fresh
//   nomad.freeze() / nomad.thaw()     show the current frame (for screenshots), then continue stepping
//   nomad.release()                   keyboard again, game runs normally
// Input names: left right up down jump walk dash melee ranged grab restart help debug

const FRAME = 1000 / 60;

export function installControl(game) {
  const scene = () => game.scene.getScene('play');
  let T = 0, held = new Set(), tapped = new Set(), active = false;
  const steps = n => { for (let f = 0; f < n; f++) { T += FRAME; game.headlessStep(T, FRAME); } };
  const fn = f => typeof f === 'function' ? f : new Function('s', `return (${f})`);
  const api = {
    take() {
      const s = scene();
      if (active) return api.state();
      active = true; T = game.loop.now || 10000;
      game.loop.sleep();
      s.hud.toggleHelp(false);
      s.script = () => { const i = {}; for (const n of Object.keys(s.keys)) i[n] = { down: held.has(n), pressed: tapped.has(n) }; tapped.clear(); return i; };
      return api.state();
    },
    release() { const s = scene(); active = false; s.script = null; api.thaw(); game.loop.wake(); return api.state(); },
    step(frames = 1, hold = [], tap = []) {
      if (!active) api.take();
      held = new Set(hold); for (const k of tap) tapped.add(k);
      steps(frames); held.clear();
      return api.state();
    },
    until(test, max = 600, hold = [], tap = []) {
      const t = fn(test); let v = api.state();
      for (let i = 0; i < max && !t(v); i++) v = api.step(1, hold, i === 0 ? tap : []);
      return v;
    },
    tp(x, feet) { const l = scene().leyla; l.body.reset(x, feet - l.body.height / 2); l.body.setVelocity(0, 0); return api.step(10); },
    tpTile(col, row) { const T_ = scene().T; return api.tp((col + 0.5) * T_, row * T_); },
    calm() { for (const e of scene().enemies) if (e.alive) { e.state = 'dead'; e.body.enable = false; e.sprite.setVisible(false); e.warn.setVisible(false); e.bar.clear(); e.aim.clear(); } return api.state(); },
    restart() { scene().restartRoom(); return api.step(5); },
    freeze() { const s = scene(); s.hud.paused = true; s.tweens.pauseAll(); s.time.paused = true; game.loop.wake(); },
    thaw() { const s = scene(); if (active) game.loop.sleep(); s.hud.paused = false; s.tweens.resumeAll(); s.time.paused = false; },
    state() {
      const s = scene(), l = s.leyla, r = n => Math.round(n);
      return {
        room: s.roomId, time: s.clock(), kills: s.kills, deltas: s.deltas, cleared: s.cleared,
        leyla: { state: l.state, x: r(l.x), feet: r(l.feet), tile: [Math.floor(l.x / s.T), Math.round(l.feet / s.T)], vx: r(l.body.velocity.x), vy: r(l.body.velocity.y), facing: l.facing, health: l.health, ammo: l.ammo },
        enemies: s.enemies.map(e => ({ id: e.id, state: e.state, x: r(e.x), feet: r(e.feet), hp: e.hp })),
      };
    },
  };
  return api;
}
