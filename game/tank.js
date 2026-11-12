// The cryo tank (design.md › Progression, Techtree & die Suche): AvA's body sleeps in it, her mind is parked in the drone.
// Pure logic, browser and Node, no DOM. Values come from the area "Cryo-Tank" (data/tank.json).
//
// save.tank = { cond: 0–100, at: hours on the clock when cond was last brought up to date, dead, rescues, since: day the run of the game began }
// Decay runs in event time (Ereignis-Zeit): whatever moved the clock (driving, sleeping, a run, cooking) is caught up by update().
// Per hour: rate × (1 + accel × (100 − cond) / 100) × (1 + days in this run of the game × aging) × bonus (Techtree, < 1 = slower).
// A rescue on a knock-out costs `rescue` %; is the tank already below that, it is the last rescue: Leyla is saved, AvA dies.

export const clockHours = save => (save.day ?? 1) * 24 + (save.hour ?? 0);
const clamp = v => Math.max(0, Math.min(100, v));

export function ensureTank(D, save) {
  const T = D.tank || {};
  save.tank ??= { cond: T.start ?? 100, at: clockHours(save), dead: false, rescues: 0, since: save.day ?? 1 };
  save.tank.at ??= clockHours(save);
  save.tank.since ??= save.day ?? 1;
  return save.tank;
}

// how fast it decays right now (% per hour); bonus = factor from the Techtree (0.85 = −15 %), accelBonus scales the acceleration
export function rate(D, save, mods = {}) {
  const T = D.tank || {}, t = save.tank, days = Math.max(0, (save.day ?? 1) - (t.since ?? 1));
  return (T.rate ?? 0.4) * (1 + (T.accel ?? 1) * (mods.accel ?? 1) * (100 - t.cond) / 100) * (1 + days * (T.aging ?? 0.05)) * (mods.decay ?? 1);
}

// catch up with the clock: hour by hour (the rate changes as the condition falls). → the condition lost
export function update(D, save, mods = {}) {
  const t = ensureTank(D, save);
  if (t.dead || D.tank?.enabled === false) { t.at = clockHours(save); return 0; }
  const now = clockHours(save), before = t.cond;
  let h = now - t.at;
  while (h > 0 && t.cond > 0) { const step = Math.min(1, h); t.cond = clamp(t.cond - rate(D, save, mods) * step); h -= step; }
  t.at = now;
  if (t.cond <= 0) { t.cond = 0; t.dead = true; t.diedOn = save.day; t.cause = 'decay'; }
  return before - t.cond;
}

// the phase for a condition: Cryo-Tank › Phasen (from the top: the first row whose "ab" the condition reaches); dead = { dead: true }
export function phase(D, save) {
  const t = save.tank, rows = [...(D.tank?.phases || [])].sort((a, b) => (b.from ?? 0) - (a.from ?? 0));
  if (!t || t.dead) return { index: rows.length + 1, name: D.tank?.deadName || 'Tot', dead: true };
  const i = rows.findIndex(r => t.cond >= (r.from ?? 0));
  const k = i < 0 ? rows.length - 1 : i;
  return { ...rows[k], index: k + 1 };
}

// a knock-out in a run: AvA brings Leyla back and pays with the tank. → { cost, last }
export function rescue(D, save, mods = {}) {
  const t = ensureTank(D, save), cost = (D.tank?.rescue ?? 12) * (mods.rescue ?? 1);
  if (t.dead) return { cost: 0, last: false, dead: true };
  t.rescues = (t.rescues || 0) + 1;
  if (t.cond <= cost) { t.cond = 0; t.dead = true; t.diedOn = save.day; t.cause = 'rescue'; return { cost, last: true }; }
  t.cond = clamp(t.cond - cost);
  return { cost, last: false };
}

// maintenance (Rezepte › Tank-Wartung): +gain %, only while the tank is not worse than `upTo` (phase number; a leak is no job for tape)
export function canMaintain(D, save, r) {
  const t = save.tank;
  if (!t || t.dead) return { ok: false, reason: 'Der Tank ist still.' };
  if (t.cond >= 100) return { ok: false, reason: 'Der Tank ist voll in Ordnung.' };
  const p = phase(D, save);
  if (r.tankUpTo && p.index > r.tankUpTo) return { ok: false, reason: `Hilft nicht mehr: ${p.name}` };
  return { ok: true };
}
export function maintain(D, save, r) {
  const t = ensureTank(D, save), ok = canMaintain(D, save, r);
  if (!ok.ok) return { ...ok, gained: 0 };
  const before = t.cond;
  t.cond = clamp(t.cond + (r.tank || 0));
  return { ok: true, gained: t.cond - before };
}

// for the run: how AvA suffers (Cryo-Tank › Phasen: Akku −%, Glitches, Scheinwerfer flackert)
export function suffering(D, save) {
  if (!save?.tank) return { battery: 0, glitch: 0, flicker: 0, index: 1 };
  const p = phase(D, save);
  return { battery: p.battery ?? 0, glitch: p.glitch ?? 0, flicker: p.flicker ?? 0, index: p.index, name: p.name, dead: !!p.dead };
}

// a rough forecast for the status screen: hours left at today's pace (ignores maintenance)
export function hoursLeft(D, save, mods = {}) {
  const copy = { day: save.day, hour: save.hour, tank: { ...save.tank } };
  let h = 0;
  while (copy.tank.cond > 0 && h < 24 * 60) { copy.tank.cond -= rate(D, copy, mods); h++; if (h % 24 === 0) copy.day++; }
  return h;
}
