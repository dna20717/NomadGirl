// Slow motion (#164 Wende-Wurf, Daniel 21.11.2026: „kurzer Zeitlupen-Moment beim Loslassen“).
// The scene runs on a game clock: real loop time minus everything slow motion held back (scene.clockShift). While it is slow,
// the clock, physics, tweens, timers and animations run at „factor“; the length counts in real time. Everything that reads
// scene.now, scene.time.now or the update's time sees the same game clock, so nomad.step stays deterministic.

// start (or stretch) a slow moment: ms in real time, factor 0.05 … 1
export function startSlow(scene, ms, factor) {
  if (!(ms > 0) || !(factor < 1)) return;
  const f = Math.max(0.05, factor), S = scene.slowmo;
  if (S && S.until != null && S.factor <= f) { S.extra = Math.max(S.extra || 0, ms); return; }
  scene.slowmo = { ms, factor: f, until: null, extra: 0 };
  scene.slowCount = (scene.slowCount || 0) + 1;
}

// once at the top of scene.update: real loop time → game time
export function slowClock(scene, time, delta) {
  const S = scene.slowmo;
  let f = 1;
  if (S) {
    if (S.until == null) S.until = time + S.ms;   // starts with the next frame (the move asked for it in the last one)
    if (S.extra) { S.until = Math.max(S.until, time + S.extra); S.extra = 0; }
    if (time < S.until) f = S.factor; else scene.slowmo = null;
  }
  scene.clockShift = (scene.clockShift || 0) + (f < 1 ? delta * (1 - f) : 0);
  scale(scene, f);
  const now = time - scene.clockShift;
  if (scene.time) scene.time.now = now;   // the scene's own clock reads the same (projectiles, voices, the drone use it)
  return { time: now, delta: delta * f };
}

function scale(scene, f) {
  if (scene.slowScale === f || (scene.slowScale == null && f === 1)) return;
  scene.slowScale = f;
  const w = scene.physics?.world;
  // Arcade: one fixed step per frame stays, each step covers less time (smooth, no stutter)
  if (w) w._frameTime = f / (w.fps || 60);
  if (scene.time) scene.time.timeScale = f;
  if (scene.tweens) scene.tweens.timeScale = f;
  if (scene.anims) scene.anims.globalTimeScale = f;
}

export function slowState(scene) {
  const S = scene.slowmo;
  return { active: !!S, factor: S ? S.factor : 1, count: scene.slowCount || 0, shift: Math.round(scene.clockShift || 0) };
}
