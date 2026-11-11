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
//   nomad.drone('kill')               show a drone mood
//   nomad.screenOf(x, y)              world position → page position
//   nomad.state().van                 van door frame, open, roof platform
//   nomad.state().light               light & atmosphere: lamps, glowing clutter, mood at Leyla, searchlight, brightness at Leyla / ahead
//   nomad.state().level               POI level: chests, switches, doors, brittle walls, goal, secrets, ranking (done)
//   nomad.state().camp                camp (game.html?camp): clock, place, Δ, prompt, hotspots, rig; .menu = open menu
//   nomad.menu() / nomad.choose(i | 'text')   the open menu / pick an item (index or part of its label)
//   nomad.walkTo(x)                   walks Leyla to an x position (camp), then E with step(1, [], ['grab'])
//   nomad.goTo(name)                  walks to a camp hotspot by name; a workshop: up onto the floor of its container (E counts only there)
//   nomad.build()                     building the rig in the camp (B): rig, budgets, scrapyard, jobs, undo
//   nomad.buildSpots()                page positions of places, couplings, trailers, scrapyard, dealer (drag with page.mouse)
//   nomad.craft()                     cooking/crafting panel at a workshop (E in the camp): book, pot, log, stock
//   nomad.save()                      the savegame
//   nomad.release()                   keyboard again, game runs normally
// Input names: left right up down jump walk dash melee ranged grab restart help (= Esc, Menü) controls (= H, Steuerung) debug pose build inventory holster (= Q, Waffe ziehen/wegstecken)

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
    menu() { return scene().hud.menuState(); },
    choose(which) {
      const h = scene().hud, items = h.menuItems || [];
      const i = typeof which === 'number' ? which : items.findIndex(it => it.label.toLowerCase().includes(String(which).toLowerCase()));
      const ok = h.choose(i);
      api.step(2);
      return ok;
    },
    goTo(name) {
      const sc = scene(), h = sc.camp?.hotspots.find(h => h.name === name || h.name?.startsWith?.(name));
      if (!h) return null;
      api.walkTo(h.x);
      const l = sc.leyla;
      if (h.floor != null && Math.abs(l.feet - h.floor) > 4) { l.body.reset(h.x, h.floor - l.size.h / 2); api.step(20); }   // as if she had jumped in
      return api.state();
    },
    walkTo(x, max = 900) {
      for (let i = 0; i < max; i++) {
        const l = scene().leyla, d = x - l.x;
        if (Math.abs(d) < 12) { api.step(20); break; }
        api.step(1, [d > 0 ? 'right' : 'left', ...(Math.abs(d) < 160 ? ['walk'] : [])]);
      }
      return api.state();
    },
    save() { return scene().box?.save || null; },
    build() { return scene().hud.build?.state() || null; },   // building in the camp (B): rig, budgets, Δ, scrapyard, Leyla's jobs, undo
    buildSpots() { return scene().hud.build?.spots() || null; },   // page positions of places, couplings, units, scrapyard items, dealer (for real mouse drags)
    craft() { return scene().hud.craft?.state() || null; },   // open cooking/crafting panel: recipe book, pot, last result
    inv() { return scene().hud.inv?.state() || null; },   // open inventory: grids, slots, held thing
    loot() { return scene().loot?.state() || null; },     // bundles on the ground (run)
    drone(mood) { scene().drone.react(mood); return scene().drone.mood; },
    light(on) { const a = scene().atmo; if (on !== undefined) a?.show(on); return a?.state() || null; },   // light & atmosphere: state, light(false) = all off (comparison), light(true) = on   // show a drone mood (tests, pictures)
    screenOf(x, y) {   // world position → page position (close-up pictures, mouse)
      const c = scene().cam, r = game.canvas.getBoundingClientRect(), kx = r.width / game.scale.width, ky = r.height / game.scale.height;
      return { x: r.left + (x - c.worldView.x) * c.zoom * kx, y: r.top + (y - c.worldView.y) * c.zoom * ky };
    },
    state() {
      const s = scene(), l = s.leyla, r = n => Math.round(n);
      return {
        room: s.roomId, time: s.clock(), kills: s.kills, deltas: s.deltas, cleared: s.cleared,
        fog: s.fog?.state?.() || { on: false }, fogAtLeyla: s.fog?.at?.(l.x, l.feet - 40) ?? 0,
        leyla: { state: l.state, x: r(l.x), feet: r(l.feet), tile: [Math.floor(l.x / s.T), Math.round(l.feet / s.T)], vx: r(l.body.velocity.x), vy: r(l.body.velocity.y), facing: l.facing, health: l.health, ammo: l.ammo, mag: l.mag, reloading: !!l.reloading, armed: l.armed,
          fight: { on: !!l.fight?.on, manual: l.fight?.manual ?? null, seen: !!l.fight?.seen }, style: s.shootStyle(), look: l.sprite.anims.currentAnim?.key || l.sprite.texture.key,
          recoil: !!l.recoilImg?.visible, recoilShown: l.recoilShown || 0, target: s.combat.target ? r(s.combat.target.body.center.x) : null },
        enemies: s.enemies.map(e => ({ id: e.id, state: e.state, x: r(e.x), feet: r(e.feet), hp: e.hp })),
        drone: s.drone && { mood: s.drone.mood, x: r(s.drone.x), y: r(s.drone.y), face: s.drone.faceFrame, cables: s.drone.cables.lines().map(c => c.pts.at(-1).map(r)), flip: s.drone.sprite.scaleX < 0 },
        van: s.van?.state(),
        level: s.level?.state() || null,
        light: s.atmo?.state() || null,
        mode: s.mode, prompt: s.hud.promptText, menu: s.hud.menuState(), banner: s.hud.bannerEl.hidden ? null : s.hud.bannerEl.textContent,
        camp: s.camp?.state(), health: Math.round(s.leyla.health), maxHealth: s.leyla.maxHealth,
      };
    },
  };
  return api;
}
